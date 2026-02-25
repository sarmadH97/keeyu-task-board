import type { FastifyReply, FastifyRequest } from "fastify";

import { unauthorized } from "../lib/errors";

/**
 * Thin wrapper around the auth plugin decorator to keep auth checks reusable
 * and explicit at route registration sites.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Let CORS preflight pass through without JWT validation.
  if (request.method === "OPTIONS") {
    return;
  }

  const authenticate = request.server.authenticate as
    | ((req: FastifyRequest, rep: FastifyReply) => Promise<void>)
    | undefined;

  if (typeof authenticate !== "function") {
    throw unauthorized("Authentication middleware is not available.");
  }

  await authenticate(request, reply);
}
