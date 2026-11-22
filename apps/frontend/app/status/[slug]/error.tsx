"use client";
import Link from "next/link";
import { CloudOff, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/app/logo";

/**
 * Shown when the status API can't be reached (e.g. rate limited during a
 * traffic spike). Pages that rendered before keep being served from cache;
 * this only covers a cold render.
 */
export default function StatusPageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="h-1 w-full bg-brand" aria-hidden="true" />
      <div className="bg-grid flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xs">
          <span className="mx-auto grid size-12 place-items-center rounded-full border bg-surface">
            <CloudOff className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-lg font-semibold tracking-tight">Status is temporarily unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t load this status page right now. This doesn&apos;t mean the service is down — please try
            again in a moment.
          </p>
          <Button variant="outline" className="mt-6 h-10" onClick={reset}>
            <RotateCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
      <footer className="flex justify-center pb-8">
        <Link
          href="/"
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <LogoMark className="size-5 rounded-md [&_svg]:size-3" />
          Powered by <span className="font-medium text-foreground">UptimeWatch</span>
        </Link>
      </footer>
    </main>
  );
}
