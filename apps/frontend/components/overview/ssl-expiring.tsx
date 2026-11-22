import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/app/page";
import type { Overview } from "@/lib/api/types";
import { hostnameOf } from "@/lib/monitor-format";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function daysTone(days: number) {
  if (days <= 7) return "bg-destructive/10 text-destructive ring-destructive/25";
  if (days <= 14) return "bg-warning/10 text-warning ring-warning/25";
  return "bg-muted text-muted-foreground ring-border";
}

function daysText(days: number) {
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function SslExpiring({ items }: { items: Overview["sslExpiring"] }) {
  return (
    <Panel title="SSL certificates" description="Expiring in the next 30 days" bodyClassName="p-2">
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-2 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success/10 ring-1 ring-inset ring-success/20">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          </span>
          <p className="text-xs text-muted-foreground">No certificates expire in the next 30 days.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/monitors/${c.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name || hostnameOf(c.url)}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {hostnameOf(c.url)} · <span className="numeric">{dateFmt.format(new Date(c.sslExpiresAt))}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "numeric shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                    daysTone(c.daysLeft)
                  )}
                >
                  {daysText(c.daysLeft)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
