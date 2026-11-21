import { Router } from "express";
import { getPublicStatusPage } from "../controllers/publicController";

// Unauthenticated endpoints. Only expose data an owner has chosen to publish.
const router = Router();

router.get("/status-pages/:slug", getPublicStatusPage);

export default router;
