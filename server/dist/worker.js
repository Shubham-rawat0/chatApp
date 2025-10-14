"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rabbit_1 = require("./lib/rabbit");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log(process.env.RABBIT_URL);
const startWorker = async () => {
    await (0, rabbit_1.subscribeToQueue)("email");
    console.log("Email worker is listening...");
};
startWorker();
