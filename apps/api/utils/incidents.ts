import { monitorTarget } from "../monitor/messages";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

export interface MonitorRefLike {
  _id?: unknown;
  name?: string | null;
  url?: string | null;
  type?: string | null;
  host?: string | null;
  port?: number | null;
}

/** Display name for a monitor: its name, else its URL host (or tcp/dns host). */
export function monitorDisplayName(m: MonitorRefLike | null | undefined): string {
  if (!m) return "Deleted monitor";
  const name = m.name?.trim();
  if (name) return name;
  if (m.type === "tcp" || m.type === "dns") return monitorTarget({ url: "", ...m } as any) || "Monitor";
  return hostOf(m.url ?? "") || (m.type === "heartbeat" ? "Heartbeat monitor" : "Monitor");
}

/** Where a monitor points: URL for http, host:port for tcp, host for dns, "" for heartbeats. */
export function monitorDisplayUrl(m: MonitorRefLike | null | undefined): string {
  if (!m) return "";
  return monitorTarget({ url: m.url ?? "", type: m.type ?? undefined, host: m.host ?? undefined, port: m.port });
}

const iso = (d: unknown): string | null => (d ? new Date(d as string).toISOString() : null);

/** Serialize an incident as the API's `IncidentDetail`. */
export function serializeIncident(incident: any, monitor: MonitorRefLike | null | undefined) {
  return {
    id: String(incident._id),
    websiteId: String(incident.websiteId),
    monitorName: monitorDisplayName(monitor),
    monitorUrl: monitorDisplayUrl(monitor),
    startedAt: iso(incident.startedAt)!,
    resolvedAt: iso(incident.resolvedAt),
    durationMs: incident.durationMs ?? null,
    ongoing: Boolean(incident.ongoing),
    lastStatusCode: incident.lastStatusCode ?? null,
    errorType: incident.errorType ?? null,
    errorMessage: incident.errorMessage ?? null,
    acknowledgedAt: iso(incident.acknowledgedAt),
    updates: (incident.updates ?? []).map((u: any) => ({
      id: String(u._id),
      at: iso(u.at)!,
      message: u.message,
      status: u.status,
      public: Boolean(u.public),
    })),
  };
}

export type IncidentDetail = ReturnType<typeof serializeIncident>;
