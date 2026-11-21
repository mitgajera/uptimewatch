import net from "node:net";
import tls from "node:tls";
import { safeLookup } from "../utils/ssrf";

/** Days-before-expiry at which users are warned, most distant first. */
export const SSL_ALERT_THRESHOLDS = [30, 14, 7, 1] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const TLS_TIMEOUT_MS = 10_000;

export interface CertificateInfo {
  validTo: Date;
  issuer: string | null;
}

/**
 * Connect to `host:port` and read the leaf certificate. Verification is
 * disabled on purpose: we want the expiry date even for an already-expired or
 * misconfigured certificate (the HTTP check reports those as TLS failures).
 */
export function fetchCertificate(host: string, port = 443): Promise<CertificateInfo> {
  return new Promise((resolve, reject) => {
    // IPv6 literals arrive bracketed from URL.hostname; SNI must be a DNS name.
    const bare = host.replace(/^\[|\]$/g, "");
    const socket = tls.connect({
      host: bare,
      port,
      servername: net.isIP(bare) ? undefined : bare,
      rejectUnauthorized: false,
      // Resolve through the SSRF guard so the socket only reaches vetted addresses.
      lookup: safeLookup,
    });
    const done = (fn: () => void) => {
      socket.destroy();
      fn();
    };

    socket.setTimeout(TLS_TIMEOUT_MS, () => done(() => reject(new Error("TLS handshake timed out"))));
    socket.once("error", (err: Error) => done(() => reject(err)));
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      if (!cert?.valid_to) {
        done(() => reject(new Error("No certificate presented")));
        return;
      }
      const issuer = cert.issuer?.O || cert.issuer?.CN || null;
      done(() => resolve({ validTo: new Date(cert.valid_to), issuer: issuer ? String(issuer) : null }));
    });
  });
}

export function daysUntil(date: Date, now: number): number {
  return Math.floor((date.getTime() - now) / DAY_MS);
}

/**
 * The warning threshold that should fire now, or null. Each threshold fires
 * once: `lastAlerted` is the threshold most recently alerted for, so moving
 * from 30 -> 14 days alerts again but repeated checks inside 14 days do not.
 */
export function sslAlertThreshold(daysLeft: number, lastAlerted: number | null | undefined): number | null {
  const crossed = SSL_ALERT_THRESHOLDS.filter((t) => daysLeft <= t);
  if (crossed.length === 0) return null;
  const tightest = crossed[crossed.length - 1]!;
  if (lastAlerted != null && lastAlerted <= tightest) return null;
  return tightest;
}
