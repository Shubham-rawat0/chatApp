"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToQueue = exports.subscribeToQueue = exports.start = void 0;
const sendMail_1 = require("./sendMail");
const amqplib = __importStar(require("amqplib"));
let connection;
let channel;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const start = async () => {
    try {
        if (!process.env.RABBIT_URL) {
            throw new Error("RABBIT_URL not configured");
        }
        connection = await amqplib.connect(process.env.RABBIT_URL);
        channel = await connection.createChannel();
        reconnectAttempts = 0;
        console.log("RabbitMQ connected");
        connection.on('error', (err) => {
            console.error('[AMQP] Connection error:', err);
            reconnect();
        });
        connection.on('close', () => {
            console.error('[AMQP] Connection closed');
            reconnect();
        });
    }
    catch (err) {
        console.error("[AMQP] Initial connection error:", err);
        reconnect();
    }
};
exports.start = start;
const reconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[AMQP] Max reconnection attempts reached');
        process.exit(1);
    }
    reconnectAttempts++;
    setTimeout(exports.start, 1000 * reconnectAttempts);
};
const subscribeToQueue = async (queue) => {
    if (!channel)
        await (0, exports.start)();
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, async (msg) => {
        if (msg) {
            const { email, name } = JSON.parse(msg.content.toString());
            try {
                await (0, sendMail_1.sendMail)(email, name);
                channel.ack(msg);
            }
            catch (err) {
                console.error("Failed to send email:", err);
                channel.nack(msg, false, true);
            }
        }
    });
};
exports.subscribeToQueue = subscribeToQueue;
const publishToQueue = async (queue, email, name) => {
    if (!channel)
        await (0, exports.start)();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify({ email, name })), {
        persistent: true,
    });
};
exports.publishToQueue = publishToQueue;
