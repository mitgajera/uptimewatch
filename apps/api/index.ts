import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { connectDB } from "db/client";
import { authMiddleware } from "./middleware/middleware";
import websiteRoutes from "./routes/websiteRoutes";
import userRoutes from "./routes/userRoutes";
import { scheduleMonitor } from "./cron/monitor";
import { scheduleWebsiteAlert } from "./cron/websiteAlert";

const app = express();
app.use(express.json());

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

// Routes
app.use("/api/v1", authMiddleware, websiteRoutes);
app.use("/api/v1", authMiddleware, userRoutes);

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

async function start() {
  await connectDB();

  // Start background jobs once the DB is connected.
  console.log("starting cron jobs");
  scheduleMonitor();
  scheduleWebsiteAlert();
  console.log("started cron jobs");

  app.listen(8080, () => {
    console.log("Server running on port 8080");
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
