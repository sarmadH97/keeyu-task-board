import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return {
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    };
  });
};

export default healthRoutes;
