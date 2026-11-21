import { describe, expect, mock, test } from "bun:test";
import { acquireLease, type LeaseStore } from "../jobs/lease";

const store = (impl: () => Promise<{ owner: string } | null>) =>
  ({ findOneAndUpdate: mock(() => ({ lean: impl })) }) as unknown as LeaseStore & {
    findOneAndUpdate: ReturnType<typeof mock>;
  };

describe("acquireLease", () => {
  test("acquires when the upsert returns our ownership", async () => {
    const s = store(async () => ({ owner: "me" }));
    const now = new Date("2024-01-01T00:00:00Z");
    expect(await acquireLease(s, "job:monitor", 50_000, "me", now)).toBe(true);

    const [filter, update] = s.findOneAndUpdate.mock.calls[0]!;
    expect(filter).toEqual({
      _id: "job:monitor",
      $or: [{ expiresAt: { $lte: now } }, { owner: "me" }],
    });
    expect(update.$set.expiresAt).toEqual(new Date(now.getTime() + 50_000));
  });

  test("does not acquire a live lease held by someone else (duplicate key)", async () => {
    const s = store(async () => {
      throw Object.assign(new Error("E11000"), { code: 11000 });
    });
    expect(await acquireLease(s, "job:monitor", 50_000, "me")).toBe(false);
  });

  test("propagates unexpected errors", async () => {
    const s = store(async () => {
      throw new Error("connection lost");
    });
    await expect(acquireLease(s, "job:monitor", 50_000, "me")).rejects.toThrow("connection lost");
  });
});
