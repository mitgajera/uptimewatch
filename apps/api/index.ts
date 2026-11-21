import { connectDB } from "db/client";
import { app } from "./app";
import { startScheduledJobs } from "./jobs/scheduler";

async function start() {
  await connectDB();

  // Start background jobs once the DB is connected.
  startScheduledJobs();

  const port = Number(process.env.PORT) || 8080;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
