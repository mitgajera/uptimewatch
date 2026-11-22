import { PrimaryCta } from "./auth-actions";

export function FinalCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center shadow-xs sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
          />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-balance font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
              Know first. Fix faster.
            </h2>
            <div className="mt-8 flex justify-center">
              <PrimaryCta />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
