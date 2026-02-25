import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { buildApp } from "./app";

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error({ err: error }, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down.`);

    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void start();
