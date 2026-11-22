import { runHttpCheck, type CheckResult } from "./httpCheck";
import { runTcpCheck } from "./tcpCheck";
import { runDnsCheck } from "./dnsCheck";

export interface RunCheckDeps {
  http: typeof runHttpCheck;
  tcp: typeof runTcpCheck;
  dns: typeof runDnsCheck;
}

const defaultDeps: RunCheckDeps = { http: runHttpCheck, tcp: runTcpCheck, dns: runDnsCheck };

/** Run the active check for an http, tcp or dns monitor (heartbeats are evaluated, not checked). */
export function runMonitorCheck(website: any, deps: RunCheckDeps = defaultDeps): Promise<CheckResult> {
  switch (website.type ?? "http") {
    case "tcp":
      return deps.tcp({ host: website.host ?? "", port: website.port, timeoutMs: website.timeoutMs });
    case "dns":
      return deps.dns({
        host: website.host ?? "",
        dnsRecordType: website.dnsRecordType,
        dnsExpected: website.dnsExpected,
        timeoutMs: website.timeoutMs,
      });
    default:
      return deps.http(website);
  }
}
