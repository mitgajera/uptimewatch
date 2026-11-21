import axios from "axios";
import { MONITOR_DEFAULTS, type CheckErrorType, type MonitorMethod } from "db/constants";
import { assertSafeUrl, pinSafeUrl } from "../utils/ssrf";
import { classifyError, describeError } from "./classify";
import { parseExpectedStatus } from "./expectedStatus";

const USER_AGENT = "UptimeWatch/1.0 (+https://uptimewatch.app)";
/** Upper bound on how much of a body we read when looking for a keyword. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export interface CheckTarget {
  url: string;
  method?: MonitorMethod;
  timeoutMs?: number;
  expectedStatus?: string;
  keyword?: string;
  followRedirects?: boolean;
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

/** Connect to the address the SSRF guard vetted, not a fresh DNS answer. */
const pinnedRequest: CheckDeps["request"] = async (config) => {
  const target = await pinSafeUrl(String(config.url));
  return axios.request({ ...config, url: target.url, headers: { ...config.headers, ...target.headers } });
};

const defaultDeps: CheckDeps = {
  request: pinnedRequest as CheckDeps["request"],
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
  const followRedirects = target.followRedirects ?? MONITOR_DEFAULTS.followRedirects;
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
    let url = target.url;
    let response;
    for (let hop = 0; ; hop++) {
      // Validate every hop (not just the stored URL): a public URL could
      // redirect into a private/internal address, and DNS can change between
      // checks (rebinding). Redirects are followed manually for this reason.
      await deps.assertSafeUrl(url);

      response = await deps.request({
        url,
        method,
        timeout,
        // Status is judged against the monitor's expected codes below.
        validateStatus: () => true,
        maxRedirects: 0,
        headers: { "User-Agent": USER_AGENT },
        // Only buffer the body when we need to search it.
        responseType: keyword ? "text" : "stream",
        maxContentLength: MAX_BODY_BYTES,
      });

      const location = response.headers?.location;
      if (!followRedirects || !REDIRECT_CODES.has(response.status) || !location) break;

      (response.data as { destroy?: () => void } | undefined)?.destroy?.();
      if (hop + 1 > MAX_REDIRECTS) {
        return fail("HTTP_STATUS", `Too many redirects (>${MAX_REDIRECTS})`, response.status);
      }
      url = new URL(String(location), url).toString();
    }

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
