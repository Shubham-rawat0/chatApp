import { Clerk } from "@clerk/clerk-sdk-node";

export const clerkClient = Clerk({ apiKey: process.env.CLERK_SECRET_KEY });