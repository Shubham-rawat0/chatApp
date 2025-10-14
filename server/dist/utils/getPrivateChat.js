"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrivateChat = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getPrivateChat = async (id) => {
    const chats = await prisma_1.default.chat.findMany({
        where: {
            OR: [{ senderId: id }, { receiverId: id }],
        },
        orderBy: {
            createdAt: "asc",
        },
    });
    return chats;
};
exports.getPrivateChat = getPrivateChat;
