"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  BellRing,
  LayoutDashboard,
  Moon,
  Plus,
  Radio,
  Settings,
  Siren,
  Sun,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { StatusDot } from "@/components/app/status";
import { useMonitors } from "@/hooks/queries";
import { displayName, monitorState, monitorTarget } from "@/lib/monitor-format";

const CommandMenuContext = createContext<{ open: () => void }>({ open: () => {} });

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

/** ⌘K / Ctrl+K palette: jump to pages and monitors, run common actions. */
export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const monitors = useMonitors();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  const pages = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Monitors", href: "/dashboard/monitors", icon: Activity },
    { label: "Incidents", href: "/dashboard/incidents", icon: Siren },
    { label: "Status pages", href: "/dashboard/status-pages", icon: Radio },
    { label: "Integrations", href: "/dashboard/integrations", icon: BellRing },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <CommandMenuContext.Provider value={ctx}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search monitors, pages and actions…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(() => router.push("/dashboard/monitors/new"))}>
              <Plus aria-hidden="true" />
              Create monitor
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => router.push("/dashboard/status-pages/new"))}>
              <Radio aria-hidden="true" />
              Create status page
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </CommandItem>
          </CommandGroup>
          {(monitors.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Monitors">
                {monitors.data!.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${displayName(m)} ${monitorTarget(m)} ${m.tags?.join(" ") ?? ""}`}
                    onSelect={() => run(() => router.push(`/dashboard/monitors/${m.id}`))}
                  >
                    <StatusDot state={monitorState(m)} live={false} />
                    <span className="truncate">{displayName(m)}</span>
                    <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">{monitorTarget(m)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {pages.map((p) => (
              <CommandItem key={p.href} onSelect={() => run(() => router.push(p.href))}>
                <p.icon aria-hidden="true" />
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}
