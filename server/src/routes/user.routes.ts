import express from "express"
const router=express.Router()
import { acceptRequest, addFriend, addToGroup, blockUser,  createRoom, denyRequest, getGroupData, getOrCreateUser, getUserId, joinGroup, userFriends } from "../controllers/user.controllers"
import { requireAuth } from "@clerk/express"

router.get("/account",requireAuth(),getOrCreateUser)
router.post("/addfriend",requireAuth(),addFriend)
router.patch("/acceptfriend",requireAuth(),acceptRequest)
router.patch("/rejectfriend",requireAuth(),denyRequest)
router.post("/blockfriend",requireAuth(),blockUser)
router.get("/getGroups",requireAuth(),getGroupData)
router.post("/createGroup",requireAuth(),createRoom)
router.patch("/addToGroup",requireAuth(),addToGroup)
router.post("/joinGroup",requireAuth(),joinGroup)
router.get("/currentUser",requireAuth(),getUserId)
router.get("/friendsOfUser",requireAuth(),userFriends)

export default router 