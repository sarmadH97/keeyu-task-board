import { Settings } from "lucide-react";

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
        <div className="mb-8 px-2">
          <img
            src="https://cdn.prod.website-files.com/68b510e785c9b2f4b960016e/68ca15d1404821bbdabef514_Keeyu%20Logo.svg"
            alt="Keeyu"
            className="h-5 w-auto object-contain"
          />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Task Board</p>
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
