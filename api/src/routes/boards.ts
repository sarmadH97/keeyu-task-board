import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { badRequest, conflict, notFound } from "../lib/errors";
import { buildRebalanceUpdates, getGapPosition, getNextPosition } from "../lib/position";
import { prisma } from "../lib/prisma";
import { toJsonSafe } from "../lib/serialize";
import { parseBody, parseParams, z } from "../lib/zod";

const boardParamsSchema = z.object({
  boardId: z.string().uuid(),
});

const createBoardBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});

const updateBoardBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });

const reorderBoardBodySchema = z
  .object({
    beforeId: z.string().uuid().nullable().optional(),
    afterId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !(data.beforeId && data.afterId && data.beforeId === data.afterId), {
    message: "beforeId and afterId cannot reference the same board.",
  });

async function getOwnedBoardOrThrow(boardId: string, ownerUserId: string): Promise<{ id: string; ownerUserId: string }> {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      ownerUserId,
    },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!board) {
    throw notFound("Board not found.");
  }

  return board;
}

async function rebalanceBoardPositions(tx: Prisma.TransactionClient, ownerUserId: string): Promise<void> {
  const siblingBoards = await tx.board.findMany({
    where: { ownerUserId },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  for (const update of buildRebalanceUpdates(siblingBoards.map((board) => board.id))) {
    await tx.board.update({
      where: { id: update.id },
      data: { position: update.position },
    });
  }
}

async function loadNeighborBoard(
  tx: Prisma.TransactionClient,
  neighborBoardId: string,
  ownerUserId: string,
  sourceName: string,
): Promise<{ id: string; position: bigint }> {
  const neighbor = await tx.board.findUnique({
    where: { id: neighborBoardId },
    select: {
      id: true,
      position: true,
      ownerUserId: true,
    },
  });

  if (!neighbor || neighbor.ownerUserId !== ownerUserId) {
    throw badRequest(`${sourceName} is invalid.`);
  }

  return {
    id: neighbor.id,
    position: neighbor.position,
  };
}

async function resolveBoardReorderPosition(
  tx: Prisma.TransactionClient,
  targetBoard: { id: string; ownerUserId: string },
  beforeId?: string | null,
  afterId?: string | null,
): Promise<bigint> {
  if (!beforeId && !afterId) {
    const lastBoard = await tx.board.findFirst({
      where: {
        ownerUserId: targetBoard.ownerUserId,
        id: { not: targetBoard.id },
      },
      select: { position: true },
      orderBy: { position: "desc" },
    });

    return getNextPosition(lastBoard?.position);
  }

  const before = beforeId
    ? await loadNeighborBoard(tx, beforeId, targetBoard.ownerUserId, "beforeId")
    : null;

  const after = afterId
    ? await loadNeighborBoard(tx, afterId, targetBoard.ownerUserId, "afterId")
    : null;

  const candidatePosition = getGapPosition({
    before: before?.position,
    after: after?.position,
  });

  if (candidatePosition !== null) {
    return candidatePosition;
  }

  await rebalanceBoardPositions(tx, targetBoard.ownerUserId);

  const beforeAfterRebalance = beforeId
    ? await loadNeighborBoard(tx, beforeId, targetBoard.ownerUserId, "beforeId")
    : null;

  const afterAfterRebalance = afterId
    ? await loadNeighborBoard(tx, afterId, targetBoard.ownerUserId, "afterId")
    : null;

  const recalculated = getGapPosition({
    before: beforeAfterRebalance?.position,
    after: afterAfterRebalance?.position,
  });

  if (recalculated === null) {
    throw conflict("Unable to allocate a new board position.");
  }

  return recalculated;
}

const boardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const boards = await prisma.board.findMany({
      where: {
        ownerUserId: request.userContext!.id,
      },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: {
        boards: toJsonSafe(boards),
      },
    };
  });

  app.post("/", async (request, reply) => {
    const body = parseBody(request, createBoardBodySchema);

    const lastBoard = await prisma.board.findFirst({
      where: { ownerUserId: request.userContext!.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const board = await prisma.board.create({
      data: {
        ownerUserId: request.userContext!.id,
        name: body.name,
        description: body.description ?? null,
        position: getNextPosition(lastBoard?.position),
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(201).send({
      data: {
        board: toJsonSafe(board),
      },
    });
  });

  app.get("/:boardId", async (request) => {
    const params = parseParams(request, boardParamsSchema);

    const board = await prisma.board.findFirst({
      where: {
        id: params.boardId,
        ownerUserId: request.userContext!.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!board) {
      throw notFound("Board not found.");
    }

    return {
      data: {
        board: toJsonSafe(board),
      },
    };
  });

  app.get("/:boardId/full", async (request) => {
    const params = parseParams(request, boardParamsSchema);

    const board = await prisma.board.findFirst({
      where: {
        id: params.boardId,
        ownerUserId: request.userContext!.id,
      },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    if (!board) {
      throw notFound("Board not found.");
    }

    return {
      data: {
        board: toJsonSafe(board),
      },
    };
  });

  app.patch("/:boardId", async (request) => {
    const params = parseParams(request, boardParamsSchema);
    const body = parseBody(request, updateBoardBodySchema);

    await getOwnedBoardOrThrow(params.boardId, request.userContext!.id);

    const board = await prisma.board.update({
      where: { id: params.boardId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: {
        board: toJsonSafe(board),
      },
    };
  });

  app.delete("/:boardId", async (request, reply) => {
    const params = parseParams(request, boardParamsSchema);

    await getOwnedBoardOrThrow(params.boardId, request.userContext!.id);

    await prisma.board.delete({
      where: { id: params.boardId },
    });

    return reply.status(204).send();
  });

  app.patch("/:boardId/reorder", async (request) => {
    const params = parseParams(request, boardParamsSchema);
    const body = parseBody(request, reorderBoardBodySchema);

    if (body.beforeId === params.boardId || body.afterId === params.boardId) {
      throw badRequest("beforeId/afterId cannot be the same as the board being moved.");
    }

    const board = await prisma.$transaction(async (tx) => {
      const targetBoard = await tx.board.findFirst({
        where: {
          id: params.boardId,
          ownerUserId: request.userContext!.id,
        },
        select: {
          id: true,
          ownerUserId: true,
        },
      });

      if (!targetBoard) {
        throw notFound("Board not found.");
      }

      const position = await resolveBoardReorderPosition(tx, targetBoard, body.beforeId, body.afterId);

      return tx.board.update({
        where: { id: targetBoard.id },
        data: { position },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          position: true,
        },
      });
    });

    return {
      data: {
        board: toJsonSafe(board),
      },
    };
  });
};

export default boardRoutes;
