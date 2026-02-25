import { LayoutGrid, Settings } from "lucide-react";

import { SidebarBoardsList } from "@/components/sidebar-boards-list";

interface SidebarProject {
  id: string;
  title: string;
}

interface AppSidebarProps {
  projects: SidebarProject[];
  activeProjectId: string | null;
  onCreateBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  deletingBoardId: string | null;
}

export function AppSidebar({
  projects,
  activeProjectId,
  onCreateBoard,
  onDeleteBoard,
  deletingBoardId,
}: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Task Board</span>
        </div>
        <SidebarBoardsList
          boards={projects}
          activeBoardId={activeProjectId}
          onCreateBoard={onCreateBoard}
          onDeleteBoard={onDeleteBoard}
          deletingBoardId={deletingBoardId}
        />
      </div>

      <div className="space-y-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-500 transition-colors duration-200 hover:bg-slate-100/80"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
