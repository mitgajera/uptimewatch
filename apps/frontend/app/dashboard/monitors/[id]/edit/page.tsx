"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/page";
import { MonitorTypeIcon } from "@/components/app/status";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorForm } from "@/components/monitors/form/monitor-form";
import { fromMonitor } from "@/components/monitors/form/form-model";
import { isNotFound, MonitorNotFound, QueryError } from "@/components/monitors/states";
import { useMonitor } from "@/hooks/queries";
import { displayName, TYPE_LABEL } from "@/lib/monitor-format";

function EditSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading monitor">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          {[220, 180, 200, 160].map((h, i) => (
            <Skeleton key={i} className="rounded-xl" style={{ height: h }} />
          ))}
        </div>
        <Skeleton className="hidden h-72 rounded-xl lg:block" />
      </div>
    </div>
  );
}

export default function EditMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const monitor = useMonitor(id);
  // Snapshot the monitor once; background refetches must not reset what the user is typing.
  const loaded = monitor.data;
  const initial = useMemo(() => (loaded ? fromMonitor(loaded) : null), [loaded?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (monitor.isPending) return <EditSkeleton />;
  if (!monitor.data) {
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
  const m = monitor.data;
  if (!initial) return <EditSkeleton />;
  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Edit ${displayName(m)}`}
        description={
          <span className="inline-flex items-center gap-1.5">
            <MonitorTypeIcon type={m.type} className="size-3.5" />
            {TYPE_LABEL[m.type]} monitor · the type can&apos;t be changed after creation
          </span>
        }
      />
      <MonitorForm key={m.id} mode="edit" initial={initial} monitorId={m.id} cancelHref={`/dashboard/monitors/${m.id}`} />
    </div>
  );
}
