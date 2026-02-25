import "fastify";
import "@fastify/jwt";

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

import type { AppRole, AuthTokenPayload, AuthenticatedUser } from "./auth";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthenticatedUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    authorize: (roles: AppRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    userContext: AuthenticatedUser | null;
  }
}
