import { describe, expect, mock, test } from "bun:test";
import { runHttpCheck, type CheckDeps } from "../monitor/httpCheck";
import { UnsafeUrlError } from "../utils/ssrf";

function deps(overrides: Partial<CheckDeps> = {}): CheckDeps {
  let t = 1_000;
  return {
    request: mock(async () => ({ status: 200 })) as any,
    assertSafeUrl: mock(async () => {}),
    // Each call advances the clock by 50ms so latency is deterministic.
    now: () => (t += 50),
    ...overrides,
  };
}

describe("runHttpCheck", () => {
  test("reports UP with status code and latency for a healthy response", async () => {
    const result = await runHttpCheck({ url: "https://ok.dev" }, deps());
    expect(result).toMatchObject({ status: "UP", statusCode: 200, latency: 50 });
  });

  test("reports DOWN for a 5xx response surfaced as an axios error", async () => {
    const request = mock(async () => {
      throw Object.assign(new Error("Request failed"), { response: { status: 503 } });
    });
    const result = await runHttpCheck({ url: "https://bad.dev" }, deps({ request: request as any }));
    expect(result).toMatchObject({ status: "DOWN", statusCode: 503 });
  });

  test("reports DOWN without making a request when the URL is unsafe", async () => {
    const request = mock(async (_config: any) => ({ status: 200 }));
    const result = await runHttpCheck(
      { url: "http://169.254.169.254" },
      deps({
        request: request as any,
        assertSafeUrl: mock(async () => {
          throw new UnsafeUrlError("URL resolves to a private or reserved address");
        }),
      })
    );
    expect(result.status).toBe("DOWN");
    expect(request).not.toHaveBeenCalled();
  });
});

describe("runHttpCheck failure classification", () => {
  const fail = (err: object) =>
    runHttpCheck(
      { url: "https://x.dev" },
      deps({ request: mock(async () => { throw Object.assign(new Error("boom"), err); }) as any })
    );

  test("DNS failures", async () => {
    expect((await fail({ code: "ENOTFOUND" })).errorType).toBe("DNS");
  });

  test("timeouts", async () => {
    expect((await fail({ code: "ECONNABORTED" })).errorType).toBe("TIMEOUT");
  });

  test("refused connections", async () => {
    expect((await fail({ code: "ECONNREFUSED" })).errorType).toBe("CONNECTION");
  });

  test("certificate problems", async () => {
    expect((await fail({ code: "CERT_HAS_EXPIRED" })).errorType).toBe("TLS");
  });

  test("HTTP errors keep the status code in the message", async () => {
    const result = await fail({ response: { status: 502 } });
    expect(result).toMatchObject({ errorType: "HTTP_STATUS", errorMessage: "Unexpected HTTP 502" });
  });

  test("blocked (SSRF) targets", async () => {
    const result = await runHttpCheck(
      { url: "http://10.0.0.1" },
      deps({
        assertSafeUrl: mock(async () => {
          throw new UnsafeUrlError("URL resolves to a private or reserved address");
        }),
      })
    );
    expect(result.errorType).toBe("BLOCKED");
  });

  test("successful checks carry no error", async () => {
    expect(await runHttpCheck({ url: "https://ok.dev" }, deps())).toMatchObject({
      errorType: null,
      errorMessage: null,
    });
  });
});

describe("runHttpCheck monitor configuration", () => {
  test("passes method and timeout through to the request", async () => {
    const request = mock(async (_config: any) => ({ status: 200 }));
    await runHttpCheck(
      { url: "https://x.dev", method: "HEAD", timeoutMs: 3000 },
      deps({ request: request as any })
    );
    expect(request.mock.calls[0]![0]).toMatchObject({ method: "HEAD", timeout: 3000 });
  });

  test("treats 4xx as DOWN by default", async () => {
    const request = mock(async (_config: any) => ({ status: 404 }));
    const result = await runHttpCheck({ url: "https://x.dev" }, deps({ request: request as any }));
    expect(result).toMatchObject({ status: "DOWN", statusCode: 404, errorType: "HTTP_STATUS" });
  });

  test("honors a custom expected status spec", async () => {
    const request = mock(async (_config: any) => ({ status: 401 }));
    const result = await runHttpCheck(
      { url: "https://x.dev", expectedStatus: "200-299,401" },
      deps({ request: request as any })
    );
    expect(result.status).toBe("UP");
  });

  test("requires the keyword in the body when configured", async () => {
    const request = mock(async (_config: any) => ({ status: 200, data: "<h1>Maintenance</h1>" }));
    const missing = await runHttpCheck(
      { url: "https://x.dev", keyword: "Welcome" },
      deps({ request: request as any })
    );
    expect(missing).toMatchObject({ status: "DOWN", errorType: "KEYWORD" });
    expect(request.mock.calls[0]![0]).toMatchObject({ responseType: "text" });

    const present = await runHttpCheck(
      { url: "https://x.dev", keyword: "Maintenance" },
      deps({ request: request as any })
    );
    expect(present.status).toBe("UP");
  });

  test("streams and discards the body when no keyword is set", async () => {
    const destroy = mock(() => {});
    const request = mock(async (_config: any) => ({ status: 200, data: { destroy } }));
    await runHttpCheck({ url: "https://x.dev" }, deps({ request: request as any }));
    expect(request.mock.calls[0]![0]).toMatchObject({ responseType: "stream" });
    expect(destroy).toHaveBeenCalled();
  });
});

describe("runHttpCheck redirects", () => {
  const redirect = (to: string, status = 301) => ({ status, headers: { location: to } });

  test("follows redirects and judges the final response", async () => {
    const responses = [redirect("/login"), { status: 200 }];
    const request = mock(async (_config: any) => responses.shift()!);
    const assertSafeUrl = mock(async (_url: string) => {});
    const result = await runHttpCheck(
      { url: "https://x.dev/app" },
      deps({ request: request as any, assertSafeUrl })
    );
    expect(result).toMatchObject({ status: "UP", statusCode: 200 });
    expect(request.mock.calls.map((c) => c[0].url)).toEqual([
      "https://x.dev/app",
      "https://x.dev/login",
    ]);
    // Every hop is SSRF-validated.
    expect(assertSafeUrl.mock.calls.map((c) => c[0])).toEqual([
      "https://x.dev/app",
      "https://x.dev/login",
    ]);
  });

  test("blocks redirects into private addresses", async () => {
    const request = mock(async (_config: any) => redirect("http://127.0.0.1/admin"));
    const result = await runHttpCheck(
      { url: "https://x.dev" },
      deps({
        request: request as any,
        assertSafeUrl: mock(async (url: string) => {
          if (url.includes("127.0.0.1")) {
            throw new UnsafeUrlError("URL resolves to a private or reserved address");
          }
        }),
      })
    );
    expect(result).toMatchObject({ status: "DOWN", errorType: "BLOCKED" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("gives up after too many redirects", async () => {
    const request = mock(async (_config: any) => redirect("/loop"));
    const result = await runHttpCheck({ url: "https://x.dev" }, deps({ request: request as any }));
    expect(result.status).toBe("DOWN");
    expect(result.errorMessage).toContain("Too many redirects");
  });

  test("does not follow when followRedirects is off", async () => {
    const request = mock(async (_config: any) => redirect("/elsewhere", 302));
    const result = await runHttpCheck(
      { url: "https://x.dev", followRedirects: false },
      deps({ request: request as any })
    );
    expect(result).toMatchObject({ status: "UP", statusCode: 302 });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
