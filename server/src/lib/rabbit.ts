import { sendMail } from "./sendMail";
import * as amqplib from "amqplib";

let connection: any;
let channel: any;

export const start = async () => {
  try {
    connection = await amqplib.connect(
      process.env.RABBIT_URL + "?heartbeat=60"
    );
    channel = await connection.createChannel();
    console.log("RabbitMQ connected");
  } catch (err) {
    console.error("[AMQP] Connection error:", err);
    setTimeout(start, 1000);
  }
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
