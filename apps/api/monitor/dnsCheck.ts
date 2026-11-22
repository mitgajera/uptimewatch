import dns from "node:dns";
import { MONITOR_DEFAULTS, type DnsRecordType } from "db/constants";
import { describeError } from "./classify";
import type { CheckResult } from "./httpCheck";

export interface DnsTarget {
  host: string;
  dnsRecordType?: DnsRecordType;
  dnsExpected?: string;
  timeoutMs?: number;
}

/** The resolver methods a DNS check uses (node's `dns.promises.Resolver`). */
export interface DnsResolver {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
  resolveMx(host: string): Promise<{ priority: number; exchange: string }[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolveNs(host: string): Promise<string[]>;
  cancel?(): void;
}

export interface DnsDeps {
  createResolver: (timeoutMs: number) => DnsResolver;
  now: () => number;
}

/**
 * Optional comma-separated resolver IPs (e.g. "1.1.1.1,8.8.8.8"). By default
 * the system resolvers are used.
 */
const DNS_SERVERS = (process.env.DNS_CHECK_SERVERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const defaultDeps: DnsDeps = {
  // `dns` (not `dns/promises`) so tests mocking that module can't affect us.
  createResolver: (timeoutMs) => {
    const resolver = new dns.promises.Resolver({ timeout: timeoutMs, tries: 1 });
    if (DNS_SERVERS.length) resolver.setServers(DNS_SERVERS);
    return resolver;
  },
  now: Date.now,
};

/** Resolve one record type and flatten the answers to comparable strings. */
async function lookupRecords(resolver: DnsResolver, host: string, type: DnsRecordType): Promise<string[]> {
  switch (type) {
    case "A":
      return resolver.resolve4(host);
    case "AAAA":
      return resolver.resolve6(host);
    case "CNAME":
      return resolver.resolveCname(host);
    case "MX":
      return (await resolver.resolveMx(host)).map((r) => `${r.priority} ${r.exchange}`);
    case "TXT":
      return (await resolver.resolveTxt(host)).map((chunks) => chunks.join(""));
    case "NS":
      return resolver.resolveNs(host);
  }
}

const NO_DATA_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN", "ENONAME"]);
const TIMEOUT_CODES = new Set(["ETIMEOUT", "ETIMEDOUT"]);

/**
 * Resolve a record for the monitor's host. UP when there is at least one
 * answer and, if `dnsExpected` is set, some answer contains it
 * (case-insensitive). Only DNS servers are contacted, never the host itself.
 */
export async function runDnsCheck(target: DnsTarget, deps: DnsDeps = defaultDeps): Promise<CheckResult> {
  const host = target.host.trim().replace(/\.$/, "");
  const type = target.dnsRecordType ?? MONITOR_DEFAULTS.dnsRecordType;
  const expected = (target.dnsExpected ?? "").trim();
  const timeout = target.timeoutMs ?? MONITOR_DEFAULTS.timeoutMs;
  const start = deps.now();
  const down = (errorType: CheckResult["errorType"], errorMessage: string): CheckResult => ({
    status: "DOWN",
    latency: deps.now() - start,
    statusCode: null,
    errorType,
    errorMessage: errorMessage.slice(0, 300),
  });

  const resolver = deps.createResolver(timeout);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The resolver's own timeout is per try; this bounds the whole check.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("DNS query timed out"), { code: "ETIMEOUT" })), timeout);
    });
    const answers = await Promise.race([lookupRecords(resolver, host, type), deadline]);
    const latency = deps.now() - start;

    if (answers.length === 0) return down("DNS", `No ${type} records for ${host}`);
    if (expected && !answers.some((a) => a.toLowerCase().includes(expected.toLowerCase()))) {
      return down("DNS_MISMATCH", `${type} records did not contain "${expected.slice(0, 50)}" (got ${answers.slice(0, 5).join(", ")})`);
    }
    return { status: "UP", latency, statusCode: null, errorType: null, errorMessage: null };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (TIMEOUT_CODES.has(code)) {
      resolver.cancel?.();
      return down("TIMEOUT", `DNS query timed out after ${timeout / 1000}s`);
    }
    if (NO_DATA_CODES.has(code)) {
      return down("DNS", code === "ENODATA" ? `No ${type} records for ${host}` : `No ${type} records found for ${host} (NXDOMAIN or no data)`);
    }
    return down("DNS", describeError(err));
  } finally {
    clearTimeout(timer);
  }
}
