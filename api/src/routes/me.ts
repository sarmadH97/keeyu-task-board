import type { FastifyPluginAsync } from "fastify";

import { unauthorized } from "../lib/errors";

const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request) => {
    if (!request.user || !request.user.id) {
      throw unauthorized("Authenticated user context is missing.");
    }

    return {
      data: {
        user: request.user,
      },
    };
  });
};

export default meRoutes;
