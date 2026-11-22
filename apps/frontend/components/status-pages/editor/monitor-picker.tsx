"use client";
import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, RotateCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorTypeIcon, StatusDot } from "@/components/app/status";
import type { Monitor } from "@/lib/api/types";
import { displayName, monitorState, STATE_LABEL } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

/**
 * Choose which monitors appear (and in what order). Selected monitors are listed
 * first in page order with up/down buttons; the rest follow alphabetically.
 */
export function MonitorPicker({
  monitors,
  isPending,
  isError,
  onRetry,
  value,
  onChange,
}: {
  monitors: Monitor[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const byId = useMemo(() => new Map((monitors ?? []).map((m) => [m.id, m])), [monitors]);
  const selected = value.map((x) => byId.get(x)).filter((m): m is Monitor => Boolean(m));
  const selectedSet = new Set(value);
  const available = (monitors ?? [])
    .filter((m) => !selectedSet.has(m.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  const matches = (m: Monitor) =>
    !q || displayName(m).toLowerCase().includes(q) || (m.url || m.host || "").toLowerCase().includes(q);
  const visibleSelected = selected.filter(matches);
  const visibleAvailable = available.filter(matches);
  const visibleAll = [...visibleSelected, ...visibleAvailable];
  const allVisibleSelected = visibleAll.length > 0 && visibleAll.every((m) => selectedSet.has(m.id));

  const toggle = (monitorId: string, checked: boolean) =>
    onChange(checked ? [...value, monitorId] : value.filter((x) => x !== monitorId));

  const move = (monitorId: string, delta: -1 | 1) => {
    const idx = value.indexOf(monitorId);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= value.length) return;
    const next = [...value];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const drop = new Set(visibleAll.map((m) => m.id));
      onChange(value.filter((x) => !drop.has(x)));
    } else {
      onChange([...value, ...visibleAvailable.map((m) => m.id)]);
    }
  };

  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading monitors">
        <Skeleton className="h-9" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm">
        <span className="text-destructive">Couldn&apos;t load your monitors.</span>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }
  if (!monitors || monitors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
        <p className="text-muted-foreground">You don&apos;t have any monitors yet. Add one, then list it here.</p>
        <Button type="button" variant="outline" asChild className="h-9">
          <Link href="/dashboard/monitors">
            <Plus className="size-4" aria-hidden="true" />
            Add a monitor
          </Link>
        </Button>
      </div>
    );
  }

  const row = (m: Monitor, position: number | null) => {
    const checkboxId = `${id}-m-${m.id}`;
    const state = monitorState(m);
    const isSelected = position !== null;
    return (
      <li key={m.id} className={cn("flex min-h-12 items-center gap-3 pr-2 pl-3", isSelected && "bg-brand/[0.03]")}>
        <Checkbox id={checkboxId} checked={isSelected} onCheckedChange={(v) => toggle(m.id, v === true)} />
        <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2 text-sm">
          <MonitorTypeIcon type={m.type} className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{displayName(m)}</span>
          <StatusDot state={state} live={false} className="shrink-0" />
          <span className="sr-only">{STATE_LABEL[state]}</span>
        </label>
        {isSelected && (
          <div className="flex shrink-0 items-center">
            <span className="numeric mr-1 w-5 text-right text-xs text-muted-foreground" aria-hidden="true">
              {position + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Move ${displayName(m)} up`}
              disabled={Boolean(q) || position === 0}
              onClick={() => move(m.id, -1)}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Move ${displayName(m)} down`}
              disabled={Boolean(q) || position === value.length - 1}
              onClick={() => move(m.id, 1)}
            >
              <ArrowDown className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search monitors"
            aria-label="Search monitors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Button type="button" variant="outline" className="h-9 shrink-0" onClick={toggleAllVisible} disabled={!visibleAll.length}>
          {allVisibleSelected ? "Clear" : "Select all"}
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border">
        {visibleSelected.length > 0 && (
          <>
            <p className="sticky top-0 z-10 border-b bg-surface px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              On the page · <span className="numeric">{value.length}</span>
            </p>
            <ul className="divide-y">{visibleSelected.map((m) => row(m, value.indexOf(m.id)))}</ul>
          </>
        )}
        {visibleAvailable.length > 0 && (
          <>
            <p
              className={cn(
                "sticky top-0 z-10 border-b bg-surface px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                visibleSelected.length > 0 && "border-t"
              )}
            >
              Available
            </p>
            <ul className="divide-y">{visibleAvailable.map((m) => row(m, null))}</ul>
          </>
        )}
        {visibleAll.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No monitors match “{query}”.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {q ? "Clear the search to reorder. " : ""}Only monitor names are shown publicly — never their URLs.
      </p>
    </div>
  );
}
