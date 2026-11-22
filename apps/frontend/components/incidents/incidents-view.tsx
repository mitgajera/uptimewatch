"use client";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Download, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCsvDownload, useIncidents, useMonitors } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Incident, IncidentFilter } from "@/lib/api/types";
import { displayName } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/status-pages/time";
import { FILTERS, isIncidentFilter } from "./incident-meta";
import { IncidentRow } from "./incident-row";
import { IncidentSheet } from "./incident-sheet";

const ALL_MONITORS = "all";

const EMPTY: Record<IncidentFilter, { title: string; description: string }> = {
  open: {
    title: "No open incidents — everything is running smoothly",
    description: "When a monitor goes down, the incident shows up here so you can acknowledge it and post updates.",
  },
  acknowledged: {
    title: "Nothing acknowledged right now",
    description: "Incidents someone is working on appear here until they recover.",
  },
  resolved: {
    title: "No resolved incidents yet",
    description: "Recovered incidents land here with their full timeline.",
  },
  all: {
    title: "No incidents yet",
    description: "Your monitors haven't recorded an outage. Long may it last.",
  },
};

/** "3", or "30+" when more pages exist. */
function useFilterCount(filter: IncidentFilter, websiteId?: string): string | null {
  const q = useIncidents(filter, websiteId);
  if (!q.data) return null;
  const n = q.data.pages.reduce((sum, p) => sum + p.incidents.length, 0);
  return q.hasNextPage ? `${n}+` : String(n);
}

export function IncidentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const statusParam = params.get("status");
  const filter: IncidentFilter = isIncidentFilter(statusParam) ? statusParam : "open";
  const websiteId = params.get("monitor") || undefined;
  const selectedId = params.get("id");

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const monitors = useMonitors();
  const incidents = useIncidents(filter, websiteId);
  const counts: Partial<Record<IncidentFilter, string | null>> = {
    open: useFilterCount("open", websiteId),
    acknowledged: useFilterCount("acknowledged", websiteId),
  };

  const items = useMemo(() => incidents.data?.pages.flatMap((p) => p.incidents) ?? [], [incidents.data]);
  const fallback = useMemo<Incident | undefined>(() => items.find((i) => i.id === selectedId), [items, selectedId]);
  const now = useNow(30_000);

  const download = useCsvDownload();
  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      await download("/incidents/export.csv", "incidents.csv");
      toast.success("Exported incidents.csv");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export incidents."));
    } finally {
      setExporting(false);
    }
  }

  const sortedMonitors = useMemo(
    () => [...(monitors.data ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [monitors.data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Every outage, who's on it, and what you've told your users."
        actions={
          <Button variant="outline" className="h-9" onClick={exportCsv} disabled={exporting} aria-busy={exporting}>
            {exporting ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter incidents by status"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:inline-flex sm:w-fit sm:rounded-lg sm:border sm:bg-card sm:p-1 sm:px-1 sm:shadow-xs"
        >
          {FILTERS.map((f) => {
            const active = f.value === filter;
            const count = counts[f.value];
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setParams({ status: f.value === "open" ? null : f.value })}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {f.label}
                {count != null && (
                  <span
                    className={cn(
                      "numeric inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]",
                      f.value === "open" && count !== "0"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-60">
          <label htmlFor="incident-monitor-filter" className="sr-only">
            Filter by monitor
          </label>
          <Select
            value={websiteId ?? ALL_MONITORS}
            onValueChange={(v) => setParams({ monitor: v === ALL_MONITORS ? null : v })}
            disabled={monitors.isPending || monitors.isError}
          >
            <SelectTrigger id="incident-monitor-filter" className="h-9 bg-card">
              <SelectValue placeholder="All monitors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONITORS}>All monitors</SelectItem>
              {sortedMonitors.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {displayName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section aria-label="Incident list">
        {incidents.isPending ? (
          <ListSkeleton />
        ) : incidents.isError ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-semibold">Couldn&apos;t load incidents</p>
            <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(incidents.error)}</p>
            <Button variant="outline" className="mt-5" onClick={() => incidents.refetch()}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={filter === "open" ? ShieldCheck : CheckCircle2}
            title={EMPTY[filter].title}
            description={
              websiteId ? "Nothing matches this monitor. Try another monitor or filter." : EMPTY[filter].description
            }
            action={
              websiteId ? (
                <Button variant="outline" onClick={() => setParams({ monitor: null })}>
                  Show all monitors
                </Button>
              ) : filter !== "all" ? (
                <Button variant="outline" onClick={() => setParams({ status: "all" })}>
                  View all incidents
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[auto_minmax(0,1fr)_11rem_7rem_9rem_auto] gap-x-3 border-b bg-surface/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid"
            >
              <span className="w-2.5" />
              <span>Monitor</span>
              <span>Started</span>
              <span>Duration</span>
              <span>Status</span>
              <span className="w-4" />
            </div>
            <ul className="divide-y">
              {items.map((i) => (
                <IncidentRow
                  key={i.id}
                  incident={i}
                  now={now}
                  selected={i.id === selectedId}
                  onOpen={() => setParams({ id: i.id })}
                />
              ))}
            </ul>
            {incidents.hasNextPage && (
              <div className="flex justify-center border-t p-3">
                <Button
                  variant="ghost"
                  className="h-9"
                  onClick={() => incidents.fetchNextPage()}
                  disabled={incidents.isFetchingNextPage}
                  aria-busy={incidents.isFetchingNextPage}
                >
                  {incidents.isFetchingNextPage && (
                    <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <IncidentSheet id={selectedId} fallback={fallback} onClose={() => setParams({ id: null })} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-busy="true" aria-label="Loading incidents">
      <div className="hidden h-9 border-b bg-surface/60 md:block" />
      <ul className="divide-y">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="size-2.5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-36 md:block" />
            <Skeleton className="hidden h-8 w-20 md:block" />
            <Skeleton className="hidden h-6 w-28 rounded-full md:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}
