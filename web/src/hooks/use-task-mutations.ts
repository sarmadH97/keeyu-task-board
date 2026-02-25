import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createTask, deleteTask, reorderTask, updateTask } from "@/api/tasks";
import { getApiErrorMessage } from "@/api/client";
import { buildBoardWithCreatedTask } from "@/features/board/board-utils";
import type { Board, CreateTaskPayload, ReorderTaskPayload, Task } from "@/features/board/types";
import { useApiClient } from "@/hooks/use-api-client";
import { boardQueryKeys } from "@/hooks/use-board-data";

interface ReorderMutationVariables {
  boardId: string;
  nextBoard: Board;
  reorder: ReorderTaskPayload;
}

interface ReorderMutationContext {
  previousBoard: Board | undefined;
}

export function useReorderTasksMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ReorderMutationVariables, ReorderMutationContext>({
    mutationFn: async ({ reorder }) => {
      await reorderTask(apiClient, reorder);
    },
    onMutate: async ({ boardId, nextBoard }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));

      // Optimistic update: immediately reflect drag result in cache.
      queryClient.setQueryData<Board>(boardQueryKeys.detail(boardId), nextBoard);

      return { previousBoard };
    },
    onError: (error, variables, context) => {
      // Rollback: restore previous board snapshot if request fails.
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not reorder tasks"));
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}

interface CreateTaskMutationVariables {
  boardId: string;
  payload: CreateTaskPayload;
  optimisticPosition: string;
}

interface CreateTaskMutationContext {
  previousBoard: Board | undefined;
  optimisticTaskId: string;
}

export function useCreateTaskMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskMutationVariables, CreateTaskMutationContext>({
    mutationFn: ({ payload }) => createTask(apiClient, payload),
    onMutate: async ({ boardId, payload, optimisticPosition }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));
      const optimisticTaskId = `optimistic-${crypto.randomUUID()}`;

      if (previousBoard) {
        const optimisticTask: Task = {
          id: optimisticTaskId,
          title: payload.title,
          description: payload.description ?? null,
          priority: payload.priority ?? "medium",
          position: optimisticPosition,
          columnId: payload.columnId,
          assigneeName: payload.assigneeName ?? null,
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Board>(
          boardQueryKeys.detail(boardId),
          buildBoardWithCreatedTask(previousBoard, optimisticTask),
        );
      }

      return {
        previousBoard,
        optimisticTaskId,
      };
    },
    onError: (error, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not create task"));
    },
    onSuccess: (task, variables, context) => {
      if (!context) {
        return;
      }

      const optimisticBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(variables.boardId));

      if (!optimisticBoard) {
        return;
      }

      const nextColumns = optimisticBoard.columns.map((column) => {
        if (column.id !== task.columnId) {
          return column;
        }

        return {
          ...column,
          tasks: column.tasks.map((columnTask) =>
            columnTask.id === context.optimisticTaskId ? task : columnTask,
          ),
        };
      });

      queryClient.setQueryData<Board>(boardQueryKeys.detail(variables.boardId), {
        ...optimisticBoard,
        columns: nextColumns,
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}

interface UpdateTaskMutationVariables {
  boardId: string;
  payload: {
    id: string;
    title?: string;
    description?: string | null;
    assigneeName?: string | null;
    priority?: Task["priority"];
    columnId?: string;
  };
}

interface UpdateTaskMutationContext {
  previousBoard: Board | undefined;
}

export function useUpdateTaskMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateTaskMutationVariables, UpdateTaskMutationContext>({
    mutationFn: ({ payload }) => updateTask(apiClient, payload),
    onMutate: async ({ boardId, payload }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));

      if (previousBoard) {
        const nextColumns = previousBoard.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) => {
            if (task.id !== payload.id) {
              return task;
            }

            return {
              ...task,
              title: payload.title ?? task.title,
              description: payload.description !== undefined ? payload.description : task.description,
              assigneeName: payload.assigneeName !== undefined ? payload.assigneeName : task.assigneeName,
              priority: payload.priority ?? task.priority,
              columnId: payload.columnId ?? task.columnId,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        queryClient.setQueryData<Board>(boardQueryKeys.detail(boardId), {
          ...previousBoard,
          columns: nextColumns,
        });
      }

      return { previousBoard };
    },
    onError: (error, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not update task"));
    },
    onSuccess: () => {
      toast.success("Task updated");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}

interface DeleteTaskMutationVariables {
  boardId: string;
  taskId: string;
}

interface DeleteTaskMutationContext {
  previousBoard: Board | undefined;
}

export function useDeleteTaskMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteTaskMutationVariables, DeleteTaskMutationContext>({
    mutationFn: ({ taskId }) => deleteTask(apiClient, taskId),
    onMutate: async ({ boardId, taskId }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));

      if (previousBoard) {
        const nextColumns = previousBoard.columns.map((column) => ({
          ...column,
          tasks: column.tasks.filter((task) => task.id !== taskId),
        }));

        queryClient.setQueryData<Board>(boardQueryKeys.detail(boardId), {
          ...previousBoard,
          columns: nextColumns,
        });
      }

      return { previousBoard };
    },
    onError: (error, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not delete task"));
    },
    onSuccess: () => {
      toast.success("Task deleted");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}
