import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

/**
 * Lightweight .env loader so local development works without adding a dotenv dependency.
 * Environment variables already defined in the shell are never overwritten.
 */
function loadDotEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (isQuoted) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeAuth0Domain(input: string): string {
  const withProtocol = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : `https://${input}`;

  const url = new URL(withProtocol);
  return url.host;
}

function normalizeIssuer(input: string): string {
  const withProtocol = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : `https://${input}`;

  const url = new URL(withProtocol);
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;

  return `${url.protocol}//${url.host}${pathname}`;
}

loadDotEnvFile();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  CORS_ORIGIN: z.string().default("*"),
  AUTH0_DOMAIN: z.string().min(1, "AUTH0_DOMAIN is required."),
  AUTH0_AUDIENCE: z.literal("https://taskboard-api"),
  AUTH0_ISSUER: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${errors}`);
}

const baseEnv = parsed.data;
const auth0Domain = normalizeAuth0Domain(baseEnv.AUTH0_DOMAIN);
const auth0Issuer = normalizeIssuer(baseEnv.AUTH0_ISSUER ?? `https://${auth0Domain}/`);

export const env = {
  ...baseEnv,
  AUTH0_DOMAIN: auth0Domain,
  AUTH0_ISSUER: auth0Issuer,
  AUTH0_JWKS_URL: `${auth0Issuer}.well-known/jwks.json`,
} as const;

export type Env = typeof env;
