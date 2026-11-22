import { Check, CheckCircle2, ImageIcon, Megaphone, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

type Tone = "up" | "degraded" | "down";
const TONE: Record<Tone, string> = { up: "bg-success/80", degraded: "bg-warning/85", down: "bg-destructive/85" };

function days(incidents: Record<number, Tone>): Tone[] {
  return Array.from({ length: 60 }, (_, i) => incidents[i] ?? "up");
}

const COMPONENTS = [
  { name: "Website", uptime: "100%", bars: days({}) },
  { name: "API", uptime: "99.94%", bars: days({ 41: "down", 42: "degraded" }) },
  { name: "Checkout", uptime: "99.98%", bars: days({ 17: "degraded" }) },
];

const POINTS = [
  { icon: Palette, text: "Your logo and colors" },
  { icon: Megaphone, text: "Announcements" },
  { icon: CheckCircle2, text: "Public incident updates" },
  { icon: ImageIcon, text: "Embeddable status badge" },
];

function StatusPageMock() {
  return (
    <div
      role="img"
      aria-label="Example public status page: all systems operational, three components with 60 days of uptime, and a resolved API incident."
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-foreground text-[11px] font-bold text-background">
              A
            </span>
            <span className="text-sm font-semibold">Acme status</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">/status/acme</span>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2.5 rounded-lg bg-success/10 px-3.5 py-3 text-success ring-1 ring-inset ring-success/20">
            <span className="grid size-5 place-items-center rounded-full bg-success text-background">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-sm font-semibold">All systems operational</span>
          </div>

          <div className="divide-y rounded-lg border">
            {COMPONENTS.map((c) => (
              <div key={c.name} className="space-y-2 px-3.5 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="numeric text-muted-foreground">{c.uptime} uptime</span>
                </div>
                <div className="flex h-6 items-stretch gap-[2px]">
                  {c.bars.map((t, i) => (
                    <span key={i} className={cn("min-w-[1px] flex-1 rounded-[1.5px]", TONE[t])} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between px-3.5 py-2 text-[10px] text-muted-foreground">
              <span>60 days ago</span>
              <span>Today</span>
            </div>
          </div>

          <div className="rounded-lg border p-3.5">
            <p className="text-xs font-semibold">API returning errors</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Resolved · lasted 9 minutes</p>
            <ol className="mt-3 space-y-2 border-l pl-3 text-[11px]">
              <li>
                <span className="font-medium text-success">Resolved</span>
                <span className="text-muted-foreground"> — Error rates are back to normal.</span>
              </li>
              <li>
                <span className="font-medium">Identified</span>
                <span className="text-muted-foreground"> — A bad deploy was rolled back.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgeMock() {
  return (
    <div
      role="img"
      aria-label="Example status badge reading status: operational"
      className="inline-flex overflow-hidden rounded-[4px] text-[11px] font-medium leading-5"
    >
      <span aria-hidden="true" className="bg-foreground/80 px-2 text-background">
        status
      </span>
      <span aria-hidden="true" className="bg-success px-2 text-background">
        operational
      </span>
    </div>
  );
}

export function StatusShowcase() {
  return (
    <section id="status-pages" className="scroll-mt-20 border-b bg-surface py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Status pages"
            title="Keep customers in the loop."
          />
          <ul className="mt-8 space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <BadgeMock />
            <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
              /public/status-pages/acme/badge.svg
            </code>
          </div>
        </div>
        <StatusPageMock />
      </div>
    </section>
  );
}
