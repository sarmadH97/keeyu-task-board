import { arrayMove } from "@dnd-kit/sortable";

import { POSITION_GAP } from "@/features/board/constants";
import { rebalancePositions, positionBetween, sortByPosition } from "@/features/board/ordering";
import type {
  Board,
  BoardColumn,
  ReorderColumnPayload,
  ReorderTaskPayload,
  ReorderTaskUpdate,
  Task,
} from "@/features/board/types";

const TASK_PREFIX = "task:";
const COLUMN_DROP_PREFIX = "column:";
const COLUMN_DRAG_PREFIX = "column-drag:";

interface TaskLocation {
  columnIndex: number;
  taskIndex: number;
}

export function taskDragId(taskId: string): string {
  return `${TASK_PREFIX}${taskId}`;
}

export function columnDropId(columnId: string): string {
  return `${COLUMN_DROP_PREFIX}${columnId}`;
}

export function columnDragId(columnId: string): string {
  return `${COLUMN_DRAG_PREFIX}${columnId}`;
}

export function parseTaskDragId(id: string): string | null {
  return id.startsWith(TASK_PREFIX) ? id.slice(TASK_PREFIX.length) : null;
}

export function parseColumnDropId(id: string): string | null {
  return id.startsWith(COLUMN_DROP_PREFIX) ? id.slice(COLUMN_DROP_PREFIX.length) : null;
}

export function parseColumnDragId(id: string): string | null {
  return id.startsWith(COLUMN_DRAG_PREFIX) ? id.slice(COLUMN_DRAG_PREFIX.length) : null;
}

function normalizeColumn(column: BoardColumn): BoardColumn {
  return {
    ...column,
    tasks: sortByPosition(column.tasks),
  };
}

export function normalizeBoard(board: Board): Board {
  return {
    ...board,
    columns: sortByPosition(board.columns).map(normalizeColumn),
  };
}

function locateTask(board: Board, taskId: string): TaskLocation | null {
  for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex += 1) {
    const tasks = board.columns[columnIndex]?.tasks;
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex !== -1) {
      return { columnIndex, taskIndex };
    }
  }

  return null;
}

function indexTasks(board: Board): Map<string, Pick<Task, "columnId" | "position">> {
  const index = new Map<string, Pick<Task, "columnId" | "position">>();

  board.columns.forEach((column) => {
    column.tasks.forEach((task) => {
      index.set(task.id, {
        columnId: task.columnId,
        position: task.position,
      });
    });
  });

  return index;
}

function updatesFromDiff(board: Board, previous: Map<string, Pick<Task, "columnId" | "position">>): ReorderTaskUpdate[] {
  const updates: ReorderTaskUpdate[] = [];

  board.columns.forEach((column) => {
    column.tasks.forEach((task) => {
      const oldTask = previous.get(task.id);

      if (!oldTask) {
        return;
      }

      if (oldTask.columnId !== task.columnId || oldTask.position !== task.position) {
        updates.push({
          id: task.id,
          columnId: task.columnId,
          position: task.position,
        });
      }
    });
  });

  return updates;
}

function assignMovedTaskPosition(
  tasks: Task[],
  movedTaskId: string,
): { tasks: Task[]; didRebalance: boolean } {
  const movedIndex = tasks.findIndex((task) => task.id === movedTaskId);

  if (movedIndex === -1) {
    return { tasks, didRebalance: false };
  }

  const previous = tasks[movedIndex - 1]?.position;
  const next = tasks[movedIndex + 1]?.position;
  const computedPosition = positionBetween(previous, next);

  if (computedPosition) {
    return {
      tasks: tasks.map((task, index) => {
        if (index !== movedIndex) {
          return task;
        }

        return {
          ...task,
          position: computedPosition,
        };
      }),
      didRebalance: false,
    };
  }

  return {
    tasks: rebalancePositions(tasks),
    didRebalance: true,
  };
}

export interface BoardMoveResult {
  board: Board;
  updates: ReorderTaskUpdate[];
}

export function applyColumnMove(board: Board, activeColumnId: string, overId: string): Board | null {
  const sourceIndex = board.columns.findIndex((column) => column.id === activeColumnId);

  if (sourceIndex === -1) {
    return null;
  }

  const overTaskId = parseTaskDragId(overId);
  const overTaskLocation = overTaskId ? locateTask(board, overTaskId) : null;

  const destinationColumnId =
    parseColumnDragId(overId) ??
    parseColumnDropId(overId) ??
    (overTaskLocation ? board.columns[overTaskLocation.columnIndex]?.id ?? null : null);

  if (!destinationColumnId || destinationColumnId === activeColumnId) {
    return null;
  }

  const destinationIndex = board.columns.findIndex((column) => column.id === destinationColumnId);

  if (destinationIndex === -1) {
    return null;
  }

  const reorderedColumns = arrayMove(board.columns, sourceIndex, destinationIndex);
  const nextColumns = reorderedColumns.map((column, index) => ({
    ...column,
    position: ((BigInt(index) + 1n) * POSITION_GAP).toString(),
  }));

  return normalizeBoard({
    ...board,
    columns: nextColumns,
  });
}

export function applyTaskMove(board: Board, activeTaskId: string, overId: string): BoardMoveResult | null {
  const activeLocation = locateTask(board, activeTaskId);

  if (!activeLocation) {
    return null;
  }

  const activeColumn = board.columns[activeLocation.columnIndex];
  const activeTask = activeColumn.tasks[activeLocation.taskIndex];

  if (!activeTask) {
    return null;
  }

  const overTaskId = parseTaskDragId(overId);
  const overColumnId = parseColumnDropId(overId) ?? parseColumnDragId(overId);

  const previousIndex = indexTasks(board);
  const nextColumns = board.columns.map((column) => ({
    ...column,
    tasks: [...column.tasks],
  }));

  if (overTaskId) {
    const overLocation = locateTask(board, overTaskId);

    if (!overLocation) {
      return null;
    }

    if (overLocation.columnIndex === activeLocation.columnIndex) {
      const reorderedTasks = arrayMove(
        nextColumns[activeLocation.columnIndex].tasks,
        activeLocation.taskIndex,
        overLocation.taskIndex,
      );

      const positioned = assignMovedTaskPosition(reorderedTasks, activeTaskId);
      nextColumns[activeLocation.columnIndex].tasks = positioned.tasks;
      const nextBoard = normalizeBoard({ ...board, columns: nextColumns });

      return {
        board: nextBoard,
        updates: updatesFromDiff(nextBoard, previousIndex),
      };
    }

    const sourceTasks = nextColumns[activeLocation.columnIndex].tasks.filter(
      (task) => task.id !== activeTaskId,
    );

    const targetTasks = [...nextColumns[overLocation.columnIndex].tasks];

    targetTasks.splice(overLocation.taskIndex, 0, {
      ...activeTask,
      columnId: nextColumns[overLocation.columnIndex].id,
    });

    const positioned = assignMovedTaskPosition(targetTasks, activeTaskId);

    nextColumns[activeLocation.columnIndex].tasks = sourceTasks;
    nextColumns[overLocation.columnIndex].tasks = positioned.tasks;

    const nextBoard = normalizeBoard({ ...board, columns: nextColumns });

    return {
      board: nextBoard,
      updates: updatesFromDiff(nextBoard, previousIndex),
    };
  }

  if (!overColumnId) {
    return null;
  }

  const targetColumnIndex = board.columns.findIndex((column) => column.id === overColumnId);

  if (targetColumnIndex === -1) {
    return null;
  }

  const isSameColumn = targetColumnIndex === activeLocation.columnIndex;

  if (isSameColumn) {
    const sameColumnTasks = nextColumns[targetColumnIndex].tasks.filter(
      (task) => task.id !== activeTaskId,
    );

    sameColumnTasks.push(activeTask);

    const positioned = assignMovedTaskPosition(sameColumnTasks, activeTaskId);
    nextColumns[targetColumnIndex].tasks = positioned.tasks;

    const nextBoard = normalizeBoard({ ...board, columns: nextColumns });

    return {
      board: nextBoard,
      updates: updatesFromDiff(nextBoard, previousIndex),
    };
  }

  const sourceTasks = nextColumns[activeLocation.columnIndex].tasks.filter(
    (task) => task.id !== activeTaskId,
  );
  const targetTasks = [...nextColumns[targetColumnIndex].tasks];

  targetTasks.push({
    ...activeTask,
    columnId: nextColumns[targetColumnIndex].id,
  });

  const positioned = assignMovedTaskPosition(targetTasks, activeTaskId);

  nextColumns[activeLocation.columnIndex].tasks = sourceTasks;
  nextColumns[targetColumnIndex].tasks = positioned.tasks;

  const nextBoard = normalizeBoard({ ...board, columns: nextColumns });

  return {
    board: nextBoard,
    updates: updatesFromDiff(nextBoard, previousIndex),
  };
}

export function buildTaskReorderPayload(board: Board, taskId: string): ReorderTaskPayload | null {
  const taskLocation = locateTask(board, taskId);

  if (!taskLocation) {
    return null;
  }

  const column = board.columns[taskLocation.columnIndex];
  const beforeTask = column.tasks[taskLocation.taskIndex - 1];
  const afterTask = column.tasks[taskLocation.taskIndex + 1];

  return {
    taskId,
    columnId: column.id,
    beforeId: beforeTask?.id ?? null,
    afterId: afterTask?.id ?? null,
  };
}

export function buildColumnReorderPayload(board: Board, columnId: string): ReorderColumnPayload | null {
  const columnIndex = board.columns.findIndex((column) => column.id === columnId);

  if (columnIndex === -1) {
    return null;
  }

  const beforeColumn = board.columns[columnIndex - 1];
  const afterColumn = board.columns[columnIndex + 1];

  return {
    columnId,
    boardId: board.id,
    beforeId: beforeColumn?.id ?? null,
    afterId: afterColumn?.id ?? null,
  };
}

export function buildBoardWithCreatedTask(board: Board, task: Task): Board {
  const nextColumns = board.columns.map((column) => {
    if (column.id !== task.columnId) {
      return column;
    }

    const nextTasks = [...column.tasks, task];

    return {
      ...column,
      tasks: sortByPosition(nextTasks),
    };
  });

  return normalizeBoard({
    ...board,
    columns: nextColumns,
  });
}
