"use client";
import Link from "next/link";
import { AlertOctagon, Gauge, PauseCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Incident, Monitor } from "@/lib/api/types";
import { errorLabel, formatDuration, formatLatency, monitorState, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

const dateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: "destructive" | "warning" | "info" | "muted";
  icon: typeof Wrench;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const tones = {
    destructive: "border-destructive/25 bg-destructive/[0.06]",
    warning: "border-warning/30 bg-warning/[0.07]",
    info: "border-info/25 bg-info/[0.06]",
    muted: "border-border bg-muted/60",
  } as const;
  const iconTone = {
    destructive: "text-destructive",
    warning: "text-warning",
    info: "text-info",
    muted: "text-muted-foreground",
  } as const;
  return (
    <div
      role={tone === "destructive" ? "alert" : "status"}
      className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center", tones[tone])}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconTone[tone])} aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {children && <div className="text-xs text-muted-foreground">{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">{action}</div>}
    </div>
  );
}

/** One banner for the monitor's most important current condition. */
export function MonitorBanners({
  monitor: m,
  ongoing,
  pending,
  onResume,
  onEndMaintenance,
}: {
  monitor: Monitor;
  ongoing: Incident | undefined;
  pending: boolean;
  onResume: () => void;
  onEndMaintenance: () => void;
}) {
  const state = monitorState(m);

  if (state === "paused") {
    return (
      <Banner
        tone="muted"
        icon={PauseCircle}
        title="This monitor is paused"
        action={
          <Button size="sm" className="h-9" onClick={onResume} disabled={pending}>
            Resume monitoring
          </Button>
        }
      >
        No checks run and no alerts are sent until you resume it.
      </Banner>
    );
  }

  if (state === "maintenance" && m.maintenanceUntil) {
    return (
      <Banner
        tone="info"
        icon={Wrench}
        title={
          <>
            In maintenance until{" "}
            <time dateTime={m.maintenanceUntil} className="numeric">
              {dateTime.format(new Date(m.maintenanceUntil))}
            </time>
          </>
        }
        action={
          <Button size="sm" variant="outline" className="h-9" onClick={onEndMaintenance} disabled={pending}>
            End maintenance
          </Button>
        }
      >
        Alerts are muted and downtime isn&apos;t counted. Ends {timeAgo(m.maintenanceUntil)}.
      </Banner>
    );
  }

  if (state === "down") {
    const since = ongoing?.startedAt;
    const reason = m.lastErrorType ? errorLabel(m.lastErrorType) : "Checks are failing";
    return (
      <Banner
        tone="destructive"
        icon={AlertOctagon}
        title={
          <>
            Down{since ? <> for <span className="numeric">{formatDuration(Date.now() - new Date(since).getTime())}</span></> : null}
            {" — "}
            {reason}
            {m.type === "http" && m.lastStatusCode ? <span className="font-mono"> · HTTP {m.lastStatusCode}</span> : null}
          </>
        }
        action={
          ongoing ? (
            <Button asChild size="sm" variant="outline" className="h-9">
              <Link href={`/dashboard/incidents?id=${ongoing.id}`}>View incident</Link>
            </Button>
          ) : undefined
        }
      >
        {since && (
          <>
            Since{" "}
            <time dateTime={since} className="numeric">
              {dateTime.format(new Date(since))}
            </time>
            {m.lastErrorMessage ? " · " : ""}
          </>
        )}
        {m.lastErrorMessage && <span className="break-words font-mono">{m.lastErrorMessage}</span>}
        {!since && !m.lastErrorMessage && <>Last checked {timeAgo(m.lastCheckedAt)}.</>}
      </Banner>
    );
  }

  if (state === "degraded") {
    return (
      <Banner
        tone="warning"
        icon={Gauge}
        title={
          <>
            Degraded — responding slowly
            {m.lastLatency != null && (
              <>
                {" "}
                (<span className="numeric">{formatLatency(m.lastLatency)}</span>)
              </>
            )}
          </>
        }
      >
        {m.degradedThresholdMs != null
          ? `The last check took longer than the ${formatLatency(m.degradedThresholdMs)} threshold.`
          : "Recent checks are slower than expected."}
      </Banner>
    );
  }

  return null;
}
