import {
  BellRing,
  CalendarClock,
  Radio,
  Siren,
  Timer,
  ArrowRight,
  Command,
  FileDown,
  Gauge,
  Globe,
  HeartPulse,
  ListChecks,
  Network,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { INTEGRATIONS, INTEGRATION_ORDER } from "@/components/integrations/catalog";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

function Card({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className={cn("flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="p-5 sm:p-6">
        <Icon className="size-5 text-brand" aria-hidden="true" />
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {children && (
        <div aria-hidden="true" className="mt-auto border-t bg-surface px-5 py-4 sm:px-6">
          {children}
        </div>
      )}
    </li>
  );
}

function ProtocolVisual() {
  const rows = [
    { icon: Globe, label: "HTTP", detail: "GET https://api.acme.dev/health", code: "200" },
    { icon: Server, label: "TCP", detail: "db.acme.internal:5432", code: "open" },
    { icon: Network, label: "DNS", detail: "MX acme.dev → mx1.acme.dev", code: "match" },
    { icon: HeartPulse, label: "Heartbeat", detail: "nightly-backup · 15m grace", code: "on time" },
  ];
  return (
    <ul className="space-y-1.5">
      {rows.map(({ icon: Icon, label, detail, code }) => (
        <li key={label} className="flex items-center gap-2.5 rounded-md border bg-card px-2.5 py-1.5 text-xs">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="w-16 shrink-0 font-medium">{label}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{detail}</span>
          <span className="shrink-0 rounded bg-success/10 px-1.5 font-mono text-[10px] text-success">{code}</span>
        </li>
      ))}
    </ul>
  );
}

function AssertionVisual() {
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <p className="flex justify-between gap-2">
        <span className="text-muted-foreground">expect status</span>
        <span>200-299,301</span>
      </p>
      <p className="flex justify-between gap-2">
        <span className="text-muted-foreground">body contains</span>
        <span>&quot;ok&quot;:true</span>
      </p>
      <p className="flex justify-between gap-2">
        <span className="text-muted-foreground">header</span>
        <span className="truncate">Authorization: Bearer ••••</span>
      </p>
    </div>
  );
}

function ThresholdVisual() {
  const values = [180, 210, 190, 240, 260, 420, 880, 1240, 1320, 980, 610, 300, 220, 200];
  const max = 1400;
  return (
    <div className="relative h-16">
      <div className="absolute inset-x-0 border-t border-dashed border-warning/60" style={{ bottom: `${(1000 / max) * 100}%` }}>
        <span className="absolute -top-4 right-0 font-mono text-[10px] text-warning">1 000 ms</span>
      </div>
      <div className="flex h-full items-end gap-1">
        {values.map((v, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-sm", v > 1000 ? "bg-warning/80" : "bg-brand/60")}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function IntegrationsVisual() {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {INTEGRATION_ORDER.map((t) => (
        <li key={t} className="flex flex-col items-center gap-1.5 rounded-lg border bg-card py-2.5">
          <IntegrationIcon type={t} size="sm" />
          <span className="max-w-full truncate px-1 text-[10px] text-muted-foreground">
            {INTEGRATIONS[t].label.replace("Microsoft ", "")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineVisual() {
  const items = [
    { tone: "bg-destructive", title: "Down — HTTP 503", meta: "09:41", note: "Auto-detected" },
    { tone: "bg-warning", title: "Acknowledged", meta: "09:43", note: "On it — investigating" },
    { tone: "bg-info", title: "Identified: bad deploy", meta: "09:47", note: "Public update" },
    { tone: "bg-success", title: "Resolved after 9m", meta: "09:50", note: "Recovered" },
  ];
  return (
    <ol className="relative space-y-2.5 pl-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-border">
      {items.map((it) => (
        <li key={it.title} className="relative text-xs">
          <span className={cn("absolute -left-4 top-1 size-[7px] rounded-full ring-2 ring-surface", it.tone)} />
          <div className="flex justify-between gap-2">
            <span className="font-medium">{it.title}</span>
            <span className="numeric font-mono text-[10px] text-muted-foreground">{it.meta}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">{it.note}</span>
        </li>
      ))}
    </ol>
  );
}

function SslVisual() {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px]">shop.acme.dev</p>
        <p className="text-[11px] text-muted-foreground">Let&apos;s Encrypt R11</p>
      </div>
      <span className="numeric shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-warning/20">
        12 days left
      </span>
    </div>
  );
}

function CommandVisual() {
  return (
    <div className="rounded-lg border bg-card text-xs">
      <div className="flex items-center gap-2 border-b px-2.5 py-1.5 text-muted-foreground">
        <Command className="size-3" />
        <span>check</span>
        <span className="ml-auto rounded border bg-muted px-1 font-mono text-[9px]">⌘K</span>
      </div>
      <p className="bg-accent px-2.5 py-1.5">Check api.acme.dev now</p>
      <p className="px-2.5 py-1.5 text-muted-foreground">Checkout — open incidents</p>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Built for uptime."
        />

        <ul className="mt-12 grid gap-4 md:grid-cols-6">
          <Card
            icon={Gauge}
            title="Multi-protocol checks"
            body="HTTP, TCP and DNS, every minute."
            className="md:col-span-4"
          >
            <ProtocolVisual />
          </Card>
          <Card
            icon={HeartPulse}
            title="Heartbeats for cron jobs"
            body="Ping a URL. Miss it, get alerted."
            className="md:col-span-2"
          >
            <code className="block truncate rounded-md border bg-card px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
              curl -fsS …/heartbeat/<span className="text-foreground">hb_7Kq2…</span>
            </code>
          </Card>

          <Card
            icon={ListChecks}
            title="Keyword & header assertions"
            body="Status codes, keywords, headers, bodies."
            className="md:col-span-2"
          >
            <AssertionVisual />
          </Card>
          <Card
            icon={Timer}
            title="Degraded thresholds"
            body="Slow is the new down."
            className="md:col-span-2"
          >
            <ThresholdVisual />
          </Card>
          <Card
            icon={ShieldCheck}
            title="SSL expiry warnings"
            body="Warned weeks ahead."
            className="md:col-span-2"
          >
            <SslVisual />
          </Card>

          <Card
            icon={BellRing}
            title="8 alert integrations"
            body="Slack, Teams, Telegram, email and more."
            className="md:col-span-3"
          >
            <IntegrationsVisual />
          </Card>
          <Card
            icon={Siren}
            title="Incident timeline"
            body="Acknowledge, update, resolve."
            className="md:col-span-3"
          >
            <TimelineVisual />
          </Card>

          <Card
            icon={CalendarClock}
            title="Maintenance windows"
            body="Planned work, no false alarms."
            className="md:col-span-2"
          />
          <Card
            icon={FileDown}
            title="CSV export"
            body="Your data, one click."
            className="md:col-span-2"
          />
          <Card
            icon={Command}
            title="Command menu"
            body="Everything, from the keyboard."
            className="md:col-span-2"
          >
            <CommandVisual />
          </Card>

          <li className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6 md:col-span-6">
            <Radio className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold tracking-tight">Branded status pages & badges</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your brand. Live badges.</p>
            </div>
            <a
              href="#status-pages"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-center"
            >
              See a status page
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
