"use client";
import { Activity, Clock, Gauge, HeartPulse, ShieldCheck, Timer } from "lucide-react";
import { Panel, StatCard } from "@/components/app/page";
import { STATE_STYLES, StatusDot } from "@/components/app/status";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitorAnalytics } from "@/hooks/queries";
import type { AnalyticsRange, Monitor } from "@/lib/api/types";
import { formatLatency, formatUptime, monitorState, STATE_LABEL, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { Segmented } from "../form/form-fields";
import { QueryError } from "../states";
import { HeartbeatSetup } from "./heartbeat-setup";
import { ResponseTimeChart } from "./response-time-chart";
import { UptimeCalendar } from "./uptime-calendar";

export const RANGES: { value: AnalyticsRange; label: string; long: string }[] = [
  { value: "24h", label: "24h", long: "last 24 hours" },
  { value: "7d", label: "7d", long: "last 7 days" },
  { value: "30d", label: "30d", long: "last 30 days" },
];

const DAY_MS = 86_400_000;
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function SslCard({ monitor }: { monitor: Monitor }) {
  if (!monitor.sslExpiresAt) {
    return (
      <StatCard
        label="SSL certificate"
        icon={ShieldCheck}
        value={<span className="text-muted-foreground">—</span>}
        hint="Checked daily once the site responds"
      />
    );
  }
  const days = Math.floor((new Date(monitor.sslExpiresAt).getTime() - Date.now()) / DAY_MS);
  const tone = days < 0 ? "text-destructive" : days <= 7 ? "text-destructive" : days <= 30 ? "text-warning" : undefined;
  return (
    <StatCard
      label="SSL certificate"
      icon={ShieldCheck}
      tone={tone}
      value={days < 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"}`}
      hint={
        <span className="block truncate" title={monitor.sslIssuer ?? undefined}>
          {days < 0 ? "Expired" : "Expires"} {new Date(monitor.sslExpiresAt).toLocaleDateString()}
          {monitor.sslIssuer ? ` · ${monitor.sslIssuer}` : ""}
        </span>
      }
    />
  );
}

function StatusCard({ monitor }: { monitor: Monitor }) {
  const state = monitorState(monitor);
  const last = monitor.type === "heartbeat" ? monitor.lastHeartbeatAt : monitor.lastCheckedAt;
  return (
    <StatCard
      label="Current status"
      icon={Activity}
      value={
        <span className={cn("inline-flex items-center gap-2", STATE_STYLES[state].text)}>
          <StatusDot state={state} className="size-2.5" />
          {STATE_LABEL[state]}
        </span>
      }
      hint={
        last ? (
          <time dateTime={last} title={dateTime.format(new Date(last))}>
            {monitor.type === "heartbeat" ? "Last ping" : "Last checked"} {timeAgo(last)}
            {monitor.type !== "heartbeat" && monitor.lastStatusCode ? ` · HTTP ${monitor.lastStatusCode}` : ""}
          </time>
        ) : monitor.type === "heartbeat" ? (
          "Waiting for the first ping"
        ) : (
          "Waiting for the first check"
        )
      }
    />
  );
}

function HeartbeatCards({ monitor }: { monitor: Monitor }) {
  const last = monitor.lastHeartbeatAt;
  const base = new Date(last ?? monitor.createdAt).getTime();
  const deadline = base + monitor.intervalSeconds * 1000 + (monitor.graceSeconds ?? 0) * 1000;
  const overdue = deadline < Date.now();
  return (
    <>
      <StatCard
        label="Last ping"
        icon={HeartPulse}
        value={last ? timeAgo(last) : "Never"}
        hint={last ? dateTime.format(new Date(last)) : "Add the ping URL to your job"}
      />
      <StatCard
        label={overdue ? "Deadline passed" : "Next ping due"}
        icon={Timer}
        tone={overdue && !monitor.paused ? "text-destructive" : undefined}
        value={monitor.paused ? "Paused" : timeAgo(new Date(deadline))}
        hint={monitor.paused ? "No deadline while paused" : `${dateTime.format(new Date(deadline))}, incl. grace`}
      />
    </>
  );
}

export function OverviewTab({
  monitor,
  range,
  onRangeChange,
}: {
  monitor: Monitor;
  range: AnalyticsRange;
  onRangeChange: (r: AnalyticsRange) => void;
}) {
  const analytics = useMonitorAnalytics(monitor.id, range);
  const a = analytics.data;
  const rangeLong = RANGES.find((r) => r.value === range)!.long;
  const isHeartbeat = monitor.type === "heartbeat";
  const isHttps = monitor.type === "http" && monitor.url.startsWith("https://");
  const loading = analytics.isPending;

  const uptimeTone =
    a && a.totalChecks ? (a.uptime >= 99.5 ? "text-success" : a.uptime >= 95 ? "text-warning" : "text-destructive") : undefined;

  const uptimeCard = loading ? (
    <Skeleton className="h-[106px] rounded-xl" />
  ) : (
    <StatCard
      label={`Uptime · ${range}`}
      icon={Gauge}
      tone={uptimeTone}
      value={a?.totalChecks ? formatUptime(a.uptime) : "—"}
      hint={
        a?.totalChecks ? (
          <>
            <span className="numeric">{a.downChecks.toLocaleString()}</span> failed of{" "}
            <span className="numeric">{a.totalChecks.toLocaleString()}</span> checks
          </>
        ) : (
          "No checks in this range"
        )
      }
    />
  );

  const latencyCard = loading ? (
    <Skeleton className="h-[106px] rounded-xl" />
  ) : (
    <StatCard
      label={`Response time · ${range}`}
      icon={Clock}
      value={
        a?.totalChecks ? (
          <span className="flex items-baseline gap-1.5">
            {formatLatency(a.latency.avg)}
            <span className="text-xs font-medium text-muted-foreground">avg</span>
          </span>
        ) : (
          "—"
        )
      }
      hint={
        a?.totalChecks ? (
          <span className="numeric">
            p95 {formatLatency(a.latency.p95)} · p99 {formatLatency(a.latency.p99)}
          </span>
        ) : (
          "No data yet"
        )
      }
    />
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing the <span className="font-medium text-foreground">{rangeLong}</span>
          {analytics.isFetching && !loading && <span className="sr-only"> (updating)</span>}
        </p>
        <Segmented<AnalyticsRange>
          label="Time range"
          size="sm"
          value={range}
          onChange={onRangeChange}
          options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard monitor={monitor} />
        {isHeartbeat ? <HeartbeatCards monitor={monitor} /> : uptimeCard}
        {isHeartbeat ? uptimeCard : latencyCard}
        {!isHeartbeat && (isHttps ? <SslCard monitor={monitor} /> : (
          <StatCard
            label="Last response"
            icon={Timer}
            value={formatLatency(monitor.lastLatency)}
            hint={a?.totalChecks ? <span className="numeric">min {formatLatency(a.latency.min)} · max {formatLatency(a.latency.max)}</span> : "From the latest check"}
          />
        ))}
      </div>

      {isHeartbeat && <HeartbeatSetup monitor={monitor} />}

      {!isHeartbeat && (
        <Panel
          title="Response time"
          description={`Average per period over the ${rangeLong}.`}
          actions={
            a?.totalChecks ? (
              <span className="numeric hidden text-xs text-muted-foreground sm:inline">
                p50 {formatLatency(a.latency.p50)} · p95 {formatLatency(a.latency.p95)}
              </span>
            ) : null
          }
        >
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : analytics.isError ? (
            <QueryError
              error={analytics.error}
              onRetry={() => analytics.refetch()}
              retrying={analytics.isFetching}
              title="Couldn't load response times"
              className="flex h-64 flex-col items-center justify-center gap-3 text-center"
            />
          ) : (
            <ResponseTimeChart
              series={a?.series ?? []}
              range={range}
              average={a?.totalChecks ? a.latency.avg : null}
              degradedThresholdMs={monitor.degradedThresholdMs}
            />
          )}
        </Panel>
      )}

      <UptimeCalendar monitorId={monitor.id} />
    </div>
  );
}
