import { connectDB } from "db/client";
import { app } from "./app";
import { startScheduledJobs } from "./jobs/scheduler";

async function start() {
  await connectDB();

  // Background jobs run in-process by default. Set RUN_SCHEDULERS=false when
  // running them in a separate worker (bun run worker).
  if (process.env.RUN_SCHEDULERS !== "false") startScheduledJobs();

  const port = Number(process.env.PORT) || 8080;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
