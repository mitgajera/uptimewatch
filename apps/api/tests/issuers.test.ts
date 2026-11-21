import { describe, expect, test } from "bun:test";
import { issuerFromPublishableKey, resolveAllowedIssuers } from "../middleware/issuers";

const pk = (host: string, env = "test") => `pk_${env}_${Buffer.from(`${host}$`).toString("base64")}`;

describe("issuerFromPublishableKey", () => {
  test("decodes the frontend API host", () => {
    expect(issuerFromPublishableKey(pk("happy-cat-12.clerk.accounts.dev"))).toBe(
      "https://happy-cat-12.clerk.accounts.dev"
    );
    expect(issuerFromPublishableKey(pk("clerk.example.com", "live"))).toBe("https://clerk.example.com");
  });

  test("rejects malformed keys", () => {
    expect(issuerFromPublishableKey(undefined)).toBeUndefined();
    expect(issuerFromPublishableKey("sk_test_abc")).toBeUndefined();
    expect(issuerFromPublishableKey(`pk_test_${Buffer.from("no-dollar.dev").toString("base64")}`)).toBeUndefined();
  });

  test("rejects hosts carrying a path, port or credentials", () => {
    expect(issuerFromPublishableKey(pk("evil.com/x"))).toBeUndefined();
    expect(issuerFromPublishableKey(pk("evil.com:8443"))).toBeUndefined();
    expect(issuerFromPublishableKey(pk("a@evil.com"))).toBeUndefined();
    expect(issuerFromPublishableKey(pk("localhost"))).toBeUndefined();
  });
});

describe("resolveAllowedIssuers", () => {
  test("prefers CLERK_ISSUER and normalizes it", () => {
    expect(
      resolveAllowedIssuers({
        CLERK_ISSUER: " https://a.dev/ , https://b.dev",
        CLERK_PUBLISHABLE_KEY: pk("c.clerk.accounts.dev"),
      })
    ).toEqual(["https://a.dev", "https://b.dev"]);
  });

  test("falls back to the publishable key", () => {
    expect(resolveAllowedIssuers({ CLERK_PUBLISHABLE_KEY: pk("c.clerk.accounts.dev") })).toEqual([
      "https://c.clerk.accounts.dev",
    ]);
    expect(resolveAllowedIssuers({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk("d.clerk.accounts.dev") })).toEqual([
      "https://d.clerk.accounts.dev",
    ]);
  });

  test("trusts nothing when unconfigured", () => {
    expect(resolveAllowedIssuers({})).toEqual([]);
    expect(resolveAllowedIssuers({ CLERK_ISSUER: " , ", CLERK_PUBLISHABLE_KEY: "garbage" })).toEqual([]);
  });
});
