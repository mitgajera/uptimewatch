"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page";
import { useMonitors, useOverview } from "@/hooks/queries";
import { QueryError } from "@/components/monitor-list/query-error";
import { HealthGrid } from "./health-grid";
import { LatencyPanel } from "./latency-panel";
import { Onboarding } from "./onboarding";
import { KpiRow, SummaryLine } from "./overview-summary";
import { RecentIncidents } from "./recent-incidents";
import { SslExpiring } from "./ssl-expiring";

function NewMonitorButton() {
  return (
    <Button asChild>
      <Link href="/dashboard/monitors/new">
        <Plus className="size-4" aria-hidden="true" />
        New monitor
      </Link>
    </Button>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Skeleton className="h-[330px] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-4 lg:space-y-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function OverviewView() {
  const overview = useOverview();
  const monitors = useMonitors();

  const counts = overview.data?.counts;
  const empty = counts?.total === 0 || (monitors.data && monitors.data.length === 0);

  let description: React.ReactNode = <span className="text-sm text-muted-foreground">Checking your systems…</span>;
  if (counts && !empty) description = <SummaryLine counts={counts} />;
  else if (empty)
    description = (
      <span className="text-sm text-muted-foreground">
        Uptime, response time and incidents for everything you monitor.
      </span>
    );

  let body: React.ReactNode;
  if (overview.isPending) {
    body = (
      <>
        <OverviewSkeleton />
        <span className="sr-only" role="status">
          Loading overview…
        </span>
      </>
    );
  } else if (overview.isError) {
    body = (
      <QueryError
        error={overview.error}
        title="Couldn't load the overview"
        onRetry={() => {
          void overview.refetch();
          if (monitors.isError) void monitors.refetch();
        }}
        retrying={overview.isFetching}
      />
    );
  } else if (empty) {
    body = <Onboarding />;
  } else {
    const data = overview.data;
    body = (
      <div className="space-y-4 lg:space-y-6">
        <KpiRow overview={data} />
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="min-w-0 space-y-4 lg:col-span-2 lg:space-y-6">
            <LatencyPanel series={data.latencySeries} />
            <HealthGrid
              monitors={monitors.data}
              isPending={monitors.isPending}
              error={monitors.isError ? monitors.error : null}
              onRetry={() => void monitors.refetch()}
            />
          </div>
          <div className="min-w-0 space-y-4 lg:space-y-6">
            <RecentIncidents incidents={data.recentIncidents} />
            <SslExpiring items={data.sslExpiring} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" actions={!empty && <NewMonitorButton />}>
        <div className="min-h-5">{description}</div>
      </PageHeader>
      {body}
    </div>
  );
}
