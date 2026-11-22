import type { Metadata } from "next";
import { NewStatusPage } from "@/components/status-pages/editor/editor-routes";

export const metadata: Metadata = { title: "New status page" };

export default function NewStatusPageRoute() {
  return <NewStatusPage />;
}
