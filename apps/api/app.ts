import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { mongoose } from "db/client";
import { authMiddleware } from "./middleware/middleware";
import websiteRoutes from "./routes/websiteRoutes";
import userRoutes from "./routes/userRoutes";
import alertChannelRoutes from "./routes/alertChannelRoutes";
import statusPageRoutes from "./routes/statusPageRoutes";

export const app = express();
// Behind a proxy/load balancer, trust the first hop for client IPs (rate limits).
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.use(helmet());
// Cap request body size to mitigate memory-exhaustion DoS via large payloads.
app.use(express.json({ limit: "10kb" }));

// Allowed CORS origins. Add your production frontend URL via the
// FRONTEND_URL env var (comma-separated for multiple).
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()) : []),
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Liveness/readiness probe for load balancers and uptime checks (no auth).
app.get("/health", (_req: Request, res: Response) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ status: dbReady ? "ok" : "degraded", db: dbReady });
});

// Per-IP limit on the authenticated API to blunt abuse and token brute-forcing.
app.use(
  "/api/v1",
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  })
);

// Routes
app.use("/api/v1", authMiddleware, websiteRoutes);
app.use("/api/v1", authMiddleware, userRoutes);
app.use("/api/v1", authMiddleware, alertChannelRoutes);
app.use("/api/v1", authMiddleware, statusPageRoutes);

// 404 for unmatched routes.
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler. Express 5 forwards errors thrown/rejected in async
// route handlers here, so any unhandled controller error is logged and returned
// as a structured JSON 500 instead of leaking a stack trace or hanging the request.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled request error:", err instanceof Error ? err.stack : err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal server error" });
});
