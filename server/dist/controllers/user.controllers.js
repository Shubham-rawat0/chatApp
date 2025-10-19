"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userFriends = exports.getUserId = exports.updateUser = exports.joinGroup = exports.addToGroup = exports.createRoom = exports.getGroupData = exports.blockUser = exports.denyRequest = exports.acceptRequest = exports.addFriend = exports.getOrCreateUser = void 0;
const express_1 = require("@clerk/express");
const clerkClient_1 = require("../utils/clerkClient");
const prisma_1 = __importDefault(require("../lib/prisma"));
const rabbit_1 = require("../lib/rabbit");
const getFriends_1 = require("../utils/getFriends");
const getGroups_1 = require("../utils/getGroups");
const redis_1 = __importDefault(require("../redis/redis"));
const redisKey_1 = require("../redis/redisKey");
const getCurrentUser = async (req) => {
    var _a;
    try {
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        if (!token) {
            console.log("no token");
        }
        else {
            console.log(" token", token);
        }
        const { userId } = (0, express_1.getAuth)(req);
        console.log("user id", userId);
        if (!userId) {
            const error = new Error("User not authenticated");
            error.statusCode = 401;
            error.code = "AUTH_REQUIRED";
            throw error;
        }
        const user = await prisma_1.default.user.findUnique({ where: { clerkId: userId } });
        if (!user) {
            const error = new Error("User not found in database");
            error.statusCode = 404;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        return user;
    }
    catch (error) {
        if (error.statusCode) {
            throw error;
        }
        const err = new Error("Authentication failed");
        err.statusCode = 401;
        err.code = "AUTH_FAILED";
        throw err;
    }
};
const getOrCreateUser = async (req, res) => {
    var _a, _b;
    try {
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        if (!token) {
            console.log("no token");
        }
        else {
            console.log(" token", token);
        }
        const { userId } = (0, express_1.getAuth)(req);
        if (!userId)
            throw new Error("User not authenticated");
        const currentUser = await getCurrentUser(req);
        const key = (0, redisKey_1.redisProfileKey)(currentUser.id);
        const cachedData = await redis_1.default.hGetAll(key);
        if (Object.keys(cachedData).length > 0) {
            const user = JSON.parse(cachedData.user);
            const friends = JSON.parse(cachedData.friends);
            console.log("fetching from redis", cachedData);
            return res.status(200).json({
                friends,
                user,
                message: "data fetched from Redis",
            });
        }
        let user = await prisma_1.default.user.findUnique({ where: { clerkId: userId } });
        if (!user) {
            const clerkUser = await clerkClient_1.clerkClient.users.getUser(userId);
            if (!clerkUser)
                throw new Error("User not found in Clerk");
            const email = ((_b = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)) === null || _b === void 0 ? void 0 : _b.emailAddress) || "";
            user = await prisma_1.default.user.create({
                data: {
                    clerkId: userId,
                    firstName: clerkUser.firstName || "",
                    lastName: clerkUser.lastName || "",
                    email,
                    name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
                        "Anonymous User",
                    profileUrl: clerkUser.imageUrl ||
                        "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                    registrationDate: new Date(),
                    lastActive: new Date(),
                },
            });
            (0, rabbit_1.publishToQueue)("email", email, clerkUser.firstName || "User");
        }
        const friends = await (0, getFriends_1.getFriends)(user.id);
        const redisData = await redis_1.default.hSet(key, {
            user: JSON.stringify(user),
            friends: JSON.stringify(friends),
        });
        console.log("redis data set", redisData);
        await redis_1.default.expire(key, 36000);
        return res.status(200).json({ message: "User synced", user, friends });
    }
    catch (error) {
        const err = error;
        console.error("Error in createOrUpdateUser:", err);
        return res
            .status(err.statusCode || 500)
            .json({ message: err.message || "Server error" });
    }
};
exports.getOrCreateUser = getOrCreateUser;
const addFriend = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ message: "Email is required" });
        const receiver = await prisma_1.default.user.findUnique({ where: { email } });
        if (!receiver)
            return res
                .status(404)
                .json({ message: "User not registered on chat app" });
        if (receiver.id === currentUser.id)
            return res
                .status(400)
                .json({ message: "Cannot add yourself as a friend" });
        const existingFriendship = await prisma_1.default.friends.findFirst({
            where: {
                OR: [
                    { requesterId: currentUser.id, accepterId: receiver.id },
                    { requesterId: receiver.id, accepterId: currentUser.id },
                ],
            },
        });
        if (existingFriendship)
            return res
                .status(400)
                .json({ message: "Friend request or friendship already exists" });
        const friendRequest = await prisma_1.default.friends.create({
            data: {
                requesterId: currentUser.id,
                accepterId: receiver.id,
                status: "PENDING",
            },
        });
        return res.status(201).json({
            message: "Friend request sent",
            friendRequest,
        });
    }
    catch (error) {
        console.error("Error in addFriend:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.addFriend = addFriend;
const acceptRequest = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const { friendrequestId } = req.body;
        if (!friendrequestId)
            return res
                .status(400)
                .json({ message: "Please provide friend request ID" });
        const friendRequest = await prisma_1.default.friends.findUnique({
            where: { id: friendrequestId },
        });
        if (!friendRequest)
            return res.status(404).json({ message: "Friend request not found" });
        if (friendRequest.accepterId !== currentUser.id)
            return res
                .status(403)
                .json({ message: "You are not authorized to accept this request" });
        const updatedRequest = await prisma_1.default.friends.update({
            where: { id: friendrequestId },
            data: { status: "ACCEPTED" },
        });
        const friendsAccepter = await (0, getFriends_1.getFriends)(currentUser.id);
        const accepterKey = (0, redisKey_1.redisProfileKey)(currentUser.id);
        await redis_1.default.hSet(accepterKey, {
            user: JSON.stringify(currentUser),
            friends: JSON.stringify(friendsAccepter),
        });
        await redis_1.default.expire(accepterKey, 36000);
        const requester = await prisma_1.default.user.findUnique({
            where: { id: friendRequest.requesterId },
        });
        if (requester) {
            const friendsRequester = await (0, getFriends_1.getFriends)(requester.id);
            const requesterKey = (0, redisKey_1.redisProfileKey)(requester.id);
            await redis_1.default.hSet(requesterKey, {
                user: JSON.stringify(requester),
                friends: JSON.stringify(friendsRequester),
            });
            await redis_1.default.expire(requesterKey, 36000);
        }
        return res.status(200).json({
            message: "Friend request accepted",
            user: currentUser,
            friends: friendsAccepter,
        });
    }
    catch (error) {
        console.error("Error in acceptRequest:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.acceptRequest = acceptRequest;
const denyRequest = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const { friendrequestId } = req.body;
        if (!friendrequestId)
            return res
                .status(400)
                .json({ message: "Please provide friend request ID" });
        const friendRequest = await prisma_1.default.friends.findUnique({
            where: { id: friendrequestId },
        });
        if (!friendRequest)
            return res.status(404).json({ message: "Friend request not found" });
        if (friendRequest.accepterId !== currentUser.id)
            return res
                .status(403)
                .json({ message: "You are not authorized to deny this request" });
        const updatedRequest = await prisma_1.default.friends.update({
            where: { id: friendrequestId },
            data: { status: "REJECTED" },
        });
        return res.status(200).json({
            message: "Friend request denied",
            user: currentUser,
            friends: updatedRequest,
        });
    }
    catch (error) {
        console.error("Error in denyRequest:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.denyRequest = denyRequest;
const blockUser = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const { userToBlockId } = req.body;
        if (!userToBlockId)
            return res
                .status(400)
                .json({ message: "Please provide user ID to block" });
        if (currentUser.id === userToBlockId)
            return res.status(400).json({ message: "Cannot block yourself" });
        const existingFriend = await prisma_1.default.friends.findFirst({
            where: {
                OR: [
                    { requesterId: currentUser.id, accepterId: userToBlockId },
                    { requesterId: userToBlockId, accepterId: currentUser.id },
                ],
            },
        });
        let updatedOrCreated;
        if (existingFriend) {
            updatedOrCreated = await prisma_1.default.friends.update({
                where: { id: existingFriend.id },
                data: { status: "BLOCKED" },
            });
        }
        else {
            updatedOrCreated = await prisma_1.default.friends.create({
                data: {
                    requesterId: currentUser.id,
                    accepterId: userToBlockId,
                    status: "BLOCKED",
                },
            });
        }
        return res
            .status(200)
            .json({ message: "User blocked successfully", friend: updatedOrCreated });
    }
    catch (error) {
        console.error("Error in blockUser:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.blockUser = blockUser;
const getGroupData = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const key = (0, redisKey_1.redisGroupKey)(currentUser.id);
        try {
            const cachedData = await redis_1.default.get(key);
            if (cachedData) {
                const groups = JSON.parse(cachedData);
                console.log("Groups fetched from Redis for current user", currentUser.name);
                return res.status(200).json({
                    message: "Groups fetched from Redis",
                    groups,
                });
            }
        }
        catch (err) {
            console.log("Cache miss or parse error");
        }
        console.log("Fetching fresh groups for user", currentUser.name);
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        try {
            await redis_1.default.set(key, JSON.stringify(groups));
            await redis_1.default.expire(key, 3600);
        }
        catch (err) {
            console.log("Error setting cache:", err);
        }
        return res.status(200).json({
            message: "Groups fetched from database",
            groups,
        });
    }
    catch (error) {
        console.error("Error in getGroupData:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.getGroupData = getGroupData;
const createRoom = async (req, res) => {
    try {
        const { roomName } = req.body;
        const currentUser = await getCurrentUser(req);
        const key = (0, redisKey_1.redisGroupKey)(currentUser.id);
        const newRoom = await prisma_1.default.room.create({
            data: {
                createdById: currentUser === null || currentUser === void 0 ? void 0 : currentUser.id,
                roomName: roomName,
                members: {
                    create: {
                        userId: currentUser.id,
                    },
                },
            },
        });
        console.log("new room created", newRoom);
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        // Clear existing cache and set new data
        await redis_1.default.del(key);
        await redis_1.default.set(key, JSON.stringify(groups));
        await redis_1.default.expire(key, 3600);
        console.log("Updated groups cache for user", currentUser.id);
        res.status(200).json({ groups });
    }
    catch (error) {
        console.error("Error in createRoom:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.createRoom = createRoom;
const addToGroup = async (req, res) => {
    try {
        console.log("starting addToGroup");
        const { roomId, email } = req.body;
        const currentUser = await getCurrentUser(req);
        const room = await prisma_1.default.room.findUnique({ where: { id: roomId } });
        if (!room)
            return res.status(404).json({ message: "Room not found" });
        console.log("room found");
        if (room.createdById !== currentUser.id)
            return res.status(403).json({ message: "You are not the group creator" });
        console.log("finding friend");
        const friend = await prisma_1.default.user.findUnique({ where: { email } });
        if (!friend)
            return res.status(401).json({ message: "User not registered" });
        console.log("friend found", friend);
        const existingMember = await prisma_1.default.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId: friend.id } },
        });
        if (existingMember)
            return res.status(400).json({ message: "User already in group" });
        await prisma_1.default.roomMember.create({
            data: { roomId, userId: friend.id },
        });
        console.log("added to group");
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        const allMembers = await prisma_1.default.roomMember.findMany({
            where: { roomId },
            select: { userId: true },
        });
        for (const member of allMembers) {
            const key = (0, redisKey_1.redisGroupKey)(member.userId);
            await redis_1.default.hSet(key, { groups: JSON.stringify(groups) });
            await redis_1.default.expire(key, 3600);
        }
        console.log("updated groups set to redis");
        res.status(200).json({ message: "User added to group", groups });
    }
    catch (error) {
        console.error("Error in addToGroup:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.addToGroup = addToGroup;
const joinGroup = async (req, res) => {
    try {
        const { roomName, roomId } = req.body;
        const currentUser = await getCurrentUser(req);
        const user = await prisma_1.default.user.findUnique({
            where: { id: currentUser.id },
        });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const room = roomId
            ? await prisma_1.default.room.findUnique({ where: { id: roomId } })
            : await prisma_1.default.room.findFirst({ where: { roomName } });
        if (!room)
            return res.status(404).json({ message: "Group not found" });
        const existing = await prisma_1.default.roomMember.findUnique({
            where: { roomId_userId: { roomId: room.id, userId: user.id } },
        });
        if (existing)
            return res.status(400).json({ message: "You are already in this group" });
        await prisma_1.default.roomMember.create({
            data: { roomId: room.id, userId: user.id },
        });
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        const allMembers = await prisma_1.default.roomMember.findMany({
            where: { roomId: room.id },
            select: { userId: true },
        });
        for (const member of allMembers) {
            const key = (0, redisKey_1.redisGroupKey)(member.userId);
            await redis_1.default.hSet(key, { groups: JSON.stringify(groups) });
            await redis_1.default.expire(key, 3600);
        }
        console.log("updated groups set to redis");
        res.status(200).json({ message: "User added to group", groups });
    }
    catch (error) {
        console.error("Error in joinGroup:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.joinGroup = joinGroup;
const updateUser = async (req, res) => {
    try {
        const { userId } = (0, express_1.getAuth)(req);
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const { firstName, lastName, name, Bio } = req.body;
        if (!firstName && !lastName && !name && !Bio) {
            return res.status(400).json({ message: "No fields to update" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkId: userId },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                firstName: firstName !== null && firstName !== void 0 ? firstName : user.firstName,
                lastName: lastName !== null && lastName !== void 0 ? lastName : user.lastName,
                name: name !== null && name !== void 0 ? name : `${firstName || user.firstName} ${lastName || user.lastName}`.trim(),
                Bio: Bio !== null && Bio !== void 0 ? Bio : user.Bio,
                lastActive: new Date(),
            },
        });
        const key = (0, redisKey_1.redisProfileKey)(userId);
        const redisData = await redis_1.default.hSet(key, {
            user: JSON.stringify(updatedUser),
        });
        console.log("redis data set", redisData);
        await redis_1.default.expire(key, 36000);
        return res.status(200).json({
            message: "User profile updated successfully",
            user: updatedUser,
        });
    }
    catch (error) {
        console.error("Error in updateUser:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.updateUser = updateUser;
const getUserId = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        res.status(200).json({ currentUser });
    }
    catch (error) {
        console.log(error);
    }
};
exports.getUserId = getUserId;
const userFriends = async (req, res) => {
    try {
        const currentUser = await getCurrentUser(req);
        const friends = await prisma_1.default.friends.findMany({
            where: {
                OR: [
                    { accepterId: currentUser.id, status: "ACCEPTED" },
                    { requesterId: currentUser.id, status: "ACCEPTED" },
                ],
            },
            include: {
                accepter: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profileUrl: true,
                        clerkId: true,
                    },
                },
                requester: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profileUrl: true,
                        clerkId: true,
                    },
                },
            },
        });
        const friendsOfUser = friends.map((f) => {
            const friend = f.accepterId === currentUser.id ? f.requester : f.accepter;
            return {
                id: friend.id,
                name: friend.name,
                email: friend.email,
                profileUrl: friend.profileUrl,
                username: friend.clerkId,
            };
        });
        return res.status(200).json({ friends: friendsOfUser });
    }
    catch (error) {
        console.error("Error in userFriends:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.userFriends = userFriends;
