import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { requireBoardAccess, requireColumnAccess } from "../lib/access";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { buildRebalanceUpdates, getGapPosition, getNextPosition } from "../lib/position";
import { prisma } from "../lib/prisma";
import { toJsonSafe } from "../lib/serialize";
import { parseBody, parseParams, parseQuery, z } from "../lib/zod";

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const columnsQuerySchema = z.object({
  boardId: z.string().uuid(),
});

const createColumnBodySchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

const updateColumnBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    boardId: z.string().uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });

const reorderColumnBodySchema = z
  .object({
    boardId: z.string().uuid(),
    beforeId: z.string().uuid().nullable().optional(),
    afterId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !(data.beforeId && data.afterId && data.beforeId === data.afterId), {
    message: "beforeId and afterId cannot reference the same column.",
  });

async function rebalanceColumns(tx: Prisma.TransactionClient, boardId: string): Promise<void> {
  const siblings = await tx.column.findMany({
    where: { boardId },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  for (const update of buildRebalanceUpdates(siblings.map((column) => column.id))) {
    await tx.column.update({
      where: { id: update.id },
      data: { position: update.position },
    });
  }
}

async function loadNeighborColumn(
  tx: Prisma.TransactionClient,
  columnId: string,
  destinationBoardId: string,
  label: string,
): Promise<{ id: string; position: bigint } | null> {
  const neighbor = await tx.column.findUnique({
    where: { id: columnId },
    select: { id: true, position: true, boardId: true },
  });

  if (!neighbor) {
    throw badRequest(`${label} does not exist.`);
  }

  if (neighbor.boardId !== destinationBoardId) {
    throw badRequest(`${label} must belong to the destination board.`);
  }

  return {
    id: neighbor.id,
    position: neighbor.position,
  };
}

async function resolveColumnReorderPosition(
  tx: Prisma.TransactionClient,
  targetColumnId: string,
  destinationBoardId: string,
  beforeId?: string | null,
  afterId?: string | null,
): Promise<bigint> {
  if (!beforeId && !afterId) {
    const last = await tx.column.findFirst({
      where: {
        boardId: destinationBoardId,
        id: { not: targetColumnId },
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return getNextPosition(last?.position);
  }

  const before = beforeId ? await loadNeighborColumn(tx, beforeId, destinationBoardId, "beforeId") : null;
  const after = afterId ? await loadNeighborColumn(tx, afterId, destinationBoardId, "afterId") : null;

  const initial = getGapPosition({
    before: before?.position,
    after: after?.position,
  });

  if (initial !== null) {
    return initial;
  }

  await rebalanceColumns(tx, destinationBoardId);

  const beforeRebalanced = beforeId
    ? await loadNeighborColumn(tx, beforeId, destinationBoardId, "beforeId")
    : null;
  const afterRebalanced = afterId
    ? await loadNeighborColumn(tx, afterId, destinationBoardId, "afterId")
    : null;

  const next = getGapPosition({
    before: beforeRebalanced?.position,
    after: afterRebalanced?.position,
  });

  if (next === null) {
    throw conflict("Unable to allocate a new column position.");
  }

  return next;
}

const columnRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const query = parseQuery(request, columnsQuerySchema);

    await requireBoardAccess(query.boardId, request.userContext!);

    const columns = await prisma.column.findMany({
      where: { boardId: query.boardId },
      orderBy: { position: "asc" },
      include: {
        tasks: {
          orderBy: { position: "asc" },
        },
      },
    });

    return {
      data: {
        columns: toJsonSafe(columns),
      },
    };
  });

  app.post("/", async (request, reply) => {
    const body = parseBody(request, createColumnBodySchema);

    await requireBoardAccess(body.boardId, request.userContext!);

    const lastColumn = await prisma.column.findFirst({
      where: { boardId: body.boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const column = await prisma.column.create({
      data: {
        title: body.title,
        boardId: body.boardId,
        position: getNextPosition(lastColumn?.position),
      },
      include: {
        tasks: {
          orderBy: { position: "asc" },
        },
      },
    });

    return reply.status(201).send({
      data: {
        column: toJsonSafe(column),
      },
    });
  });

  app.patch("/:id", async (request) => {
    const params = parseParams(request, idParamsSchema);
    const body = parseBody(request, updateColumnBodySchema);

    const current = await requireColumnAccess(params.id, request.userContext!);

    const data: Prisma.ColumnUpdateInput = {};

    if (body.title !== undefined) {
      data.title = body.title;
    }

    if (body.boardId && body.boardId !== current.boardId) {
      await requireBoardAccess(body.boardId, request.userContext!);

      const lastInDestination = await prisma.column.findFirst({
        where: {
          boardId: body.boardId,
          id: { not: current.id },
        },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      data.board = {
        connect: { id: body.boardId },
      };
      data.position = getNextPosition(lastInDestination?.position);
    }

    const column = await prisma.column.update({
      where: { id: current.id },
      data,
      include: {
        tasks: {
          orderBy: { position: "asc" },
        },
      },
    });

    return {
      data: {
        column: toJsonSafe(column),
      },
    };
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseParams(request, idParamsSchema);

    const column = await requireColumnAccess(params.id, request.userContext!);

    await prisma.column.delete({
      where: { id: column.id },
    });

    return reply.status(204).send();
  });

  app.patch("/:id/reorder", async (request) => {
    const params = parseParams(request, idParamsSchema);
    const body = parseBody(request, reorderColumnBodySchema);

    if (body.beforeId === params.id || body.afterId === params.id) {
      throw badRequest("beforeId/afterId cannot be the same as the column being moved.");
    }

    const column = await prisma.$transaction(async (tx) => {
      const target = await tx.column.findUnique({
        where: { id: params.id },
        include: {
          board: {
            select: {
              ownerUserId: true,
            },
          },
        },
      });

      if (!target) {
        throw notFound("Column not found.");
      }

      if (request.userContext!.role !== "admin" && target.board.ownerUserId !== request.userContext!.id) {
        throw forbidden();
      }

      const destinationBoard = await tx.board.findUnique({
        where: { id: body.boardId },
        select: { id: true, ownerUserId: true },
      });

      if (!destinationBoard) {
        throw notFound("Destination board not found.");
      }

      if (request.userContext!.role !== "admin" && destinationBoard.ownerUserId !== request.userContext!.id) {
        throw forbidden();
      }

      const position = await resolveColumnReorderPosition(tx, target.id, destinationBoard.id, body.beforeId, body.afterId);

      return tx.column.update({
        where: { id: target.id },
        data: {
          boardId: destinationBoard.id,
          position,
        },
        include: {
          tasks: {
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return {
      data: {
        column: toJsonSafe(column),
      },
    };
  });
};

export default columnRoutes;
