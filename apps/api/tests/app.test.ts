import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { mockDb } from "./helpers/mockDb";

const connection = { readyState: 0 };
mockDb({ mongoose: { connection } });

const { app } = await import("../app");

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => {
  server.close();
});

describe("app", () => {
  test("/health reports degraded until the database is connected", async () => {
    connection.readyState = 0;
    const down = await fetch(`${base}/health`);
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ status: "degraded", db: false });

    connection.readyState = 1;
    const up = await fetch(`${base}/health`);
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual({ status: "ok", db: true });
  });

  test("API routes require a bearer token", async () => {
    const res = await fetch(`${base}/api/v1/websites`);
    expect(res.status).toBe(401);
  });

  test("sets security and rate-limit headers", async () => {
    const res = await fetch(`${base}/api/v1/websites`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("ratelimit-policy")).toBeTruthy();
  });

  test("public routes do not require auth", async () => {
    const res = await fetch(`${base}/api/v1/public/status-pages/!!`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Status page not found." });
  });

  test("unknown routes return JSON 404", async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  test("malformed and oversized JSON bodies are client errors, not 500s", async () => {
    const post = (body: string) =>
      fetch(`${base}/nope`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const bad = await post("{not json");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Bad request" });
    const big = await post(JSON.stringify({ x: "a".repeat(20_000) }));
    expect(big.status).toBe(413);
  });
});
