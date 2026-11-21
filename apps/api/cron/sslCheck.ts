import cron from "node-cron";
import { Notification, Website } from "db/client";
import { assertSafeUrl } from "../utils/ssrf";
import { daysUntil, fetchCertificate, sslAlertThreshold } from "../monitor/ssl";
import { sslExpiryAlert } from "../monitor/messages";
import { mapSettledWithConcurrency } from "../monitor/schedule";

/** Certificates rarely change; re-read each one at most this often. */
const SSL_RECHECK_MS = 12 * 60 * 60 * 1000;

function log(message: string, data: Record<string, unknown> = {}) {
  console.log(`[${new Date().toISOString()}] [SSL] ${message}`, data);
}

async function checkCertificate(website: any, now: number) {
  const url = new URL(website.url);
  // Same SSRF guard as HTTP checks: never open sockets to private hosts.
  await assertSafeUrl(website.url);

  const cert = await fetchCertificate(url.hostname, url.port ? Number(url.port) : 443);
  const daysLeft = daysUntil(cert.validTo, now);
  const threshold = sslAlertThreshold(daysLeft, website.sslAlertedThreshold);

  // A renewed certificate re-arms the warnings.
  const renewed =
    website.sslExpiresAt && cert.validTo.getTime() > new Date(website.sslExpiresAt).getTime();

  await Website.updateOne(
    { _id: website._id },
    {
      $set: {
        sslExpiresAt: cert.validTo,
        sslIssuer: cert.issuer,
        sslCheckedAt: new Date(now),
        sslAlertedThreshold: renewed ? null : threshold ?? website.sslAlertedThreshold ?? null,
      },
    }
  );

  if (threshold !== null && !renewed) {
    log("Certificate expiring", { url: website.url, daysLeft });
    await Notification.create({
      userId: website.userId,
      websiteId: website._id,
      kind: "SSL_EXPIRY",
      ...sslExpiryAlert(website, cert, daysLeft),
    });
  }
}

/** Refresh certificate info for https monitors and warn before expiry. */
export async function runSslChecks(now = Date.now()) {
  try {
    const websites = await Website.find({
      disabled: false,
      paused: { $ne: true },
      url: /^https:\/\//i,
      $or: [
        { sslCheckedAt: null },
        { sslCheckedAt: { $exists: false } },
        { sslCheckedAt: { $lt: new Date(now - SSL_RECHECK_MS) } },
      ],
    }).lean();
    if (websites.length === 0) return;

    const results = await mapSettledWithConcurrency(websites, 10, (w) => checkCertificate(w, now));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        log("Certificate check failed", {
          url: websites[i]?.url,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    });
  } catch (err) {
    log("Error running SSL checks", { error: err instanceof Error ? err.message : String(err) });
  }
}

export const scheduleSslCheck = () => {
  // Every 15 minutes pick up monitors whose certificate data is stale.
  cron.schedule("*/15 * * * *", () => runSslChecks());
};
