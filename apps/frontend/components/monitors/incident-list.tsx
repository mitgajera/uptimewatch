import { CheckCircle2 } from "lucide-react";
import type { Incident } from "@/lib/api/types";
import { errorLabel, formatDuration } from "@/lib/monitor-format";
import { StatusDot } from "./status-indicator";

export function IncidentList({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
        <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
        No incidents recorded. Nice.
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {incidents.map((i) => (
        <li key={i.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <StatusDot state={i.ongoing ? "down" : "paused"} className="mt-1.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {errorLabel(i.errorType)}
                {i.lastStatusCode ? (
                  <span className="ml-1 font-normal text-muted-foreground">HTTP {i.lastStatusCode}</span>
                ) : null}
              </p>
              {i.errorMessage && (
                <p className="truncate text-xs text-muted-foreground" title={i.errorMessage}>
                  {i.errorMessage}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                <time dateTime={i.startedAt}>{new Date(i.startedAt).toLocaleString()}</time>
              </p>
            </div>
          </div>
          <span
            className={
              i.ongoing
                ? "text-sm font-medium text-destructive"
                : "text-sm tabular-nums text-muted-foreground"
            }
          >
            {i.ongoing ? "Ongoing" : formatDuration(i.durationMs)}
          </span>
        </li>
      ))}
    </ul>
  );
}
