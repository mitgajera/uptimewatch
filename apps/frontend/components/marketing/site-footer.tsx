import Link from "next/link";
import { Logo } from "@/components/app/logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#status-pages", label: "Status pages" },
    ],
  },
  {
    title: "App",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/monitors", label: "Monitors" },
      { href: "/dashboard/integrations", label: "Integrations" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto_auto] md:gap-16">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">
            Uptime, API, cron and SSL monitoring with alerts that reach the right people.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g.title}</h2>
            <ul className="mt-3 space-y-1">
              {g.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("#") ? (
                    <a href={l.href} className="inline-flex h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="inline-flex h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © <span className="numeric">{new Date().getFullYear()}</span> UptimeWatch
          </p>
          <p className="flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="animate-status-pulse absolute inset-0 rounded-full bg-success" />
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            Checking the internet, one minute at a time.
          </p>
        </div>
      </div>
    </footer>
  );
}
