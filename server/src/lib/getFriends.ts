import prisma from "./prisma";
export const getFriends = async (userId: string) => {
  const friends = await prisma.friends.findMany({
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
