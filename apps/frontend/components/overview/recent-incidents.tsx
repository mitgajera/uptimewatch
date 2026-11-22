import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/app/page";
import type { Incident } from "@/lib/api/types";
import { errorLabel, formatDuration, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

function IncidentItem({ incident }: { incident: Incident }) {
  const { ongoing } = incident;
  const acknowledged = Boolean(incident.acknowledgedAt);
  const reason =
    incident.errorType === "HTTP_STATUS" && incident.lastStatusCode
      ? `HTTP ${incident.lastStatusCode}`
      : incident.errorType
        ? errorLabel(incident.errorType)
        : incident.lastStatusCode
          ? `HTTP ${incident.lastStatusCode}`
          : "Check failed";

  return (
    <li>
      <Link
        href={`/dashboard/incidents?id=${incident.id}`}
        className="group flex gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset",
            ongoing ? "bg-destructive/10 text-destructive ring-destructive/25" : "bg-success/10 text-success ring-success/20"
          )}
        >
          {ongoing ? (
            <CircleAlert className="size-3.5" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-3.5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-medium">{incident.monitorName}</p>
            {ongoing && (
              <span
                className={cn(
                  "ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset",
                  acknowledged
                    ? "bg-muted text-muted-foreground ring-border"
                    : "bg-warning/10 text-warning ring-warning/25"
                )}
              >
                {acknowledged ? "Acknowledged" : "Unacknowledged"}
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground" title={incident.errorMessage ?? undefined}>
            {reason}
            {incident.errorMessage && incident.errorType !== "HTTP_STATUS" ? ` · ${incident.errorMessage}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Started <span className="numeric">{timeAgo(incident.startedAt)}</span>
            {" · "}
            {ongoing ? (
              <span className="font-medium text-destructive">Ongoing</span>
            ) : (
              <>
                lasted <span className="numeric">{formatDuration(incident.durationMs)}</span>
              </>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function RecentIncidents({ incidents }: { incidents: Incident[] }) {
  return (
    <Panel
      title="Recent incidents"
      actions={
        <Link
          href="/dashboard/incidents"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
      bodyClassName="p-2"
    >
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-success/10 ring-1 ring-inset ring-success/20">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">No incidents</p>
          <p className="max-w-[16rem] text-xs text-muted-foreground">
            When a monitor fails, the incident and its timeline show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {incidents.map((i) => (
            <IncidentItem key={i.id} incident={i} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
