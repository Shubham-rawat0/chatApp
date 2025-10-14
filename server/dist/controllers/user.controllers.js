"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.joinGroup = exports.addToGroup = exports.createRoom = exports.getGroupData = exports.blockUser = exports.denyRequest = exports.acceptRequest = exports.addFriend = exports.createOrUpdateUser = void 0;
const express_1 = require("@clerk/express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const rabbit_1 = require("../lib/rabbit");
const getFriends_1 = require("../lib/getFriends");
const getPrivateChat_1 = require("../lib/getPrivateChat");
const getGroups_1 = require("../lib/getGroups");
const getCurrentUser = async (req) => {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    console.log("tokent", token);
    const { userId } = (0, express_1.getAuth)(req);
    if (!userId)
        throw new Error("User not authenticated");
    const user = await prisma_1.default.user.findUnique({ where: { clerkId: userId } });
    if (!user)
        throw new Error("Current user not found");
    return user;
};
const createOrUpdateUser = async (req, res) => {
    var _a, _b;
    try {
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        console.log("tokent", token);
        const { userId } = (0, express_1.getAuth)(req);
        console.log("clerkId", userId);
        if (!userId)
            throw new Error("User not authenticated");
        const clerkUser = await express_1.clerkClient.users.getUser(userId);
        if (!clerkUser)
            throw new Error("User not found in Clerk");
        const email = ((_b = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)) === null || _b === void 0 ? void 0 : _b.emailAddress) || "";
        if (!email)
            throw new Error("User has no email in Clerk");
        const user = await prisma_1.default.user.upsert({
            where: { clerkId: userId },
            update: {
                firstName: clerkUser.firstName || "",
                lastName: clerkUser.lastName || "",
                email,
                lastActive: new Date(),
                name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
                    "Anonymous User",
            },
            create: {
                clerkId: userId,
                firstName: clerkUser.firstName || "",
                lastName: clerkUser.lastName || "",
                profileUrl: clerkUser.imageUrl ||
                    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAJQArwMBIgACEQEDEQH/xAAbAAEAAgIDAAAAAAAAAAAAAAAABgcEBQECA//EADkQAAICAQICBggEBAcAAAAAAAABAgMEBREGQRIhIjFRYRMyM0JxkbHBI4Gh0VNz4fAUJDVDUmJy/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAEhEf/aAAwDAQACEQMRAD8AtIAGmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPLKyaMSv0uVbGqHJze25rte1qvSqFslPImvw4fd+X1IDmZmRm5DvyrZWWPx7l8PAomt3FumVvaHp7fOEOr9djvj8VaXdJRlK2lvnZDq/TcgAB1bFNtd9cbKbIWQl3Sg90zuVfpuo5Om3elxp7b+tB+rJeDRYWkanTqmL6anqkvaQb64MDOABAAAAAAAAAAAAAAAAAPLJvhi49uRa9q6oucn5I9SPcbZDq0qFMX7a1J/BdYENz8y3Py7Mm99ub6l4LkvyMcAsQABQM/RNSlpefC/r9E+zbHxj/AH1mACUW0mmk4vdNbpo5NVwvkPJ0THlJ9qC9G9/J7fTY2pFAAAAAAAAAAAAAAAACKce+xwny6c/oiVkd44pdml1WJeztT+e6/YCDAAsQABQABKJ5wT/or/nS+xvzUcK0unQsfpLZz3n82zbkUAAAAAAAAAAAAAAAAMbUcWOdgX4s9vxINJvk+T+ZkgCp7qp0Wypti42Qe0l5nQnnEfD61HfJxWo5SXaT7rF8fEhGTj3Ytrryap1TXKa2+RYjyABQMjAxLM/MqxafXsfft6q5sYWFk51qrxaZ2Pm0uyl5vuRPOH9EhpNLlNqzJsXblyS8ESjaVVwqqhVWujCEVGK8EjuARQAAAAAAAAAAAAAAAAAADzuoqvg4XVQsj4SjuYOfrmn4Dcb71Kxf7dS6UjSZHGa7sbCe3jbP7IDc2cPaTZLd4UF/5bj9DmrQNJqe8cKtv/tvL6kZlxhqDfZpx4rzi39zmHGOen2qKJfDdAxNq64VRUKoKEV3RitkdiK4/GdTaWVhzj4yql0v0exvMDV8HUGljZEZT/4S7MvkyjOABAAAAAAAAAAAAAAADC1fU6dLxHdb2pN7V1r35fsB21HUMbTaPTZViin1RivWk/JEI1fiLM1BuEN8fH5Qg+t/F8zXZ+bfqGRK/Js6Un3Jd0V4JGOUp3cgAVAAAAABINH4nycRxrzOlk0d3Sb7cV5Pn+ZNcTKpzaI341kZ1vmuT8H5lVGdpOqX6Vk+loe8H7Stvqmv38yKs0GPg5lOfiwycZ7wny5xfNMyCAAAAAAAAAAAOtlkKq52WNKEE5Sb5Jd5WutalPVM2V0m1WuquD92P9eZJuNs904teFCXau7U9n7q/d/QhRQABUAAAAAAAAAABuOGdWemZqjZP/LWvo2J90Xyl/fIsMqQsHhLPeZpUYTlvbj7Vy3fW1yf2/IixugARQABAAAADhy6Kcn7q3KK44lyv8VreTL3a2q4/CP9dzWHMpuyTsl1yk3Jv4nAQABQAAAAAAAAAAA3/BeV6HVnT7t8Oj+a619zQGXpFro1bDmur8aCfwbSZBaAACgAIAAAHjlvbEva/hS+gBRVMfVRyAVkAAUAAAAAAAAAAA9MZ7ZVDX8WP1QARbD72cAEaAAQf//Z",
                name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
                    "Anonymous User",
                email,
                registrationDate: new Date(),
                lastActive: new Date(),
            },
        });
        console.log("user id", user.id);
        if (user.registrationDate.getTime() === user.lastActive.getTime()) {
            try {
                (0, rabbit_1.publishToQueue)("email", email, clerkUser.firstName || "User");
            }
            catch (err) {
                console.error("Error sending welcome email:", err);
            }
        }
        const friends = await (0, getFriends_1.getFriends)(user.id);
        const privateChats = await Promise.all(friends.map((f) => (0, getPrivateChat_1.getPrivateChat)(f.id)));
        return res.status(200).json({
            message: "User synced successfully",
            user,
            friends,
            privateChats,
            details: "User data has been synchronized with Clerk",
        });
    }
    catch (error) {
        const err = error;
        console.error("Error in createOrUpdateUser:", err);
        return res.status(err.statusCode || 500).json({
            message: err.message || "Server error",
        });
    }
};
exports.createOrUpdateUser = createOrUpdateUser;
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
        console.log("inside getGroupdata function");
        const currentUser = await getCurrentUser(req);
        console.log("user found");
        const groups = await ((0, getGroups_1.getRooms)(currentUser.id));
        return res.status(200).json({ message: "user groups fetched", groups });
    }
    catch (error) {
        console.error("Error in blockUser:", error);
        return res.status(500).json({ message: "Server error" });
    }
};
exports.getGroupData = getGroupData;
const createRoom = async (req, res) => {
    try {
        const { roomName } = req.body;
        const currentUser = await getCurrentUser(req);
        const newGroup = await prisma_1.default.room.create({
            data: {
                createdById: currentUser === null || currentUser === void 0 ? void 0 : currentUser.id,
                roomName: roomName,
            },
        });
        const groups = await (0, getGroups_1.getRooms)(currentUser.id);
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
        const { roomId, userId } = req.body;
        const currentUser = await getCurrentUser(req);
        const room = await prisma_1.default.room.findUnique({
            where: { id: roomId },
        });
        if (!room)
            return res.status(404).json({ message: "Room not found" });
        if (room.createdById !== currentUser.id)
            return res.status(403).json({ message: "You are not the group creator" });
        const existingMember = await prisma_1.default.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } },
        });
        if (existingMember)
            return res.status(400).json({ message: "User already in group" });
        await prisma_1.default.roomMember.create({
            data: {
                roomId,
                userId,
            },
        });
        const updatedGroup = await prisma_1.default.room.findUnique({
            where: { id: roomId },
            include: { members: { include: { user: true } } },
        });
        res
            .status(200)
            .json({ message: "User added to group", group: updatedGroup });
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
