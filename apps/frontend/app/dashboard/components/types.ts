export type WindowStatus = 'up' | 'down' | 'unknown';

export interface WebsiteTick {
  id: string;
  websiteId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  latency: number;
  statusCode?: number | null;
}

export interface Website {
  id: string;
  url: string;
  name?: string;
  userId: string;
  disabled: boolean;
  isDown?: boolean;
  websiteTicks: WebsiteTick[];
}

export interface AddWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (website: { name: string; url: string }) => void;
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

export interface WebsiteAnalytics {
  range: string;
  uptime: number;
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  series: { t: number; avgLatency: number; up: boolean }[];
}

export interface Incident {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
  ongoing: boolean;
  lastStatusCode: number | null;
}
