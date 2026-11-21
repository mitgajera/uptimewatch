import { mock } from "bun:test";

/**
 * Mock "db/client" for a test file. bun's mock.module is process-wide and
 * modules imported by one test file stay linked for later files, so every
 * mock must expose every export name; pass the models this file drives and
 * the rest are stubbed.
 */
export function mockDb(models: Record<string, unknown>) {
  mock.module("db/client", () => ({
    mongoose: { connection: { readyState: 0 } },
    connectDB: async () => {},
    User: {},
    Website: {},
    WebsiteTick: {},
    Incident: {},
    Notification: {},
    AlertChannel: {},
    Lease: {},
    StatusPage: {},
    ...models,
  }));
}
