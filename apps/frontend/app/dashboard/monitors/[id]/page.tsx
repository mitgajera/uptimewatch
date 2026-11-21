"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Gauge,
  Pause,
  Pencil,
  Play,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMonitor, useMonitorAnalytics, useMonitorIncidents, useUpdateMonitor } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AnalyticsRange, Monitor } from "@/lib/api/types";
import {
  displayName,
  errorLabel,
  formatInterval,
  formatLatency,
  formatUptime,
  monitorState,
  timeAgo,
} from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { StatusLabel } from "@/components/monitors/status-indicator";
import { RecentChecksBar } from "@/components/monitors/recent-checks-bar";
import { LatencyChart } from "@/components/monitors/latency-chart";
import { IncidentList } from "@/components/monitors/incident-list";
import { MonitorFormDialog } from "@/components/monitors/monitor-form-dialog";
import { DeleteMonitorDialog } from "@/components/monitors/delete-monitor-dialog";
import { HeartbeatSetup } from "@/components/monitors/heartbeat-setup";
import { MaintenanceMenu } from "@/components/monitors/maintenance-menu";
import { PageSpeedInsightsModal } from "@/components/monitors/pagespeed-panel";

const RANGES: AnalyticsRange[] = ["24h", "7d", "30d"];
const DAY_MS = 24 * 60 * 60 * 1000;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SslSummary({ monitor }: { monitor: Monitor }) {
  if (!monitor.url.startsWith("https://")) return <>Not HTTPS</>;
  if (!monitor.sslExpiresAt) return <>Pending</>;
  const days = Math.floor((new Date(monitor.sslExpiresAt).getTime() - Date.now()) / DAY_MS);
  const tone = days < 7 ? "text-destructive" : days < 30 ? "text-warning" : "";
  return <span className={tone}>{days < 0 ? "Expired" : `${days} days`}</span>;
}

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [range, setRange] = useState<AnalyticsRange>("24h");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);

  const monitor = useMonitor(id);
  const analytics = useMonitorAnalytics(id, range);
  const incidents = useMonitorIncidents(id);
  const update = useUpdateMonitor(id);

  if (monitor.isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading monitor">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-2/3" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[86px]" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (monitor.isError || !monitor.data) {
    const notFound = (monitor.error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <h1 className="text-lg font-semibold">{notFound ? "Monitor not found" : "Couldn't load this monitor"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {notFound ? "It may have been deleted." : apiErrorMessage(monitor.error)}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to monitors</Link>
          </Button>
          {!notFound && (
            <Button onClick={() => monitor.refetch()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const m = monitor.data;
  const state = monitorState(m);
  const name = displayName(m);
  const lastFailure = m.websiteTicks.find((t) => t.status === "DOWN");
  const isHeartbeat = m.type === "heartbeat";
  const graceMinutes = Math.round((m.graceSeconds ?? 300) / 60);

  async function togglePause() {
    try {
      await update.mutateAsync({ paused: !m.paused });
      toast.success(m.paused ? "Monitoring resumed" : "Monitoring paused");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update the monitor."));
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Monitors
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <StatusLabel state={state} />
            <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
            {isHeartbeat ? (
              <p className="text-sm text-muted-foreground">
                Heartbeat · last ping {timeAgo(m.lastHeartbeatAt)}
              </p>
            ) : (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{m.url}</span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            )}
            <p className="text-xs text-muted-foreground">
              {isHeartbeat
                ? `Expected every ${formatInterval(m.intervalSeconds)} + ${graceMinutes} min grace`
                : `${m.method} every ${formatInterval(m.intervalSeconds)} · checked ${timeAgo(m.lastCheckedAt)}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={togglePause} disabled={update.isPending}>
              {m.paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
              {m.paused ? "Resume" : "Pause"}
            </Button>
            {!m.paused && <MaintenanceMenu monitor={m} active={state === "maintenance"} />}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            {!isHeartbeat && (
              <Button variant="outline" onClick={() => setSpeedOpen(true)}>
                <Gauge className="size-4" aria-hidden="true" />
                PageSpeed
              </Button>
            )}
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {state === "maintenance" && m.maintenanceUntil && (
        <div role="status" className="rounded-lg border bg-secondary p-4 text-sm">
          <p className="font-medium">Under maintenance</p>
          <p className="text-muted-foreground">
            Checks and alerts resume{" "}
            <time dateTime={m.maintenanceUntil}>{new Date(m.maintenanceUntil).toLocaleString()}</time>. Status
            pages show this monitor as under maintenance.
          </p>
        </div>
      )}

      {state === "down" && (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-destructive">
              {errorLabel(m.lastErrorType)}
              {m.lastStatusCode ? ` (HTTP ${m.lastStatusCode})` : ""}
            </p>
            {lastFailure?.errorMessage && (
              <p className="mt-0.5 break-words text-muted-foreground">{lastFailure.errorMessage}</p>
            )}
          </div>
        </div>
      )}

      {isHeartbeat && (
        <Section title="Setup">
          <HeartbeatSetup monitor={m} />
        </Section>
      )}

      <div className={cn("grid grid-cols-2 gap-3", isHeartbeat ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        <Stat
          label={`Uptime (${range})`}
          value={analytics.data ? formatUptime(analytics.data.uptime) : "—"}
          hint={analytics.data ? `${analytics.data.downChecks} failed of ${analytics.data.totalChecks}` : undefined}
        />
        {!isHeartbeat && (
        <Stat
          label="Avg response"
          value={analytics.data ? formatLatency(analytics.data.latency.avg) : "—"}
          hint={analytics.data ? `p95 ${formatLatency(analytics.data.latency.p95)}` : undefined}
        />
        )}
        {isHeartbeat ? (
          <>
            <Stat label="Last ping" value={timeAgo(m.lastHeartbeatAt)} />
            <Stat label="Ping period" value={formatInterval(m.intervalSeconds)} hint={`${graceMinutes} min grace`} />
          </>
        ) : (
          <>
            <Stat
              label="Last response"
              value={formatLatency(m.lastLatency)}
              hint={m.lastStatusCode ? `HTTP ${m.lastStatusCode}` : undefined}
            />
            <Stat label="SSL certificate" value={<SslSummary monitor={m} />} hint={m.sslIssuer ?? undefined} />
          </>
        )}
      </div>

      {!isHeartbeat && (
      <Section
        title="Response time"
        action={
          <div role="group" aria-label="Time range" className="inline-flex rounded-md border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  "min-h-8 min-w-12 rounded-[5px] px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        <div className="rounded-lg border bg-card p-4">
          {analytics.isPending ? (
            <Skeleton className="h-56" />
          ) : analytics.isError ? (
            <div className="grid h-56 place-items-center text-sm text-muted-foreground">
              <div className="text-center">
                <p>Couldn&apos;t load response times.</p>
                <Button variant="link" onClick={() => analytics.refetch()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <LatencyChart data={analytics.data.series} range={range} />
          )}
        </div>
      </Section>

      )}

      {!isHeartbeat && (
      <Section title="Last 30 minutes">
        <div className="rounded-lg border bg-card p-4">
          <RecentChecksBar ticks={m.websiteTicks} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>30 min ago</span>
            <span>Now</span>
          </div>
        </div>
      </Section>

      )}

      <Section title="Incidents">
        {incidents.isPending ? (
          <Skeleton className="h-24" />
        ) : incidents.isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load incidents.{" "}
            <Button variant="link" className="h-auto p-0" onClick={() => incidents.refetch()}>
              Try again
            </Button>
          </p>
        ) : (
          <IncidentList incidents={incidents.data} />
        )}
      </Section>

      <Section title="Configuration">
        <dl className="grid gap-x-6 gap-y-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
          {(isHeartbeat
            ? [
                ["Ping period", formatInterval(m.intervalSeconds)],
                ["Grace period", `${graceMinutes} min`],
              ]
            : [
            ["Method", m.method],
            ["Interval", formatInterval(m.intervalSeconds)],
            ["Timeout", `${m.timeoutMs / 1000}s`],
            ["Expected status", m.expectedStatus],
            ["Alert after", `${m.failureThreshold} failed check${m.failureThreshold === 1 ? "" : "s"}`],
            ["Follow redirects", m.followRedirects ? "Yes" : "No"],
            ["Required text", m.keyword ? `“${m.keyword}”` : "None"],
          ]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Alerts go to your channels on the{" "}
          <Link href="/dashboard/alerts" className="underline underline-offset-2 hover:text-foreground">
            Alerts
          </Link>{" "}
          page.
        </p>
      </Section>

      <MonitorFormDialog open={editOpen} onOpenChange={setEditOpen} monitor={m} />
      <DeleteMonitorDialog
        monitorId={m.id}
        name={name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/dashboard")}
      />
      <Dialog open={speedOpen} onOpenChange={setSpeedOpen}>
        <DialogContent className="h-[98dvh] w-[98vw] max-w-5xl gap-0 p-0 sm:h-[85vh] sm:w-[85vw]">
          <DialogHeader className="sr-only">
            <DialogTitle>PageSpeed Insights for {name}</DialogTitle>
          </DialogHeader>
          {speedOpen && <PageSpeedInsightsModal websiteId={m.id} url={m.url} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
