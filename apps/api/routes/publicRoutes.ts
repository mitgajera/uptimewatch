import { Router } from "express";
import { getPublicStatusPage, getStatusBadge } from "../controllers/publicController";
import { receiveHeartbeat } from "../controllers/heartbeatController";

// Unauthenticated endpoints. Only expose data an owner has chosen to publish.
const router = Router();

router.get("/status-pages/:slug", getPublicStatusPage);
router.get("/status-pages/:slug/badge.svg", getStatusBadge);
// GET for curl/wget one-liners; POST for tools that prefer it. Express
// answers HEAD with the GET handler.
router.get("/heartbeat/:token", receiveHeartbeat);
router.post("/heartbeat/:token", receiveHeartbeat);

export default router;
