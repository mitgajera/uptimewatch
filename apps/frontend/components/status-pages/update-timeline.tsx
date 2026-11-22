import type { IncidentUpdateStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { UPDATE_STATUS } from "./status-meta";
import { LocalTime } from "./time";

export interface TimelineItem {
  key: string;
  at: string;
  message: string;
  status: IncidentUpdateStatus;
  /** Extra badges after the status (e.g. "Public"). */
  meta?: React.ReactNode;
}

export function UpdateStatusPill({ status, className }: { status: IncidentUpdateStatus; className?: string }) {
  const s = UPDATE_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium ring-1 ring-inset",
        s.soft,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

/** Vertical timeline of incident updates, newest first. */
export function UpdateTimeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((u, idx) => (
        <li key={u.key} className="relative flex gap-3 pb-5 last:pb-0">
          {idx < items.length - 1 && (
            <span aria-hidden="true" className="absolute top-6 bottom-1 left-[5px] w-px bg-border" />
          )}
          <span
            aria-hidden="true"
            className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full", UPDATE_STATUS[u.status].dot)}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <UpdateStatusPill status={u.status} />
              {u.meta}
              <LocalTime iso={u.at} className="numeric text-xs text-muted-foreground" />
            </div>
            <p className="text-sm leading-relaxed break-words whitespace-pre-line">{u.message}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
