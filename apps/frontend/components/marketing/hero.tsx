import { Globe, HeartPulse, Network, Radio, Server, ShieldCheck } from "lucide-react";
import { PrimaryCta } from "./auth-actions";
import { ProductPreview } from "./product-preview";

const CAPABILITIES = [
  { icon: Globe, label: "HTTP & APIs" },
  { icon: Server, label: "TCP ports" },
  { icon: Network, label: "DNS records" },
  { icon: HeartPulse, label: "Cron heartbeats" },
  { icon: ShieldCheck, label: "SSL expiry" },
  { icon: Radio, label: "Status pages" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <a
            href="#features"
            className="inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-xs text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative flex size-2" aria-hidden="true">
              <span className="animate-status-pulse absolute inset-0 rounded-full bg-success" />
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            HTTP · TCP · DNS · Heartbeats
          </a>
          <h1 className="mt-6 text-balance font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Know it&apos;s down before your customers do.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Monitoring, alerts and status pages. One place.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryCta />
            <a
              href="#features"
              className="inline-flex h-11 items-center rounded-md px-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore features
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 sm:mt-16">
          <ProductPreview />
        </div>
      </div>

      <div className="relative border-t bg-surface">
        <ul
          aria-label="What UptimeWatch monitors"
          className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-6"
        >
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Icon className="size-4 text-foreground/70" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
