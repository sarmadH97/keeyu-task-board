import type { Role } from "@prisma/client";

export type AppRole = Role;

export interface AuthenticatedUser {
  id: string;
  auth0Sub: string;
  email: string;
  role: AppRole;
}

export interface AuthTokenPayload {
  sub: string;
  email?: string;
  [claim: string]: unknown;
}
