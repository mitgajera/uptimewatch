import { Router } from "express";
import {
  createAlertChannel,
  deleteAlertChannel,
  listAlertChannels,
  testAlertChannel,
  updateAlertChannel,
} from "../controllers/alertChannelController";

const router = Router();

router.get("/alert-channels", listAlertChannels);
router.post("/alert-channels", createAlertChannel);
router.patch("/alert-channels/:channelId", updateAlertChannel);
router.delete("/alert-channels/:channelId", deleteAlertChannel);
router.post("/alert-channels/:channelId/test", testAlertChannel);

export default router;
