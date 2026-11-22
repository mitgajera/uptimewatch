import { cn } from "@/lib/utils";

/** Settings section: label column on the left (desktop), content card on the right. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  tone,
  className,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  tone?: "danger";
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("grid gap-4 border-t pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-8", className)}
    >
      <div>
        <h2 id={`${id}-title`} className={cn("text-sm font-semibold", tone === "danger" && "text-destructive")}>
          {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "min-w-0 rounded-xl border bg-card shadow-xs",
          tone === "danger" && "border-destructive/30"
        )}
      >
        {children}
      </div>
    </section>
  );
}
