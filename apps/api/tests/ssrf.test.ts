import { afterEach, describe, expect, mock, test } from "bun:test";

// The module under test resolves hostnames via `node:dns/promises`.`lookup` is
// mocked per-test so the suite is hermetic (no real DNS) and can exercise the
// "resolves to a private address" branch deterministically.
const lookupMock = mock<
  (host: string, opts: { all: true }) => Promise<{ address: string }[]>
>(async () => [{ address: "93.184.216.34" }]);

mock.module("node:dns/promises", () => ({
  lookup: lookupMock,
}));

const { assertSafeUrl, UnsafeUrlError } = await import("../utils/ssrf");

afterEach(() => {
  lookupMock.mockReset();
  lookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
});

describe("UnsafeUrlError", () => {
  test("is an Error with the expected name", () => {
    const err = new UnsafeUrlError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("UnsafeUrlError");
    expect(err.message).toBe("boom");
  });
});

describe("assertSafeUrl — malformed / disallowed input", () => {
  test("rejects a non-URL string", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });

  test("rejects non-http(s) protocols", async () => {
    for (const url of [
      "ftp://example.com",
      "file:///etc/passwd",
      "gopher://example.com",
      "javascript:alert(1)",
    ]) {
      await expect(assertSafeUrl(url)).rejects.toThrow(
        "Only http and https URLs are allowed"
      );
    }
  });
});

describe("assertSafeUrl — literal IP addresses (no DNS)", () => {
  test("accepts a public IPv4 literal without resolving", async () => {
    await expect(assertSafeUrl("http://93.184.216.34/")).resolves.toBeUndefined();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  test.each([
    ["loopback", "http://127.0.0.1/"],
    ["private 10/8", "http://10.0.0.5/"],
    ["private 172.16/12", "http://172.16.5.4/"],
    ["private 192.168/16", "http://192.168.1.1/"],
    ["link-local / cloud metadata", "http://169.254.169.254/"],
    ["carrier-grade NAT", "http://100.64.0.1/"],
    ["this-network 0/8", "http://0.0.0.0/"],
    ["multicast", "http://224.0.0.1/"],
    ["reserved 240/4", "http://240.0.0.1/"],
  ])("rejects private/reserved IPv4 (%s)", async (_label, url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  test("accepts a public IPv6 literal", async () => {
    await expect(
      assertSafeUrl("http://[2606:2800:220:1:248:1893:25c8:1946]/")
    ).resolves.toBeUndefined();
  });

  test.each([
    ["loopback ::1", "http://[::1]/"],
    ["unspecified ::", "http://[::]/"],
    ["link-local fe80::/10", "http://[fe80::1]/"],
    ["unique-local fc00::/7", "http://[fc00::1]/"],
  ])("rejects private/reserved IPv6 (%s)", async (_label, url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
  });
});

describe("assertSafeUrl — hostname resolution", () => {
  test("accepts a hostname that resolves to a public address", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
    await expect(assertSafeUrl("https://example.com/")).resolves.toBeUndefined();
    expect(lookupMock).toHaveBeenCalledWith("example.com", { all: true });
  });

  test("rejects when ANY resolved address is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34" },
      { address: "10.0.0.1" },
    ]);
    await expect(assertSafeUrl("https://sneaky.example/")).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
  });

  test("rejects when a hostname resolves to an IPv4-mapped private IPv6", async () => {
    lookupMock.mockResolvedValue([{ address: "::ffff:127.0.0.1" }]);
    await expect(assertSafeUrl("https://mapped.example/")).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
  });

  test("rejects when a resolved address has an unrecognized format", async () => {
    lookupMock.mockResolvedValue([{ address: "not-an-ip" }]);
    await expect(assertSafeUrl("https://weird.example/")).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
  });

  test("rejects when resolution yields no addresses", async () => {
    lookupMock.mockResolvedValue([]);
    await expect(assertSafeUrl("https://empty.example/")).rejects.toThrow(
      "URL resolves to a private or reserved address"
    );
  });

  test("rejects when the DNS lookup fails", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSafeUrl("https://nx.example/")).rejects.toThrow(
      "Could not resolve host"
    );
  });
});
