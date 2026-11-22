import type { Metadata } from "next";
import { StatusPagesList } from "@/components/status-pages/status-pages-list";

export const metadata: Metadata = { title: "Status pages" };

export default function StatusPagesPage() {
  return <StatusPagesList />;
}
