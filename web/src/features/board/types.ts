export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  position: string;
  columnId: string;
  assigneeName?: string | null;
  updatedAt?: string | null;
}

export interface BoardColumn {
  id: string;
  title: string;
  position: string;
  tasks: Task[];
}

export interface Board {
  id: string;
  title: string;
  description?: string | null;
  columns: BoardColumn[];
}

export interface BoardSummary {
  id: string;
  title: string;
  description?: string | null;
}

export interface CreateBoardPayload {
  title: string;
  description?: string;
}

export interface UpdateBoardPayload {
  title?: string;
  description?: string | null;
}

export interface CreateColumnPayload {
  boardId: string;
  title: string;
  position: string;
}

export interface UpdateColumnPayload {
  title?: string;
  position?: string;
}

export interface ReorderColumnPayload {
  columnId: string;
  boardId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export interface ReorderTaskUpdate {
  id: string;
  columnId: string;
  position: string;
}

export interface ReorderTaskPayload {
  taskId: string;
  columnId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export interface CreateTaskPayload {
  columnId: string;
  title: string;
  description?: string;
  assigneeName?: string;
  priority?: TaskPriority;
}

export interface UpdateTaskPayload {
  id: string;
  title?: string;
  description?: string | null;
  assigneeName?: string | null;
  priority?: TaskPriority;
  columnId?: string;
}

export interface AdminStats {
  boardCount: number;
  columnCount: number;
  taskCount: number;
  userCount: number;
}
