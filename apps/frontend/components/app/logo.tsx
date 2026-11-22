import { cn } from "@/lib/utils";

/**
 * Brand mark: a single heartbeat pulse ending in an emerald status light.
 * Drawn on a 32px grid so it stays crisp from 16px (favicon) up.
 */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 17h5.2l3.1-7.5 5.4 14 3.4-6.5h3.2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27.2" cy="17" r="2.8" className="fill-brand" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[9px] bg-foreground text-background shadow-sm ring-1 ring-foreground/10",
        className
      )}
      aria-hidden="true"
    >
      <LogoGlyph className="size-[72%]" />
    </span>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight">
          Uptime<span className="text-muted-foreground">Watch</span>
        </span>
      )}
    </span>
  );
}
