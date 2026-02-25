import type { FastifyRequest } from "fastify";
import { z, type ZodTypeAny } from "zod";

import { badRequest } from "./errors";

function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  source: string,
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw badRequest(`Invalid ${source}.`, result.error.flatten());
  }

  return result.data;
}

export function parseBody<TSchema extends ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> {
  return parseWithSchema(schema, request.body, "request body");
}

export function parseParams<TSchema extends ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> {
  return parseWithSchema(schema, request.params, "path params");
}

export function parseQuery<TSchema extends ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema,
): z.infer<TSchema> {
  return parseWithSchema(schema, request.query, "query params");
}

export { z };
