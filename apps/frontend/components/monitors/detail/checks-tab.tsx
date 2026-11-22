"use client";
import { useState } from "react";
import { CheckCircle2, ListChecks, Loader2, XCircle } from "lucide-react";
import { EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitorChecks } from "@/hooks/queries";
import type { Monitor, Tick } from "@/lib/api/types";
import { errorLabel, formatLatency, timeAgo } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";
import { Segmented } from "../form/form-fields";
import { QueryError } from "../states";

type Filter = "all" | "DOWN";

const timeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function StatusPill({ status }: { status: Tick["status"] }) {
  const up = status === "UP";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        up ? "bg-success/10 text-success ring-success/20" : "bg-destructive/10 text-destructive ring-destructive/25"
      )}
    >
      {up ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <XCircle className="size-3" aria-hidden="true" />}
      {up ? "Up" : "Down"}
    </span>
  );
}

function ErrorCell({ check }: { check: Tick }) {
  if (check.status === "UP" && !check.errorType) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{errorLabel(check.errorType)}</p>
      {check.errorMessage && (
        <p className="truncate text-xs text-muted-foreground" title={check.errorMessage}>
          {check.errorMessage}
        </p>
      )}
    </div>
  );
}

function CodeCell({ code }: { code: number | null | undefined }) {
  if (code == null) return <span className="text-muted-foreground">—</span>;
  const tone = code >= 500 ? "text-destructive" : code >= 400 ? "text-warning" : "text-foreground";
  return <span className={cn("numeric font-mono text-xs", tone)}>{code}</span>;
}

/** Raw check history, newest first, with a failed-only filter. */
export function ChecksTab({ monitor }: { monitor: Monitor }) {
  const [filter, setFilter] = useState<Filter>("all");
  const checks = useMonitorChecks(monitor.id, filter === "DOWN" ? "DOWN" : undefined);
  const rows = checks.data?.pages.flatMap((p) => p.checks) ?? [];
  const showCode = monitor.type === "http";

  return (
    <section aria-labelledby="checks-title" className="rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="checks-title" className="text-sm font-semibold">
            Check history
          </h2>
          <p className="text-xs text-muted-foreground">Every check we ran, newest first.</p>
        </div>
        <Segmented<Filter>
          label="Filter checks"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "DOWN", label: "Failed" },
          ]}
        />
      </header>

      {checks.isPending ? (
        <div className="divide-y" aria-busy="true" aria-label="Loading checks">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="hidden h-4 flex-1 sm:block" />
            </div>
          ))}
        </div>
      ) : checks.isError ? (
        <div className="p-4">
          <QueryError
            error={checks.error}
            onRetry={() => checks.refetch()}
            retrying={checks.isFetching}
            title="Couldn't load checks"
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={ListChecks}
            className="border-0"
            title={filter === "DOWN" ? "No failed checks" : "No checks yet"}
            description={
              filter === "DOWN"
                ? "Every recorded check passed."
                : monitor.type === "heartbeat"
                  ? "Pings and missed deadlines appear here."
                  : "The first check runs within a minute of creating the monitor."
            }
            action={
              filter === "DOWN" ? (
                <Button variant="outline" onClick={() => setFilter("all")}>
                  Show all checks
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Time</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  {showCode && <th scope="col" className="px-4 py-2.5 font-medium">Code</th>}
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Latency</th>
                  <th scope="col" className="w-[45%] px-4 py-2.5 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id} className={cn("transition-colors hover:bg-muted/40", c.status === "DOWN" && "bg-destructive/[0.03]")}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <time dateTime={c.createdAt} className="numeric" title={timeAgo(c.createdAt)}>
                        {timeFmt.format(new Date(c.createdAt))}
                      </time>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={c.status} />
                    </td>
                    {showCode && (
                      <td className="px-4 py-2.5">
                        <CodeCell code={c.statusCode} />
                      </td>
                    )}
                    <td className="numeric whitespace-nowrap px-4 py-2.5 text-right">
                      {c.latency > 0 ? formatLatency(c.latency) : "—"}
                    </td>
                    <td className="max-w-0 px-4 py-2.5">
                      <ErrorCell check={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked rows */}
          <ul className="divide-y md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="grid gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <StatusPill status={c.status} />
                  <time dateTime={c.createdAt} className="numeric text-xs text-muted-foreground">
                    {timeFmt.format(new Date(c.createdAt))}
                  </time>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="numeric">{c.latency > 0 ? formatLatency(c.latency) : "—"}</span>
                  {showCode && c.statusCode != null && (
                    <span>
                      HTTP <CodeCell code={c.statusCode} />
                    </span>
                  )}
                </div>
                {(c.status === "DOWN" || c.errorType) && <ErrorCell check={c} />}
              </li>
            ))}
          </ul>

          <footer className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <span className="numeric">{rows.length.toLocaleString()}</span> check{rows.length === 1 ? "" : "s"} loaded
            </p>
            {checks.hasNextPage ? (
              <Button variant="outline" onClick={() => checks.fetchNextPage()} disabled={checks.isFetchingNextPage}>
                {checks.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}
                Load more
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">End of history</span>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
