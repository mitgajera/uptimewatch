"use client";
import { Suspense, useCallback } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecksTab } from "@/components/monitors/detail/checks-tab";
import { IncidentsTab } from "@/components/monitors/detail/incidents-tab";
import { MonitorBanners } from "@/components/monitors/detail/monitor-banners";
import { MonitorHeader, useMonitorActions } from "@/components/monitors/detail/monitor-header";
import { OverviewTab, RANGES } from "@/components/monitors/detail/overview-tab";
import { isNotFound, MonitorNotFound, QueryError } from "@/components/monitors/states";
import { useMonitor, useMonitorIncidents } from "@/hooks/queries";
import type { AnalyticsRange, Monitor } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TABS = ["overview", "checks", "incidents"] as const;
type Tab = (typeof TABS)[number];

const triggerClass = cn(
  "relative h-10 rounded-none bg-transparent px-1 pb-2.5 pt-2 text-sm font-medium text-muted-foreground shadow-none ring-offset-0",
  "hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-foreground",
  "focus-visible:ring-offset-0"
);

function DetailSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading monitor">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="flex gap-3.5">
          <Skeleton className="size-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72 max-w-[60vw]" />
          </div>
        </div>
        <div className="flex gap-2">
          {[104, 84, 132, 72, 36].map((w, i) => (
            <Skeleton key={i} className="h-9" style={{ width: w }} />
          ))}
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}

function MonitorDetail({ monitor }: { monitor: Monitor }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actions = useMonitorActions(monitor);
  const incidents = useMonitorIncidents(monitor.id);

  const rawTab = params.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "overview";
  const rawRange = params.get("range");
  const range: AnalyticsRange = RANGES.some((r) => r.value === rawRange) ? (rawRange as AnalyticsRange) : "24h";

  const setParam = useCallback(
    (key: string, value: string, fallback: string) => {
      const next = new URLSearchParams(params.toString());
      if (value === fallback) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const ongoing = incidents.data?.find((i) => i.ongoing);
  const openCount = incidents.data?.filter((i) => i.ongoing).length ?? 0;

  return (
    <div className="grid gap-6">
      <MonitorHeader monitor={monitor} />
      <MonitorBanners
        monitor={monitor}
        ongoing={ongoing}
        pending={actions.pending}
        onResume={actions.resume}
        onEndMaintenance={actions.endMaintenance}
      />

      <Tabs value={tab} onValueChange={(v) => setParam("tab", v, "overview")} className="grid gap-6">
        <TabsList className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="overview" className={triggerClass}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="checks" className={triggerClass}>
            Checks
          </TabsTrigger>
          <TabsTrigger value="incidents" className={triggerClass}>
            Incidents
            {incidents.data && incidents.data.length > 0 && (
              <span
                className={cn(
                  "numeric ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
                  openCount ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                )}
              >
                {openCount || incidents.data.length}
                <span className="sr-only">{openCount ? " ongoing" : " total"}</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab monitor={monitor} range={range} onRangeChange={(r) => setParam("range", r, "24h")} />
        </TabsContent>
        <TabsContent value="checks" className="mt-0">
          <ChecksTab monitor={monitor} />
        </TabsContent>
        <TabsContent value="incidents" className="mt-0">
          <IncidentsTab monitorId={monitor.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonitorPageContent() {
  const { id } = useParams<{ id: string }>();
  const monitor = useMonitor(id);

  if (monitor.isPending) return <DetailSkeleton />;
  // A failed background refresh keeps the last good data on screen.
  if (monitor.data) return <MonitorDetail monitor={monitor.data} />;
  if (isNotFound(monitor.error)) return <MonitorNotFound />;
  return (
    <QueryError
      error={monitor.error}
      onRetry={() => monitor.refetch()}
      retrying={monitor.isFetching}
      title="Couldn't load this monitor"
    />
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <MonitorPageContent />
    </Suspense>
  );
}
