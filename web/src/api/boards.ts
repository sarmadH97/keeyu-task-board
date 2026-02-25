import type { ApiClient } from "@/api/client";
import { normalizeBoard } from "@/features/board/board-utils";
import type {
  Board,
  BoardColumn,
  BoardSummary,
  CreateBoardPayload,
  Task,
  TaskPriority,
  UpdateBoardPayload,
} from "@/features/board/types";

interface RawBoardSummary {
  id: string;
  title?: string;
  name?: string;
  description?: string | null;
}

interface RawTask {
  id: string;
  title: string;
  description?: string | null;
  priority?: string;
  position?: string | number;
  columnId?: string;
  assigneeName?: string | null;
  updatedAt?: string | null;
}

interface RawColumn {
  id: string;
  title?: string;
  name?: string;
  position?: string | number;
  tasks?: RawTask[];
}

interface RawBoard {
  id: string;
  title?: string;
  name?: string;
  description?: string | null;
  columns?: RawColumn[];
}

interface BoardsEnvelope {
  boards?: RawBoardSummary[];
  data?: RawBoardSummary[] | BoardsEnvelope;
  items?: RawBoardSummary[];
}

interface BoardEnvelope {
  board?: RawBoard;
  data?: RawBoard | BoardEnvelope;
}

interface CreatedBoardEnvelope {
  board?: RawBoard;
  data?: RawBoard | BoardEnvelope;
}

interface CreateBoardRequestBody {
  name: string;
  description?: string;
}

interface UpdateBoardRequestBody {
  name?: string;
  description?: string | null;
}

function toPriority(priority?: string): TaskPriority {
  const normalized = typeof priority === "string" ? priority.toLowerCase() : "";

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return "medium";
}

function toPosition(position: string | number | undefined, index: number): string {
  if (typeof position === "string" && position.trim().length > 0) {
    return position;
  }

  if (typeof position === "number" && Number.isFinite(position)) {
    return Math.round(position).toString();
  }

  return ((index + 1) * 1024).toString();
}

function toTask(task: RawTask, fallbackColumnId: string, index: number): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    priority: toPriority(task.priority),
    position: toPosition(task.position, index),
    columnId: task.columnId ?? fallbackColumnId,
    assigneeName: task.assigneeName ?? null,
    updatedAt: task.updatedAt ?? null,
  };
}

function toColumn(column: RawColumn, index: number): BoardColumn {
  const columnId = column.id;

  return {
    id: columnId,
    title: column.title ?? column.name ?? "Untitled",
    position: toPosition(column.position, index),
    tasks: (column.tasks ?? []).map((task, taskIndex) => toTask(task, columnId, taskIndex)),
  };
}

function toBoardSummary(input: RawBoardSummary): BoardSummary {
  return {
    id: input.id,
    title: input.title ?? input.name ?? "Untitled Board",
    description: input.description ?? null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBoardsFromUnknown(payload: unknown): RawBoardSummary[] | null {
  if (Array.isArray(payload)) {
    return payload as RawBoardSummary[];
  }

  if (!isObject(payload)) {
    return null;
  }

  const boards = payload.boards;
  if (Array.isArray(boards)) {
    return boards as RawBoardSummary[];
  }

  const items = payload.items;
  if (Array.isArray(items)) {
    return items as RawBoardSummary[];
  }

  const data = payload.data;
  if (Array.isArray(data)) {
    return data as RawBoardSummary[];
  }

  if (isObject(data)) {
    return readBoardsFromUnknown(data);
  }

  return null;
}

function unwrapBoards(payload: RawBoardSummary[] | BoardsEnvelope): RawBoardSummary[] {
  return readBoardsFromUnknown(payload) ?? [];
}

function readBoardFromUnknown(payload: unknown): RawBoard | null {
  if (!isObject(payload)) {
    return null;
  }

  const id = payload.id;
  if (typeof id === "string") {
    return payload as unknown as RawBoard;
  }

  const board = payload.board;
  if (isObject(board)) {
    const nestedBoard = readBoardFromUnknown(board);
    if (nestedBoard) {
      return nestedBoard;
    }
  }

  const data = payload.data;
  if (isObject(data)) {
    const nestedBoard = readBoardFromUnknown(data);
    if (nestedBoard) {
      return nestedBoard;
    }
  }

  return null;
}

function unwrapBoard(payload: RawBoard | BoardEnvelope | CreatedBoardEnvelope): RawBoard {
  const board = readBoardFromUnknown(payload);
  if (board) {
    return board;
  }

  throw new Error("Invalid board response payload");
}

function toBoardSummaryFromUnknown(payload: RawBoardSummary | BoardEnvelope | RawBoard | CreatedBoardEnvelope): BoardSummary {
  if ("id" in payload) {
    return toBoardSummary(payload);
  }

  return toBoardSummary(unwrapBoard(payload));
}

function toBoard(rawBoard: RawBoard): Board {
  return normalizeBoard({
    id: rawBoard.id,
    title: rawBoard.title ?? rawBoard.name ?? "Untitled Board",
    description: rawBoard.description ?? null,
    columns: (rawBoard.columns ?? []).map(toColumn),
  });
}

export async function fetchBoards(client: ApiClient): Promise<BoardSummary[]> {
  const payload = await client.get<RawBoardSummary[] | BoardsEnvelope>("/boards");
  return unwrapBoards(payload).map(toBoardSummary);
}

export async function fetchBoard(client: ApiClient, boardId: string): Promise<Board> {
  const payload = await client.get<RawBoard | BoardEnvelope | CreatedBoardEnvelope>(`/boards/${boardId}/full`);
  return toBoard(unwrapBoard(payload));
}

export async function createBoard(client: ApiClient, payload: CreateBoardPayload): Promise<BoardSummary> {
  const requestPayload: CreateBoardRequestBody = {
    name: payload.title,
  };

  if (payload.description !== undefined) {
    requestPayload.description = payload.description;
  }

  const created = await client.post<
    RawBoardSummary | BoardEnvelope | RawBoard | CreatedBoardEnvelope,
    CreateBoardRequestBody
  >(
    "/boards",
    requestPayload,
  );
  return toBoardSummaryFromUnknown(created);
}

export async function updateBoard(
  client: ApiClient,
  boardId: string,
  payload: UpdateBoardPayload,
): Promise<BoardSummary> {
  const requestPayload: UpdateBoardRequestBody = {};

  if (payload.title !== undefined) {
    requestPayload.name = payload.title;
  }

  if ("description" in payload) {
    requestPayload.description = payload.description ?? null;
  }

  const updated = await client.patch<
    RawBoardSummary | BoardEnvelope | RawBoard | CreatedBoardEnvelope,
    UpdateBoardRequestBody
  >(
    `/boards/${boardId}`,
    requestPayload,
  );
  return toBoardSummaryFromUnknown(updated);
}

export async function deleteBoard(client: ApiClient, boardId: string): Promise<void> {
  await client.delete(`/boards/${boardId}`);
}
