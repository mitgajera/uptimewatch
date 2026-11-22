import type { PublicStatusPage } from "@/lib/api/types";
import { StatusBadge } from "@/components/app/status";
import { UptimeBars, uptimeTone, type UptimeBar } from "@/components/app/uptime-bars";
import { formatUptime } from "@/lib/monitor-format";
import { formatDay, MONITOR_STATUS } from "./status-meta";

type PublicMonitor = PublicStatusPage["monitors"][number];

const DAYS_FULL = 90;
const DAYS_COMPACT = 30;

/** Pad to a fixed number of days so every row's bars line up, oldest first. */
function toBars(days: PublicMonitor["days"], count: number): UptimeBar[] {
  const recent = days.slice(-count);
  const padding: UptimeBar[] = Array.from({ length: Math.max(0, count - recent.length) }, (_, i) => ({
    key: `pad-${i}`,
    tone: "none",
    label: "No data",
  }));
  return [
    ...padding,
    ...recent.map((d) => ({
      key: d.date,
      tone: uptimeTone(d.uptime),
      label: `${formatDay(d.date)} · ${d.uptime == null ? "No data" : `${formatUptime(d.uptime)} uptime`}`,
    })),
  ];
}

/** One service: name, live status, and daily uptime bars (30 when narrow, 90 when wide). */
export function MonitorStatusRow({ monitor }: { monitor: PublicMonitor }) {
  const status = MONITOR_STATUS[monitor.status];
  const uptime = formatUptime(monitor.uptime);
  return (
    <li className="space-y-3 px-4 py-4 @lg:px-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-medium">{monitor.name}</h3>
        <StatusBadge state={status.state} label={status.label} className="shrink-0" />
      </div>
      <UptimeBars
        bars={toBars(monitor.days, DAYS_COMPACT)}
        className="h-9 @xl:hidden"
        ariaLabel={`${monitor.name}: ${uptime} uptime over the last ${DAYS_COMPACT} days`}
      />
      <UptimeBars
        bars={toBars(monitor.days, DAYS_FULL)}
        className="hidden h-9 @xl:flex"
        ariaLabel={`${monitor.name}: ${uptime} uptime over the last ${DAYS_FULL} days`}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          <span className="numeric @xl:hidden">{DAYS_COMPACT}</span>
          <span className="numeric hidden @xl:inline">{DAYS_FULL}</span> days ago
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>
          <span className="numeric font-medium text-foreground">{uptime}</span> uptime
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>Today</span>
      </div>
    </li>
  );
}

const LEGEND = [
  { label: "Operational", className: "bg-success/85" },
  { label: "Degraded", className: "bg-warning/85" },
  { label: "Outage", className: "bg-destructive/85" },
  { label: "No data", className: "bg-muted ring-1 ring-inset ring-border" },
];

export function UptimeLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {LEGEND.map((l) => (
        <li key={l.label} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-1.5 rounded-[2px] ${l.className}`} aria-hidden="true" />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
