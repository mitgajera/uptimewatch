import { describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { runTcpCheck, type TcpDeps } from "../monitor/tcpCheck";
import { safeLookup, UnsafeUrlError } from "../utils/ssrf";

/** A fake socket the test drives by emitting "connect" / "error". */
function fakeSocket() {
  const socket = new EventEmitter() as EventEmitter & { setTimeout: () => void; destroy: ReturnType<typeof mock> };
  socket.setTimeout = () => {};
  socket.destroy = mock(() => {});
  return socket;
}

function deps(behave: (socket: ReturnType<typeof fakeSocket>) => void): TcpDeps & { connect: ReturnType<typeof mock> } {
  let t = 1_000;
  const connect = mock((_opts: any) => {
    const socket = fakeSocket();
    queueMicrotask(() => behave(socket));
    return socket;
  });
  return { connect, now: () => (t += 25) } as any;
}

describe("runTcpCheck", () => {
  test("is UP once the connection opens, timing the connect", async () => {
    const d = deps((s) => s.emit("connect"));
    const result = await runTcpCheck({ host: "db.example.com", port: 5432, timeoutMs: 1000 }, d);
    expect(result).toEqual({ status: "UP", latency: 25, statusCode: null, errorType: null, errorMessage: null });
    const opts = d.connect.mock.calls[0]![0];
    expect(opts).toMatchObject({ host: "db.example.com", port: 5432 });
    // Hostnames resolve through the SSRF-safe lookup.
    expect(opts.lookup).toBe(safeLookup);
  });

  test("closes the socket after the check", async () => {
    let socket: any;
    const d = deps((s) => {
      socket = s;
      s.emit("connect");
    });
    await runTcpCheck({ host: "db.example.com", port: 5432 }, d);
    expect(socket.destroy).toHaveBeenCalled();
  });

  test("refused connections are CONNECTION failures", async () => {
    const d = deps((s) => s.emit("error", Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })));
    const result = await runTcpCheck({ host: "db.example.com", port: 5432 }, d);
    expect(result).toMatchObject({ status: "DOWN", errorType: "CONNECTION" });
    expect(result.errorMessage).toContain("ECONNREFUSED");
  });

  test("times out when nothing answers", async () => {
    const d = deps(() => {});
    const result = await runTcpCheck({ host: "db.example.com", port: 5432, timeoutMs: 20 }, d);
    expect(result).toMatchObject({ status: "DOWN", errorType: "TIMEOUT" });
  });

  test("hosts that resolve to private addresses are BLOCKED", async () => {
    const d = deps((s) =>
      s.emit("error", new UnsafeUrlError("URL resolves to a private or reserved address"))
    );
    const result = await runTcpCheck({ host: "internal.example.com", port: 22 }, d);
    expect(result).toMatchObject({ status: "DOWN", errorType: "BLOCKED" });
  });

  test("private IP literals are BLOCKED without connecting", async () => {
    const d = deps((s) => s.emit("connect"));
    for (const host of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]"]) {
      const result = await runTcpCheck({ host, port: 80 }, d);
      expect(result).toMatchObject({ status: "DOWN", errorType: "BLOCKED" });
    }
    expect(d.connect).not.toHaveBeenCalled();
  });

  test("unresolvable hosts are DNS failures", async () => {
    const d = deps((s) => s.emit("error", new UnsafeUrlError("Could not resolve host")));
    const result = await runTcpCheck({ host: "nope.invalid", port: 80 }, d);
    expect(result).toMatchObject({ status: "DOWN", errorType: "DNS" });
  });
});
