"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-card";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

type Palette = { bg: string; side: string; card: string; line: string; ink: string; border: string };

/** Live tokens, used when the preview matches the active theme. */
const SAME: Palette = {
  bg: "bg-background",
  side: "bg-muted",
  card: "bg-card",
  line: "bg-muted-foreground/30",
  ink: "bg-foreground/80",
  border: "border-border",
};

/** Approximates the opposite theme by inverting the neutral tokens. */
const INVERSE: Palette = {
  bg: "bg-foreground",
  side: "bg-foreground/90",
  card: "bg-background/10",
  line: "bg-background/30",
  ink: "bg-background/85",
  border: "border-background/15",
};

/** Miniature app window, drawn only with theme tokens. */
function MiniWindow({ p }: { p: Palette }) {
  return (
    <div className={cn("flex h-full w-full", p.bg)}>
      <div className={cn("flex w-1/4 flex-col gap-1 border-r p-1.5", p.side, p.border)}>
        <span className={cn("h-1.5 w-3/4 rounded-sm", p.ink)} />
        <span className={cn("mt-1 h-1 w-full rounded-sm", p.line)} />
        <span className={cn("h-1 w-2/3 rounded-sm", p.line)} />
        <span className={cn("h-1 w-3/4 rounded-sm", p.line)} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
        <span className={cn("h-1.5 w-1/3 rounded-sm", p.ink)} />
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-4 rounded-sm border", p.card, p.border)} />
          ))}
        </div>
        <div className={cn("flex flex-1 flex-col gap-1 rounded-sm border p-1", p.card, p.border)}>
          {["bg-success", "bg-success", "bg-destructive"].map((tone, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className={cn("size-1 rounded-full", tone)} />
              <span className={cn("h-1 flex-1 rounded-sm", p.line)} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Preview({ value, active }: { value: (typeof OPTIONS)[number]["value"]; active: "light" | "dark" }) {
  const lightP = active === "light" ? SAME : INVERSE;
  const darkP = active === "dark" ? SAME : INVERSE;
  if (value === "system") {
    return (
      <div className="relative h-full w-full">
        <MiniWindow p={lightP} />
        <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
          <MiniWindow p={darkP} />
        </div>
      </div>
    );
  }
  return <MiniWindow p={value === "light" ? lightP : darkP} />;
}

export function AppearanceSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Saved in this browser."
    >
      <RadioGroup.Root
        aria-label="Theme"
        value={mounted ? (theme ?? "system") : undefined}
        onValueChange={setTheme}
        className="grid grid-cols-1 gap-3 p-4 min-[420px]:grid-cols-3"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <RadioGroup.Item
            key={value}
            value={value}
            className={cn(
              "group rounded-lg border bg-background p-1.5 text-left transition-colors duration-150",
              "hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              "data-[state=checked]:border-brand data-[state=checked]:ring-1 data-[state=checked]:ring-brand"
            )}
          >
            <div className="aspect-[16/10] overflow-hidden rounded-md border" aria-hidden="true">
              <Preview value={value} active={active} />
            </div>
            <span className="flex items-center gap-2 px-1 pb-0.5 pt-2 text-sm font-medium">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="grid size-4 place-items-center rounded-full border group-data-[state=checked]:border-brand group-data-[state=checked]:bg-brand">
                <RadioGroup.Indicator>
                  <Check className="size-3 text-brand-foreground" strokeWidth={3} aria-hidden="true" />
                </RadioGroup.Indicator>
              </span>
            </span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </SettingsSection>
  );
}
