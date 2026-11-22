"use client";
import Link from "next/link";
import { CheckCircle2, ChevronRight, MessageSquareText, ShieldCheck, Siren, UserCheck } from "lucide-react";
import { EmptyState } from "@/components/app/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitorIncidents } from "@/hooks/queries";
import type { Incident } from "@/lib/api/types";
import { errorLabel, formatDuration, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { QueryError } from "../states";

const dateTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function cause(i: Incident) {
  const label = i.errorType ? errorLabel(i.errorType) : i.lastStatusCode ? "Unexpected status code" : "Checks failed";
  return i.lastStatusCode ? `${label} · HTTP ${i.lastStatusCode}` : label;
}

function IncidentItem({ incident: i, last }: { incident: Incident; last: boolean }) {
  const duration = i.ongoing ? Date.now() - new Date(i.startedAt).getTime() : i.durationMs;
  return (
    <li className="relative flex gap-4">
      {/* Timeline rail */}
      <div className="relative flex w-8 shrink-0 justify-center" aria-hidden="true">
        {!last && <span className="absolute top-9 bottom-0 w-px bg-border" />}
        <span
          className={cn(
            "relative mt-2 grid size-8 place-items-center rounded-full ring-1 ring-inset",
            i.ongoing ? "bg-destructive/10 text-destructive ring-destructive/25" : "bg-success/10 text-success ring-success/20"
          )}
        >
          {i.ongoing ? <Siren className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
        </span>
      </div>
      <Link
        href={`/dashboard/incidents?id=${i.id}`}
        className="group mb-3 flex min-w-0 flex-1 items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-foreground/15 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                i.ongoing ? "bg-destructive/10 text-destructive ring-destructive/25" : "bg-success/10 text-success ring-success/20"
              )}
            >
              {i.ongoing ? "Ongoing" : "Resolved"}
            </span>
            {i.acknowledgedAt && i.ongoing && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
                <UserCheck className="size-3" aria-hidden="true" />
                Acknowledged
              </span>
            )}
            <span className="text-sm font-medium">{cause(i)}</span>
          </div>
          {i.errorMessage && (
            <p className="line-clamp-2 break-words font-mono text-xs text-muted-foreground">{i.errorMessage}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Started{" "}
              <time dateTime={i.startedAt} className="numeric" title={timeAgo(i.startedAt)}>
                {dateTime.format(new Date(i.startedAt))}
              </time>
            </span>
            {i.resolvedAt && (
              <span>
                Resolved{" "}
                <time dateTime={i.resolvedAt} className="numeric">
                  {dateTime.format(new Date(i.resolvedAt))}
                </time>
              </span>
            )}
            <span>
              {i.ongoing ? "Down for " : "Lasted "}
              <span className="numeric font-medium text-foreground">{formatDuration(duration)}</span>
            </span>
            {i.updates.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="size-3" aria-hidden="true" />
                <span className="numeric">{i.updates.length}</span> update{i.updates.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** Incident timeline for one monitor, linking into the incidents workspace. */
export function IncidentsTab({ monitorId }: { monitorId: string }) {
  const incidents = useMonitorIncidents(monitorId);

  if (incidents.isPending) {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading incidents">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="mt-2 size-8 shrink-0 rounded-full" />
            <Skeleton className="h-24 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  if (incidents.isError) {
    return (
      <QueryError
        error={incidents.error}
        onRetry={() => incidents.refetch()}
        retrying={incidents.isFetching}
        title="Couldn't load incidents"
      />
    );
  }

  const list = [...incidents.data].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  if (list.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No incidents"
        description="Outages will show up here."
      />
    );
  }

  const totalDown = list.reduce((sum, i) => sum + (i.durationMs ?? 0), 0);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="numeric font-medium text-foreground">{list.length}</span> incident{list.length === 1 ? "" : "s"}
        {totalDown > 0 && (
          <>
            {" "}
            · <span className="numeric font-medium text-foreground">{formatDuration(totalDown)}</span> of resolved downtime
          </>
        )}
      </p>
      <ol aria-label="Incidents, newest first">
        {list.map((i, idx) => (
          <IncidentItem key={i.id} incident={i} last={idx === list.length - 1} />
        ))}
      </ol>
    </div>
  );
}
