"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFriends = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getFriends = async (userId) => {
    const friendsData = await prisma_1.default.friends.findMany({
        where: {
            OR: [
                { requesterId: userId, status: "ACCEPTED" },
                { accepterId: userId, status: "ACCEPTED" },
            ],
        },
        include: {
            requester: true,
            accepter: true,
        },
    });
    const friends = await Promise.all(friendsData.map(async (f) => {
        const friend = f.accepterId === userId ? f.requester : f.accepter;
        const chats = await prisma_1.default.chat.findMany({
            where: {
                OR: [
                    { AND: [{ senderId: userId }, { receiverId: friend.id }] },
                    { AND: [{ senderId: friend.id }, { receiverId: userId }] },
                ],
            },
            orderBy: { createdAt: "asc" },
        });
        return {
            id: friend.id,
            name: friend.name,
            email: friend.email,
            lastActive: friend.lastActive,
            chats,
        };
    }));
    return friends;
};
exports.getFriends = getFriends;
