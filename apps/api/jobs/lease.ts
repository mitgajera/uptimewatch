import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

/** Identifies this process as a lease owner. */
export const PROCESS_ID = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

/** The subset of the Lease model used here, injectable for tests. */
export interface LeaseStore {
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>
  ): { lean(): Promise<{ owner: string } | null> };
}

/**
 * Try to take (or renew) the named lease for `ttlMs`. Returns true when this
 * process holds it. Expired leases can be taken over by anyone; a live lease
 * held by another owner makes the upsert collide on _id, which means "no".
 */
export async function acquireLease(
  store: LeaseStore,
  name: string,
  ttlMs: number,
  owner = PROCESS_ID,
  now = new Date()
): Promise<boolean> {
  try {
    const lease = await store
      .findOneAndUpdate(
        { _id: name, $or: [{ expiresAt: { $lte: now } }, { owner }] },
        { $set: { owner, expiresAt: new Date(now.getTime() + ttlMs) } },
        { upsert: true, new: true }
      )
      .lean();
    return lease?.owner === owner;
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return false;
    throw err;
  }
}
