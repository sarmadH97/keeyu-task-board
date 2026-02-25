import { useQuery } from "@tanstack/react-query";

import { fetchBoard, fetchBoards } from "@/api/boards";
import { useApiClient } from "@/hooks/use-api-client";

export const boardQueryKeys = {
  all: ["boards"] as const,
  detail: (boardId: string) => ["boards", boardId] as const,
};

export function useBoards(enabled = true) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: boardQueryKeys.all,
    queryFn: () => fetchBoards(apiClient),
    staleTime: 30_000,
    enabled,
  });
}

export function useBoard(boardId: string | null, enabled = true) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: boardId ? boardQueryKeys.detail(boardId) : ["boards", "empty"],
    queryFn: () => fetchBoard(apiClient, boardId!),
    enabled: Boolean(boardId) && enabled,
  });
}

export const useBoardsQuery = useBoards;
export const useBoardQuery = useBoard;
