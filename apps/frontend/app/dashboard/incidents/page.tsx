import { Suspense } from "react";
import type { Metadata } from "next";
import { IncidentsView } from "@/components/incidents/incidents-view";

export const metadata: Metadata = { title: "Incidents" };

// The view reads filters and the open incident (?id=) from the URL.
export default function IncidentsPage() {
  return (
    <Suspense fallback={null}>
      <IncidentsView />
    </Suspense>
  );
}
