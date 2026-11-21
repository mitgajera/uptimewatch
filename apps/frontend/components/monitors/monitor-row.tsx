import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Monitor } from "@/lib/api/types";
import {
  displayName,
  formatInterval,
  formatLatency,
  formatUptime,
  hostnameOf,
  monitorState,
  STATE_LABEL,
} from "@/lib/monitor-format";
import { StatusDot } from "./status-indicator";
import { RecentChecksBar } from "./recent-checks-bar";

/** One monitor in the overview list; the whole row links to its detail page. */
export function MonitorRow({ monitor }: { monitor: Monitor }) {
  const state = monitorState(monitor);
  const name = displayName(monitor);

  return (
    <li>
      <Link
        href={`/dashboard/monitors/${monitor.id}`}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_5.5rem_5.5rem_auto]"
      >
        <StatusDot state={state} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {name}
            <span className="sr-only">, {STATE_LABEL[state]}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {state === "paused"
              ? "Paused"
              : `${monitor.type === "heartbeat" ? "Heartbeat" : hostnameOf(monitor.url)} · every ${formatInterval(monitor.intervalSeconds)}`}
          </p>
        </div>

        <RecentChecksBar ticks={monitor.websiteTicks} className="col-span-3 col-start-1 h-4 md:col-span-1 md:col-start-auto md:h-5" />

        <div className="hidden text-right md:block">
          <p className="text-sm font-medium tabular-nums">{formatUptime(monitor.uptime24h)}</p>
          <p className="text-xs text-muted-foreground">24h uptime</p>
        </div>
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium tabular-nums">{formatLatency(monitor.avgLatency24h)}</p>
          <p className="text-xs text-muted-foreground">avg</p>
        </div>

        <ChevronRight
          className="col-start-3 row-start-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:col-start-auto"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
