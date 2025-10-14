import prisma from "./prisma";

export const getPrivateChat=async(id:string)=>{
    const chats = await prisma.chat.findMany({
      where: {
        OR: [{ senderId: id }, { receiverId: id }],
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return chats
}