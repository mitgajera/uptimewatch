import { Router } from "express";
import {
  createStatusPage,
  deleteStatusPage,
  listStatusPages,
  updateStatusPage,
} from "../controllers/statusPageController";

const router = Router();

router.get("/status-pages", listStatusPages);
router.post("/status-pages", createStatusPage);
router.patch("/status-pages/:statusPageId", updateStatusPage);
router.delete("/status-pages/:statusPageId", deleteStatusPage);

export default router;
