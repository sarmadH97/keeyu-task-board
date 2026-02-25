import type { Board, Column, Task } from "@prisma/client";

import type { AuthenticatedUser } from "../types/auth";
import { forbidden, notFound } from "./errors";
import { prisma } from "./prisma";

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === "admin";
}

export function assertOwnership(user: AuthenticatedUser, ownerId: string): void {
  if (isAdmin(user)) {
    return;
  }

  if (user.id !== ownerId) {
    throw forbidden();
  }
}

export async function requireBoardAccess(boardId: string, user: AuthenticatedUser): Promise<Board> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
  });

  if (!board) {
    throw notFound("Board not found.");
  }

  assertOwnership(user, board.ownerUserId);
  return board;
}

export async function requireColumnAccess(
  columnId: string,
  user: AuthenticatedUser,
): Promise<Column & { board: Board }> {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      board: true,
    },
  });

  if (!column) {
    throw notFound("Column not found.");
  }

  assertOwnership(user, column.board.ownerUserId);
  return column;
}

export async function requireTaskAccess(
  taskId: string,
  user: AuthenticatedUser,
): Promise<Task & { column: Column & { board: Board } }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      column: {
        include: {
          board: true,
        },
      },
    },
  });

  if (!task) {
    throw notFound("Task not found.");
  }

  assertOwnership(user, task.column.board.ownerUserId);
  return task;
}
