"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../lib/prisma"));
const index_1 = require("../index");
const redis_1 = __importDefault(require("../redis/redis"));
const redisKey_1 = require("../redis/redisKey");
const getFriends_1 = require("../utils/getFriends");
const getGroups_1 = require("../utils/getGroups");
const socketGroups = {};
const socketUserMap = {};
index_1.io.on("connection", (socket) => {
    console.log("socket connected", socket.id);
    socket.on("register", async (userId) => {
        try {
            await redis_1.default.hSet("online_users", userId, socket.id);
            await prisma_1.default.user.update({
                where: { id: userId },
                data: { lastActive: new Date() },
            });
            socketUserMap[socket.id] = userId;
            console.log(`User ${userId} registered and marked active.`);
        }
        catch (err) {
            console.error("Error in register event:", err);
        }
    });
    socket.on("register-group", async (data) => {
        try {
            const { userId, roomId } = data;
            const key = `group_${roomId}_users`;
            const existing = await redis_1.default.hGet(key, "members");
            let members = existing ? JSON.parse(existing) : [];
            if (!members.includes(socket.id))
                members.push(socket.id);
            await redis_1.default.hSet(key, { members: JSON.stringify(members) });
            if (!socketGroups[socket.id])
                socketGroups[socket.id] = new Set();
            socketGroups[socket.id].add(roomId);
            socketUserMap[socket.id] = userId;
            console.log(`User ${userId} joined group ${roomId}`);
        }
        catch (err) {
            console.error("Error in register-group event:", err);
        }
    });
    socket.on("private-message", async (data) => {
        try {
            const { senderId, receiverId, message } = data;
            console.log("received private message from", senderId);
            const receiverSocketId = await redis_1.default.hGet("online_users", receiverId);
            const chat = await prisma_1.default.chat.create({
                data: { senderId, receiverId, message },
            });
            console.log("message saved in db", chat);
            if (receiverSocketId) {
                index_1.io.to(receiverSocketId).emit("receive-private-message", {
                    senderId,
                    receiverId,
                    message,
                    createdAt: chat.createdAt,
                });
                console.log(`sent message to receiver ${receiverId}`);
            }
            socket.emit("private-message-sent", {
                success: true,
                receiverOnline: Boolean(receiverSocketId),
            });
            // Update Redis cache for both sender and receiver
            const [sender, receiver] = await Promise.all([
                prisma_1.default.user.findUnique({ where: { id: senderId } }),
                prisma_1.default.user.findUnique({ where: { id: receiverId } }),
            ]);
            const [senderFriends, receiverFriends] = await Promise.all([
                (0, getFriends_1.getFriends)(senderId),
                (0, getFriends_1.getFriends)(receiverId),
            ]);
            await redis_1.default.hSet((0, redisKey_1.redisProfileKey)(senderId), {
                user: JSON.stringify(sender),
                friends: JSON.stringify(senderFriends),
            });
            await redis_1.default.hSet((0, redisKey_1.redisProfileKey)(receiverId), {
                user: JSON.stringify(receiver),
                friends: JSON.stringify(receiverFriends),
            });
        }
        catch (err) {
            console.error("Error sending private message:", err);
            socket.emit("error", { message: "Failed to send private message" });
        }
    });
    // 💬 GROUP MESSAGE
    socket.on("group-message-sent", async (data) => {
        try {
            const { userId, roomId, message } = data;
            console.log(`Group message from ${userId} in room ${roomId}`);
            // Save message to DB
            const chat = await prisma_1.default.chat.create({
                data: { senderId: userId, roomId, message },
            });
            console.log("group message saved in db", chat);
            const key = `group_${roomId}_users`;
            const members = await redis_1.default.hGet(key, "members");
            const memberSocketIds = members ? JSON.parse(members) : [];
            memberSocketIds.forEach((sockId) => {
                if (sockId !== socket.id) {
                    index_1.io.to(sockId).emit("group-message-received", {
                        senderId: userId,
                        roomId,
                        message,
                        createdAt: chat.createdAt,
                    });
                }
            });
            const roomMembers = await prisma_1.default.roomMember.findMany({
                where: { roomId },
                select: { userId: true },
            });
            for (const m of roomMembers) {
                const key = (0, redisKey_1.redisGroupKey)(m.userId);
                const groups = await (0, getGroups_1.getRooms)(m.userId);
                await redis_1.default.set(key, JSON.stringify(groups));
                await redis_1.default.expire(key, 3600);
            }
        }
        catch (err) {
            console.error("Error sending group message:", err);
            socket.emit("error", { message: "Failed to send group message" });
        }
    });
    socket.on("disconnect", async () => {
        try {
            console.log("user disconnected", socket.id);
            const userId = socketUserMap[socket.id];
            if (userId) {
                await redis_1.default.hDel("online_users", userId);
                console.log(`User ${userId} removed from online_users`);
            }
            const groups = socketGroups[socket.id];
            if (groups) {
                for (const roomId of groups) {
                    const key = `group_${roomId}_users`;
                    const members = await redis_1.default.hGet(key, "members");
                    if (members) {
                        const updated = JSON.parse(members).filter((id) => id !== socket.id);
                        await redis_1.default.hSet(key, "members", JSON.stringify(updated));
                    }
                    console.log(`Removed ${userId} from group ${roomId}`);
                }
                delete socketGroups[socket.id];
            }
            delete socketUserMap[socket.id];
        }
        catch (err) {
            console.error("Error on disconnect:", err);
        }
    });
});
