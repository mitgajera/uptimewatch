"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BellRing, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Monitors", icon: Activity, match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/monitors") },
  { href: "/dashboard/status-pages", label: "Status pages", icon: Globe, match: (p: string) => p.startsWith("/dashboard/status-pages") },
  { href: "/dashboard/alerts", label: "Alerts", icon: BellRing, match: (p: string) => p.startsWith("/dashboard/alerts") },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
