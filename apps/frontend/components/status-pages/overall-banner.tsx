import type { PublicPageStatus } from "@/lib/api/types";
import { StatusDot } from "@/components/app/status";
import { cn } from "@/lib/utils";
import { OVERALL } from "./status-meta";
import { RelativeTime } from "./time";

/** The big "how are things right now" banner at the top of a status page. */
export function OverallBanner({
  status,
  generatedAt,
  upCount,
  total,
}: {
  status: PublicPageStatus;
  generatedAt: string;
  upCount: number;
  total: number;
}) {
  const meta = OVERALL[status];
  const Icon = meta.icon;
  return (
    <section
      aria-label="Current status"
      className={cn("relative overflow-hidden rounded-2xl p-5 ring-1 ring-inset @lg:p-6", meta.soft)}
    >
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-xs ring-1 ring-border">
            <Icon className={cn("size-6", meta.tone)} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={cn("text-lg font-semibold tracking-tight @lg:text-xl", meta.tone)} role="status">
              {meta.title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{meta.detail}</p>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-4 gap-y-1 text-xs text-muted-foreground @lg:flex-col @lg:items-end">
          {total > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <StatusDot state={meta.dot} />
              <span className="numeric">
                {upCount} of {total}
              </span>{" "}
              operational
            </span>
          )}
          <span>
            Updated <RelativeTime iso={generatedAt} className="numeric" />
          </span>
        </div>
      </div>
    </section>
  );
}
