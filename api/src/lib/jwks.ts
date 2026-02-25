import { createPublicKey } from "node:crypto";

interface SigningJwk extends JsonWebKey {
  kid?: string;
  use?: string;
}

interface JwkResponse {
  keys: SigningJwk[];
}

function parseMaxAgeSeconds(cacheControlHeader: string | null): number | null {
  if (!cacheControlHeader) {
    return null;
  }

  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) {
    return null;
  }

  const [_, maxAgeValue] = match;
  if (!maxAgeValue) {
    return null;
  }

  const parsed = Number.parseInt(maxAgeValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function jwkToPem(jwk: SigningJwk): string {
  const keyObject = createPublicKey({ key: jwk, format: "jwk" });
  return keyObject.export({ format: "pem", type: "spki" }).toString();
}

export class JwksClient {
  private keysByKid = new Map<string, string>();

  private cacheExpiresAt = 0;

  constructor(
    private readonly jwksUrl: string,
    private readonly defaultCacheTtlMs = 5 * 60 * 1000,
  ) {}

  private async refreshKeys(): Promise<void> {
    const response = await fetch(this.jwksUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS (status ${response.status}).`);
    }

    const payload = (await response.json()) as JwkResponse;

    if (!payload.keys || !Array.isArray(payload.keys)) {
      throw new Error("Invalid JWKS response payload.");
    }

    const nextMap = new Map<string, string>();

    for (const jwk of payload.keys) {
      if (!jwk.kid || jwk.use === "enc") {
        continue;
      }

      nextMap.set(jwk.kid, jwkToPem(jwk));
    }

    if (nextMap.size === 0) {
      throw new Error("JWKS did not contain usable signing keys.");
    }

    this.keysByKid = nextMap;

    const maxAgeSeconds = parseMaxAgeSeconds(response.headers.get("cache-control"));
    this.cacheExpiresAt = Date.now() + (maxAgeSeconds ? maxAgeSeconds * 1000 : this.defaultCacheTtlMs);
  }

  async getPublicKeyByKid(kid: string): Promise<string> {
    if (Date.now() > this.cacheExpiresAt || !this.keysByKid.has(kid)) {
      await this.refreshKeys();
    }

    const cached = this.keysByKid.get(kid);
    if (!cached) {
      throw new Error(`Unable to find signing key for kid '${kid}'.`);
    }

    return cached;
  }
}
