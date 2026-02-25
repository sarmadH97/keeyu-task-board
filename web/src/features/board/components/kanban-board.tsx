import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { BoardColumn } from "@/features/board/components/board-column";
import { TaskCardPreview } from "@/features/board/components/task-card";
import {
  applyColumnMove,
  applyTaskMove,
  buildColumnReorderPayload,
  buildTaskReorderPayload,
  columnDragId,
  parseColumnDragId,
  parseTaskDragId,
} from "@/features/board/board-utils";
import { positionBetween, sortByPosition } from "@/features/board/ordering";
import type { Board, Task } from "@/features/board/types";
import { useCreateTaskMutation, useDeleteTaskMutation, useReorderTasksMutation, useUpdateTaskMutation } from "@/hooks/use-task-mutations";
import { TaskDetailsDialog, type TaskDetailsFormValues } from "@/components/task-details-dialog";
import { useReorderColumnsMutation } from "@/hooks/use-column-mutations";

interface KanbanBoardProps {
  board: Board;
  searchTerm: string;
}

export function KanbanBoard({ board, searchTerm }: KanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const reorderMutation = useReorderTasksMutation();
  const reorderColumnsMutation = useReorderColumnsMutation();
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const isFiltering = normalizedSearchTerm.length > 0;

  const displayedColumns = useMemo(() => {
    if (!isFiltering) {
      return board.columns;
    }

    return board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => {
        const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearchTerm);
      }),
    }));
  }, [board.columns, isFiltering, normalizedSearchTerm]);

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }

    const tasks = board.columns.flatMap((column) => column.tasks);
    return tasks.find((task) => task.id === activeTaskId) ?? null;
  }, [activeTaskId, board.columns]);

  const handleDragStart = (event: DragStartEvent) => {
    if (isFiltering) {
      return;
    }

    const activeId = String(event.active.id);
    const parsedTaskId = parseTaskDragId(activeId);
    const parsedColumnId = parseColumnDragId(activeId);

    if (parsedTaskId) {
      setActiveTaskId(parsedTaskId);
      return;
    }
    if (parsedColumnId) {
      return;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);

    if (isFiltering) {
      return;
    }

    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeRawId = String(active.id);
    const columnActiveId = parseColumnDragId(activeRawId);

    if (columnActiveId) {
      const nextBoard = applyColumnMove(board, columnActiveId, String(over.id));

      if (!nextBoard) {
        return;
      }

      const reorderPayload = buildColumnReorderPayload(nextBoard, columnActiveId);

      if (!reorderPayload) {
        return;
      }

      reorderColumnsMutation.mutate({
        boardId: board.id,
        nextBoard,
        reorder: reorderPayload,
      });
      return;
    }

    const activeId = parseTaskDragId(activeRawId);

    if (!activeId) {
      return;
    }

    const overId = String(over.id);

    if (String(active.id) === overId) {
      return;
    }

    const moveResult = applyTaskMove(board, activeId, overId);

    if (!moveResult) {
      return;
    }

    const reorderPayload = buildTaskReorderPayload(moveResult.board, activeId);

    if (!reorderPayload) {
      return;
    }

    reorderMutation.mutate({
      boardId: board.id,
      nextBoard: moveResult.board,
      reorder: reorderPayload,
    });
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
  };

  const handleAddTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
  };

  const handleCreateTaskSubmit = (values: TaskDetailsFormValues) => {
    if (!createTaskColumnId) {
      return;
    }

    const column = board.columns.find((candidate) => candidate.id === createTaskColumnId);

    if (!column) {
      return;
    }

    const sortedTasks = sortByPosition(column.tasks);
    const lastTask = sortedTasks.at(-1);
    const nextPosition =
      positionBetween(lastTask?.position, undefined) ?? (BigInt(lastTask?.position ?? "0") + 1024n).toString();

    createTaskMutation.mutate({
      boardId: board.id,
      optimisticPosition: nextPosition,
      payload: {
        columnId: createTaskColumnId,
        title: values.title,
        description: values.description.trim().length > 0 ? values.description.trim() : undefined,
        assigneeName: values.assigneeName.trim().length > 0 ? values.assigneeName.trim() : undefined,
        priority: values.priority,
      },
    }, {
      onSuccess: () => {
        setCreateTaskColumnId(null);
      },
    });
  };

  const handleUpdateTaskSubmit = (values: TaskDetailsFormValues) => {
    if (!editingTask) {
      return;
    }

    updateTaskMutation.mutate({
      boardId: board.id,
      payload: {
        id: editingTask.id,
        title: values.title,
        description: values.description.trim().length > 0 ? values.description.trim() : null,
        assigneeName: values.assigneeName.trim().length > 0 ? values.assigneeName.trim() : null,
        priority: values.priority,
      },
    }, {
      onSuccess: () => {
        setEditingTask(null);
      },
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (deleteTaskMutation.isPending) {
      return;
    }

    if (!window.confirm("Delete this task?")) {
      return;
    }

    setDeletingTaskId(taskId);
    deleteTaskMutation.mutate(
      {
        boardId: board.id,
        taskId,
      },
      {
        onSettled: () => {
          setDeletingTaskId(null);
        },
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1220px]">
      {isFiltering ? (
        <p className="mb-3 text-xs text-slate-500">Drag and drop is paused while filtering results.</p>
      ) : null}

      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={displayedColumns.map((column) => columnDragId(column.id))} strategy={horizontalListSortingStrategy}>
            <div className="flex min-h-[calc(100vh-210px)] gap-4">
              {displayedColumns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  onAddTask={handleAddTask}
                  onEditTask={setEditingTask}
                  onDeleteTask={handleDeleteTask}
                  deletingTaskId={deletingTaskId}
                  dragDisabled={isFiltering || reorderMutation.isPending || updateTaskMutation.isPending}
                  columnDragDisabled={
                    isFiltering ||
                    reorderMutation.isPending ||
                    reorderColumnsMutation.isPending ||
                    updateTaskMutation.isPending
                  }
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>{activeTask ? <TaskCardPreview task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      </div>

      <TaskDetailsDialog
        key={`create-${createTaskColumnId ?? "closed"}`}
        open={Boolean(createTaskColumnId)}
        mode="create"
        isSubmitting={createTaskMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setCreateTaskColumnId(null);
          }
        }}
        onSubmit={handleCreateTaskSubmit}
        defaultValues={{
          priority: "medium",
        }}
      />

      <TaskDetailsDialog
        key={`edit-${editingTask?.id ?? "closed"}-${editingTask?.updatedAt ?? "none"}`}
        open={Boolean(editingTask)}
        mode="edit"
        isSubmitting={updateTaskMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
          }
        }}
        onSubmit={handleUpdateTaskSubmit}
        defaultValues={
          editingTask
            ? {
                title: editingTask.title,
                description: editingTask.description ?? "",
                assigneeName: editingTask.assigneeName ?? "",
                priority: editingTask.priority,
              }
            : undefined
        }
      />
    </div>
  );
}
