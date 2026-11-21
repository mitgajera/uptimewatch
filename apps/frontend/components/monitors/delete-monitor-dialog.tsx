"use client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteMonitor } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";

interface Props {
  monitorId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteMonitorDialog({ monitorId, name, open, onOpenChange, onDeleted }: Props) {
  const remove = useDeleteMonitor();

  async function confirm() {
    try {
      await remove.mutateAsync(monitorId);
      toast.success(`Deleted ${name}`);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete the monitor."));
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !remove.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Checks and alerts stop immediately and the monitor is removed from your status pages.
            To stop checks temporarily, pause it instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          {/* A plain button so the dialog stays open (and shows progress) until the request finishes. */}
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending} aria-busy={remove.isPending}>
            {remove.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
            Delete monitor
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
