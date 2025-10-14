"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clerkClient = void 0;
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
exports.clerkClient = (0, clerk_sdk_node_1.Clerk)({ apiKey: process.env.CLERK_SECRET_KEY });
