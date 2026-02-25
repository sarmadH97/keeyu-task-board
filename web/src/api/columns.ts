import type { ApiClient } from "@/api/client";
import type {
  BoardColumn,
  CreateColumnPayload,
  ReorderColumnPayload,
  UpdateColumnPayload,
} from "@/features/board/types";

interface RawColumn {
  id: string;
  title?: string;
  name?: string;
  position?: string | number;
}

interface ColumnEnvelope {
  column: RawColumn;
}

interface ReorderColumnRequestBody {
  boardId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

function toPosition(position: string | number | undefined): string {
  if (typeof position === "string" && position.trim().length > 0) {
    return position;
  }

  if (typeof position === "number" && Number.isFinite(position)) {
    return Math.round(position).toString();
  }

  return "1024";
}

function unwrapColumn(payload: RawColumn | ColumnEnvelope): RawColumn {
  return "column" in payload ? payload.column : payload;
}

function toColumn(rawColumn: RawColumn): BoardColumn {
  return {
    id: rawColumn.id,
    title: rawColumn.title ?? rawColumn.name ?? "Untitled Column",
    position: toPosition(rawColumn.position),
    tasks: [],
  };
}

export async function createColumn(client: ApiClient, payload: CreateColumnPayload): Promise<BoardColumn> {
  const created = await client.post<RawColumn | ColumnEnvelope, CreateColumnPayload>("/columns", payload);
  return toColumn(unwrapColumn(created));
}

export async function updateColumn(
  client: ApiClient,
  columnId: string,
  payload: UpdateColumnPayload,
): Promise<BoardColumn> {
  const updated = await client.patch<RawColumn | ColumnEnvelope, UpdateColumnPayload>(`/columns/${columnId}`, payload);
  return toColumn(unwrapColumn(updated));
}

export async function deleteColumn(client: ApiClient, columnId: string): Promise<void> {
  await client.delete(`/columns/${columnId}`);
}

export async function reorderColumn(client: ApiClient, payload: ReorderColumnPayload): Promise<void> {
  const requestPayload: ReorderColumnRequestBody = {
    boardId: payload.boardId,
  };

  if ("beforeId" in payload) {
    requestPayload.beforeId = payload.beforeId ?? null;
  }

  if ("afterId" in payload) {
    requestPayload.afterId = payload.afterId ?? null;
  }

  await client.patch<void, ReorderColumnRequestBody>(`/columns/${payload.columnId}/reorder`, requestPayload);
}
