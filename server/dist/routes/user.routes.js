"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const user_controllers_1 = require("../controllers/user.controllers");
const express_2 = require("@clerk/express");
router.get("/account", (0, express_2.requireAuth)(), user_controllers_1.createOrUpdateUser);
router.post("/addfriend", (0, express_2.requireAuth)(), user_controllers_1.addFriend);
router.patch("/acceptfriend", (0, express_2.requireAuth)(), user_controllers_1.acceptRequest);
router.patch("/rejectfriend", (0, express_2.requireAuth)(), user_controllers_1.denyRequest);
router.post("/blockfriend", (0, express_2.requireAuth)(), user_controllers_1.blockUser);
router.get("/getGroups", (0, express_2.requireAuth)(), user_controllers_1.getGroupData);
router.post("/createGroup", (0, express_2.requireAuth)(), user_controllers_1.createRoom);
router.patch("/addToGroup", (0, express_2.requireAuth)(), user_controllers_1.addToGroup);
router.post("/addToGroup", (0, express_2.requireAuth)(), user_controllers_1.joinGroup);
exports.default = router;
