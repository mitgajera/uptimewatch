"use client";
import { ChevronDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateMonitor } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { Monitor } from "@/lib/api/types";

const DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "24 hours", minutes: 1440 },
];

/** Start a timed maintenance window, or end the current one early. */
export function MaintenanceMenu({ monitor, active }: { monitor: Monitor; active: boolean }) {
  const update = useUpdateMonitor(monitor.id);

  const setUntil = (maintenanceUntil: string | null, message: string) =>
    update.mutate(
      { maintenanceUntil },
      {
        onSuccess: () => toast.success(message),
        onError: (err) => toast.error(apiErrorMessage(err, "Could not update maintenance.")),
      }
    );

  if (active) {
    return (
      <Button variant="outline" disabled={update.isPending} onClick={() => setUntil(null, "Maintenance ended")}>
        <Wrench className="size-4" aria-hidden="true" />
        End maintenance
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={update.isPending}>
          <Wrench className="size-4" aria-hidden="true" />
          Maintenance
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Pause checks and alerts for
        </DropdownMenuLabel>
        {DURATIONS.map((d) => (
          <DropdownMenuItem
            key={d.minutes}
            onSelect={() =>
              setUntil(
                new Date(Date.now() + d.minutes * 60_000).toISOString(),
                `Maintenance started for ${d.label}`
              )
            }
          >
            {d.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
