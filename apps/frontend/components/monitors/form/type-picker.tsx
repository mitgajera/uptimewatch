"use client";
import { ArrowRight } from "lucide-react";
import { MonitorTypeIcon } from "@/components/app/status";
import { MONITOR_TYPES, type MonitorType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const TYPE_META: Record<MonitorType, { title: string; description: string; example: string }> = {
  http: {
    title: "HTTP",
    description: "Websites and APIs. Checks status codes, response time, keywords and SSL.",
    example: "https://api.example.com/health",
  },
  tcp: {
    title: "TCP port",
    description: "Databases, mail servers and anything that listens on a port.",
    example: "db.example.com:5432",
  },
  dns: {
    title: "DNS record",
    description: "Confirms a record resolves, and optionally that it contains a value.",
    example: "A example.com → 93.184.216.34",
  },
  heartbeat: {
    title: "Heartbeat",
    description: "Cron jobs and workers ping us. We alert when a ping is late.",
    example: "curl https://…/heartbeat/<token>",
  },
};

/** Large selectable cards for the first step of creating a monitor. */
export function TypePicker({ onSelect }: { onSelect: (type: MonitorType) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {MONITOR_TYPES.map((type) => {
        const meta = TYPE_META[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={cn(
              "group relative flex min-h-36 flex-col items-start gap-3 rounded-xl border bg-card p-5 text-left shadow-xs",
              "transition-[border-color,background-color,box-shadow] duration-150 ease-out",
              "hover:border-foreground/20 hover:bg-accent/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <span className="grid size-10 place-items-center rounded-lg border bg-surface text-foreground transition-colors group-hover:border-brand/30 group-hover:text-brand">
              <MonitorTypeIcon type={type} className="size-5" />
            </span>
            <span className="space-y-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {meta.title}
                <ArrowRight
                  className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
              <span className="block text-sm text-muted-foreground">{meta.description}</span>
            </span>
            <span className="mt-auto block max-w-full truncate font-mono text-xs text-muted-foreground/80">{meta.example}</span>
          </button>
        );
      })}
    </div>
  );
}
