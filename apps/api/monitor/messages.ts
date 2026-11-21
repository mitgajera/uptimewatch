import type { CheckErrorType } from "db/constants";

const ERROR_LABELS: Record<CheckErrorType, string> = {
  DNS: "DNS lookup failed",
  TIMEOUT: "Request timed out",
  CONNECTION: "Connection failed",
  TLS: "TLS/SSL error",
  HTTP_STATUS: "Unexpected HTTP status",
  KEYWORD: "Keyword not found",
  BLOCKED: "Blocked target address",
  UNKNOWN: "Unknown error",
};

export function errorLabel(type: CheckErrorType | null | undefined): string {
  return type ? ERROR_LABELS[type] : "Unknown error";
}

export interface AlertMessage {
  subject: string;
  message: string;
}

interface MonitorRef {
  name?: string;
  url: string;
}

const labelOf = (m: MonitorRef) => m.name?.trim() || m.url;

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function downAlert(
  monitor: MonitorRef,
  failure: { errorType: CheckErrorType | null; errorMessage: string | null; statusCode: number | null }
): AlertMessage {
  const label = labelOf(monitor);
  const reason = failure.errorMessage || errorLabel(failure.errorType);
  return {
    subject: `🔴 ${label} is DOWN`,
    message: [
      `${label} is DOWN.`,
      ``,
      `URL: ${monitor.url}`,
      `Reason: ${errorLabel(failure.errorType)}${failure.statusCode ? ` (HTTP ${failure.statusCode})` : ""}`,
      `Details: ${reason}`,
      `Detected: ${new Date().toUTCString()}`,
    ].join("\n"),
  };
}

export function recoveryAlert(monitor: MonitorRef, downtimeMs: number | null): AlertMessage {
  const label = labelOf(monitor);
  return {
    subject: `🟢 ${label} is back UP`,
    message: [
      `${label} is back UP.`,
      ``,
      `URL: ${monitor.url}`,
      downtimeMs != null ? `Downtime: ${formatDuration(downtimeMs)}` : null,
      `Recovered: ${new Date().toUTCString()}`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  };
}
