// Shapes returned by the UptimeWatch API (/api/v1).

export type MonitorMethod = "GET" | "HEAD" | "POST";
export type MonitorType = "http" | "heartbeat";

export type CheckErrorType =
  | "DNS"
  | "TIMEOUT"
  | "CONNECTION"
  | "TLS"
  | "HTTP_STATUS"
  | "KEYWORD"
  | "BLOCKED"
  | "MISSED"
  | "UNKNOWN";

export const MONITOR_INTERVALS = [60, 120, 300, 600, 900, 1800, 3600, 21600, 43200, 86400] as const;

export interface MonitorConfig {
  type: MonitorType;
  name: string;
  url: string;
  method: MonitorMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: string;
  keyword: string;
  followRedirects: boolean;
  failureThreshold: number;
  paused: boolean;
  graceSeconds: number;
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
  consecutiveFailures: number;
  lastCheckedAt?: string | null;
  lastStatusCode?: number | null;
  lastLatency?: number | null;
  lastErrorType?: CheckErrorType | null;
  sslExpiresAt?: string | null;
  sslIssuer?: string | null;
  heartbeatToken?: string | null;
  lastHeartbeatAt?: string | null;
  createdAt: string;
  /** Ticks from the last 30 minutes, newest first (list endpoints only). */
  websiteTicks: Tick[];
  uptime24h?: number | null;
  avgLatency24h?: number | null;
  checks24h?: number;
}

export interface DashboardStats {
  totalMonitors: number;
  up: number;
  down: number;
  avgUptime: number;
  avgResponseTime: number;
  activeIncidents: number;
  checksLast24h: number;
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

export interface Incident {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
  ongoing: boolean;
  lastStatusCode: number | null;
  errorType?: CheckErrorType | null;
  errorMessage?: string | null;
}

export type AlertChannelType = "email" | "slack" | "discord" | "webhook";

export interface AlertChannel {
  id: string;
  type: AlertChannelType;
  name: string;
  target: string;
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
  createdAt: string;
  updatedAt: string;
}

export type PublicMonitorStatus = "up" | "down" | "paused" | "unknown";
export type PublicPageStatus = "operational" | "partial_outage" | "major_outage" | "unknown";

export interface PublicStatusPage {
  title: string;
  description: string;
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
    startedAt: string;
    resolvedAt: string | null;
    durationMs: number | null;
    ongoing: boolean;
  }[];
}
