import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { requireColumnAccess, requireTaskAccess } from "../lib/access";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { buildRebalanceUpdates, getGapPosition, getNextPosition } from "../lib/position";
import { prisma } from "../lib/prisma";
import { toJsonSafe } from "../lib/serialize";
import { parseBody, parseParams, parseQuery, z } from "../lib/zod";

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

const tasksQuerySchema = z.object({
  columnId: z.string().uuid(),
});

const createTaskBodySchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeName: z.string().trim().min(1).max(120).optional(),
  priority: taskPrioritySchema.default("MEDIUM"),
});

const updateTaskBodySchema = z
  .object({
    columnId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    assigneeName: z.string().trim().min(1).max(120).nullable().optional(),
    priority: taskPrioritySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });

const reorderTaskBodySchema = z
  .object({
    columnId: z.string().uuid(),
    beforeId: z.string().uuid().nullable().optional(),
    afterId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !(data.beforeId && data.afterId && data.beforeId === data.afterId), {
    message: "beforeId and afterId cannot reference the same task.",
  });

async function rebalanceTasks(tx: Prisma.TransactionClient, columnId: string): Promise<void> {
  const siblings = await tx.task.findMany({
    where: { columnId },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  for (const update of buildRebalanceUpdates(siblings.map((task) => task.id))) {
    await tx.task.update({
      where: { id: update.id },
      data: { position: update.position },
    });
  }
}

async function loadNeighborTask(
  tx: Prisma.TransactionClient,
  taskId: string,
  destinationColumnId: string,
  label: string,
): Promise<{ id: string; position: bigint } | null> {
  const neighbor = await tx.task.findUnique({
    where: { id: taskId },
    select: { id: true, position: true, columnId: true },
  });

  if (!neighbor) {
    throw badRequest(`${label} does not exist.`);
  }

  if (neighbor.columnId !== destinationColumnId) {
    throw badRequest(`${label} must belong to the destination column.`);
  }

  return {
    id: neighbor.id,
    position: neighbor.position,
  };
}

async function resolveTaskReorderPosition(
  tx: Prisma.TransactionClient,
  targetTaskId: string,
  destinationColumnId: string,
  beforeId?: string | null,
  afterId?: string | null,
): Promise<bigint> {
  if (!beforeId && !afterId) {
    const last = await tx.task.findFirst({
      where: {
        columnId: destinationColumnId,
        id: { not: targetTaskId },
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return getNextPosition(last?.position);
  }

  const before = beforeId ? await loadNeighborTask(tx, beforeId, destinationColumnId, "beforeId") : null;
  const after = afterId ? await loadNeighborTask(tx, afterId, destinationColumnId, "afterId") : null;

  const initial = getGapPosition({
    before: before?.position,
    after: after?.position,
  });

  if (initial !== null) {
    return initial;
  }

  await rebalanceTasks(tx, destinationColumnId);

  const beforeRebalanced = beforeId
    ? await loadNeighborTask(tx, beforeId, destinationColumnId, "beforeId")
    : null;
  const afterRebalanced = afterId
    ? await loadNeighborTask(tx, afterId, destinationColumnId, "afterId")
    : null;

  const next = getGapPosition({
    before: beforeRebalanced?.position,
    after: afterRebalanced?.position,
  });

  if (next === null) {
    throw conflict("Unable to allocate a new task position.");
  }

  return next;
}

const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const query = parseQuery(request, tasksQuerySchema);

    await requireColumnAccess(query.columnId, request.userContext!);

    const tasks = await prisma.task.findMany({
      where: { columnId: query.columnId },
      orderBy: { position: "asc" },
    });

    return {
      data: {
        tasks: toJsonSafe(tasks),
      },
    };
  });

  app.post("/", async (request, reply) => {
    const body = parseBody(request, createTaskBodySchema);

    await requireColumnAccess(body.columnId, request.userContext!);

    const lastTask = await prisma.task.findFirst({
      where: { columnId: body.columnId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        assigneeName: body.assigneeName ?? null,
        priority: body.priority,
        columnId: body.columnId,
        position: getNextPosition(lastTask?.position),
      },
    });

    return reply.status(201).send({
      data: {
        task: toJsonSafe(task),
      },
    });
  });

  app.patch("/:id", async (request) => {
    const params = parseParams(request, idParamsSchema);
    const body = parseBody(request, updateTaskBodySchema);

    const current = await requireTaskAccess(params.id, request.userContext!);

    const data: Prisma.TaskUpdateInput = {};

    if (body.title !== undefined) {
      data.title = body.title;
    }

    if (body.description !== undefined) {
      data.description = body.description;
    }

    if (body.assigneeName !== undefined) {
      data.assigneeName = body.assigneeName;
    }

    if (body.priority !== undefined) {
      data.priority = body.priority;
    }

    if (body.columnId && body.columnId !== current.columnId) {
      await requireColumnAccess(body.columnId, request.userContext!);

      const lastInDestination = await prisma.task.findFirst({
        where: {
          columnId: body.columnId,
          id: { not: current.id },
        },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      data.column = {
        connect: { id: body.columnId },
      };
      data.position = getNextPosition(lastInDestination?.position);
    }

    const task = await prisma.task.update({
      where: { id: current.id },
      data,
    });

    return {
      data: {
        task: toJsonSafe(task),
      },
    };
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseParams(request, idParamsSchema);

    const task = await requireTaskAccess(params.id, request.userContext!);

    await prisma.task.delete({
      where: { id: task.id },
    });

    return reply.status(204).send();
  });

  app.patch("/:id/reorder", async (request) => {
    const params = parseParams(request, idParamsSchema);
    const body = parseBody(request, reorderTaskBodySchema);

    if (body.beforeId === params.id || body.afterId === params.id) {
      throw badRequest("beforeId/afterId cannot be the same as the task being moved.");
    }

    const task = await prisma.$transaction(async (tx) => {
      const target = await tx.task.findUnique({
        where: { id: params.id },
        include: {
          column: {
            include: {
              board: {
                select: { ownerUserId: true },
              },
            },
          },
        },
      });

      if (!target) {
        throw notFound("Task not found.");
      }

      if (request.userContext!.role !== "admin" && target.column.board.ownerUserId !== request.userContext!.id) {
        throw forbidden();
      }

      const destinationColumn = await tx.column.findUnique({
        where: { id: body.columnId },
        include: {
          board: {
            select: { ownerUserId: true },
          },
        },
      });

      if (!destinationColumn) {
        throw notFound("Destination column not found.");
      }

      if (request.userContext!.role !== "admin" && destinationColumn.board.ownerUserId !== request.userContext!.id) {
        throw forbidden();
      }

      const position = await resolveTaskReorderPosition(tx, target.id, destinationColumn.id, body.beforeId, body.afterId);

      return tx.task.update({
        where: { id: target.id },
        data: {
          columnId: destinationColumn.id,
          position,
        },
      });
    });

    return {
      data: {
        task: toJsonSafe(task),
      },
    };
  });
};

export default taskRoutes;
