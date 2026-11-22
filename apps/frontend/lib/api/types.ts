// Shapes returned by the UptimeWatch API (/api/v1). See docs/api-contract.md.

export type MonitorType = "http" | "tcp" | "dns" | "heartbeat";
export type MonitorMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
export type KeywordMode = "contains" | "absent";
export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";

export const MONITOR_TYPES: MonitorType[] = ["http", "tcp", "dns", "heartbeat"];
export const MONITOR_METHODS: MonitorMethod[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
export const DNS_RECORD_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];
export const MONITOR_INTERVALS = [60, 120, 300, 600, 900, 1800, 3600, 21600, 43200, 86400] as const;
export const REMINDER_OPTIONS = [0, 15, 30, 60, 240, 1440] as const;

export type CheckErrorType =
  | "DNS"
  | "DNS_MISMATCH"
  | "TIMEOUT"
  | "CONNECTION"
  | "TLS"
  | "HTTP_STATUS"
  | "KEYWORD"
  | "BLOCKED"
  | "MISSED"
  | "UNKNOWN";

export interface MonitorHeader {
  name: string;
  value: string;
}

export interface MonitorConfig {
  type: MonitorType;
  name: string;
  url: string;
  method: MonitorMethod;
  headers: MonitorHeader[];
  body: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: string;
  keyword: string;
  keywordMode: KeywordMode;
  followRedirects: boolean;
  degradedThresholdMs: number | null;
  host: string;
  port: number | null;
  dnsRecordType: DnsRecordType;
  dnsExpected: string;
  failureThreshold: number;
  paused: boolean;
  graceSeconds: number;
  tags: string[];
  alertChannelIds: string[];
  reminderMinutes: number;
}

export interface Tick {
  id: string;
  websiteId: string;
  createdAt: string;
  status: "UP" | "DOWN";
  latency: number;
  statusCode?: number | null;
  errorType?: CheckErrorType | null;
  errorMessage?: string | null;
}

export interface Monitor extends MonitorConfig {
  id: string;
  isDown: boolean;
  isDegraded?: boolean;
  consecutiveFailures: number;
  lastCheckedAt?: string | null;
  lastStatusCode?: number | null;
  lastLatency?: number | null;
  lastErrorType?: CheckErrorType | null;
  lastErrorMessage?: string | null;
  sslExpiresAt?: string | null;
  sslIssuer?: string | null;
  heartbeatToken?: string | null;
  lastHeartbeatAt?: string | null;
  maintenanceUntil?: string | null;
  createdAt: string;
  /** Ticks from the last 30 minutes, newest first (list endpoints only). */
  websiteTicks: Tick[];
  uptime24h?: number | null;
  avgLatency24h?: number | null;
  checks24h?: number;
  /** 24 hourly average latencies, oldest first; 0 = no data (list only). */
  sparkline?: number[];
}

export interface CheckNowResult {
  status: "UP" | "DOWN";
  latency: number;
  statusCode: number | null;
  errorType: CheckErrorType | null;
  errorMessage: string | null;
  checkedAt: string;
}

export type BulkAction = "pause" | "resume" | "delete" | "addTag" | "removeTag";

export interface ChecksPage {
  checks: Tick[];
  nextBefore: string | null;
}

export interface CalendarDay {
  date: string;
  uptime: number | null;
  checks: number;
  downChecks: number;
}

export type AnalyticsRange = "24h" | "7d" | "30d";

export interface MonitorAnalytics {
  range: AnalyticsRange;
  uptime: number;
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  latency: { avg: number; p50: number; p95: number; p99: number; min: number; max: number };
  series: { t: number; avgLatency: number; up: boolean }[];
}

export type IncidentUpdateStatus = "investigating" | "identified" | "monitoring" | "resolved";
export const INCIDENT_UPDATE_STATUSES: IncidentUpdateStatus[] = ["investigating", "identified", "monitoring", "resolved"];

export interface IncidentUpdate {
  id: string;
  at: string;
  message: string;
  status: IncidentUpdateStatus;
  public: boolean;
}

export interface Incident {
  id: string;
  websiteId: string;
  monitorName: string;
  monitorUrl: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
  ongoing: boolean;
  lastStatusCode: number | null;
  errorType?: CheckErrorType | null;
  errorMessage?: string | null;
  acknowledgedAt: string | null;
  updates: IncidentUpdate[];
}

export type IncidentFilter = "open" | "acknowledged" | "resolved" | "all";

export interface IncidentsPage {
  incidents: Incident[];
  nextBefore: string | null;
}

export interface Overview {
  counts: {
    total: number;
    up: number;
    down: number;
    degraded: number;
    paused: number;
    maintenance: number;
    pending: number;
  };
  uptime24h: number | null;
  uptime7d: number | null;
  avgLatency24h: number | null;
  openIncidents: number;
  latencySeries: { t: number; avg: number | null }[];
  recentIncidents: Incident[];
  sslExpiring: { id: string; name: string; url: string; sslExpiresAt: string; daysLeft: number }[];
}

export type AlertChannelType = "email" | "slack" | "discord" | "webhook" | "telegram" | "teams" | "googlechat" | "ntfy";

export interface AlertChannel {
  id: string;
  type: AlertChannelType;
  name: string;
  target: string;
  chatId?: string;
  enabled: boolean;
  createdAt: string;
}

export interface StatusPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  websiteIds: string[];
  published: boolean;
  logoUrl: string;
  accentColor: string;
  announcement: string;
  showIncidentHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicMonitorStatus = "up" | "down" | "maintenance" | "paused" | "unknown";
export type PublicPageStatus = "operational" | "maintenance" | "partial_outage" | "major_outage" | "unknown";

export interface PublicStatusPage {
  title: string;
  description: string;
  logoUrl?: string;
  accentColor?: string;
  announcement?: string;
  status: PublicPageStatus;
  generatedAt: string;
  monitors: {
    id: string;
    name: string;
    status: PublicMonitorStatus;
    uptime: number | null;
    days: { date: string; uptime: number | null }[];
  }[];
  incidents: {
    id: string;
    monitor: string;
    title?: string;
    startedAt: string;
    resolvedAt: string | null;
    durationMs: number | null;
    ongoing: boolean;
    updates?: { at: string; message: string; status: IncidentUpdateStatus }[];
  }[];
}
