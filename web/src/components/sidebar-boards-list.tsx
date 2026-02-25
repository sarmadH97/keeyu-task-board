import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarBoardItem {
  id: string;
  title: string;
}

interface SidebarBoardsListProps {
  boards: SidebarBoardItem[];
  activeBoardId: string | null;
  onCreateBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  deletingBoardId: string | null;
}

export function SidebarBoardsList({
  boards,
  activeBoardId,
  onCreateBoard,
  onDeleteBoard,
  deletingBoardId,
}: SidebarBoardsListProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Projects</p>
        <Button
          type="button"
          variant="subtle"
          className="h-auto rounded-md px-2 py-1 text-xs text-slate-500"
          onClick={onCreateBoard}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Board
        </Button>
      </div>

      <nav className="space-y-1">
        {boards.map((board) => (
          <div
            key={board.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg transition-colors duration-200",
              board.id === activeBoardId ? "bg-blue-50" : "hover:bg-slate-100/80",
            )}
          >
            <Link
              to={`/boards/${board.id}`}
              className={cn(
                "block min-w-0 flex-1 truncate px-3 py-2 text-left text-sm transition-colors duration-200",
                board.id === activeBoardId ? "text-slate-700" : "text-slate-500",
              )}
            >
              {board.title}
            </Link>
            <Button
              type="button"
              size="icon"
              variant="subtle"
              className={cn(
                "h-7 w-7 rounded-md text-slate-400 opacity-0 transition-opacity duration-200 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100",
                deletingBoardId === board.id && "opacity-100 text-red-500",
              )}
              onClick={() => onDeleteBoard(board.id)}
              disabled={Boolean(deletingBoardId)}
              aria-label={`Delete ${board.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {boards.length === 0 ? <p className="rounded-lg px-3 py-2 text-xs text-slate-400">No projects loaded yet</p> : null}
      </nav>
    </div>
  );
}
