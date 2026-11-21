import axios from "axios";
import type { CheckErrorType } from "db/client";
import { assertSafeUrl } from "../utils/ssrf";
import { classifyError, describeError } from "./classify";

export const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "UptimeWatch/1.0 (+https://uptimewatch.app)";

export interface CheckResult {
  status: "UP" | "DOWN";
  latency: number;
  statusCode: number | null;
  errorType: CheckErrorType | null;
  errorMessage: string | null;
}

export interface CheckDeps {
  request: typeof axios.request;
  assertSafeUrl: typeof assertSafeUrl;
  now: () => number;
}

const defaultDeps: CheckDeps = {
  request: axios.request.bind(axios),
  assertSafeUrl,
  now: Date.now,
};

/**
 * Perform a single HTTP check against `url` and report whether it is UP,
 * how long it took and the status code received (if any).
 */
export async function runHttpCheck(
  url: string,
  deps: CheckDeps = defaultDeps
): Promise<CheckResult> {
  const startTime = deps.now();

  try {
    // Re-validate at fetch time to guard against a host that now resolves to a
    // private address (DNS rebinding) or a URL stored before SSRF checks existed.
    await deps.assertSafeUrl(url);

    const response = await deps.request({
      url,
      method: "GET",
      timeout: DEFAULT_TIMEOUT_MS,
      // Treat any non-5xx response as "reachable"; only 5xx / network errors are DOWN.
      validateStatus: (code) => code < 500,
      // Do not follow redirects: a public URL could otherwise redirect the
      // server into a private/internal address, bypassing the SSRF check.
      maxRedirects: 0,
      headers: { "User-Agent": USER_AGENT },
    });
    const up = response.status < 500;
    return {
      status: up ? "UP" : "DOWN",
      latency: deps.now() - startTime,
      statusCode: response.status,
      errorType: up ? null : "HTTP_STATUS",
      errorMessage: up ? null : `Unexpected HTTP ${response.status}`,
    };
  } catch (error: any) {
    const statusCode = error?.response?.status ?? null;
    return {
      status: "DOWN",
      latency: deps.now() - startTime,
      statusCode,
      errorType: classifyError(error),
      errorMessage: statusCode ? `Unexpected HTTP ${statusCode}` : describeError(error),
    };
  }
}
