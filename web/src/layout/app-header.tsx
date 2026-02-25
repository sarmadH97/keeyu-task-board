import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Search } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppHeaderProps {
  projectTitle: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchDisabled?: boolean;
  userDisplayName: string;
  userEmail?: string;
  userAvatarUrl?: string;
  onLogout: () => void;
}

function getInitials(input: string): string {
  const words = input
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function AppHeader({
  projectTitle,
  searchValue,
  onSearchChange,
  searchDisabled = false,
  userDisplayName,
  userEmail,
  userAvatarUrl,
  onLogout,
}: AppHeaderProps) {
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const avatarFallback = useMemo(() => {
    if (userDisplayName.trim().length > 0) {
      return getInitials(userDisplayName);
    }

    if (userEmail && userEmail.trim().length > 0) {
      return getInitials(userEmail.split("@")[0] ?? "U");
    }

    return "U";
  }, [userDisplayName, userEmail]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!userMenuRef.current?.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isUserMenuOpen]);

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
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            onClick={() => setUserMenuOpen((previous) => !previous)}
            aria-expanded={isUserMenuOpen}
            aria-label="Open user menu"
          >
            <Avatar src={userAvatarUrl} fallback={avatarFallback} />
          </button>

          {isUserMenuOpen ? (
            <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
              <p className="truncate text-sm font-semibold text-slate-700">
                {userDisplayName.trim().length > 0 ? userDisplayName : "Signed-in User"}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {userEmail?.trim().length ? userEmail : "No email available"}
              </p>

              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full justify-start text-slate-600"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
