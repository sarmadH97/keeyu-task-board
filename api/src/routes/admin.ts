import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../middleware/require-role";
import { prisma } from "../lib/prisma";
import { toJsonSafe } from "../lib/serialize";

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireRole(["admin"]));

  app.get("/stats", async () => {
    const [users, boards, columns, tasks, priorityBreakdown, topUsersByBoardCount] = await Promise.all([
      prisma.user.count(),
      prisma.board.count(),
      prisma.column.count(),
      prisma.task.count(),
      prisma.task.groupBy({
        by: ["priority"],
        _count: {
          _all: true,
        },
      }),
      prisma.$queryRaw<Array<{ userId: string; email: string; role: string; boardCount: bigint }>>`
        SELECT
          u.id AS "userId",
          u.email AS "email",
          u.role::text AS "role",
          COUNT(b.id)::bigint AS "boardCount"
        FROM "User" u
        LEFT JOIN "Board" b ON b."ownerUserId" = u.id
        GROUP BY u.id, u.email, u.role
        ORDER BY "boardCount" DESC, u."createdAt" ASC
        LIMIT 10
      `,
    ]);

    return {
      data: toJsonSafe({
        totals: {
          users,
          boards,
          columns,
          tasks,
        },
        taskPriorityBreakdown: priorityBreakdown,
        topUsersByBoardCount,
      }),
    };
  });
};

export default adminRoutes;
