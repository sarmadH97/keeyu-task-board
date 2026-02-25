import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { createApiClient } from "@/api/client";

const API_URL = import.meta.env.VITE_API_URL;
const REQUIRED_AUDIENCE = "https://taskboard-api";

function decodeJwtSegment(segment: string): Record<string, unknown> {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function verifyAccessTokenShape(token: string): void {
  const parts = token.split(".");
  console.log("[auth] token parts length:", parts.length);

  if (parts.length !== 3) {
    throw new Error("Invalid access token format. JWT must have 3 parts.");
  }

  const header = decodeJwtSegment(parts[0]);
  const payload = decodeJwtSegment(parts[1]);

  console.log("[auth] token header:", header);
  console.log("[auth] token payload:", payload);

  const alg = header.alg;
  const kid = header.kid;

  if (alg !== "RS256") {
    throw new Error(`Invalid JWT alg: ${String(alg)}. Expected RS256.`);
  }

  if (typeof kid !== "string" || kid.length === 0) {
    throw new Error("Invalid JWT header: missing kid.");
  }

  const audClaim = payload.aud;
  const audiences =
    Array.isArray(audClaim) && audClaim.every((value) => typeof value === "string")
      ? audClaim
      : typeof audClaim === "string"
        ? [audClaim]
        : [];

  if (!audiences.includes(REQUIRED_AUDIENCE)) {
    throw new Error(`Invalid JWT audience. Expected to include ${REQUIRED_AUDIENCE}.`);
  }
}

export function useApiClient() {
  const { getAccessTokenSilently } = useAuth0();

  return useMemo(() => {
    return createApiClient({
      baseUrl: API_URL,
      getAccessToken: async () => {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: REQUIRED_AUDIENCE,
          },
        });

        verifyAccessTokenShape(token);

        const canUseStorage = typeof window !== "undefined";
        const didLogToken = canUseStorage && window.sessionStorage.getItem("auth:token-logged") === "1";

        if (!didLogToken) {
          const tokenPreview = `${token.slice(0, 12)}...${token.slice(-6)}`;
          console.info("[auth] access token acquired", {
            preview: tokenPreview,
            length: token.length,
          });

          if (canUseStorage) {
            window.sessionStorage.setItem("auth:token-logged", "1");
          }
        }

        if (canUseStorage) {
          window.sessionStorage.removeItem("auth:unauthorized-notified");
        }

        return token;
      },
      onUnauthorized: async () => {
        if (typeof window === "undefined") {
          return;
        }

        const unauthorizedNotified = window.sessionStorage.getItem("auth:unauthorized-notified") === "1";

        if (unauthorizedNotified) {
          return;
        }

        window.sessionStorage.setItem("auth:unauthorized-notified", "1");
        window.dispatchEvent(new Event("auth:unauthorized"));
      },
    });
  }, [getAccessTokenSilently]);
}
