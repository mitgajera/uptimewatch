import { describe, expect, mock, test } from "bun:test";
import { runDnsCheck, type DnsDeps, type DnsResolver } from "../monitor/dnsCheck";

const notFound = () => Object.assign(new Error("queryA ENOTFOUND"), { code: "ENOTFOUND" });

function resolver(overrides: Partial<DnsResolver> = {}): DnsResolver {
  return {
    resolve4: mock(async () => ["93.184.216.34"]),
    resolve6: mock(async () => ["2606:2800:220:1::1"]),
    resolveCname: mock(async () => ["edge.cdn.example.net"]),
    resolveMx: mock(async () => [{ priority: 10, exchange: "mx1.Mail.example.com" }]),
    resolveTxt: mock(async () => [["v=spf1 include:_spf.", "example.com ~all"]]),
    resolveNs: mock(async () => ["ns1.example.com"]),
    ...overrides,
  };
}

function deps(r: DnsResolver): DnsDeps & { createResolver: ReturnType<typeof mock> } {
  let t = 0;
  return { createResolver: mock(() => r), now: () => (t += 10) } as any;
}

describe("runDnsCheck", () => {
  test("any answer is UP when nothing is expected", async () => {
    const d = deps(resolver());
    const result = await runDnsCheck({ host: "example.com", timeoutMs: 3000 }, d);
    expect(result).toEqual({ status: "UP", latency: 10, statusCode: null, errorType: null, errorMessage: null });
    // The monitor timeout is passed to the resolver.
    expect(d.createResolver).toHaveBeenCalledWith(3000);
  });

  test("queries the configured record type", async () => {
    const r = resolver();
    await runDnsCheck({ host: "example.com", dnsRecordType: "MX" }, deps(r));
    expect(r.resolveMx).toHaveBeenCalledWith("example.com");
    expect(r.resolve4).not.toHaveBeenCalled();
  });

  test("expected text must appear in some answer, case-insensitively", async () => {
    const mx = await runDnsCheck(
      { host: "example.com", dnsRecordType: "MX", dnsExpected: "mail.EXAMPLE.com" },
      deps(resolver())
    );
    expect(mx.status).toBe("UP");

    // TXT chunks are joined before matching.
    const txt = await runDnsCheck(
      { host: "example.com", dnsRecordType: "TXT", dnsExpected: "_spf.example.com" },
      deps(resolver())
    );
    expect(txt.status).toBe("UP");
  });

  test("a mismatch is DNS_MISMATCH", async () => {
    const result = await runDnsCheck({ host: "example.com", dnsExpected: "1.2.3.4" }, deps(resolver()));
    expect(result).toMatchObject({ status: "DOWN", errorType: "DNS_MISMATCH" });
    expect(result.errorMessage).toContain("93.184.216.34");
  });

  test("NXDOMAIN and empty answers are DNS failures", async () => {
    const nx = await runDnsCheck(
      { host: "nope.example" },
      deps(resolver({ resolve4: mock(async () => { throw notFound(); }) }))
    );
    expect(nx).toMatchObject({ status: "DOWN", errorType: "DNS" });

    const empty = await runDnsCheck({ host: "example.com" }, deps(resolver({ resolve4: mock(async () => []) })));
    expect(empty).toMatchObject({ status: "DOWN", errorType: "DNS" });

    const noData = await runDnsCheck(
      { host: "example.com", dnsRecordType: "AAAA" },
      deps(resolver({ resolve6: mock(async () => { throw Object.assign(new Error("no data"), { code: "ENODATA" }); }) }))
    );
    expect(noData).toMatchObject({ status: "DOWN", errorType: "DNS" });
  });

  test("a stalled resolver times out", async () => {
    const r = resolver({ resolve4: mock(() => new Promise<string[]>(() => {})), cancel: mock(() => {}) });
    const result = await runDnsCheck({ host: "example.com", timeoutMs: 20 }, deps(r));
    expect(result).toMatchObject({ status: "DOWN", errorType: "TIMEOUT" });
    expect(r.cancel).toHaveBeenCalled();
  });
});
