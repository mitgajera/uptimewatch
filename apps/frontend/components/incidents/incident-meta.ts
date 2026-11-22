import type { Incident, IncidentFilter } from "@/lib/api/types";
import { errorLabel } from "@/lib/monitor-format";

export type IncidentState = "ongoing" | "acknowledged" | "resolved";

export function incidentState(i: Pick<Incident, "ongoing" | "acknowledgedAt">): IncidentState {
  if (!i.ongoing) return "resolved";
  return i.acknowledgedAt ? "acknowledged" : "ongoing";
}

export const INCIDENT_STATE: Record<IncidentState, { label: string; dot: string; soft: string; text: string }> = {
  ongoing: {
    label: "Ongoing",
    dot: "bg-destructive",
    soft: "bg-destructive/10 text-destructive ring-destructive/25",
    text: "text-destructive",
  },
  acknowledged: {
    label: "Acknowledged",
    dot: "bg-warning",
    soft: "bg-warning/10 text-warning ring-warning/25",
    text: "text-warning",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-success",
    soft: "bg-success/10 text-success ring-success/20",
    text: "text-success",
  },
};

export const FILTERS: { value: IncidentFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

export function isIncidentFilter(v: string | null): v is IncidentFilter {
  return v === "open" || v === "acknowledged" || v === "resolved" || v === "all";
}

export function incidentHeadline(i: Pick<Incident, "monitorName" | "ongoing">): string {
  return i.ongoing ? `${i.monitorName} is down` : `${i.monitorName} was down`;
}

/** "Unexpected status code · HTTP 503", or the error label alone. */
export function incidentCause(i: Pick<Incident, "errorType" | "lastStatusCode">): string {
  const label = errorLabel(i.errorType);
  return i.errorType === "HTTP_STATUS" && i.lastStatusCode ? `${label} · HTTP ${i.lastStatusCode}` : label;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
