import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

// One JWKS client per issuer (Clerk instance), cached across requests.
const clients: Record<string, JwksClient> = {};

/**
 * Issuers we trust, parsed from CLERK_ISSUER (comma-separated). The signing key
 * is fetched from the token's own `iss` claim, so this allowlist is required:
 * without it an attacker could present a self-signed token whose issuer points
 * at a JWKS endpoint they control and bypass authentication entirely.
 */
const allowedIssuers = (process.env.CLERK_ISSUER || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (allowedIssuers.length === 0) {
  console.error(
    "[auth] CLERK_ISSUER is not set. All requests will be rejected. " +
      "Set CLERK_ISSUER to your Clerk instance issuer URL (comma-separated for multiple)."
  );
}

function getJwksClient(issuer: string): JwksClient {
  if (!clients[issuer]) {
    clients[issuer] = new JwksClient({
      jwksUri: `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
    });
  }
  return clients[issuer];
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).send("Unauthorized");
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).send("Unauthorized");
      return;
    }

    // Decode (without verifying) to find the issuer and signing key id.
    const decoded = jwt.decode(token, { complete: true });
    const issuer = decoded?.payload && typeof decoded.payload !== "string"
      ? (decoded.payload.iss as string | undefined)
      : undefined;
    const kid = decoded?.header?.kid;

    if (!issuer || !kid) {
      res.status(401).send("Unauthorized");
      return;
    }

    // Only trust tokens from an explicitly allow-listed issuer. Never fetch a
    // signing key from an issuer supplied by the (untrusted) token itself.
    if (!allowedIssuers.includes(issuer.replace(/\/$/, ""))) {
      res.status(401).send("Unauthorized");
      return;
    }

    const signingKey = await getJwksClient(issuer).getSigningKey(kid);
    const publicKey = signingKey.getPublicKey();

    const verified = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer,
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
