import type { Metadata } from "next";
import { EditStatusPage } from "@/components/status-pages/editor/editor-routes";

export const metadata: Metadata = { title: "Edit status page" };

export default function EditStatusPageRoute() {
  return <EditStatusPage />;
}
