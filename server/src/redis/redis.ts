import { createClient } from "redis";
const redis=createClient({url:process.env.REDIS_URL})

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

redis.on('reconnecting', () => {
  console.log('Redis Client Reconnecting');
});
(async () => {
  try {
    await redis.connect();
    console.log("Connected to Redis successfully");
  } catch (error) {
    console.error("Error connecting to Redis:", error);
  }
})();

export default redis;
