"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisGroupKey = exports.redisProfileKey = void 0;
const redisProfileKey = (userId) => {
    return `user:${userId}`;
};
exports.redisProfileKey = redisProfileKey;
const redisGroupKey = (userId) => {
    return `group:${userId}`;
};
exports.redisGroupKey = redisGroupKey;
