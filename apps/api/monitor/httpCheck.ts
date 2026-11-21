import axios from "axios";
import { MONITOR_DEFAULTS, type CheckErrorType, type MonitorMethod } from "db/constants";
import { assertSafeUrl } from "../utils/ssrf";
import { classifyError, describeError } from "./classify";
import { parseExpectedStatus } from "./expectedStatus";

const USER_AGENT = "UptimeWatch/1.0 (+https://uptimewatch.app)";
/** Upper bound on how much of a body we read when looking for a keyword. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export interface CheckTarget {
  url: string;
  method?: MonitorMethod;
  timeoutMs?: number;
  expectedStatus?: string;
  keyword?: string;
}

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
 * Perform a single HTTP check against a monitor target and report whether it
 * is UP, how long it took, the status code received and, if it failed, why.
 */
export async function runHttpCheck(
  target: CheckTarget,
  deps: CheckDeps = defaultDeps
): Promise<CheckResult> {
  const method = target.method ?? MONITOR_DEFAULTS.method;
  const timeout = target.timeoutMs ?? MONITOR_DEFAULTS.timeoutMs;
  const keyword = target.keyword?.trim() ?? "";
  const isExpected =
    parseExpectedStatus(target.expectedStatus ?? MONITOR_DEFAULTS.expectedStatus) ??
    parseExpectedStatus(MONITOR_DEFAULTS.expectedStatus)!;

  const startTime = deps.now();
  const fail = (errorType: CheckErrorType, errorMessage: string, statusCode: number | null) => ({
    status: "DOWN" as const,
    latency: deps.now() - startTime,
    statusCode,
    errorType,
    errorMessage,
  });

  try {
    // Re-validate at fetch time to guard against a host that now resolves to a
    // private address (DNS rebinding) or a URL stored before SSRF checks existed.
    await deps.assertSafeUrl(target.url);

    const response = await deps.request({
      url: target.url,
      method,
      timeout,
      // Status is judged against the monitor's expected codes below.
      validateStatus: () => true,
      // Do not follow redirects: a public URL could otherwise redirect the
      // server into a private/internal address, bypassing the SSRF check.
      maxRedirects: 0,
      headers: { "User-Agent": USER_AGENT },
      // Only buffer the body when we need to search it.
      responseType: keyword ? "text" : "stream",
      maxContentLength: MAX_BODY_BYTES,
    });

    const latency = deps.now() - startTime;
    if (!keyword) (response.data as { destroy?: () => void } | undefined)?.destroy?.();

    if (!isExpected(response.status)) {
      return fail("HTTP_STATUS", `Unexpected HTTP ${response.status}`, response.status);
    }

    if (keyword && !String(response.data ?? "").includes(keyword)) {
      return fail("KEYWORD", `Response did not contain "${keyword.slice(0, 50)}"`, response.status);
    }

    return {
      status: "UP",
      latency,
      statusCode: response.status,
      errorType: null,
      errorMessage: null,
    };
  } catch (error: any) {
    const statusCode = error?.response?.status ?? null;
    return fail(
      classifyError(error),
      statusCode ? `Unexpected HTTP ${statusCode}` : describeError(error),
      statusCode
    );
  }
}
