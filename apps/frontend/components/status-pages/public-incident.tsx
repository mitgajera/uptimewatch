import type { PublicStatusPage } from "@/lib/api/types";
import { formatDuration } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { UpdateTimeline } from "./update-timeline";
import { LiveDuration, LocalTime } from "./time";

type PublicIncident = PublicStatusPage["incidents"][number];

export function incidentTitle(i: Pick<PublicIncident, "title" | "monitor" | "ongoing">): string {
  return i.title?.trim() || (i.ongoing ? `${i.monitor} is down` : `${i.monitor} outage`);
}

/** One incident on the public page, with its public update timeline. */
export function PublicIncidentCard({ incident: i }: { incident: PublicIncident }) {
  const updates = [...(i.updates ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-xs",
        i.ongoing && "border-destructive/30 ring-1 ring-destructive/10"
      )}
    >
      <header className="flex flex-col gap-2 px-4 py-4 @lg:flex-row @lg:items-start @lg:justify-between @lg:px-5">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold break-words">{incidentTitle(i)}</h3>
          <p className="text-xs text-muted-foreground">
            {i.monitor} · Started <LocalTime iso={i.startedAt} className="numeric" />
          </p>
        </div>
        {i.ongoing ? (
          <span className="inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 text-xs font-medium text-destructive ring-1 ring-destructive/25 ring-inset">
            <span className="relative inline-flex size-2" aria-hidden="true">
              <span className="animate-status-pulse absolute inset-0 rounded-full bg-destructive" />
              <span className="relative inline-flex size-full rounded-full bg-destructive" />
            </span>
            Ongoing · <LiveDuration since={i.startedAt} className="numeric" />
          </span>
        ) : (
          <span className="inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 text-xs font-medium text-success ring-1 ring-success/20 ring-inset">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Resolved · <span className="numeric">{formatDuration(i.durationMs)}</span>
          </span>
        )}
      </header>
      {updates.length > 0 && (
        <div className="border-t bg-surface/50 px-4 py-4 @lg:px-5">
          <UpdateTimeline
            items={updates.map((u, idx) => ({ key: `${u.at}-${idx}`, at: u.at, message: u.message, status: u.status }))}
          />
        </div>
      )}
    </article>
  );
}
