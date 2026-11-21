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
    const result = await runHttpCheck("https://ok.dev", deps());
    expect(result).toMatchObject({ status: "UP", statusCode: 200, latency: 50 });
  });

  test("reports DOWN for a 5xx response surfaced as an axios error", async () => {
    const request = mock(async () => {
      throw Object.assign(new Error("Request failed"), { response: { status: 503 } });
    });
    const result = await runHttpCheck("https://bad.dev", deps({ request: request as any }));
    expect(result).toMatchObject({ status: "DOWN", statusCode: 503 });
  });

  test("reports DOWN without making a request when the URL is unsafe", async () => {
    const request = mock(async () => ({ status: 200 }));
    const result = await runHttpCheck(
      "http://169.254.169.254",
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
