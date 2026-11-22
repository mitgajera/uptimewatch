"use client";
import { CloudOff, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/** Inline error state for a failed query, with a Retry action. */
export function QueryError({
  error,
  title = "Couldn't load data",
  onRetry,
  retrying,
  className,
}: {
  error: unknown;
  title?: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <span className="grid size-11 place-items-center rounded-full border border-destructive/20 bg-card shadow-xs">
        <CloudOff className="size-5 text-destructive" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
      <Button variant="outline" className="mt-5" onClick={onRetry} disabled={retrying}>
        <RotateCw className={cn("size-4", retrying && "animate-spin")} aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
