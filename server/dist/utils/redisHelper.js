"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRedisSet = exports.safeRedisGet = void 0;
const redis_1 = __importDefault(require("../redis/redis"));
const safeRedisGet = async (key) => {
    try {
        const type = await redis_1.default.type(key);
        if (type !== "hash" && type !== "none") {
            await redis_1.default.del(key);
        }
        return await redis_1.default.hGetAll(key);
    }
    catch (error) {
        console.error("Redis get error:", error);
        return {};
    }
};
exports.safeRedisGet = safeRedisGet;
const safeRedisSet = async (key, field, value, expireSeconds = 3600) => {
    try {
        const type = await redis_1.default.type(key);
        if (type !== "hash" && type !== "none") {
            await redis_1.default.del(key);
        }
        await redis_1.default.hSet(key, field, value);
        await redis_1.default.expire(key, expireSeconds);
    }
    catch (error) {
        console.error("Redis set error:", error);
    }
};
exports.safeRedisSet = safeRedisSet;
