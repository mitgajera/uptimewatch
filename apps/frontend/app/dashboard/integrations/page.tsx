"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { AddIntegrationDialog } from "@/components/integrations/add-integration-dialog";
import { MAX_CHANNELS } from "@/components/integrations/catalog";
import { ConnectedChannels } from "@/components/integrations/connected-channels";
import { IntegrationCatalog } from "@/components/integrations/integration-catalog";
import { UserSync } from "@/components/layout/user-sync";
import { useAlertChannels } from "@/hooks/queries";
import type { AlertChannelType } from "@/lib/api/types";

const CATALOG_ID = "add-integration";

export default function IntegrationsPage() {
  const channels = useAlertChannels();
  const [selected, setSelected] = useState<AlertChannelType | null>(null);
  const [open, setOpen] = useState(false);
  const atLimit = (channels.data?.length ?? 0) >= MAX_CHANNELS;

  const browse = () => {
    const el = document.getElementById(CATALOG_ID);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-6">
      <UserSync />
      <PageHeader
        title="Integrations"
        description="Where your alerts go."
        actions={
          <Button className="h-9" onClick={browse} disabled={atLimit || channels.isLoading}>
            <Plus className="size-4" aria-hidden="true" />
            Add integration
          </Button>
        }
      />

      <ConnectedChannels
        channels={channels.data}
        isLoading={channels.isLoading}
        isError={channels.isError}
        onRetry={() => channels.refetch()}
        onBrowse={browse}
      />

      <IntegrationCatalog
        id={CATALOG_ID}
        channels={channels.data}
        onSelect={(type) => {
          setSelected(type);
          setOpen(true);
        }}
      />


      <AddIntegrationDialog type={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
