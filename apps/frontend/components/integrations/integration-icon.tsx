import { BellRing, Gamepad2, Mail, MessageCircle, Send, Slack, Users, Webhook, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertChannelType } from "@/lib/api/types";
import { INTEGRATIONS } from "./catalog";

export const INTEGRATION_ICON: Record<AlertChannelType, LucideIcon> = {
  email: Mail,
  slack: Slack,
  discord: Gamepad2,
  teams: Users,
  googlechat: MessageCircle,
  telegram: Send,
  ntfy: BellRing,
  webhook: Webhook,
};

/** Rounded tile with the integration's glyph, colored from theme tokens. */
export function IntegrationIcon({
  type,
  size = "md",
  className,
}: {
  type: AlertChannelType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = INTEGRATION_ICON[type];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-lg ring-1 ring-inset",
        INTEGRATIONS[type].tone,
        size === "sm" && "size-8 [&>svg]:size-4",
        size === "md" && "size-9 [&>svg]:size-[18px]",
        size === "lg" && "size-11 [&>svg]:size-5",
        className
      )}
    >
      <Icon />
    </span>
  );
}
