import { Router } from "express";
import { syncUser } from "../controllers/userController";

const router = Router();

router.post("/user/sync", syncUser);

export default router;
