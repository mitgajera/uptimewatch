import { describe, expect, test } from "bun:test";
import { isValidExpectedStatus, parseExpectedStatus } from "../monitor/expectedStatus";

describe("parseExpectedStatus", () => {
  test("matches single codes and inclusive ranges", () => {
    const match = parseExpectedStatus("200-299, 301,404")!;
    expect(match(200)).toBe(true);
    expect(match(299)).toBe(true);
    expect(match(301)).toBe(true);
    expect(match(404)).toBe(true);
    expect(match(302)).toBe(false);
    expect(match(500)).toBe(false);
  });

  test("rejects malformed specs", () => {
    for (const spec of ["", "abc", "200-", "99", "600", "300-200", "2xx"]) {
      expect(isValidExpectedStatus(spec)).toBe(false);
    }
  });
});
