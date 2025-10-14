import { createClient } from "redis";
const redis=createClient({url:process.env.REDIS_URL})

redis.on("error", (err) => console.error("Redis error:", err));

(async () => {
  try {
    await redis.connect();
    console.log("Connected to Redis successfully");
  } catch (error) {
    console.error("Error connecting to Redis:", error);
  }
})();

export default redis;
