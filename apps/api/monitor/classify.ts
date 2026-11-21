import type { CheckErrorType } from "db/constants";
import { UnsafeUrlError } from "../utils/ssrf";

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ENODATA", "ESERVFAIL"]);
const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ESOCKETTIMEDOUT"]);
const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ERR_SOCKET_CONNECTION_TIMEOUT",
]);

/**
 * Map a thrown request error onto a coarse failure cause users can act on.
 */
export function classifyError(error: unknown): CheckErrorType {
  if (error instanceof UnsafeUrlError) {
    return error.message === "Could not resolve host" ? "DNS" : "BLOCKED";
  }

  const err = error as { code?: string; message?: string; response?: { status?: number } };
  const code = err?.code ?? "";
  const message = (err?.message ?? "").toLowerCase();

  if (err?.response?.status) return "HTTP_STATUS";
  if (DNS_CODES.has(code)) return "DNS";
  if (TIMEOUT_CODES.has(code) || message.includes("timeout")) return "TIMEOUT";
  if (
    code.startsWith("ERR_TLS") ||
    code.startsWith("CERT_") ||
    code.includes("CERT") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    message.includes("certificate") ||
    message.includes("ssl")
  ) {
    return "TLS";
  }
  if (CONNECTION_CODES.has(code)) return "CONNECTION";
  return "UNKNOWN";
}

/** Short, single-line error description safe to store and show to users. */
export function describeError(error: unknown): string {
  const err = error as { code?: string; message?: string };
  const text = [err?.code, err?.message].filter(Boolean).join(": ") || String(error);
  return text.replace(/\s+/g, " ").slice(0, 300);
}
