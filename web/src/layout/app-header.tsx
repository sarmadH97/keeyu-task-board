import { Search } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

interface AppHeaderProps {
  projectTitle: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchDisabled?: boolean;
}

export function AppHeader({ projectTitle, searchValue, onSearchChange, searchDisabled = false }: AppHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Project</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-700 md:text-xl">{projectTitle}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={searchDisabled ? "Load a board to search" : "Search tasks"}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
            disabled={searchDisabled}
          />
        </div>
        <Avatar fallback="SS" />
      </div>
    </div>
  );
}
