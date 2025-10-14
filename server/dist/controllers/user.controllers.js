"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.joinGroup = exports.addToGroup = exports.createRoom = exports.getGroupData = exports.blockUser = exports.denyRequest = exports.acceptRequest = exports.addFriend = exports.getOrCreateUser = void 0;
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
        const key = (0, redisKey_1.redisProfileKey)(userId);
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
            friends: JSON.stringify(friends)
        });
        console.log("redis data set", redisData);
        await redis_1.default.expire(key, 36000);
        return res
            .status(200)
            .json({ message: "User synced", user, friends });
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
        return res
            .status(200)
            .json({ message: "Friend request accepted", friend: updatedRequest });
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
        return res
            .status(200)
            .json({ message: "Friend request denied", friend: updatedRequest });
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
        const cachedData = await redis_1.default.hGetAll(key);
        if (Object.keys(cachedData).length > 0) {
            const groups = JSON.parse(cachedData.groups);
            console.log("user groups fetched from Redis", groups);
            return res
                .status(200)
                .json({ message: "user groups fetched from Redis", groups });
        }
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        const redisData = await redis_1.default.hSet(key, { groups: JSON.stringify(groups) });
        await redis_1.default.expire(key, 3600);
        console.log("groups set to rediss", redisData);
        return res.status(200).json({ message: "user groups fetched", groups });
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
        const redisData = await redis_1.default.hSet(key, { groups: JSON.stringify(groups) });
        await redis_1.default.expire(key, 3600);
        console.log("updated groups set to rediss", redisData);
        res.status(200).json({ groups });
    }
    catch (error) {
        console.error("Error in blockUser:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.createRoom = createRoom;
const addToGroup = async (req, res) => {
    try {
        console.log("starting addToGroup");
        const { roomId, email } = req.body;
        const currentUser = await getCurrentUser(req);
        const room = await prisma_1.default.room.findUnique({
            where: { id: roomId },
        });
        if (!room)
            return res.status(404).json({ message: "Room not found" });
        console.log("room found");
        if (room.createdById !== currentUser.id)
            return res.status(403).json({ message: "You are not the group creator" });
        console.log("finding friend");
        const friend = await prisma_1.default.user.findUnique({ where: {
                email
            } });
        if (!friend) {
            return res.status(401).json({ message: "user not registered" });
        }
        console.log("friend found", friend);
        const existingMember = await prisma_1.default.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId: friend.id } },
        });
        if (existingMember)
            return res.status(400).json({ message: "User already in group" });
        await prisma_1.default.roomMember.create({
            data: {
                roomId,
                userId: friend.id,
            },
        });
        console.log("added to group");
        const key = (0, redisKey_1.redisGroupKey)(currentUser.id);
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
        const redisData = await redis_1.default.hSet(key, {
            groups: JSON.stringify(groups),
        });
        await redis_1.default.expire(key, 3600);
        console.log("updated groups set to rediss", redisData);
        res
            .status(200)
            .json({ message: "User added to group", groups });
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
            where: { clerkId: currentUser.id },
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
            data: {
                roomId: room.id,
                userId: user.id,
            },
        });
        const groups = await prisma_1.default.room.findMany({
            where: {
                members: { some: { userId: user.id } },
            },
            include: { members: { include: { user: true } } },
        });
        res.status(200).json({ message: "Joined group successfully", groups });
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
        const redisData = await redis_1.default.hSet(key, { user: JSON.stringify(updatedUser) });
        console.log("redis data set", redisData);
        await redis_1.default.expire(key, 36000);
        return res.status(200).json({
            message: "User profile updated successfully",
            user: exports.updateUser
        });
    }
    catch (error) {
        console.error("Error in updateUser:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.updateUser = updateUser;
