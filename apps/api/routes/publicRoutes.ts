import { Router } from "express";
import { getPublicStatusPage } from "../controllers/publicController";
import { receiveHeartbeat } from "../controllers/heartbeatController";

// Unauthenticated endpoints. Only expose data an owner has chosen to publish.
const router = Router();

router.get("/status-pages/:slug", getPublicStatusPage);
// GET for curl/wget one-liners; POST/HEAD for tools that prefer them.
router.all("/heartbeat/:token", receiveHeartbeat);

export default router;
