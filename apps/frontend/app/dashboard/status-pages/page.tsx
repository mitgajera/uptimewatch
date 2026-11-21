"use client";
import { useState } from "react";
import { ExternalLink, Globe, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteStatusPage, useStatusPages } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import type { StatusPage } from "@/lib/api/types";
import { StatusPageDialog } from "./status-page-dialog";

export default function StatusPagesPage() {
  const pages = useStatusPages();
  const remove = useDeleteStatusPage();
  const [editing, setEditing] = useState<StatusPage | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StatusPage | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(`Deleted ${deleting.title}`);
      setDeleting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete the status page."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status pages</h1>
          <p className="text-sm text-muted-foreground">Public pages that show your users what&apos;s up and what&apos;s down.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New status page
        </Button>
      </div>

      {pages.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : pages.isError ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load your status pages</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(pages.error)}</p>
          <Button className="mt-4" variant="outline" onClick={() => pages.refetch()}>
            <RotateCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : pages.data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Globe className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-semibold">Create your first status page</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Pick the monitors to show and share the link. It updates automatically during incidents.
          </p>
          <Button className="mt-6" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            New status page
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {pages.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{p.title}</p>
                  {!p.published && <Badge variant="secondary">Draft</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  /status/{p.slug} · {p.websiteIds.length} monitor{p.websiteIds.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {p.published && (
                  <Button variant="ghost" size="sm" className="h-10" asChild>
                    <a href={`/status/${p.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      View
                      <span className="sr-only"> {p.title} (opens in a new tab)</span>
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Edit ${p.title}`}
                  onClick={() => {
                    setEditing(p);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <StatusPageDialog open={formOpen} onOpenChange={setFormOpen} page={editing} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The public link stops working immediately. Your monitors are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending} aria-busy={remove.isPending}>
              Delete page
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
