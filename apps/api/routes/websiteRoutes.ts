import { Router } from "express";
import {
  createWebsite,
  getWebsiteStatus,
  getAllWebsites,
  disableWebsite,
  getWebsite,
  updateWebsite,
  rotateHeartbeatToken,
  checkWebsiteNow,
  bulkUpdateWebsites,
  getWebsiteChecks,
  getWebsiteCalendar,
  exportWebsiteChecks,
} from "../controllers/websiteController";
import { getOverview } from "../controllers/overviewController";
import {
  acknowledgeIncident,
  addIncidentUpdate,
  exportIncidents,
  getIncident,
  listIncidents,
} from "../controllers/incidentController";
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
router.post("/websites/bulk", bulkUpdateWebsites);
router.get("/website/:websiteId", getWebsite);
router.patch("/website/:websiteId", updateWebsite);
router.delete("/website/:websiteId", disableWebsite);
router.post("/website/:websiteId/heartbeat-token", rotateHeartbeatToken);
router.post("/website/:websiteId/check", checkWebsiteNow);
router.get("/website/:websiteId/checks", getWebsiteChecks);
router.get("/website/:websiteId/calendar", getWebsiteCalendar);
router.get("/website/:websiteId/export.csv", exportWebsiteChecks);

// Analytics & incidents
router.get("/stats", getDashboardStats);
router.get("/website/:websiteId/analytics", getWebsiteAnalytics);
router.get("/website/:websiteId/incidents", getWebsiteIncidents);
router.get("/website/:websiteId/pagespeed", getPageSpeed);

// Overview & incidents
router.get("/overview", getOverview);
router.get("/incidents", listIncidents);
// Before "/incidents/:incidentId" so "export.csv" isn't taken for an id.
router.get("/incidents/export.csv", exportIncidents);
router.get("/incidents/:incidentId", getIncident);
router.post("/incidents/:incidentId/acknowledge", acknowledgeIncident);
router.post("/incidents/:incidentId/updates", addIncidentUpdate);

export default router;
