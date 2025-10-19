"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const express_2 = require("@clerk/express");
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app = (0, express_1.default)();
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));
app.use(limiter);
app.use((0, express_2.clerkMiddleware)());
app.use("/user", user_routes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: "An unexpected error occurred",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});
const server = http_1.default.createServer(app);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    },
});
require("./websockets/socket");
const PORT = process.env.PORT || 3000;
server
    .listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})
    .on("error", (err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
});
