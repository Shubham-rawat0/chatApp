import { subscribeToQueue } from "./lib/rabbit";
import dotenv from "dotenv"
dotenv.config()
console.log(process.env.RABBIT_URL)
const startWorker = async () => {
  await subscribeToQueue("email");
  console.log("Email worker is listening...");
};

startWorker();
