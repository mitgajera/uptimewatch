"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileQuestion, Layers, RotateCw } from "lucide-react";
import { EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatusPages } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api/errors";
import { MAX_STATUS_PAGES } from "../preview-data";
import { StatusPageEditor } from "./status-page-editor";

function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading status page">
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="hidden h-[36rem] rounded-xl lg:block" />
      </div>
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-semibold">Couldn&apos;t load your status pages</p>
      <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
      <Button className="mt-5" variant="outline" onClick={onRetry}>
        <RotateCw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

export function NewStatusPage() {
  const pages = useStatusPages();
  // Decide once: creating the 5th page must not swap the editor for the limit notice mid-save.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  if (allowed === null && pages.isSuccess) setAllowed(pages.data.length < MAX_STATUS_PAGES);

  if (allowed === null) {
    if (pages.isError) return <LoadError error={pages.error} onRetry={() => pages.refetch()} />;
    return <EditorSkeleton />;
  }
  if (!allowed) {
    return (
      <EmptyState
        icon={Layers}
        title={`You've reached the limit of ${MAX_STATUS_PAGES} status pages`}
        description="Delete one to add another."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/status-pages">Back to status pages</Link>
          </Button>
        }
      />
    );
  }
  return <StatusPageEditor />;
}

export function EditStatusPage() {
  const params = useParams<{ id: string }>();
  const pages = useStatusPages();
  if (pages.isPending) return <EditorSkeleton />;
  if (pages.isError) return <LoadError error={pages.error} onRetry={() => pages.refetch()} />;
  const page = pages.data.find((p) => p.id === params.id);
  if (!page) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Status page not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/status-pages">Back to status pages</Link>
          </Button>
        }
      />
    );
  }
  // Re-mount when switching pages so the form starts from the right data.
  return <StatusPageEditor key={page.id} page={page} />;
}
