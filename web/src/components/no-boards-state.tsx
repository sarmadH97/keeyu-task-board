import { Database, Plus, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface NoBoardsStateProps {
  onCreateBoard: () => void;
  onRetry: () => void;
  isCreating: boolean;
}

export function NoBoardsState({ onCreateBoard, onRetry, isCreating }: NoBoardsStateProps) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/70 bg-white/85 p-8 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="mb-4 inline-flex rounded-full bg-slate-100 p-2 text-slate-600">
        <Database className="h-4 w-4" />
      </div>
      <h2 className="text-lg font-semibold text-slate-700">No boards found</h2>
      <p className="mt-2 text-sm text-slate-500">
        Your backend returned an empty list for <code>GET /boards</code>. Create a board to get started.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onCreateBoard} disabled={isCreating}>
          <Plus className="mr-2 h-4 w-4" />
          {isCreating ? "Creating..." : "Create Board"}
        </Button>
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Retry API
        </Button>
      </div>
    </div>
  );
}
