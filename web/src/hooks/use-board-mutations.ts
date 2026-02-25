import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createBoard, deleteBoard, updateBoard } from "@/api/boards";
import { getApiErrorMessage } from "@/api/client";
import type { Board, BoardSummary, CreateBoardPayload, UpdateBoardPayload } from "@/features/board/types";
import { useApiClient } from "@/hooks/use-api-client";
import { boardQueryKeys } from "@/hooks/use-board-data";

interface UpdateBoardMutationPayload {
  boardId: string;
  data: UpdateBoardPayload;
}

interface CreateBoardMutationContext {
  previousBoards: BoardSummary[];
  optimisticBoardId: string;
}

export function useCreateBoard() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BoardSummary, Error, CreateBoardPayload, CreateBoardMutationContext>({
    mutationFn: (payload) => createBoard(apiClient, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.all });

      const previousBoards = queryClient.getQueryData<BoardSummary[]>(boardQueryKeys.all) ?? [];
      const optimisticBoardId = `optimistic-${crypto.randomUUID()}`;
      const optimisticBoard: BoardSummary = {
        id: optimisticBoardId,
        title: payload.title,
        description: payload.description?.trim() ? payload.description : null,
      };

      queryClient.setQueryData<BoardSummary[]>(boardQueryKeys.all, [optimisticBoard, ...previousBoards]);
      queryClient.setQueryData<Board>(boardQueryKeys.detail(optimisticBoardId), {
        id: optimisticBoardId,
        title: optimisticBoard.title,
        description: optimisticBoard.description,
        columns: [],
      });

      return {
        previousBoards,
        optimisticBoardId,
      };
    },
    onSuccess: (createdBoard, _variables, context) => {
      queryClient.setQueryData<BoardSummary[]>(boardQueryKeys.all, (currentBoards = []) => {
        if (!context) {
          return currentBoards;
        }

        return currentBoards.map((board) => (board.id === context.optimisticBoardId ? createdBoard : board));
      });
      if (context) {
        queryClient.removeQueries({ queryKey: boardQueryKeys.detail(context.optimisticBoardId), exact: true });
      }
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(createdBoard.id) });
      toast.success("Board created");
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData<BoardSummary[]>(boardQueryKeys.all, context?.previousBoards ?? []);
      if (context) {
        queryClient.removeQueries({ queryKey: boardQueryKeys.detail(context.optimisticBoardId), exact: true });
      }

      toast.error(getApiErrorMessage(error, "Could not create board"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.all });
    },
  });
}

export const useCreateBoardMutation = useCreateBoard;

export function useUpdateBoardMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BoardSummary, Error, UpdateBoardMutationPayload>({
    mutationFn: ({ boardId, data }) => updateBoard(apiClient, boardId, data),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.detail(board.id) });
      toast.success("Board updated");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not update board"));
    },
  });
}

export function useDeleteBoardMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (boardId) => deleteBoard(apiClient, boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.all });
      toast.success("Board deleted");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not delete board"));
    },
  });
}
