import { AlertTriangle, CheckCircle2, CircleHelp, Wrench, XCircle, type LucideIcon } from "lucide-react";
import type { IncidentUpdateStatus, PublicMonitorStatus, PublicPageStatus } from "@/lib/api/types";
import type { MonitorState } from "@/lib/monitor-format";

export const DEFAULT_ACCENT = "#ea580c";
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/** The accent as a CSS value, falling back to the brand token when unset or invalid. */
export function accentValue(color: string | null | undefined): string {
  return isHexColor(color) ? color : "var(--brand)";
}

/** Overall page banner per status. Status colors stay semantic; the accent never replaces them. */
export const OVERALL: Record<
  PublicPageStatus,
  { title: string; detail: string; icon: LucideIcon; tone: string; soft: string; dot: MonitorState }
> = {
  operational: {
    title: "All systems operational",
    detail: "Everything is running normally.",
    icon: CheckCircle2,
    tone: "text-success",
    soft: "bg-success/10 ring-success/20",
    dot: "up",
  },
  maintenance: {
    title: "Scheduled maintenance",
    detail: "Some services are under planned maintenance.",
    icon: Wrench,
    tone: "text-info",
    soft: "bg-info/10 ring-info/25",
    dot: "maintenance",
  },
  partial_outage: {
    title: "Partial outage",
    detail: "Some services are having problems. We're on it.",
    icon: AlertTriangle,
    tone: "text-warning",
    soft: "bg-warning/10 ring-warning/25",
    dot: "degraded",
  },
  major_outage: {
    title: "Major outage",
    detail: "Our services are down. We're working to restore them.",
    icon: XCircle,
    tone: "text-destructive",
    soft: "bg-destructive/10 ring-destructive/25",
    dot: "down",
  },
  unknown: {
    title: "Status not available yet",
    detail: "We haven't collected enough data to report a status.",
    icon: CircleHelp,
    tone: "text-muted-foreground",
    soft: "bg-muted ring-border",
    dot: "pending",
  },
};

/** Public monitor status → the app's visual state + label. */
export const MONITOR_STATUS: Record<PublicMonitorStatus, { state: MonitorState; label: string }> = {
  up: { state: "up", label: "Operational" },
  down: { state: "down", label: "Down" },
  maintenance: { state: "maintenance", label: "Maintenance" },
  paused: { state: "paused", label: "Paused" },
  unknown: { state: "pending", label: "No data" },
};

export const UPDATE_STATUS: Record<IncidentUpdateStatus, { label: string; soft: string; dot: string }> = {
  investigating: {
    label: "Investigating",
    soft: "bg-destructive/10 text-destructive ring-destructive/25",
    dot: "bg-destructive",
  },
  identified: { label: "Identified", soft: "bg-warning/10 text-warning ring-warning/25", dot: "bg-warning" },
  monitoring: { label: "Monitoring", soft: "bg-info/10 text-info ring-info/25", dot: "bg-info" },
  resolved: { label: "Resolved", soft: "bg-success/10 text-success ring-success/20", dot: "bg-success" },
};

/** Same rule as the API: outages outrank maintenance, maintenance outranks "all good". */
export function overallStatus(statuses: PublicMonitorStatus[]): PublicPageStatus {
  const maintenance = statuses.includes("maintenance");
  const active = statuses.filter((s) => s !== "paused" && s !== "maintenance");
  const down = active.filter((s) => s === "down").length;
  if (down > 0) return down === active.length ? "major_outage" : "partial_outage";
  if (maintenance) return "maintenance";
  if (active.length === 0 || active.every((s) => s === "unknown")) return "unknown";
  return "operational";
}

/** "YYYY-MM-DD" (UTC day) → "Mar 3, 2026". */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
