import { connectDB } from "db/client";
import { app } from "./app";
import { scheduleMonitor } from "./cron/monitor";
import { scheduleWebsiteAlert } from "./cron/websiteAlert";
import { scheduleSslCheck } from "./cron/sslCheck";

async function start() {
  await connectDB();

  // Start background jobs once the DB is connected.
  console.log("starting cron jobs");
  scheduleMonitor();
  scheduleWebsiteAlert();
  scheduleSslCheck();
  console.log("started cron jobs");

  const port = Number(process.env.PORT) || 8080;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
