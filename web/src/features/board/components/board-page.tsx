import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/features/board/components/kanban-board";
import type { Board } from "@/features/board/types";

interface BoardPageProps {
  board: Board;
  searchTerm: string;
  onCreateColumn: () => void;
  isCreatingColumn: boolean;
}

export function BoardPage({ board, searchTerm, onCreateColumn, isCreatingColumn }: BoardPageProps) {
  return (
    <div className="space-y-4">
      <section className="mx-auto w-full max-w-[1220px] rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">{board.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {board.description?.trim() ? board.description : "Add a short board description to keep the team aligned."}
            </p>
          </div>
          <Button variant="secondary" onClick={onCreateColumn} disabled={isCreatingColumn}>
            {isCreatingColumn ? "Adding..." : "Add Column"}
          </Button>
        </div>
      </section>

      {board.columns.length === 0 ? (
        <EmptyState
          title="No columns yet"
          description="Create your first column to start organizing tasks."
          action={
            <Button onClick={onCreateColumn} disabled={isCreatingColumn}>
              {isCreatingColumn ? "Adding..." : "Add First Column"}
            </Button>
          }
        />
      ) : (
        <KanbanBoard board={board} searchTerm={searchTerm} />
      )}
    </div>
  );
}
