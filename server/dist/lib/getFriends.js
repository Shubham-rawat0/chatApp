"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFriends = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const getFriends = async (userId) => {
    const friends = await prisma_1.default.friends.findMany({
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
    return friends.map((f) => {
        const friend = f.accepterId === userId ? f.requester : f.accepter;
        return {
            id: friend.id,
            name: friend.name,
            email: friend.email,
            lastActive: friend.lastActive,
        };
    });
};
exports.getFriends = getFriends;
