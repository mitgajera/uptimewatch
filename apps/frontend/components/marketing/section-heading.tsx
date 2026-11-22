import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-pretty text-base text-muted-foreground">{description}</p>}
    </div>
  );
}
