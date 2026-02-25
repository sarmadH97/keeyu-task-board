import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { env } from "../config/env";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown): ApiError =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Authentication required.", details?: unknown): ApiError =>
  new ApiError(401, "UNAUTHORIZED", message, details);

export const forbidden = (message = "You do not have permission to perform this action.", details?: unknown): ApiError =>
  new ApiError(403, "FORBIDDEN", message, details);

export const notFound = (message: string, details?: unknown): ApiError =>
  new ApiError(404, "NOT_FOUND", message, details);

export const conflict = (message: string, details?: unknown): ApiError =>
  new ApiError(409, "CONFLICT", message, details);

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): void {
  const payload = {
    statusCode,
    code,
    error: code,
    message,
    ...(details !== undefined ? { details } : {}),
  };

  reply.status(statusCode).send(payload);
}

function handleFastifyValidationError(error: Error & { validation?: unknown }): ApiError | null {
  if (!error.validation) {
    return null;
  }

  return badRequest("Request validation failed.", error.validation);
}

function handleJwtError(error: Error & { code?: string }): ApiError | null {
  if (!error.code?.startsWith("FST_JWT_")) {
    return null;
  }

  return unauthorized(
    "Invalid or expired access token.",
    env.NODE_ENV !== "production"
      ? { jwtCode: error.code }
      : undefined,
  );
}

function handlePrismaError(error: unknown): ApiError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return conflict("Unique constraint violation.", error.meta);
    }

    if (error.code === "P2003") {
      return badRequest("Invalid relation reference.", error.meta);
    }

    if (error.code === "P2025") {
      return notFound("Requested resource does not exist.", error.meta);
    }

    if (error.code === "P2021" || error.code === "P2022") {
      return new ApiError(500, "INTERNAL_SERVER_ERROR", "Database schema is not in sync with the application.", {
        prismaCode: error.code,
        meta: error.meta,
      });
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ApiError(503, "INTERNAL_SERVER_ERROR", "Database connection failed.", {
      prismaCode: error.errorCode,
    });
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new ApiError(500, "INTERNAL_SERVER_ERROR", "Database engine crashed unexpectedly.");
  }

  return null;
}

function handleZodError(error: unknown): ApiError | null {
  if (error instanceof ZodError) {
    return badRequest("Request validation failed.", error.flatten());
  }

  return null;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error & { code?: string; validation?: unknown }, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ApiError) {
      sendError(reply, error.statusCode, error.code, error.message, error.details);
      return;
    }

    const zodMapped = handleZodError(error);
    if (zodMapped) {
      sendError(reply, zodMapped.statusCode, zodMapped.code, zodMapped.message, zodMapped.details);
      return;
    }

    const fastifyValidationMapped = handleFastifyValidationError(error);
    if (fastifyValidationMapped) {
      sendError(
        reply,
        fastifyValidationMapped.statusCode,
        fastifyValidationMapped.code,
        fastifyValidationMapped.message,
        fastifyValidationMapped.details,
      );
      return;
    }

    const jwtMapped = handleJwtError(error);
    if (jwtMapped) {
      sendError(reply, jwtMapped.statusCode, jwtMapped.code, jwtMapped.message, jwtMapped.details);
      return;
    }

    const prismaMapped = handlePrismaError(error);
    if (prismaMapped) {
      sendError(reply, prismaMapped.statusCode, prismaMapped.code, prismaMapped.message, prismaMapped.details);
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    sendError(reply, 500, "INTERNAL_SERVER_ERROR", "Something went wrong.", env.NODE_ENV !== "production"
      ? { name: error.name, message: error.message }
      : undefined);
  });
}
