import cors from "@fastify/cors";
import Fastify, { type FastifyPluginAsync } from "fastify";

import { env } from "./config/env";
import { registerErrorHandler } from "./lib/errors";
import { requireAuth } from "./middleware/require-auth";
import authPlugin from "./plugins/auth";
import adminRoutes from "./routes/admin";
import boardRoutes from "./routes/boards";
import columnRoutes from "./routes/columns";
import healthRoutes from "./routes/health";
import meRoutes from "./routes/me";
import taskRoutes from "./routes/tasks";

const protectedRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  await app.register(meRoutes);
  await app.register(boardRoutes, { prefix: "/boards" });
  await app.register(columnRoutes, { prefix: "/columns" });
  await app.register(taskRoutes, { prefix: "/tasks" });
  await app.register(adminRoutes, { prefix: "/admin" });
};

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "debug" : "info",
    },
  });

  // CORS is intentionally registered before auth middleware so preflight requests
  // are handled correctly for browser clients.
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  registerErrorHandler(app);

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(protectedRoutes);

  return app;
}
