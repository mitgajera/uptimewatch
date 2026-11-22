"use client";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/app/page";
import { MonitorTypeIcon } from "@/components/app/status";
import { Skeleton } from "@/components/ui/skeleton";
import { MonitorForm } from "@/components/monitors/form/monitor-form";
import { defaultForm } from "@/components/monitors/form/form-model";
import { TYPE_META, TypePicker } from "@/components/monitors/form/type-picker";
import { MONITOR_TYPES, type MonitorType } from "@/lib/api/types";

function NewMonitor() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("type");
  const type = MONITOR_TYPES.includes(raw as MonitorType) ? (raw as MonitorType) : null;
  const initial = useMemo(() => (type ? defaultForm(type) : null), [type]);

  if (!type || !initial) {
    return (
      <div className="mx-auto grid max-w-3xl gap-6">
        <PageHeader
          title="Create a monitor"
          description="What do you want to watch?"
        />
        <TypePicker onSelect={(t) => router.push(`/dashboard/monitors/new?type=${t}`)} />
        <p className="text-xs text-muted-foreground">
          Not sure? Use <span className="font-medium text-foreground">HTTP</span> for anything with a URL, and{" "}
          <span className="font-medium text-foreground">Heartbeat</span> for scheduled jobs that should check in.
        </p>
      </div>
    );
  }

  const meta = TYPE_META[type];
  return (
    <div className="grid gap-6">
      <PageHeader title={`New ${meta.title} monitor`} description={meta.description} />
      <MonitorForm
        key={type}
        mode="create"
        initial={initial}
        cancelHref="/dashboard/monitors"
        header={
          <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
            <span className="grid size-9 place-items-center rounded-lg border bg-surface text-brand">
              <MonitorTypeIcon type={type} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{meta.title}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{meta.example}</p>
            </div>
            <Link
              href="/dashboard/monitors/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              Change type
            </Link>
          </div>
        }
      />
    </div>
  );
}

export default function NewMonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-3xl gap-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <NewMonitor />
    </Suspense>
  );
}
