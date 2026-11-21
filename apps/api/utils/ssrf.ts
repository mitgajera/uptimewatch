import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * SSRF protection for user-supplied monitor URLs.
 *
 * Websites are fetched server-side every minute, so an attacker could point a
 * monitor at internal-only infrastructure (cloud metadata endpoints, private
 * networks, loopback services). These helpers reject URLs whose (resolved)
 * address falls inside a private, loopback, link-local or otherwise reserved
 * range.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (base: string, maskBits: number) => {
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id
  // IPv4-mapped / -compatible addresses (::ffff:a.b.c.d)
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe8") || addr.startsWith("fe9") || addr.startsWith("fea") || addr.startsWith("feb"))
    return true; // link-local fe80::/10
  const first = parseInt(addr.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // unknown format — reject to be safe
}

/**
 * Validate a monitor URL, resolving its hostname and rejecting any that map to
 * a private/reserved address. Returns the parsed URL and a vetted address.
 */
async function resolveSafe(rawUrl: string): Promise<{ parsed: URL; address: string; family: number }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new UnsafeUrlError("Only http and https URLs are allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // If the host is already a literal IP, check it directly.
  const literal = net.isIP(hostname);
  if (literal) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError("URL resolves to a private or reserved address");
    }
    return { parsed, address: hostname, family: literal };
  }

  // Otherwise resolve the hostname and reject if ANY address is private.
  const addresses = await resolveSafeHost(hostname);
  return { parsed, ...addresses[0]! };
}

async function resolveSafeHost(hostname: string): Promise<{ address: string; family: number }[]> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve host");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("URL resolves to a private or reserved address");
  }
  return addresses;
}

/** Throws {@link UnsafeUrlError} unless the URL is http(s) and resolves only to public addresses. */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  await resolveSafe(rawUrl);
}

/**
 * Validate a URL and return how to request it so the connection goes to the
 * vetted address, closing the DNS-rebinding gap between check and connect
 * (Bun's HTTP client ignores custom `lookup`/`createConnection` hooks).
 *
 * - http: the hostname is replaced by the vetted IP and sent as `Host`.
 * - https: left as is. Certificate verification pins the identity: a host
 *   rebound to an internal address can't present a valid certificate for the
 *   attacker's domain, so the request fails before anything is exchanged.
 */
export async function pinSafeUrl(rawUrl: string): Promise<{ url: string; headers: Record<string, string> }> {
  const { parsed, address, family } = await resolveSafe(rawUrl);
  if (parsed.protocol === "https:") return { url: rawUrl, headers: {} };

  const host = parsed.host;
  const pinned = new URL(parsed.toString());
  pinned.hostname = family === 6 ? `[${address}]` : address;
  return { url: pinned.toString(), headers: { Host: host } };
}

type LookupCallback = (err: Error | null, address: any, family?: number) => void;

/**
 * A `lookup` for `net`/`tls.connect` that only ever hands the socket vetted
 * public addresses, so validation and connection use the same answer.
 */
export function safeLookup(hostname: string, options: any, callback?: LookupCallback): void {
  const cb = (typeof options === "function" ? options : callback) as LookupCallback;
  const opts = typeof options === "object" && options ? options : {};
  const host = hostname.replace(/^\[|\]$/g, "");
  const resolved: Promise<{ address: string; family: number }[]> = net.isIP(host)
    ? isPrivateAddress(host)
      ? Promise.reject(new UnsafeUrlError("URL resolves to a private or reserved address"))
      : Promise.resolve([{ address: host, family: net.isIP(host) }])
    : resolveSafeHost(host);
  resolved.then(
    (addresses) => (opts.all ? cb(null, addresses) : cb(null, addresses[0]!.address, addresses[0]!.family)),
    (err) => cb(err, undefined)
  );
}
