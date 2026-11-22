"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  BellRing,
  LayoutDashboard,
  Plus,
  Radio,
  Settings,
  Siren,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/app/logo";
import { StatusDot } from "@/components/app/status";
import { useMonitors, useOverview } from "@/hooks/queries";
import { displayName, monitorState, STATE_ORDER } from "@/lib/monitor-format";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  badgeTone?: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const overview = useOverview();
  const monitors = useMonitors();

  const down = overview.data?.counts.down ?? 0;
  const open = overview.data?.openIncidents ?? 0;

  const main: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/monitors", label: "Monitors", icon: Activity, badge: down, badgeTone: "text-destructive" },
    { href: "/dashboard/incidents", label: "Incidents", icon: Siren, badge: open, badgeTone: "text-destructive" },
    { href: "/dashboard/status-pages", label: "Status pages", icon: Radio },
  ];
  const config: NavItem[] = [
    { href: "/dashboard/integrations", label: "Integrations", icon: BellRing },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Problems first, so the most relevant monitors are one click away.
  const pinned = [...(monitors.data ?? [])]
    .sort((a, b) => STATE_ORDER[monitorState(a)] - STATE_ORDER[monitorState(b)])
    .slice(0, 6);

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
          <Link href={item.href}>
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {item.badge ? (
          <SidebarMenuBadge className={item.badgeTone}>
            <span className="numeric">{item.badge}</span>
            <span className="sr-only"> need attention</span>
          </SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-2">
        <Link href="/dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="New monitor" className="font-medium">
                  <Link href="/dashboard/monitors/new">
                    <Plus aria-hidden="true" />
                    <span>New monitor</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {renderItems(main)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {pinned.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Monitors</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinned.map((m) => {
                  const href = `/dashboard/monitors/${m.id}`;
                  return (
                    <SidebarMenuItem key={m.id}>
                      <SidebarMenuButton asChild size="sm" isActive={pathname.startsWith(href)}>
                        <Link href={href}>
                          <StatusDot state={monitorState(m)} live={false} />
                          <span className="truncate">{displayName(m)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Configure</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(config)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <UserButton appearance={{ elements: { avatarBox: "size-7" } }} />
          <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Account</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
