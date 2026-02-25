import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppRole } from "../types/auth";

/**
 * Role-based middleware factory (admin vs user) for protected routes.
 */
export function requireRole(roles: AppRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authorize = request.server.authorize as
      | ((allowedRoles: AppRole[]) => (req: FastifyRequest, rep: FastifyReply) => Promise<void>)
      | undefined;

    if (typeof authorize !== "function") {
      throw new Error("Role authorization plugin is not registered correctly.");
    }

    const guard = authorize(roles);
    await guard(request, reply);
  };
}
