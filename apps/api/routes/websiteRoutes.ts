import { Router } from "express";
import {
  createWebsite,
  getWebsiteStatus,
  getAllWebsites,
  disableWebsite,
  getWebsite,
  updateWebsite,
  rotateHeartbeatToken,
} from "../controllers/websiteController";
import {
  getDashboardStats,
  getWebsiteAnalytics,
  getWebsiteIncidents,
} from "../controllers/analyticsController";
import { getPageSpeed } from "../controllers/pageSpeedController";

const router = Router();

router.post("/website", createWebsite);
router.get("/website/status", getWebsiteStatus);
router.get("/websites", getAllWebsites);
router.get("/website/:websiteId", getWebsite);
router.patch("/website/:websiteId", updateWebsite);
router.delete("/website/:websiteId", disableWebsite);
router.post("/website/:websiteId/heartbeat-token", rotateHeartbeatToken);

// Analytics & incidents
router.get("/stats", getDashboardStats);
router.get("/website/:websiteId/analytics", getWebsiteAnalytics);
router.get("/website/:websiteId/incidents", getWebsiteIncidents);
router.get("/website/:websiteId/pagespeed", getPageSpeed);

export default router;
