import express from "express";
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
