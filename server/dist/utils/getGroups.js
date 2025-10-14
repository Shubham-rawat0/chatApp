"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRooms = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getRooms = async (userId) => {
    console.log("running getRooms");
    const rooms = await prisma_1.default.room.findMany({
        where: {
            members: {
                some: { userId },
            },
        },
        include: {
            members: {
                include: { user: true },
            },
            chats: {
                include: {
                    sender: true,
                    receiver: true,
                },
                orderBy: {
                    createdAt: "asc",
                },
            },
        },
    });
    return rooms.map((room) => ({
        room: {
            id: room.id,
            createdById: room.createdById,
            roomName: room.roomName,
            createdAt: room.createdAt,
            chats: room.chats,
        },
        members: room.members.map((m) => m.user),
    }));
};
exports.getRooms = getRooms;
