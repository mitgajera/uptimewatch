"use client";
import { Suspense } from "react";
import { MonitorsView } from "@/components/monitor-list/monitors-view";
import { MonitorListSkeleton } from "@/components/monitor-list/monitor-table";

export default function MonitorsPage() {
  // useSearchParams (filters in the URL) needs a Suspense boundary in Next 15.
  return (
    <Suspense fallback={<MonitorListSkeleton />}>
      <MonitorsView />
    </Suspense>
  );
}
