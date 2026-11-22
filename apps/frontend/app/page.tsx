import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { StatusShowcase } from "@/components/marketing/status-showcase";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Features />
        <StatusShowcase />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
