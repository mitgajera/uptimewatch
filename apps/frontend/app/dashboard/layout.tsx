import { QueryProvider } from "@/components/providers/query-provider";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="md:sticky md:top-24 md:self-start">
          <DashboardNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </QueryProvider>
  );
}
