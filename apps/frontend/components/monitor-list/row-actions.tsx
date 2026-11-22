"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteMonitor, useUpdateMonitor } from "@/hooks/queries";
import type { Monitor } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";
import { displayName } from "@/lib/monitor-format";

/** Per-monitor actions menu: open, edit, pause/resume, delete (confirmed). */
export function RowActions({ monitor }: { monitor: Monitor }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateMonitor(monitor.id);
  const remove = useDeleteMonitor();
  const name = displayName(monitor);

  const togglePause = () => {
    const paused = !monitor.paused;
    update.mutate(
      { paused },
      {
        onSuccess: () => toast.success(paused ? `Paused ${name}` : `Resumed ${name}`),
        onError: (e) => toast.error(apiErrorMessage(e, `Couldn't ${paused ? "pause" : "resume"} ${name}.`)),
      }
    );
  };

  const confirmDelete = () => {
    remove.mutate(monitor.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success(`Deleted ${name}`);
      },
      onError: (e) => toast.error(apiErrorMessage(e, `Couldn't delete ${name}.`)),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/monitors/${monitor.id}`}>
              <ArrowUpRight className="size-4" aria-hidden="true" />
              Open
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={togglePause} disabled={update.isPending}>
            {monitor.paused ? (
              <Play className="size-4" aria-hidden="true" />
            ) : (
              <Pause className="size-4" aria-hidden="true" />
            )}
            {monitor.paused ? "Resume" : "Pause"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !remove.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its check history and incidents are removed and it disappears from any status page. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete monitor"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
