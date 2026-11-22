import type { Request, Response } from "express";
import { AlertChannel, Website } from "db/client";
import type { AlertChannelType } from "db/constants";
import { deliver, maskTelegramToken, validateChannelTarget } from "../notify/channels";
import { isValidId } from "../utils/websites";
import { createAlertChannelSchema, parseBody, updateAlertChannelSchema } from "../validation";

const MAX_CHANNELS_PER_USER = 10;

// Telegram bot tokens are secrets: only a masked form leaves the server.
const serialize = (c: any) => ({
  id: String(c._id),
  type: c.type,
  name: c.name,
  target: c.type === "telegram" ? maskTelegramToken(c.target) : c.target,
  ...(c.type === "telegram" ? { chatId: c.chatId ?? "" } : {}),
  enabled: c.enabled,
  createdAt: c.createdAt,
});

export const listAlertChannels = async (req: Request, res: Response) => {
  const channels = await AlertChannel.find({ userId: req.userId! }).sort({ createdAt: 1 }).lean();
  res.json({ channels: channels.map(serialize) });
};

export const createAlertChannel = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(createAlertChannelSchema, req, res);
  if (!body) return;

  const type = body.type as AlertChannelType;
  const invalid = validateChannelTarget(type, body.target, body.chatId);
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }

  if ((await AlertChannel.countDocuments({ userId })) >= MAX_CHANNELS_PER_USER) {
    res.status(403).json({ message: `Alert channel limit reached (${MAX_CHANNELS_PER_USER}).` });
    return;
  }

  const channel = await AlertChannel.create({
    userId,
    type,
    name: body.name ?? "",
    target: body.target,
    chatId: type === "telegram" ? body.chatId : null,
    enabled: body.enabled ?? true,
  });
  res.status(201).json(serialize(channel.toObject()));
};

/** Load a channel owned by the requester, or respond 400/404 and return null. */
async function findOwnedChannel(req: Request, res: Response) {
  const id = req.params.channelId;
  if (!isValidId(id)) {
    res.status(400).json({ error: "Invalid channel id." });
    return null;
  }
  const channel = await AlertChannel.findOne({ _id: id, userId: req.userId! }).lean();
  if (!channel) {
    res.status(404).json({ error: "Alert channel not found." });
    return null;
  }
  return channel;
}

export const updateAlertChannel = async (req: Request, res: Response) => {
  const existing = await findOwnedChannel(req, res);
  if (!existing) return;

  const body = parseBody(updateAlertChannelSchema, req, res);
  if (!body) return;

  const update: Record<string, unknown> = { ...body };
  // Clients echo back the masked token they were shown; that means "unchanged".
  if (existing.type === "telegram" && body.target === maskTelegramToken(existing.target)) {
    delete update.target;
  }
  if (existing.type !== "telegram") delete update.chatId;

  if (update.target !== undefined || update.chatId !== undefined) {
    const invalid = validateChannelTarget(
      existing.type,
      (update.target as string | undefined) ?? existing.target,
      (update.chatId as string | undefined) ?? existing.chatId
    );
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }
  }

  const updated = await AlertChannel.findOneAndUpdate(
    { _id: existing._id, userId: req.userId! },
    { $set: update },
    { new: true }
  ).lean();
  res.json(serialize(updated));
};

export const deleteAlertChannel = async (req: Request, res: Response) => {
  const existing = await findOwnedChannel(req, res);
  if (!existing) return;
  await AlertChannel.deleteOne({ _id: existing._id, userId: req.userId! });
  // Monitors routed to this channel fall back to the remaining ones.
  await Website.updateMany(
    { userId: req.userId!, alertChannelIds: existing._id },
    { $pull: { alertChannelIds: existing._id } }
  );
  res.json({ message: "Alert channel deleted." });
};

/**
 * Test sends go to unverified addresses from the platform's sender, so cap
 * them per user (in memory: a per-instance limit is enough to stop abuse).
 */
const TEST_SENDS_PER_WINDOW = 5;
const TEST_WINDOW_MS = 10 * 60_000;
const recentTestSends = new Map<string, number[]>();

function allowTestSend(userId: string, now = Date.now()): boolean {
  const recent = (recentTestSends.get(userId) ?? []).filter((t) => now - t < TEST_WINDOW_MS);
  if (recent.length >= TEST_SENDS_PER_WINDOW) {
    recentTestSends.set(userId, recent);
    return false;
  }
  recent.push(now);
  recentTestSends.set(userId, recent);
  return true;
}

/** Test hook. */
export function resetTestSendLimits() {
  recentTestSends.clear();
}

/** Send a test alert so users can verify a channel works end to end. */
export const testAlertChannel = async (req: Request, res: Response) => {
  const channel = await findOwnedChannel(req, res);
  if (!channel) return;
  if (!allowTestSend(req.userId!)) {
    res.status(429).json({ message: "Too many test alerts. Try again in a few minutes." });
    return;
  }

  const result = await deliver(
    { type: channel.type, target: channel.target, chatId: channel.chatId ?? null },
    {
      kind: "TEST",
      subject: "✅ UptimeWatch test alert",
      message: "This is a test alert from UptimeWatch. If you can read this, the channel works.",
    }
  );
  if (!result.ok) {
    res.status(502).json({ message: `Delivery failed: ${result.error ?? "unknown error"}` });
    return;
  }
  res.json({ message: "Test alert sent." });
};
