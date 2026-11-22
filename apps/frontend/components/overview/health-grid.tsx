"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/app/page";
import { MonitorTypeIcon, STATE_STYLES, StatusDot } from "@/components/app/status";
import { Sparkline } from "@/components/app/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import type { Monitor } from "@/lib/api/types";
import {
  displayName,
  formatLatency,
  formatUptime,
  monitorState,
  STATE_LABEL,
  STATE_ORDER,
  TYPE_LABEL,
} from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { sparklineTone, uptimeTextClass } from "@/components/monitor-list/utils";
import { QueryError } from "@/components/monitor-list/query-error";

const LIMIT = 12;

function Tile({ m }: { m: Monitor }) {
  const state = monitorState(m);
  const problem = state === "down" || state === "degraded";
  return (
    <li>
      <Link
        href={`/dashboard/monitors/${m.id}`}
        className={cn(
          "group flex h-full flex-col gap-3 rounded-lg border bg-card p-3 transition-colors duration-150",
          "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          state === "down" && "border-destructive/30 bg-destructive/5 hover:bg-destructive/10",
          state === "degraded" && "border-warning/30 bg-warning/5 hover:bg-warning/10"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot state={state} />
          <span className="truncate text-sm font-medium">{displayName(m)}</span>
          <span className="sr-only">, {STATE_LABEL[state]}</span>
          <MonitorTypeIcon type={m.type} className="ml-auto size-3.5 shrink-0 text-muted-foreground/70" />
          <span className="sr-only">{TYPE_LABEL[m.type]}</span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {problem ? (
              <p className={cn("text-xs font-medium", STATE_STYLES[state].text)}>{STATE_LABEL[state]}</p>
            ) : (
              <p className={cn("numeric text-sm font-semibold", uptimeTextClass(m.uptime24h))}>
                {formatUptime(m.uptime24h)}
              </p>
            )}
            <p className="numeric text-[11px] text-muted-foreground">
              {problem
                ? `${formatUptime(m.uptime24h)} uptime`
                : m.type === "heartbeat"
                  ? "24h uptime"
                  : formatLatency(m.avgLatency24h)}
            </p>
          </div>
          {m.type !== "heartbeat" && (
            <Sparkline values={m.sparkline} width={72} height={26} tone={sparklineTone(state)} />
          )}
        </div>
      </Link>
    </li>
  );
}

export function HealthGrid({
  monitors,
  isPending,
  error,
  onRetry,
}: {
  monitors: Monitor[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const sorted = [...(monitors ?? [])].sort(
    (a, b) =>
      STATE_ORDER[monitorState(a)] - STATE_ORDER[monitorState(b)] || displayName(a).localeCompare(displayName(b))
  );
  const shown = sorted.slice(0, LIMIT);

  return (
    <Panel
      title="Monitor health"
      description="Problems first · 24h uptime and response trend"
      actions={
        <Link
          href="/dashboard/monitors"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
          {sorted.length > 0 && <span className="numeric">({sorted.length})</span>}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {isPending ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </ul>
      ) : error ? (
        <QueryError error={error} title="Couldn't load monitors" onRetry={onRetry} className="py-8" />
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => (
              <Tile key={m.id} m={m} />
            ))}
          </ul>
          {sorted.length > LIMIT && (
            <Link
              href="/dashboard/monitors"
              className="numeric mt-3 flex h-9 items-center justify-center rounded-md border border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sorted.length - LIMIT} more monitor{sorted.length - LIMIT === 1 ? "" : "s"}
            </Link>
          )}
        </>
      )}
    </Panel>
  );
}
