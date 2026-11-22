import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = { select: () => q, sort: () => q, limit: () => q, lean: async () => result };
  return q;
}

const Notification = {
  find: mock((..._a: any[]) => query<any[]>([])),
  updateOne: mock(async (..._a: any[]) => ({})),
};
const User = { find: mock((..._a: any[]) => query<any[]>([])) };
const AlertChannel = { find: mock((..._a: any[]) => query<any[]>([])) };
const Website = { find: mock((..._a: any[]) => query<any[]>([])) };
mockDb({ Notification, User, AlertChannel, Website });

const { dispatchPendingNotifications } = await import("../cron/websiteAlert");

const W1 = "65a000000000000000000001";
const W2 = "65a000000000000000000002";

beforeEach(() => {
  for (const m of [Notification.find, Notification.updateOne, User.find, AlertChannel.find, Website.find]) m.mockReset();
  Notification.updateOne.mockResolvedValue({});
  User.find.mockReturnValue(query([{ _id: "u1", email: "me@acme.dev" }]));
  AlertChannel.find.mockReturnValue(
    query([
      { _id: "c1", userId: "u1", type: "slack", target: "https://hooks.slack.com/services/a", enabled: true },
      { _id: "c2", userId: "u1", type: "telegram", target: "1:tok", chatId: "-5", enabled: true },
    ])
  );
  Website.find.mockReturnValue(
    query([
      { _id: W1, alertChannelIds: ["c2"] },
      { _id: W2, alertChannelIds: [] },
    ])
  );
});

describe("dispatchPendingNotifications routing", () => {
  test("routes each notification to its monitor's channels", async () => {
    Notification.find.mockReturnValue(
      query([
        { _id: "n1", userId: "u1", websiteId: W1, kind: "DOWN", subject: "s", message: "m", attempts: 0, deliveredTo: [] },
        { _id: "n2", userId: "u1", websiteId: W2, kind: "REMINDER", subject: "s", message: "m", attempts: 0, deliveredTo: [] },
      ])
    );
    const deliver = mock(async (..._a: any[]) => ({ ok: true }));

    await dispatchPendingNotifications({ deliver });

    // Monitor routing is loaded once for the batch.
    expect(Website.find).toHaveBeenCalledTimes(1);
    const sent = deliver.mock.calls.map((c) => [(c[1] as any).kind, (c[0] as any).type]);
    expect(sent).toEqual([
      ["DOWN", "telegram"],
      ["REMINDER", "slack"],
      ["REMINDER", "telegram"],
    ]);
    expect(deliver.mock.calls[0]![0]).toEqual({ type: "telegram", target: "1:tok", chatId: "-5" });
    expect(Notification.updateOne.mock.calls[0]![1].$set.sent).toBe(true);
  });
});
