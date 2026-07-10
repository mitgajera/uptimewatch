import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

// One JWKS client per issuer (Clerk instance), cached across requests.
const clients: Record<string, JwksClient> = {};

function normalizeIssuer(issuer?: string): string | undefined {
  return issuer?.trim().replace(/\/+$/, "");
}

/**
 * Issuers we trust, parsed from CLERK_ISSUER (comma-separated). The signing key
 * is fetched from the token's own `iss` claim, so this allowlist is required:
 * without it an attacker could present a token that points to a JWKS endpoint
 * they control and bypass authentication.
 */
const allowedIssuers = (process.env.CLERK_ISSUER || "")
  .split(",")
  .map((s) => normalizeIssuer(s))
  .filter((s): s is string => Boolean(s));

if (allowedIssuers.length === 0) {
  console.error(
    "[auth] CLERK_ISSUER is not set. All requests will be rejected. " +
      "Set CLERK_ISSUER to your Clerk issuer URL (comma-separated for multiple)."
  );
}

function getJwksClient(issuer: string): JwksClient {
  if (!clients[issuer]) {
    clients[issuer] = new JwksClient({
      jwksUri: `${issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
    });
  }
  return clients[issuer];
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).send("Unauthorized");
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).send("Unauthorized");
      return;
    }

    const decoded = jwt.decode(token, { complete: true });
    const tokenIssuer =
      decoded?.payload && typeof decoded.payload !== "string"
        ? (decoded.payload.iss as string | undefined)
        : undefined;
    const kid = decoded?.header?.kid;

    const normalizedTokenIssuer = normalizeIssuer(tokenIssuer);
    if (!normalizedTokenIssuer || !kid) {
      res.status(401).send("Unauthorized");
      return;
    }

    // Only trust tokens from explicit allow-listed issuers.
    if (!allowedIssuers.includes(normalizedTokenIssuer)) {
      res.status(401).send("Unauthorized");
      return;
    }

    const signingKey = await getJwksClient(normalizedTokenIssuer).getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();

    const verified = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: normalizedTokenIssuer,
    });

    const sub =
      typeof verified === "string" ? undefined : (verified.sub as string | undefined);

    if (!sub) {
      res.status(401).send("Unauthorized");
      return;
    }

    req.userId = sub;
    next();
  } catch (err) {
    console.error("Auth error:", err instanceof Error ? err.message : err);
    res.status(401).send("Unauthorized");
  }
}
