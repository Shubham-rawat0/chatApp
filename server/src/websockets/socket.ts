import prisma from "../lib/prisma";
import { io } from "../index";
import redis from "../redis/redis";
import { redisProfileKey, redisGroupKey } from "../redis/redisKey";
import { getFriends } from "../utils/getFriends";
import { getRooms } from "../utils/getGroups";

const socketGroups: Record<string, Set<string>> = {};
const socketUserMap: Record<string, string> = {};

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("register", async (userId: string) => {
    try {
      await redis.hSet("online_users", userId, socket.id);
      await prisma.user.update({
        where: { id: userId },
        data: { lastActive: new Date() },
      });
      socketUserMap[socket.id] = userId;
      console.log(`User ${userId} registered and marked active.`);
    } catch (err) {
 console.error("Error in register event:", err);
    }
  });

  socket.on("register-group", async (data:{userId: string, roomId: string}) => {
    try {
      const {userId,roomId}=data
      const key = `group_${roomId}_users`;
      const existing = await redis.hGet(key, "members");
      let members = existing ? JSON.parse(existing) : [];

      if (!members.includes(socket.id)) members.push(socket.id);
      await redis.hSet(key, { members: JSON.stringify(members) });

      if (!socketGroups[socket.id]) socketGroups[socket.id] = new Set();
      socketGroups[socket.id].add(roomId);
      socketUserMap[socket.id] = userId;

      console.log(`User ${userId} joined group ${roomId}`);
    } catch (err) {
      console.error("Error in register-group event:", err);
    }
  });

  socket.on(
    "private-message",
    async (data: { senderId: string; receiverId: string; message: string }) => {
      try {
        const { senderId, receiverId, message } = data;
        console.log("received private message from", senderId);

        const receiverSocketId = await redis.hGet("online_users", receiverId);

        const chat = await prisma.chat.create({
          data: { senderId, receiverId, message },
        });

        console.log("message saved in db", chat);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive-private-message", {
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
          prisma.user.findUnique({ where: { id: senderId } }),
          prisma.user.findUnique({ where: { id: receiverId } }),
        ]);

        const [senderFriends, receiverFriends] = await Promise.all([
          getFriends(senderId),
          getFriends(receiverId),
        ]);

        await redis.hSet(redisProfileKey(senderId), {
          user: JSON.stringify(sender),
          friends: JSON.stringify(senderFriends),
        });
        await redis.hSet(redisProfileKey(receiverId), {
          user: JSON.stringify(receiver),
          friends: JSON.stringify(receiverFriends),
        });
      } catch (err) {
        console.error("Error sending private message:", err);
        socket.emit("error", { message: "Failed to send private message" });
      }
    }
  );

  // 💬 GROUP MESSAGE
  socket.on(
    "group-message-sent",
    async (data: { userId: string; roomId: string; message: string }) => {
      try {
        const { userId, roomId, message } = data;
        console.log(`Group message from ${userId} in room ${roomId}`);

        // Save message to DB
        const chat = await prisma.chat.create({
          data: { senderId: userId, roomId, message },
        });

        console.log("group message saved in db", chat);
        const key = `group_${roomId}_users`;
        const members = await redis.hGet(key, "members");
        const memberSocketIds = members ? JSON.parse(members) : [];

        memberSocketIds.forEach((sockId: string) => {
          if(sockId!==socket.id){
          io.to(sockId).emit("group-message-received", {
            senderId: userId,
            roomId,
            message,
            createdAt: chat.createdAt,
          });}
        });

        
        const roomMembers = await prisma.roomMember.findMany({
          where: { roomId },
          select: { userId: true },
        });

        for (const m of roomMembers) {
          const key = redisGroupKey(m.userId);
          const groups = await getRooms(m.userId);
          await redis.set(key,  JSON.stringify(groups) );
          await redis.expire(key, 3600);
        }
      } catch (err) {
        console.error("Error sending group message:", err);
        socket.emit("error", { message: "Failed to send group message" });
      }
    }
  );

  socket.on("disconnect", async () => {
    try {
      console.log("user disconnected", socket.id);
      const userId = socketUserMap[socket.id];

      if (userId) {
        await redis.hDel("online_users", userId);
        console.log(`User ${userId} removed from online_users`);
      }

const groups = socketGroups[socket.id];
if (groups) {
  for (const roomId of groups) {
    const key = `group_${roomId}_users`;
    const members = await redis.hGet(key, "members");
    if (members) {
      const updated = JSON.parse(members).filter(
        (id: string) => id !== socket.id
      );
      await redis.hSet(key, "members", JSON.stringify(updated)); 
    }
    console.log(`Removed ${userId} from group ${roomId}`);
  }
  delete socketGroups[socket.id];
}
      delete socketUserMap[socket.id];
    } catch (err) {
      console.error("Error on disconnect:", err);
    }
  });
});