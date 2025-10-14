import { sendMail } from "./sendMail";
import * as amqplib from "amqplib";

let connection: any;
let channel: any;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export const start = async () => {
  try {
    if (!process.env.RABBIT_URL) {
      throw new Error("RABBIT_URL not configured");
    }
    connection = await amqplib.connect(process.env.RABBIT_URL);
    channel = await connection.createChannel();
    reconnectAttempts = 0;
    console.log("RabbitMQ connected");
    
    connection.on('error', (err:any) => {
      console.error('[AMQP] Connection error:', err);
      reconnect();
    });
    
    connection.on('close', () => {
      console.error('[AMQP] Connection closed');
      reconnect();
    });
  } catch (err) {
    console.error("[AMQP] Initial connection error:", err);
    reconnect();
  }
};

const reconnect = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[AMQP] Max reconnection attempts reached');
    process.exit(1);
  }
  reconnectAttempts++;
  setTimeout(start, 1000 * reconnectAttempts);
};

export const subscribeToQueue = async (queue: string) => {
  if (!channel) await start();

  await channel.assertQueue(queue, { durable: true });
  channel.consume(queue, async (msg: any) => {
    if (msg) {
      const { email, name } = JSON.parse(msg.content.toString());
      try {
        await sendMail(email, name);
        channel.ack(msg);
      } catch (err) {
        console.error("Failed to send email:", err);
        channel.nack(msg, false, true);
      }
    }
  });
};

export const publishToQueue = async (
  queue: string,
  email: string,
  name: string
) => {
  if (!channel) await start();

  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify({ email, name })), {
    persistent: true,
  });
};
