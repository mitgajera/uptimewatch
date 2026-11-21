import { connectDB } from "db/client";
import { startScheduledJobs } from "./jobs/scheduler";

/**
 * Standalone background worker: runs monitoring, alert delivery and SSL jobs
 * without serving HTTP. Pair with RUN_SCHEDULERS=false on API instances to
 * scale request handling and checking independently.
 */
async function start() {
  await connectDB();
  startScheduledJobs();
  console.log("[WORKER] Background worker started");
}

start().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
