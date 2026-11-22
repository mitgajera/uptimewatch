"use client";
import Link from "next/link";
import axios from "axios";
import { AlertTriangle, RotateCw, SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api/errors";

/** True for a 404 or an invalid id (400) from the monitor endpoints. */
export function isNotFound(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 404 || status === 400;
}

export function MonitorNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Monitor not found"
      description="It may have been deleted, or the link is wrong."
      action={
        <Button asChild>
          <Link href="/dashboard/monitors">Back to monitors</Link>
        </Button>
      }
    />
  );
}

/** Inline error with a Retry button, for a failed query. */
export function QueryError({
  error,
  onRetry,
  title = "Couldn't load this",
  retrying,
  className,
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={
        className ??
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center"
      }
    >
      <span className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{apiErrorMessage(error, "Something went wrong.")}</p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        <RotateCw className={retrying ? "animate-spin" : undefined} aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
