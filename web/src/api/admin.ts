import type { ApiClient } from "@/api/client";
import type { AdminStats } from "@/features/board/types";

interface RawAdminStats {
  boardCount?: number;
  columnCount?: number;
  taskCount?: number;
  userCount?: number;
}

interface AdminStatsEnvelope {
  stats: RawAdminStats;
}

function unwrapStats(payload: RawAdminStats | AdminStatsEnvelope): RawAdminStats {
  return "stats" in payload ? payload.stats : payload;
}

export async function fetchAdminStats(client: ApiClient): Promise<AdminStats> {
  const payload = await client.get<RawAdminStats | AdminStatsEnvelope>("/admin/stats");
  const stats = unwrapStats(payload);

  return {
    boardCount: stats.boardCount ?? 0,
    columnCount: stats.columnCount ?? 0,
    taskCount: stats.taskCount ?? 0,
    userCount: stats.userCount ?? 0,
  };
}
