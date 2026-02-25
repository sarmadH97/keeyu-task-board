import type { ApiClient } from "@/api/client";
import type {
  CreateTaskPayload,
  ReorderTaskPayload,
  Task,
  TaskPriority,
  UpdateTaskPayload,
} from "@/features/board/types";

type ApiPriority = "LOW" | "MEDIUM" | "HIGH";

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

interface CreateTaskRequestBody {
  columnId: string;
  title: string;
  description?: string;
  assigneeName?: string;
  priority?: ApiPriority;
}

interface UpdateTaskRequestBody {
  columnId?: string;
  title?: string;
  description?: string | null;
  assigneeName?: string | null;
  priority?: ApiPriority;
}

interface ReorderTaskRequestBody {
  columnId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toApiPriority(priority: TaskPriority | undefined): ApiPriority | undefined {
  if (!priority) {
    return undefined;
  }

  if (priority === "low") {
    return "LOW";
  }

  if (priority === "high") {
    return "HIGH";
  }

  return "MEDIUM";
}

function toPriority(priority: string | undefined, fallback: TaskPriority): TaskPriority {
  const normalized = typeof priority === "string" ? priority.toLowerCase() : "";

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return fallback;
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

function readTaskFromUnknown(payload: unknown): RawTask | null {
  if (!isObject(payload)) {
    return null;
  }

  if (typeof payload.id === "string") {
    return payload as unknown as RawTask;
  }

  const taskValue = payload.task;
  if (isObject(taskValue)) {
    const nestedTask = readTaskFromUnknown(taskValue);
    if (nestedTask) {
      return nestedTask;
    }
  }

  const dataValue = payload.data;
  if (isObject(dataValue)) {
    const nestedTask = readTaskFromUnknown(dataValue);
    if (nestedTask) {
      return nestedTask;
    }
  }

  return null;
}

function readTasksFromUnknown(payload: unknown): RawTask[] {
  if (Array.isArray(payload)) {
    return payload as RawTask[];
  }

  if (!isObject(payload)) {
    return [];
  }

  if (Array.isArray(payload.tasks)) {
    return payload.tasks as RawTask[];
  }

  if (Array.isArray(payload.data)) {
    return payload.data as RawTask[];
  }

  if (isObject(payload.data)) {
    return readTasksFromUnknown(payload.data);
  }

  return [];
}

function toTask(
  rawTask: RawTask,
  fallback: Pick<CreateTaskPayload, "columnId"> & { priority: TaskPriority; position: string },
  index = 0,
): Task {
  return {
    id: rawTask.id,
    title: rawTask.title,
    description: rawTask.description ?? null,
    priority: toPriority(rawTask.priority, fallback.priority),
    position: toPosition(rawTask.position, index),
    columnId: rawTask.columnId ?? fallback.columnId,
    assigneeName: rawTask.assigneeName ?? null,
    updatedAt: rawTask.updatedAt ?? null,
  };
}

export async function fetchTasks(client: ApiClient, columnId: string): Promise<Task[]> {
  const payload = await client.get<unknown>(`/tasks?columnId=${encodeURIComponent(columnId)}`);
  const tasks = readTasksFromUnknown(payload);
  return tasks.map((task, index) => toTask(task, { columnId, priority: "medium", position: "1024" }, index));
}

export async function createTask(client: ApiClient, payload: CreateTaskPayload): Promise<Task> {
  const requestPayload: CreateTaskRequestBody = {
    columnId: payload.columnId,
    title: payload.title,
  };

  if (payload.description !== undefined) {
    requestPayload.description = payload.description;
  }

  if (payload.assigneeName !== undefined) {
    requestPayload.assigneeName = payload.assigneeName;
  }

  const apiPriority = toApiPriority(payload.priority);
  if (apiPriority) {
    requestPayload.priority = apiPriority;
  }

  const result = await client.post<unknown, CreateTaskRequestBody>("/tasks", requestPayload);
  const rawTask = readTaskFromUnknown(result);

  if (!rawTask) {
    throw new Error("Invalid task response payload");
  }

  return toTask(rawTask, {
    columnId: payload.columnId,
    priority: payload.priority ?? "medium",
    position: "1024",
  });
}

export async function updateTask(client: ApiClient, payload: UpdateTaskPayload): Promise<void> {
  const { id, ...rest } = payload;
  const requestPayload: UpdateTaskRequestBody = {
    columnId: rest.columnId,
    title: rest.title,
    description: rest.description,
    assigneeName: rest.assigneeName,
  };

  const apiPriority = toApiPriority(rest.priority);
  if (apiPriority) {
    requestPayload.priority = apiPriority;
  }

  const hasAnyField =
    requestPayload.columnId !== undefined ||
    requestPayload.title !== undefined ||
    requestPayload.description !== undefined ||
    requestPayload.assigneeName !== undefined ||
    requestPayload.priority !== undefined;

  if (!hasAnyField) {
    throw new Error("Task update requires at least one field.");
  }

  await client.patch<void, UpdateTaskRequestBody>(`/tasks/${id}`, requestPayload);
}

export async function reorderTask(client: ApiClient, payload: ReorderTaskPayload): Promise<void> {
  const { taskId, ...rest } = payload;
  const requestPayload: ReorderTaskRequestBody = {
    columnId: rest.columnId,
  };

  if ("beforeId" in rest) {
    requestPayload.beforeId = rest.beforeId ?? null;
  }

  if ("afterId" in rest) {
    requestPayload.afterId = rest.afterId ?? null;
  }

  await client.patch<void, ReorderTaskRequestBody>(`/tasks/${taskId}/reorder`, requestPayload);
}

export async function deleteTask(client: ApiClient, taskId: string): Promise<void> {
  await client.delete(`/tasks/${taskId}`);
}
