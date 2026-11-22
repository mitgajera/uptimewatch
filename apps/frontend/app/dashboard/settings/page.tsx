"use client";

import { PageHeader } from "@/components/app/page";
import { UserSync } from "@/components/layout/user-sync";
import { AccountSection } from "@/components/settings/account-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DangerZone } from "@/components/settings/danger-zone";
import { DataSection } from "@/components/settings/data-section";
import { NotificationsSection } from "@/components/settings/notifications-section";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <UserSync />
      <PageHeader title="Settings" description="Your account, appearance, notifications and data." />
      <div className="space-y-6">
        <AccountSection />
        <AppearanceSection />
        <NotificationsSection />
        <DataSection />
        <DangerZone />
      </div>
    </div>
  );
}
