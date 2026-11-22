"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BellOff, CheckCheck, Globe, Loader2, Lock, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAcknowledgeIncident, useIncident } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Incident } from "@/lib/api/types";
import { formatDuration, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { LiveDuration, useNow } from "@/components/status-pages/time";
import { UpdateTimeline } from "@/components/status-pages/update-timeline";
import { formatDateTime, incidentCause, incidentHeadline } from "./incident-meta";
import { IncidentStatePill } from "./incident-row";
import { IncidentComposer } from "./incident-composer";

/** Right-side incident detail. `fallback` (from the list) renders instantly while the detail loads. */
export function IncidentSheet({
  id,
  fallback,
  onClose,
}: {
  id: string | null;
  fallback?: Incident;
  onClose: () => void;
}) {
  // Keep rendering the last incident while the sheet animates closed.
  const [shownId, setShownId] = useState(id);
  if (id && id !== shownId) setShownId(id);

  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {shownId && <IncidentDetail id={shownId} fallback={fallback?.id === shownId ? fallback : undefined} />}
      </SheetContent>
    </Sheet>
  );
}

function IncidentDetail({ id, fallback }: { id: string; fallback?: Incident }) {
  const query = useIncident(id);
  const incident = query.data ?? fallback;

  if (!incident) {
    if (query.isError) {
      return (
        <>
          <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
            <SheetTitle className="text-base">Couldn&apos;t load this incident</SheetTitle>
            <SheetDescription>{apiErrorMessage(query.error, "It may have been deleted.")}</SheetDescription>
          </SheetHeader>
          <div className="p-5">
            <Button variant="outline" onClick={() => query.refetch()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </>
      );
    }
    return (
      <>
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle className="sr-only">Loading incident</SheetTitle>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-2/3" />
          <SheetDescription className="sr-only">Loading incident details</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-5" aria-busy="true">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </>
    );
  }

  return <IncidentBody incident={incident} />;
}

function IncidentBody({ incident: i }: { incident: Incident }) {
  const now = useNow(30_000);
  const ack = useAcknowledgeIncident();
  const updates = [...i.updates].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  async function acknowledge() {
    try {
      await ack.mutateAsync(i.id);
      toast.success("Incident acknowledged", { description: "Teammates can see someone is on it." });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not acknowledge the incident."));
    }
  }

  return (
    <>
      <SheetHeader className="space-y-2 border-b px-5 py-4 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <IncidentStatePill incident={i} />
          <span className="text-xs text-muted-foreground">
            Started <span className="numeric">{timeAgo(i.startedAt, now)}</span>
          </span>
        </div>
        <SheetTitle className="text-lg leading-snug tracking-tight">{incidentHeadline(i)}</SheetTitle>
        <SheetDescription className="text-sm break-words">
          {incidentCause(i)}
          {i.errorMessage && <span className="block font-mono text-xs">{i.errorMessage}</span>}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {i.ongoing && !i.acknowledgedAt && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <BellOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Nobody has acknowledged this yet</p>
                <p className="text-xs text-muted-foreground">Let your team know you&apos;re looking into it.</p>
              </div>
            </div>
            <Button onClick={acknowledge} disabled={ack.isPending} aria-busy={ack.isPending} className="h-9 shrink-0">
              {ack.isPending ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="size-4" aria-hidden="true" />
              )}
              Acknowledge
            </Button>
          </div>
        )}

        <section aria-label="Details">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm shadow-xs">
            <Fact label="Monitor" className="col-span-2">
              <Link
                href={`/dashboard/monitors/${i.websiteId}`}
                className="inline-flex max-w-full items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="truncate">{i.monitorName}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
              {i.monitorUrl && (
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{i.monitorUrl}</span>
              )}
            </Fact>
            <Fact label="Started">
              <span className="numeric">{formatDateTime(i.startedAt)}</span>
            </Fact>
            <Fact label="Resolved">
              {i.resolvedAt ? (
                <span className="numeric">{formatDateTime(i.resolvedAt)}</span>
              ) : (
                <span className="font-medium text-destructive">Not yet</span>
              )}
            </Fact>
            <Fact label="Duration">
              {i.ongoing ? (
                <LiveDuration since={i.startedAt} className="numeric font-medium" />
              ) : (
                <span className="numeric">{formatDuration(i.durationMs)}</span>
              )}
            </Fact>
            <Fact label="Status code">
              <span className="font-mono">{i.lastStatusCode ?? "—"}</span>
            </Fact>
            <Fact label="Cause" className="col-span-2">
              {incidentCause(i)}
            </Fact>
            {i.acknowledgedAt && (
              <Fact label="Acknowledged" className="col-span-2">
                <span className="numeric">{formatDateTime(i.acknowledgedAt)}</span>
              </Fact>
            )}
          </dl>
        </section>

        <section aria-labelledby="incident-updates-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="incident-updates-heading" className="text-sm font-semibold">
              Updates
            </h3>
            <span className="numeric text-xs text-muted-foreground">{updates.length}</span>
          </div>
          {updates.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No updates yet. Post one below to keep your users in the loop.
            </p>
          ) : (
            <UpdateTimeline
              className="rounded-xl border bg-card p-4 shadow-xs"
              items={updates.map((u) => ({
                key: u.id,
                at: u.at,
                message: u.message,
                status: u.status,
                meta: u.public ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand/10 px-2 text-[11px] font-medium text-brand ring-1 ring-brand/20 ring-inset">
                    <Globe className="size-3" aria-hidden="true" />
                    Public
                  </span>
                ) : (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                    <Lock className="size-3" aria-hidden="true" />
                    Internal
                  </span>
                ),
              }))}
            />
          )}
        </section>

        <IncidentComposer key={i.id} incident={i} />
      </div>
    </>
  );
}

function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 bg-card px-4 py-3", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0">{children}</dd>
    </div>
  );
}
