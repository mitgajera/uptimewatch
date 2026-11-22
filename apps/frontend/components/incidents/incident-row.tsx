"use client";
import { ChevronRight, MessageSquareText } from "lucide-react";
import type { Incident } from "@/lib/api/types";
import { formatDuration, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { LiveDuration } from "@/components/status-pages/time";
import { formatDateTime, INCIDENT_STATE, incidentCause, incidentState } from "./incident-meta";

export function IncidentStateIndicator({ incident, className }: { incident: Incident; className?: string }) {
  const state = incidentState(incident);
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden="true">
      {state === "ongoing" && (
        <span className={cn("animate-status-pulse absolute inset-0 rounded-full", INCIDENT_STATE[state].dot)} />
      )}
      <span className={cn("relative inline-flex size-full rounded-full", INCIDENT_STATE[state].dot)} />
    </span>
  );
}

export function IncidentStatePill({ incident, className }: { incident: Incident; className?: string }) {
  const state = incidentState(incident);
  const s = INCIDENT_STATE[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        s.soft,
        className
      )}
    >
      <IncidentStateIndicator incident={incident} className="size-2" />
      {s.label}
    </span>
  );
}

/** A clickable incident row; stacks on mobile, aligns into columns from `md`. */
export function IncidentRow({
  incident: i,
  selected,
  onOpen,
  now,
}: {
  incident: Incident;
  selected: boolean;
  onOpen: () => void;
  now: number;
}) {
  const state = incidentState(i);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "group grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset md:grid-cols-[auto_minmax(0,1fr)_11rem_7rem_9rem_auto] md:items-center",
          selected && "bg-accent/60"
        )}
      >
        <IncidentStateIndicator incident={i} className="mt-1.5 md:mt-0" />

        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{i.monitorName}</span>
            <span className={cn("shrink-0 text-xs font-medium md:hidden", INCIDENT_STATE[state].text)}>
              {INCIDENT_STATE[state].label}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {incidentCause(i)}
            {i.errorMessage && <span className="text-muted-foreground/80"> — {i.errorMessage}</span>}
          </span>
          {/* Mobile meta line */}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:hidden">
            <span className="numeric">{timeAgo(i.startedAt, now)}</span>
            <span className="numeric">
              {i.ongoing ? <LiveDuration since={i.startedAt} /> : formatDuration(i.durationMs)}
            </span>
            {i.updates.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="size-3" aria-hidden="true" />
                <span className="numeric">{i.updates.length}</span>
              </span>
            )}
          </span>
        </span>

        <span className="hidden min-w-0 md:block">
          <span className="numeric block truncate text-sm">{formatDateTime(i.startedAt)}</span>
          <span className="numeric block text-xs text-muted-foreground">{timeAgo(i.startedAt, now)}</span>
        </span>

        <span className="hidden md:block">
          <span className={cn("numeric text-sm", i.ongoing && "font-medium text-destructive")}>
            {i.ongoing ? <LiveDuration since={i.startedAt} /> : formatDuration(i.durationMs)}
          </span>
          <span className="block text-xs text-muted-foreground">{i.ongoing ? "and counting" : "duration"}</span>
        </span>

        <span className="hidden items-center gap-1.5 md:flex">
          <IncidentStatePill incident={i} />
          {i.updates.length > 0 && (
            <span
              className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground"
              title={`${i.updates.length} update${i.updates.length === 1 ? "" : "s"}`}
            >
              <MessageSquareText className="size-3" aria-hidden="true" />
              <span className="numeric">{i.updates.length}</span>
              <span className="sr-only"> updates</span>
            </span>
          )}
        </span>

        <ChevronRight
          className="mt-1 size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 md:mt-0"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
