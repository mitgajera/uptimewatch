import type { Request, Response } from "express";
import { Website } from "db/client";
import { recordCheckResult } from "../monitor/record";

/**
 * GET|POST|HEAD /public/heartbeat/:token — called by the user's cron job or
 * script. Records the ping and, if the monitor was down, recovers it at once.
 */
export const receiveHeartbeat = async (req: Request, res: Response) => {
  const token = String(req.params.token ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    res.status(404).json({ error: "Unknown heartbeat." });
    return;
  }

  const now = new Date();
  // Returns the document as it was before the update, so isDown is current.
  const website = await Website.findOneAndUpdate(
    { heartbeatToken: token, type: "heartbeat", disabled: false },
    { $set: { lastHeartbeatAt: now } },
    { new: false }
  ).lean();

  if (!website) {
    res.status(404).json({ error: "Unknown heartbeat." });
    return;
  }

  if (!website.paused && website.isDown) {
    await recordCheckResult(website, {
      status: "UP",
      latency: 0,
      statusCode: null,
      errorType: null,
      errorMessage: null,
    });
  }

  res.json({ ok: true, receivedAt: now.toISOString() });
};
