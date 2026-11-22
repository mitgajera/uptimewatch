import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_BACKEND_URL } from "@/config";
import type { PublicStatusPage } from "@/lib/api/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicStatusView } from "@/components/status-pages/public-status-view";
import { OVERALL } from "@/components/status-pages/status-meta";

// Matches the API's cache window.
export const revalidate = 60;

async function getStatusPage(slug: string): Promise<PublicStatusPage | null> {
  const res = await fetch(`${API_BACKEND_URL}/api/v1/public/status-pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Status page request failed (${res.status})`);
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStatusPage(slug).catch(() => null);
  if (!page) return { title: "Status page not found" };
  const description = page.description || `${OVERALL[page.status].title}. Live status of ${page.title}.`;
  return {
    title: `${page.title} status`,
    description,
    openGraph: { title: `${page.title} status`, description },
  };
}

export default async function PublicStatusPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getStatusPage(slug);
  if (!page) notFound();

  return (
    <TooltipProvider delayDuration={100}>
      <PublicStatusView page={page} />
    </TooltipProvider>
  );
}
