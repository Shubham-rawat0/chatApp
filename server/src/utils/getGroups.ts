import prisma from "../lib/prisma";

export const getRooms = async (userId: string) => {
  console.log("running getRooms")
  const rooms = await prisma.room.findMany({
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
      roomName:room.roomName,
      createdAt: room.createdAt,
      chats: room.chats, 
    },
    members: room.members.map((m) => m.user), 
  }));
};
