"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCsvDownload } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import { SettingsSection } from "./settings-card";

export function DataSection() {
  const download = useCsvDownload();
  const [pending, setPending] = useState(false);

  async function exportIncidents() {
    setPending(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await download("/incidents/export.csv", `uptimewatch-incidents-${date}.csv`);
      toast.success("Incident export downloaded");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export incidents."));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsSection id="data" title="Data" description="Your data is yours. Export it as CSV any time.">
      <ul className="divide-y">
        <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-inset ring-border">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">All incidents</p>
            <p className="text-xs text-muted-foreground">Every incident across your monitors, with start, end and cause.</p>
          </div>
          <Button variant="outline" className="h-9 shrink-0" onClick={exportIncidents} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            Export CSV
          </Button>
        </li>
        <li className="p-4 text-xs leading-relaxed text-muted-foreground">
          Need raw checks? Open a monitor from{" "}
          <Link href="/dashboard/monitors" className="font-medium text-foreground underline-offset-4 hover:underline">
            Monitors
          </Link>{" "}
          and export its checks for the last 24 hours, 7 days or 30 days.
        </li>
      </ul>
    </SettingsSection>
  );
}
