import net from "node:net";
import { MONITOR_DEFAULTS } from "db/constants";
import { isPrivateAddress, safeLookup, UnsafeUrlError } from "../utils/ssrf";
import { classifyError, describeError } from "./classify";
import type { CheckResult } from "./httpCheck";

export interface TcpTarget {
  host: string;
  port?: number | null;
  timeoutMs?: number;
}

/** The subset of a socket the check needs. */
export interface TcpSocket {
  once(event: "connect", listener: () => void): unknown;
  once(event: "error", listener: (err: Error) => void): unknown;
  setTimeout(ms: number, listener?: () => void): unknown;
  destroy(): unknown;
}

export interface TcpDeps {
  connect: (options: net.NetConnectOpts) => TcpSocket;
  now: () => number;
}

const defaultDeps: TcpDeps = {
  connect: (options) => net.connect(options),
  now: Date.now,
};

/**
 * Open a TCP connection to host:port. UP once connected (latency = connect
 * time). The socket only ever reaches vetted public addresses: hostnames
 * resolve through `safeLookup`, and IP literals (which skip lookup) are
 * checked here.
 */
export async function runTcpCheck(target: TcpTarget, deps: TcpDeps = defaultDeps): Promise<CheckResult> {
  const host = target.host.trim().replace(/^\[|\]$/g, "");
  const port = target.port ?? 0;
  const timeout = target.timeoutMs ?? MONITOR_DEFAULTS.timeoutMs;
  const start = deps.now();
  const down = (errorType: CheckResult["errorType"], errorMessage: string): CheckResult => ({
    status: "DOWN",
    latency: deps.now() - start,
    statusCode: null,
    errorType,
    errorMessage,
  });

  if (!host || port < 1 || port > 65_535) return down("UNKNOWN", "Invalid host or port");
  if (net.isIP(host) && isPrivateAddress(host)) {
    return down("BLOCKED", "Host resolves to a private or reserved address");
  }

  return new Promise<CheckResult>((resolve) => {
    let settled = false;
    let socket: TcpSocket | null = null;
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish(down("TIMEOUT", `Connection timed out after ${timeout / 1000}s`)),
      timeout
    );

    try {
      socket = deps.connect({ host, port, lookup: safeLookup as any });
    } catch (err) {
      finish(down(classifyTcpError(err), describeTcpError(err)));
      return;
    }
    socket.once("connect", () =>
      finish({ status: "UP", latency: deps.now() - start, statusCode: null, errorType: null, errorMessage: null })
    );
    socket.once("error", (err) => finish(down(classifyTcpError(err), describeTcpError(err))));
  });
}

function classifyTcpError(err: unknown): CheckResult["errorType"] {
  if (err instanceof UnsafeUrlError || (err as Error)?.name === "UnsafeUrlError") {
    return (err as Error).message === "Could not resolve host" ? "DNS" : "BLOCKED";
  }
  const type = classifyError(err);
  // Anything else the socket reports is a failure to connect.
  return type === "UNKNOWN" || type === "TLS" || type === "HTTP_STATUS" ? "CONNECTION" : type;
}

function describeTcpError(err: unknown): string {
  if ((err as Error)?.name === "UnsafeUrlError") {
    const message = (err as Error).message;
    return message === "Could not resolve host" ? message : "Host resolves to a private or reserved address";
  }
  return describeError(err);
}
