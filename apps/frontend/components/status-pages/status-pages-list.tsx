"use client";
import { useState } from "react";
import Link from "next/link";
import { Globe, Plus, RotateCw } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitors, useStatusPages } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { StatusPage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { StatusPageCard } from "./status-page-card";
import { BadgeDialog } from "./badge-dialog";
import { DeleteStatusPageDialog } from "./delete-status-page-dialog";
import { MAX_STATUS_PAGES } from "./preview-data";

export function StatusPagesList() {
  const pages = useStatusPages();
  const monitors = useMonitors();
  const [badgeFor, setBadgeFor] = useState<StatusPage | null>(null);
  const [deleting, setDeleting] = useState<StatusPage | null>(null);

  const used = pages.data?.length ?? 0;
  const atLimit = used >= MAX_STATUS_PAGES;

  const newButton = atLimit ? (
    <Button disabled className="h-9">
      <Plus className="size-4" aria-hidden="true" />
      New status page
    </Button>
  ) : (
    <Button asChild className="h-9">
      <Link href="/dashboard/status-pages/new">
        <Plus className="size-4" aria-hidden="true" />
        New status page
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status pages"
        description="Public, live status for your users."
        actions={pages.isSuccess ? newButton : undefined}
      />

      {pages.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading status pages">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-card shadow-xs">
              <Skeleton className="h-1 rounded-none" />
              <div className="space-y-4 p-4">
                <div className="flex gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-[4.25rem] rounded-lg" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="border-t p-2">
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : pages.isError ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="text-sm font-semibold">Couldn&apos;t load your status pages</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(pages.error)}</p>
          <Button className="mt-5" variant="outline" onClick={() => pages.refetch()}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : pages.data.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Create your first status page"
          description="Pick monitors, brand it, share the link."
          action={newButton}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pages.data.map((p) => (
              <li key={p.id} className="flex">
                <StatusPageCard
                  page={p}
                  monitors={monitors.data}
                  onBadge={() => setBadgeFor(p)}
                  onDelete={() => setDeleting(p)}
                />
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Status pages used"
              aria-valuemin={0}
              aria-valuemax={MAX_STATUS_PAGES}
              aria-valuenow={used}
            >
              <div
                className={cn("h-full rounded-full", atLimit ? "bg-warning" : "bg-brand")}
                style={{ width: `${Math.min(100, (used / MAX_STATUS_PAGES) * 100)}%` }}
              />
            </div>
            <span>
              <span className="numeric">
                {used} of {MAX_STATUS_PAGES}
              </span>{" "}
              status pages used{atLimit && " — delete one to create another."}
            </span>
          </div>
        </>
      )}

      <BadgeDialog page={badgeFor} onOpenChange={(o) => !o && setBadgeFor(null)} />
      <DeleteStatusPageDialog page={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </div>
  );
}
