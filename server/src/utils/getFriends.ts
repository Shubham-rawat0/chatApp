import prisma from "../lib/prisma";

export const getFriends = async (userId: string) => {
  const friendsData = await prisma.friends.findMany({
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

  const friends = await Promise.all(
    friendsData.map(async (f) => {
      const friend = f.accepterId === userId ? f.requester : f.accepter;
      const chats = await prisma.chat.findMany({
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
    })
  );

  return friends;
};
