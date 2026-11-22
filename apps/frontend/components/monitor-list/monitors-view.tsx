"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/page";
import { useMonitors } from "@/hooks/queries";
import { BulkBar } from "./bulk-bar";
import { ListToolbar } from "./list-toolbar";
import { MonitorCards, MonitorListSkeleton, MonitorTable } from "./monitor-table";
import { QueryError } from "./query-error";
import { useListFilters } from "./use-list-filters";
import { allTags, applyFilters, countByStatus } from "./utils";

function NewMonitorButton() {
  return (
    <Button asChild>
      <Link href="/dashboard/monitors/new">
        <Plus className="size-4" aria-hidden="true" />
        New monitor
      </Link>
    </Button>
  );
}

export function MonitorsView() {
  const monitors = useMonitors();
  const { filters, setFilters, clearFilters, active } = useListFilters();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const data = useMemo(() => monitors.data ?? [], [monitors.data]);
  const counts = useMemo(() => countByStatus(data), [data]);
  const tags = useMemo(() => allTags(data), [data]);
  const visible = useMemo(() => applyFilters(data, filters), [data, filters]);

  // Drop selections for monitors that no longer exist (deleted elsewhere).
  const selectedMonitors = useMemo(() => data.filter((m) => selectedIds.has(m.id)), [data, selectedIds]);
  const selected = useMemo(() => new Set(selectedMonitors.map((m) => m.id)), [selectedMonitors]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const m of visible) {
          if (checked) next.add(m.id);
          else next.delete(m.id);
        }
        return next;
      });
    },
    [visible]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const onTagClick = useCallback(
    (tag: string) =>
      setFilters({ tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag] }),
    [filters.tags, setFilters]
  );

  const total = data.length;
  const description = monitors.isPending
    ? "Loading your monitors…"
    : total === 0
      ? "HTTP, TCP, DNS and heartbeat checks, every minute."
      : counts.down > 0
        ? `${total} monitor${total === 1 ? "" : "s"} · ${counts.down} down`
        : `${total} monitor${total === 1 ? "" : "s"}`;

  let body: React.ReactNode;
  if (monitors.isPending) {
    body = <MonitorListSkeleton />;
  } else if (monitors.isError) {
    body = (
      <QueryError
        error={monitors.error}
        title="Couldn't load monitors"
        onRetry={() => void monitors.refetch()}
        retrying={monitors.isFetching}
      />
    );
  } else if (total === 0) {
    body = (
      <EmptyState
        icon={Activity}
        title="No monitors yet"
        description="Websites, APIs, ports, DNS or cron jobs."
        action={<NewMonitorButton />}
      />
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No monitors match these filters"
        description="Try a different search, or clear the filters to see every monitor."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <MonitorTable
          monitors={visible}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          activeTags={filters.tags}
          onTagClick={onTagClick}
        />
        <MonitorCards
          monitors={visible}
          selected={selected}
          onToggle={toggle}
          activeTags={filters.tags}
          onTagClick={onTagClick}
        />
        {active && (
          <p className="numeric text-xs text-muted-foreground">
            Showing {visible.length} of {total}.{" "}
            <button
              type="button"
              onClick={clearFilters}
              className="rounded font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filters
            </button>
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Monitors" description={description} actions={<NewMonitorButton />} />
      {!monitors.isError && total > 0 && (
        <ListToolbar filters={filters} setFilters={setFilters} counts={counts} tags={tags} />
      )}
      <div className="space-y-3">{body}</div>
      <BulkBar selected={selectedMonitors} allTags={tags} onClear={clearSelection} />
    </div>
  );
}
