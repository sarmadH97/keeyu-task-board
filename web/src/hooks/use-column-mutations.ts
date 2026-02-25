import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createColumn, deleteColumn, reorderColumn } from "@/api/columns";
import { getApiErrorMessage } from "@/api/client";
import type { Board, BoardColumn, CreateColumnPayload, ReorderColumnPayload } from "@/features/board/types";
import { useApiClient } from "@/hooks/use-api-client";
import { boardQueryKeys } from "@/hooks/use-board-data";

interface CreateColumnMutationVariables {
  boardId: string;
  payload: CreateColumnPayload;
}

export function useCreateColumnMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BoardColumn, Error, CreateColumnMutationVariables>({
    mutationFn: ({ payload }) => createColumn(apiClient, payload),
    onSuccess: (_column, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
      toast.success("Column created");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not create column"));
    },
  });
}

interface ReorderColumnsMutationVariables {
  boardId: string;
  nextBoard: Board;
  reorder: ReorderColumnPayload;
}

interface ReorderColumnsMutationContext {
  previousBoard: Board | undefined;
}

export function useReorderColumnsMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ReorderColumnsMutationVariables, ReorderColumnsMutationContext>({
    mutationFn: ({ reorder }) => reorderColumn(apiClient, reorder),
    onMutate: async ({ boardId, nextBoard }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));
      queryClient.setQueryData<Board>(boardQueryKeys.detail(boardId), nextBoard);

      return { previousBoard };
    },
    onError: (error, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not reorder columns"));
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}

interface DeleteColumnMutationVariables {
  boardId: string;
  columnId: string;
}

interface DeleteColumnMutationContext {
  previousBoard: Board | undefined;
}

export function useDeleteColumnMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteColumnMutationVariables, DeleteColumnMutationContext>({
    mutationFn: ({ columnId }) => deleteColumn(apiClient, columnId),
    onMutate: async ({ boardId, columnId }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardQueryKeys.detail(boardId));

      if (previousBoard) {
        queryClient.setQueryData<Board>(boardQueryKeys.detail(boardId), {
          ...previousBoard,
          columns: previousBoard.columns.filter((column) => column.id !== columnId),
        });
      }

      return { previousBoard };
    },
    onError: (error, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKeys.detail(variables.boardId), context.previousBoard);
      }

      toast.error(getApiErrorMessage(error, "Could not delete column"));
    },
    onSuccess: () => {
      toast.success("Column deleted");
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(variables.boardId) });
    },
  });
}
