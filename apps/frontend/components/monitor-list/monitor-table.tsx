"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorTypeIcon, STATE_STYLES, StatusDot } from "@/components/app/status";
import { Sparkline } from "@/components/app/sparkline";
import { UptimeBars } from "@/components/app/uptime-bars";
import type { Monitor } from "@/lib/api/types";
import {
  displayName,
  formatLatency,
  formatUptime,
  monitorState,
  monitorTarget,
  STATE_LABEL,
  timeAgo,
  TYPE_LABEL,
} from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { RowActions } from "./row-actions";
import { recentCheckBars, sparklineTone, uptimeTextClass } from "./utils";

export interface SelectionProps {
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/** Navigate on row click, but not when the click came from a control or a portal (menus, dialogs). */
function useRowNavigation() {
  const router = useRouter();
  return (e: React.MouseEvent<HTMLElement>, id: string) => {
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target)) return;
    if (target.closest("a,button,input,label,[role=checkbox],[role=menuitem]")) return;
    if (window.getSelection()?.toString()) return;
    const href = `/dashboard/monitors/${id}`;
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else router.push(href);
  };
}

export function TagChips({
  tags,
  activeTags,
  onTagClick,
  max = 3,
}: {
  tags: string[] | undefined;
  activeTags?: string[];
  onTagClick?: (tag: string) => void;
  max?: number;
}) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, max);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((t) => {
        const active = activeTags?.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTagClick?.(t)}
            title={active ? `Remove filter "${t}"` : `Filter by "${t}"`}
            className={cn(
              "inline-flex h-5 max-w-[10rem] items-center truncate rounded border px-1.5 text-[11px] font-medium leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-foreground/30 bg-foreground text-background"
                : "bg-muted/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {t}
          </button>
        );
      })}
      {tags.length > max && (
        <span className="numeric text-[11px] text-muted-foreground" title={tags.slice(max).join(", ")}>
          +{tags.length - max}
        </span>
      )}
    </span>
  );
}

function lastChecked(m: Monitor) {
  return m.type === "heartbeat" ? (m.lastHeartbeatAt ?? m.lastCheckedAt) : m.lastCheckedAt;
}

const HEAD = "h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap";

export function MonitorTable({
  monitors,
  selected,
  onToggle,
  onToggleAll,
  activeTags,
  onTagClick,
}: SelectionProps & {
  monitors: Monitor[];
  onToggleAll: (checked: boolean) => void;
  activeTags: string[];
  onTagClick: (tag: string) => void;
}) {
  const navigate = useRowNavigation();
  const selectedVisible = monitors.filter((m) => selected.has(m.id)).length;
  const allState: boolean | "indeterminate" =
    selectedVisible === 0 ? false : selectedVisible === monitors.length ? true : "indeterminate";

  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="w-10 pl-4 pr-1">
                <Checkbox
                  checked={allState}
                  onCheckedChange={(c) => onToggleAll(c === true)}
                  aria-label="Select all visible monitors"
                  className="align-middle"
                />
              </th>
              <th className={HEAD}>Monitor</th>
              <th className={cn(HEAD, "w-24")}>Type</th>
              <th className={cn(HEAD, "w-24 text-right")}>Uptime 24h</th>
              <th className={cn(HEAD, "w-44")}>Response 24h</th>
              <th className={cn(HEAD, "w-32")}>Last checked</th>
              <th className={cn(HEAD, "w-40")}>Last 30 min</th>
              <th className="w-12 pr-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => {
              const state = monitorState(m);
              const isSelected = selected.has(m.id);
              const name = displayName(m);
              return (
                <tr
                  key={m.id}
                  onClick={(e) => navigate(e, m.id)}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "group cursor-pointer border-b transition-colors duration-150 last:border-0 hover:bg-muted/40",
                    "data-[state=selected]:bg-brand/5",
                    state === "paused" && "text-muted-foreground"
                  )}
                >
                  <td className="w-10 pl-4 pr-1 align-middle">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(m.id)}
                      aria-label={`Select ${name}`}
                      className="align-middle"
                    />
                  </td>
                  <td className="max-w-0 px-3 py-3 align-middle">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-1.5 flex">
                        <StatusDot state={state} />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/dashboard/monitors/${m.id}`}
                            className="truncate rounded font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {name}
                          </Link>
                          {state !== "up" && (
                            <span className={cn("shrink-0 text-xs font-medium", STATE_STYLES[state].text)}>
                              {STATE_LABEL[state]}
                            </span>
                          )}
                          {state === "up" && <span className="sr-only">{STATE_LABEL[state]}</span>}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-mono text-xs text-muted-foreground">{monitorTarget(m)}</span>
                          <TagChips tags={m.tags} activeTags={activeTags} onTagClick={onTagClick} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MonitorTypeIcon type={m.type} className="size-3.5" />
                      {TYPE_LABEL[m.type]}
                    </span>
                  </td>
                  <td className="px-3 text-right align-middle">
                    <span className={cn("numeric font-medium", uptimeTextClass(m.uptime24h))}>
                      {formatUptime(m.uptime24h)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    {m.type === "heartbeat" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <Sparkline values={m.sparkline} width={72} height={24} tone={sparklineTone(state)} />
                        <span className="numeric text-xs text-muted-foreground">{formatLatency(m.avgLatency24h)}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 align-middle">
                    <span className="numeric text-xs text-muted-foreground">{timeAgo(lastChecked(m))}</span>
                  </td>
                  <td className="px-3 align-middle">
                    <UptimeBars
                      bars={recentCheckBars(m)}
                      className="h-6 w-36"
                      ariaLabel={`Checks in the last 30 minutes for ${name}`}
                    />
                  </td>
                  <td className="pr-2 text-right align-middle">
                    <RowActions monitor={m} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MonitorCards({
  monitors,
  selected,
  onToggle,
  activeTags,
  onTagClick,
}: SelectionProps & { monitors: Monitor[]; activeTags: string[]; onTagClick: (tag: string) => void }) {
  const navigate = useRowNavigation();
  return (
    <ul className="space-y-2 md:hidden">
      {monitors.map((m) => {
        const state = monitorState(m);
        const isSelected = selected.has(m.id);
        const name = displayName(m);
        return (
          <li
            key={m.id}
            onClick={(e) => navigate(e, m.id)}
            className={cn(
              "cursor-pointer rounded-xl border bg-card p-3 shadow-xs transition-colors",
              isSelected && "border-brand/40 bg-brand/5"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="-m-2 grid size-10 shrink-0 place-items-center">
                <Checkbox checked={isSelected} onCheckedChange={() => onToggle(m.id)} aria-label={`Select ${name}`} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot state={state} />
                  <Link
                    href={`/dashboard/monitors/${m.id}`}
                    className="truncate rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {name}
                  </Link>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{monitorTarget(m)}</p>
              </div>
              <div className="-my-1 -mr-1">
                <RowActions monitor={m} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className={cn("mt-0.5 font-medium", STATE_STYLES[state].text)}>{STATE_LABEL[state]}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Uptime 24h</p>
                <p className={cn("numeric mt-0.5 font-medium", uptimeTextClass(m.uptime24h))}>
                  {formatUptime(m.uptime24h)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{m.type === "heartbeat" ? "Last ping" : "Response"}</p>
                <p className="numeric mt-0.5 font-medium">
                  {m.type === "heartbeat" ? timeAgo(lastChecked(m)) : formatLatency(m.avgLatency24h)}
                </p>
              </div>
            </div>
            <UptimeBars
              bars={recentCheckBars(m)}
              className="mt-3 h-5"
              ariaLabel={`Checks in the last 30 minutes for ${name}`}
            />
            {(m.tags?.length ?? 0) > 0 && (
              <div className="mt-2.5">
                <TagChips tags={m.tags} activeTags={activeTags} onTagClick={onTagClick} max={4} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MonitorListSkeleton() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block" aria-hidden="true">
        <div className="h-9 border-b bg-muted/40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
            <Skeleton className="size-4 rounded-sm" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </div>
      <div className="space-y-2 md:hidden" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading monitors…
      </span>
    </>
  );
}
