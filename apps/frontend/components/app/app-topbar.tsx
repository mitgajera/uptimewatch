"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCommandMenu } from "@/components/app/command-menu";
import { useMonitors, useStatusPages } from "@/hooks/queries";
import { displayName } from "@/lib/monitor-format";

const SEGMENT_LABEL: Record<string, string> = {
  dashboard: "Overview",
  monitors: "Monitors",
  incidents: "Incidents",
  "status-pages": "Status pages",
  integrations: "Integrations",
  settings: "Settings",
  new: "New",
  edit: "Edit",
};

const isId = (s: string) => /^[a-f\d]{24}$/i.test(s);

/** Breadcrumbs derived from the path; ids resolve to monitor / page names. */
function Breadcrumbs() {
  const pathname = usePathname();
  const monitors = useMonitors();
  const pages = useStatusPages();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs = parts.map((part, i) => {
    const href = `/${parts.slice(0, i + 1).join("/")}`;
    let label = SEGMENT_LABEL[part] ?? part;
    if (isId(part)) {
      const parent = parts[i - 1];
      if (parent === "monitors") {
        const m = monitors.data?.find((x) => x.id === part);
        label = m ? displayName(m) : "Monitor";
      } else if (parent === "status-pages") {
        label = pages.data?.find((x) => x.id === part)?.title ?? "Status page";
      }
    }
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={c.href}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
              <li className={last ? "min-w-0 truncate font-medium" : "hidden shrink-0 sm:block"}>
                {last ? (
                  <span aria-current="page">{c.label}</span>
                ) : (
                  <Link href={c.href} className="rounded text-muted-foreground transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppTopbar() {
  const { open } = useCommandMenu();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <SidebarTrigger className="size-9" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={open}
          className="hidden h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        >
          <Search className="size-4" aria-hidden="true" />
          <span>Search…</span>
          <kbd className="ml-6 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">Ctrl K</kbd>
        </button>
        <button
          type="button"
          onClick={open}
          aria-label="Search"
          className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
