export function normalizeIssuer(issuer?: string): string | undefined {
  return issuer?.trim().replace(/\/+$/, "") || undefined;
}

/**
 * A Clerk publishable key is `pk_(test|live)_` + base64("<frontend-api-host>$").
 * The frontend API host is the issuer of that instance's session tokens.
 */
export function issuerFromPublishableKey(key?: string): string | undefined {
  const match = key?.trim().match(/^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/);
  if (!match) return undefined;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1]!, "base64").toString("utf8");
  } catch {
    return undefined;
  }
  if (!decoded.endsWith("$")) return undefined;
  const host = decoded.slice(0, -1);
  // Hostname only: no scheme, path, port or credentials can sneak in.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
    return undefined;
  }
  return `https://${host.toLowerCase()}`;
}

/**
 * Issuers we trust. CLERK_ISSUER (comma-separated) wins; otherwise the issuer is
 * derived from the Clerk publishable key. Never empty-means-trust-anything:
 * an empty list rejects every token.
 */
export function resolveAllowedIssuers(env: Record<string, string | undefined>): string[] {
  const explicit = (env.CLERK_ISSUER || "")
    .split(",")
    .map((s) => normalizeIssuer(s))
    .filter((s): s is string => Boolean(s));
  if (explicit.length > 0) return explicit;

  const derived = issuerFromPublishableKey(
    env.CLERK_PUBLISHABLE_KEY || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
  return derived ? [derived] : [];
}
