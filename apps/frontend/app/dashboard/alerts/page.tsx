import { redirect } from "next/navigation";

/** Alerts moved to Integrations. */
export default function AlertsRedirect() {
  redirect("/dashboard/integrations");
}
