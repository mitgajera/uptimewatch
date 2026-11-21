"use client";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when the status API can't be reached (e.g. rate limited during a
 * traffic spike). Pages that rendered before keep being served from cache;
 * this only covers a cold render.
 */
export default function StatusPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Status is temporarily unavailable</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load this status page right now. Please try again in a moment.
      </p>
      <Button variant="outline" onClick={reset}>
        <RotateCw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </main>
  );
}
