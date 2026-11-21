"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Plus, RotateCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useMonitors } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import { displayName, formatLatency, formatUptime, monitorState, type MonitorState } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { MonitorRow } from "@/components/monitors/monitor-row";
import { MonitorFormDialog } from "@/components/monitors/monitor-form-dialog";

type Filter = "all" | MonitorState;

// Down first so problems are seen immediately, then by name.
const ORDER: Record<MonitorState, number> = { down: 0, pending: 1, maintenance: 2, up: 3, paused: 4 };

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

export default function MonitorsPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const monitors = useMonitors();
  const stats = useDashboardStats();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, up: 0, down: 0, maintenance: 0, paused: 0, pending: 0 };
    for (const m of monitors.data ?? []) {
      c.all++;
      c[monitorState(m)]++;
    }
    return c;
  }, [monitors.data]);

  // Match the Down filter (which excludes paused and maintenance monitors)
  // once the list is loaded; the stats endpoint counts every isDown monitor.
  const downNow = monitors.data ? counts.down : (stats.data?.down ?? 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (monitors.data ?? [])
      .filter((m) => filter === "all" || monitorState(m) === filter)
      .filter((m) => !q || displayName(m).toLowerCase().includes(q) || m.url.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          ORDER[monitorState(a)] - ORDER[monitorState(b)] || displayName(a).localeCompare(displayName(b))
      );
  }, [monitors.data, query, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "down", label: "Down" },
    { key: "up", label: "Up" },
    { key: "paused", label: "Paused" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monitors</h1>
          <p className="text-sm text-muted-foreground">Uptime and response time for your sites and APIs.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New monitor
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[82px]" />)
        ) : stats.data ? (
          <>
            <SummaryCard
              label="Down now"
              value={String(downNow)}
              tone={downNow > 0 ? "text-destructive" : undefined}
            />
            <SummaryCard label="Uptime (24h)" value={formatUptime(stats.data.checksLast24h ? stats.data.avgUptime : null)} />
            <SummaryCard label="Avg response (24h)" value={formatLatency(stats.data.checksLast24h ? stats.data.avgResponseTime : null)} />
            <SummaryCard
              label="Open incidents"
              value={String(stats.data.activeIncidents)}
              tone={stats.data.activeIncidents > 0 ? "text-warning" : undefined}
            />
          </>
        ) : null}
      </div>

      {monitors.isPending ? (
        <div className="divide-y rounded-lg border" aria-busy="true" aria-label="Loading monitors">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-5 w-1/3" />
            </div>
          ))}
        </div>
      ) : monitors.isError ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load your monitors</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(monitors.error)}</p>
          <Button className="mt-4" variant="outline" onClick={() => monitors.refetch()}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : counts.all === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Activity className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-semibold">Add your first monitor</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Paste a URL and we&apos;ll check it every minute, then alert you the moment it goes down.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New monitor
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filter by status" className="inline-flex w-fit rounded-md border p-0.5">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "min-h-9 rounded-[5px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    filter === f.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search monitors"
                placeholder="Search monitors"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No monitors match.{" "}
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {visible.map((m) => (
                <MonitorRow key={m.id} monitor={m} />
              ))}
            </ul>
          )}
        </div>
      )}

      <MonitorFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => router.push(`/dashboard/monitors/${id}`)}
      />
    </div>
  );
}
