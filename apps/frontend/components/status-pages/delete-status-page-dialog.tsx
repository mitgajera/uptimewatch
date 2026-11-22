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
import { useDeleteStatusPage } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { StatusPage } from "@/lib/api/types";

export function DeleteStatusPageDialog({
  page,
  onOpenChange,
  onDeleted,
}: {
  page: StatusPage | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteStatusPage();

  async function confirm() {
    if (!page) return;
    try {
      await remove.mutateAsync(page.id);
      toast.success(`Deleted ${page.title}`);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete the status page."));
    }
  }

  return (
    <AlertDialog open={page !== null} onOpenChange={(o) => !remove.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {page?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">/status/{page?.slug}</span> stops working immediately and embedded badges break.
            Your monitors and incidents are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending} aria-busy={remove.isPending}>
            {remove.isPending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
            Delete page
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
