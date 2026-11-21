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
 * Search the first MAX_BODY_BYTES of a response for `keyword`, stopping as
 * soon as it's found. A larger body isn't a failure: only its start is read.
 */
async function bodyContains(body: unknown, keyword: string): Promise<boolean> {
  if (typeof body === "string") return body.slice(0, MAX_BODY_BYTES).includes(keyword);
  const stream = body as AsyncIterable<Uint8Array | string> & { destroy?: () => void };
  if (!stream || typeof stream[Symbol.asyncIterator] !== "function") return false;

  const decoder = new TextDecoder();
  let seen = 0;
  let tail = "";
  try {
    for await (const chunk of stream) {
      const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      const slice = bytes.subarray(0, MAX_BODY_BYTES - seen);
      seen += slice.length;
      // Keep the end of the previous chunk so a keyword split across chunks matches.
      const text = tail + decoder.decode(slice, { stream: true });
      if (text.includes(keyword)) return true;
      tail = text.slice(-(keyword.length - 1) || text.length);
      if (seen >= MAX_BODY_BYTES) return false;
    }
    return (tail + decoder.decode()).includes(keyword);
  } finally {
    stream.destroy?.();
  }
}

/**
 * Perform a single HTTP check against a monitor target and report whether it
 * is UP, how long it took, the status code received and, if it failed, why.
 */
export async function runHttpCheck(
  target: CheckTarget,
  deps: CheckDeps = defaultDeps
): Promise<CheckResult> {
  const keywordToFind = target.keyword?.trim() ?? "";
  // HEAD responses have no body, so a keyword check needs GET.
  let method: MonitorMethod = keywordToFind && target.method === "HEAD" ? "GET" : target.method ?? MONITOR_DEFAULTS.method;
  const timeout = target.timeoutMs ?? MONITOR_DEFAULTS.timeoutMs;
  const keyword = keywordToFind;
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
        // Stream, so a keyword search can stop early and big bodies aren't buffered.
        responseType: "stream",
      });

      const location = response.headers?.location;
      if (!followRedirects || !REDIRECT_CODES.has(response.status) || !location) break;

      (response.data as { destroy?: () => void } | undefined)?.destroy?.();
      if (hop + 1 > MAX_REDIRECTS) {
        return fail("HTTP_STATUS", `Too many redirects (>${MAX_REDIRECTS})`, response.status);
      }
      url = new URL(String(location), url).toString();
      // Same as browsers: 303 always becomes GET, and so does POST on 301/302.
      if ((response.status === 303 && method !== "HEAD") || (method === "POST" && response.status < 303)) {
        method = "GET";
      }
    }

    const latency = deps.now() - startTime;
    if (!isExpected(response.status)) {
      (response.data as { destroy?: () => void } | undefined)?.destroy?.();
      return fail("HTTP_STATUS", `Unexpected HTTP ${response.status}`, response.status);
    }

    const found = keyword ? await bodyContains(response.data, keyword) : true;
    if (!keyword) (response.data as { destroy?: () => void } | undefined)?.destroy?.();
    if (!found) {
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
