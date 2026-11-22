import { QueryProvider } from "@/components/providers/query-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandMenuProvider } from "@/components/app/command-menu";
import { UserSync } from "@/components/layout/user-sync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <UserSync />
      <TooltipProvider delayDuration={200}>
        <CommandMenuProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0 bg-background">
              <AppTopbar />
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </CommandMenuProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
