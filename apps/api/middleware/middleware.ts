import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

// One JWKS client per issuer (Clerk instance), cached across requests.
const clients: Record<string, JwksClient> = {};

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

    // Optionally lock to a specific issuer if configured.
    if (process.env.CLERK_ISSUER && process.env.CLERK_ISSUER !== issuer) {
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
