import { Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import prisma from "../lib/prisma";
import { publishToQueue } from "../lib/rabbit";
import { getFriends } from "../lib/getFriends";
import { getPrivateChat } from "../lib/getPrivateChat";
import { getRooms } from "../lib/getGroups";
import redis from "../redis/redis";
import {redisGroupKey,redisProfileKey} from "../redis/redisKey"

interface AuthError extends Error {
  code?: string;
  statusCode?: number;
}

const getCurrentUser = async (req: Request) => {
  const token=req.headers.authorization?.split(" ")[1]
  console.log("tokent",token)
  const { userId } = getAuth(req);
  if (!userId) throw new Error("User not authenticated");
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) throw new Error("Current user not found");
  return user;
};

export const getOrCreateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) throw new Error("User not authenticated");

    const key = redisProfileKey(userId);
    const cachedData = await redis.hGetAll(key);

    if (Object.keys(cachedData).length > 0) {
      const user = JSON.parse(cachedData.user);
      const friends = JSON.parse(cachedData.friends);
      const privateChats = JSON.parse(cachedData.privateChats);
      return res
        .status(200)
        .json({
          friends,
          user,
          privateChats,
          message: "data fetched from Redis",
        });
    }

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      if (!clerkUser) throw new Error("User not found in Clerk");

      const email =
        clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId
        )?.emailAddress || "";

      user = await prisma.user.create({
        data: {
          clerkId: userId,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
          email,
          name:
            `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
            "Anonymous User",
          profileUrl:
            clerkUser.imageUrl ||
            "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
          registrationDate: new Date(),
          lastActive: new Date(),
        },
      });

      publishToQueue("email", email, clerkUser.firstName || "User");
    }

    const friends = await getFriends(user.id);
    const privateChats = await Promise.all(
      friends.map((f) => getPrivateChat(f.id))
    );

    await redis.hSet(key, {
      user: JSON.stringify(user),
      friends: JSON.stringify(friends),
      privateChats: JSON.stringify(privateChats),
    });
    await redis.expire(key, 36000);

    return res
      .status(200)
      .json({ message: "User synced", user, friends, privateChats });
  }
  catch (error) {
     const err = error as AuthError;
      console.error("Error in createOrUpdateUser:", err);
       return res.status(err.statusCode || 500).json({ message: err.message || "Server error", });
       }
       }

export const addFriend = async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req);
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const receiver = await prisma.user.findUnique({ where: { email } });
    if (!receiver)
      return res
        .status(404)
        .json({ message: "User not registered on chat app" });

    if (receiver.id === currentUser.id)
      return res
        .status(400)
        .json({ message: "Cannot add yourself as a friend" });

    const existingFriendship = await prisma.friends.findFirst({
      where: {
        OR: [
          { requesterId: currentUser.id, accepterId: receiver.id },
          { requesterId: receiver.id, accepterId: currentUser.id },
        ],
      },
    });

    if (existingFriendship)
      return res
        .status(400)
        .json({ message: "Friend request or friendship already exists" });

    const friendRequest = await prisma.friends.create({
      data: {
        requesterId: currentUser.id,
        accepterId: receiver.id,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      message: "Friend request sent",
      friendRequest,
    });
  } catch (error) {
    console.error("Error in addFriend:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const acceptRequest = async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req);
    const { friendrequestId } = req.body;
    if (!friendrequestId)
      return res
        .status(400)
        .json({ message: "Please provide friend request ID" });

    const friendRequest = await prisma.friends.findUnique({
      where: { id: friendrequestId },
    });

    if (!friendRequest)
      return res.status(404).json({ message: "Friend request not found" });

    if (friendRequest.accepterId !== currentUser.id)
      return res
        .status(403)
        .json({ message: "You are not authorized to accept this request" });

    const updatedRequest = await prisma.friends.update({
      where: { id: friendrequestId },
      data: { status: "ACCEPTED" },
    });

    return res
      .status(200)
      .json({ message: "Friend request accepted", friend: updatedRequest });
  } catch (error) {
    console.error("Error in acceptRequest:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const denyRequest = async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req);
    const { friendrequestId } = req.body;
    if (!friendrequestId)
      return res
        .status(400)
        .json({ message: "Please provide friend request ID" });

    const friendRequest = await prisma.friends.findUnique({
      where: { id: friendrequestId },
    });

    if (!friendRequest)
      return res.status(404).json({ message: "Friend request not found" });
    if (friendRequest.accepterId !== currentUser.id)
      return res
        .status(403)
        .json({ message: "You are not authorized to deny this request" });

    const updatedRequest = await prisma.friends.update({
      where: { id: friendrequestId },
      data: { status: "REJECTED" },
    });

    return res
      .status(200)
      .json({ message: "Friend request denied", friend: updatedRequest });
  } catch (error) {
    console.error("Error in denyRequest:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const blockUser = async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req);
    const { userToBlockId } = req.body;
    if (!userToBlockId)
      return res
        .status(400)
        .json({ message: "Please provide user ID to block" });
  
    if (currentUser.id === userToBlockId)
      return res.status(400).json({ message: "Cannot block yourself" });

    const existingFriend = await prisma.friends.findFirst({
      where: {
        OR: [
          { requesterId: currentUser.id, accepterId: userToBlockId },
          { requesterId: userToBlockId, accepterId: currentUser.id },
        ],
      },
    });

    let updatedOrCreated;
    if (existingFriend) {
      updatedOrCreated = await prisma.friends.update({
        where: { id: existingFriend.id },
        data: { status: "BLOCKED" },
      });
    } else {
      updatedOrCreated = await prisma.friends.create({
        data: {
          requesterId: currentUser.id,
          accepterId: userToBlockId,
          status: "BLOCKED",
        },
      });
    }

    return res
      .status(200)
      .json({ message: "User blocked successfully", friend: updatedOrCreated });
  } catch (error) {
    console.error("Error in blockUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getGroupData=async(req:Request,res:Response)=>{
   try {
     console.log("inside getGroupdata function");
     const currentUser = await getCurrentUser(req);
     
     console.log("user found")
     const groups=await (getRooms(currentUser.id))
    
     return res.status(200).json({message:"user groups fetched",groups})
   } catch (error) {
    console.error("Error in blockUser:", error);
    return res.status(500).json({ message: "Server error" });
   }
}

export const createRoom=async(req:Request,res:Response)=>{
  try {
    const {roomName}=req.body
    const currentUser = await getCurrentUser(req);

    const newGroup = await prisma.room.create({
      data: {
        createdById: currentUser?.id,
        roomName: roomName,
      },
    });
    const groups = await getRooms(currentUser.id);
    res.status(200).json({groups})
  } catch (error) {
      console.error("Error in blockUser:", error);
      return res.status(500).json({ message: "Server error" });
  }
}


export const addToGroup = async (req: Request, res: Response) => {
  try {
    const { roomId, userId } = req.body;
    const currentUser = await getCurrentUser(req);

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.createdById !== currentUser.id)
      return res.status(403).json({ message: "You are not the group creator" });

    const existingMember = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (existingMember)
      return res.status(400).json({ message: "User already in group" });

    await prisma.roomMember.create({
      data: {
        roomId,
        userId,
      },
    });

    const updatedGroup = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: { include: { user: true } } },
    });

    res
      .status(200)
      .json({ message: "User added to group", group: updatedGroup });
  } catch (error) {
    console.error("Error in addToGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const joinGroup = async (req: Request, res: Response) => {
  try {
    const { roomName, roomId } = req.body;
    const currentUser = await getCurrentUser(req);

    const user = await prisma.user.findUnique({
      where: { clerkId: currentUser.id },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    const room = roomId
      ? await prisma.room.findUnique({ where: { id: roomId } })
      : await prisma.room.findFirst({ where: { roomName } });

    if (!room) return res.status(404).json({ message: "Group not found" });

    const existing = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    if (existing)
      return res.status(400).json({ message: "You are already in this group" });

    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
      },
    });

    const groups = await prisma.room.findMany({
      where: {
        members: { some: { userId: user.id } },
      },
      include: { members: { include: { user: true } } },
    });

    res.status(200).json({ message: "Joined group successfully", groups });
  } catch (error) {
    console.error("Error in joinGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const { firstName, lastName, name, Bio } = req.body;

    if (!firstName && !lastName && !name && !Bio) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: firstName ?? user.firstName,
        lastName: lastName ?? user.lastName,
        name:
          name ??
          `${firstName || user.firstName} ${lastName || user.lastName}`.trim(),
        Bio: Bio ?? user.Bio,
        lastActive: new Date(),
      },
    });

    return res.status(200).json({
      message: "User profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error in updateUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
