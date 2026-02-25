import jwt from "@fastify/jwt";
import type { TokenOrHeader } from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { env } from "../config/env";
import { JwksClient } from "../lib/jwks";
import { prisma } from "../lib/prisma";
import { forbidden, unauthorized } from "../lib/errors";
import type { AppRole, AuthTokenPayload, AuthenticatedUser } from "../types/auth";

function fallbackEmailForSub(sub: string): string {
  const sanitized = sub.toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 48);
  return `${sanitized || "auth0_user"}@placeholder.local`;
}

interface JwtHeaderLike {
  alg?: string;
  kid?: string;
  typ?: string;
  [key: string]: unknown;
}

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtHeader(token: string): JwtHeaderLike | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0]) {
    return null;
  }

  try {
    const rawHeader = decodeBase64Url(parts[0]);
    const parsed = JSON.parse(rawHeader) as JwtHeaderLike;
    return parsed;
  } catch {
    return null;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  const auth0Issuer = `https://${env.AUTH0_DOMAIN}/`;

  if (env.AUTH0_ISSUER !== auth0Issuer) {
    app.log.warn(
      { configuredIssuer: env.AUTH0_ISSUER, expectedIssuer: auth0Issuer },
      "AUTH0_ISSUER differs from expected tenant issuer with trailing slash; using expected value for JWT validation.",
    );
  }

  const jwksClient = new JwksClient(`${auth0Issuer}.well-known/jwks.json`);

  await app.register(jwt, {
    secret: async (
      request: FastifyRequest,
      tokenOrHeader: TokenOrHeader
    ) => {
      const maybeHeader =
        "header" in tokenOrHeader
          ? tokenOrHeader.header
          : tokenOrHeader;

      let kid =
        typeof maybeHeader?.kid === "string" && maybeHeader.kid.length > 0
          ? maybeHeader.kid
          : null;

      if (!kid) {
        const rawToken = getBearerToken(request.headers.authorization);
        const decodedHeader = rawToken ? decodeJwtHeader(rawToken) : null;
        kid = typeof decodedHeader?.kid === "string" && decodedHeader.kid.length > 0
          ? decodedHeader.kid
          : null;
      }

      if (!kid) {
        throw unauthorized("Token header is missing kid.");   
      }

      return jwksClient.getPublicKeyByKid(kid);
    },
    decode: {
      complete: true,
    },
    verify: {
      allowedAud: env.AUTH0_AUDIENCE,
      allowedIss: auth0Issuer,
      algorithms: ["RS256"],
    },
  });
  app.decorateRequest("userContext", null);

  app.decorate("authenticate", async (request, _reply) => {
    const bearerToken = getBearerToken(request.headers.authorization);
    if (!bearerToken) {
      request.log.warn({ path: request.url, method: request.method }, "Authorization bearer token is missing.");
      throw unauthorized("Missing bearer access token.");
    }

    const decodedHeader = decodeJwtHeader(bearerToken);
    if (!decodedHeader) {
      request.log.warn(
        { path: request.url, method: request.method, tokenSegments: bearerToken.split(".").length },
        "Authorization token is not a JWT.",
      );
      throw unauthorized("Access token is not a JWT for this API.");
    }

    request.log.debug(
      { alg: decodedHeader.alg, kid: decodedHeader.kid ?? null, typ: decodedHeader.typ ?? null },
      "Incoming token header.",
    );

    const hasKid = typeof decodedHeader.kid === "string" && decodedHeader.kid.length > 0;
    if (decodedHeader.alg !== "RS256" || !hasKid) {
      request.log.warn(
        { alg: decodedHeader.alg ?? null, hasKid, typ: decodedHeader.typ ?? null },
        "Access token header is invalid for Auth0 JWKS verification.",
      );
      throw unauthorized(
        "Access token must be an Auth0 RS256 API token with a kid header.",
        env.NODE_ENV !== "production"
          ? { alg: decodedHeader.alg ?? null, hasKid }
          : undefined,
      );
    }

    let payload: AuthTokenPayload;

    try {
      payload = await request.jwtVerify<AuthTokenPayload>();
      request.log.info("JWT verified");
      request.log.info({ decodedUser: request.user }, "Decoded user");
    } catch (error) {
      const jwtError = error as Error & { code?: string; statusCode?: number };
      request.log.warn(
        {
          path: request.url,
          method: request.method,
          jwtCode: jwtError.code ?? "N/A",
          jwtStatusCode: jwtError.statusCode ?? "N/A",
          jwtMessage: jwtError.message,
          err: error,
        },
        "JWT verification failed",
      );
      throw unauthorized("Invalid or expired access token.");
    }

    if (!payload || typeof payload.sub !== "string" || payload.sub.length === 0) {
      request.log.warn({ payload }, "JWT is missing a valid sub claim.");
      throw unauthorized("Token does not contain a valid subject claim.");
    }

    const auth0Sub = payload.sub;
    const audClaim = payload.aud;
    request.log.debug({ sub: auth0Sub, aud: audClaim }, "JWT validated.");
    const emailFromToken = typeof payload.email === "string" && payload.email.length > 0 ? payload.email : null;

    const user = await prisma.user.upsert({
      where: { auth0Sub },
      create: {
        auth0Sub,
        email: emailFromToken ?? fallbackEmailForSub(auth0Sub),
      },
      update: emailFromToken ? { email: emailFromToken } : {},
    });

    const userContext: AuthenticatedUser = {
      id: user.id,
      auth0Sub: user.auth0Sub,
      email: user.email,
      role: user.role,
    };

    request.userContext = userContext;
    request.user = userContext;
  });

  app.decorate("authorize", (roles: AppRole[]) => {
    return async (request, _reply) => {
      if (!request.userContext) {
        throw unauthorized();
      }

      if (!roles.includes(request.userContext.role)) {
        throw forbidden();
      }
    };
  });
};

export default fp(authPlugin, {
  name: "auth-plugin",
});
