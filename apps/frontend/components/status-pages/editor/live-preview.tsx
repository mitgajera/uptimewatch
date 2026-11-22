"use client";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Monitor as MonitorIcon, Smartphone } from "lucide-react";
import { useApiClient } from "@/hooks/useApiClient";
import { queryKeys, useIncidents } from "@/hooks/queries";
import type { CalendarDay, Monitor } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { PublicStatusView } from "../public-status-view";
import { buildPreview } from "../preview-data";
import type { EditorForm } from "./form";

/**
 * Renders the real public page design from unsaved form state, live monitor
 * statuses, each selected monitor's 90-day calendar and recent incidents.
 */
export function LivePreview({ form, monitors }: { form: EditorForm; monitors: Monitor[] }) {
  const api = useApiClient();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  // Shares the cache with useMonitorCalendar on the monitor detail page.
  const calendarQueries = useQueries({
    queries: form.websiteIds.map((id) => ({
      queryKey: queryKeys.calendar(id),
      queryFn: async () => (await api.get<{ days: CalendarDay[] }>(`/website/${id}/calendar`)).data.days,
      staleTime: 5 * 60_000,
    })),
  });
  const incidents = useIncidents("all");

  const calendarKey = calendarQueries.map((q) => q.dataUpdatedAt).join(",");
  const calendars = useMemo(() => {
    const map = new Map<string, CalendarDay[]>();
    form.websiteIds.forEach((id, idx) => {
      const data = calendarQueries[idx]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // calendarQueries is a new array every render; key on when each result changed instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.websiteIds, calendarKey]);

  const data = useMemo(
    () =>
      buildPreview({
        form,
        monitors,
        calendars,
        incidents: incidents.data?.pages.flatMap((p) => p.incidents) ?? [],
      }),
    [form, monitors, calendars, incidents.data]
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex items-center gap-3 border-b bg-surface/70 px-3 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md border bg-background px-2.5 py-1 text-center font-mono text-[11px] text-muted-foreground">
          /status/{form.slug || "your-page"}
        </div>
        <div className="flex gap-0.5 rounded-md border bg-background" role="group" aria-label="Preview size">
          <button
            type="button"
            aria-pressed={device === "desktop"}
            aria-label="Desktop preview"
            onClick={() => setDevice("desktop")}
            className={cn(
              "grid size-9 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              device === "desktop" && "bg-secondary text-foreground"
            )}
          >
            <MonitorIcon className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={device === "mobile"}
            aria-label="Mobile preview"
            onClick={() => setDevice("mobile")}
            className={cn(
              "grid size-9 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              device === "mobile" && "bg-secondary text-foreground"
            )}
          >
            <Smartphone className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto bg-surface/40">
        <div
          className={cn(
            "mx-auto transition-[max-width] duration-200 ease-out",
            device === "mobile" ? "max-w-[375px] border-x" : "max-w-none"
          )}
          role="region"
          aria-label="Status page preview"
        >
          <PublicStatusView page={data} preview />
        </div>
      </div>
    </div>
  );
}
