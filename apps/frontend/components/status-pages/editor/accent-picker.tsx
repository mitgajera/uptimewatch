"use client";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_ACCENT, isHexColor } from "../status-meta";
import { ACCENT_SWATCHES } from "./form";

/** Color input + hex field + swatches. Emits lowercase `#rrggbb` (or the raw text while typing). */
export function AccentPicker({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const valid = isHexColor(value);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-hex`}>Accent color</Label>
        <div className="flex items-center gap-2">
          <label
            className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50"
            style={{ backgroundColor: valid ? value : undefined }}
          >
            <span className="sr-only">Pick a custom accent color</span>
            <input
              type="color"
              value={valid ? value : DEFAULT_ACCENT}
              onChange={(e) => onChange(e.target.value.toLowerCase())}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
          <Input
            id={`${id}-hex`}
            value={value}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            className="w-32 font-mono"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-accent-error` : `${id}-accent-hint`}
            onChange={(e) => {
              let next = e.target.value.trim().toLowerCase();
              if (next && !next.startsWith("#")) next = `#${next}`;
              onChange(next);
            }}
          />
        </div>
        {error ? (
          <p id={`${id}-accent-error`} className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : (
          <p id={`${id}-accent-hint`} className="text-xs text-muted-foreground">
            Used for the top bar, logo tile and announcement. Status colors stay green, amber and red.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested accent colors">
        {ACCENT_SWATCHES.map((s) => {
          const active = value.toLowerCase() === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              aria-label={s.name}
              title={s.name}
              onClick={() => onChange(s.value)}
              className={cn(
                "grid size-9 place-items-center rounded-full border-2 border-transparent transition-transform outline-none hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active && "border-foreground/70"
              )}
            >
              <span
                className="grid size-6 place-items-center rounded-full ring-1 ring-foreground/10 ring-inset"
                style={{ backgroundColor: s.value }}
              >
                {active && (
                  <span className="grid size-3.5 place-items-center rounded-full bg-background/90 text-foreground">
                    <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
