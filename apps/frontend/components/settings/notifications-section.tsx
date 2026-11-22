"use client";

import Link from "next/link";
import { ArrowRight, BellOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { useAlertChannels } from "@/hooks/queries";
import { SettingsSection } from "./settings-card";

export function NotificationsSection() {
  const channels = useAlertChannels();
  const list = channels.data ?? [];
  const enabled = list.filter((c) => c.enabled);

  let summary: React.ReactNode;
  if (channels.isLoading) {
    summary = (
      <div className="flex items-center gap-3" aria-hidden="true">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  } else if (channels.isError) {
    summary = (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Couldn&apos;t load your channels.</span>
        <Button variant="outline" size="sm" className="h-9" onClick={() => channels.refetch()}>
          Retry
        </Button>
      </div>
    );
  } else if (list.length === 0) {
    summary = (
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info ring-1 ring-inset ring-info/20">
          <Mail className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm">
          Alerts go to your <span className="font-medium">account email</span>. Add an integration to reach your team.
        </p>
      </div>
    );
  } else if (enabled.length === 0) {
    summary = (
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning ring-1 ring-inset ring-warning/20">
          <BellOff className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm">
          <span className="font-medium text-warning">Alerts are paused.</span> All{" "}
          <span className="numeric">{list.length}</span> channels are turned off.
        </p>
      </div>
    );
  } else {
    summary = (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex -space-x-1.5">
          {enabled.slice(0, 5).map((c) => (
            <IntegrationIcon key={c.id} type={c.type} size="sm" className="bg-card ring-2 ring-card" />
          ))}
        </div>
        <p className="text-sm">
          <span className="numeric font-medium">{enabled.length}</span> of <span className="numeric">{list.length}</span>{" "}
          channels receive alerts
        </p>
      </div>
    );
  }

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Enabled channels get every alert unless a monitor picks its own."
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{summary}</div>
        <Button asChild variant="outline" className="h-9 shrink-0">
          <Link href="/dashboard/integrations">
            Manage integrations
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </SettingsSection>
  );
}
