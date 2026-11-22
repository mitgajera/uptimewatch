import Link from "next/link";
import { Activity, ArrowRight, BellRing, Plus, Radio, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  cta: string;
}

const STEPS: Step[] = [
  {
    icon: Activity,
    title: "Add a monitor",
    body: "Watch a website, API, TCP port, DNS record or cron job. Checks run as often as every minute.",
    href: "/dashboard/monitors/new",
    cta: "Create monitor",
  },
  {
    icon: BellRing,
    title: "Connect alerts",
    body: "Get notified by email, Slack, Discord, Telegram, Teams or a webhook the moment something fails.",
    href: "/dashboard/integrations",
    cta: "Set up alerts",
  },
  {
    icon: Radio,
    title: "Publish a status page",
    body: "Share live uptime and incident updates with your users on a public page.",
    href: "/dashboard/status-pages/new",
    cta: "Create status page",
  },
];

/** First-run state: shown when the account has no monitors. */
export function Onboarding() {
  return (
    <section
      aria-labelledby="onboarding-title"
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div className="relative border-b px-6 py-8 sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand)_0%,transparent_55%)] opacity-[0.07]"
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
            Getting started
          </span>
          <h2 id="onboarding-title" className="mt-4 text-lg font-semibold tracking-tight sm:text-xl">
            Know about downtime before your users do
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three steps to a fully monitored stack. Your first monitor starts checking within a minute.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/monitors/new">
              <Plus className="size-4" aria-hidden="true" />
              Create your first monitor
            </Link>
          </Button>
        </div>
      </div>
      <ol className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border bg-muted/50">
                <step.icon className="size-4 text-foreground" aria-hidden="true" />
              </span>
              <span className="numeric text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
            <Link
              href={step.href}
              className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {step.cta}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
