import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/api/client";
import { CreateBoardDialog, type CreateBoardFormValues } from "@/components/create-board-dialog";
import { CreateColumnDialog, type CreateColumnFormValues } from "@/components/create-column-dialog";
import { ErrorState } from "@/components/error-state";
import { LoadingBoard } from "@/components/loading-board";
import { NoBoardsState } from "@/components/no-boards-state";
import { Button } from "@/components/ui/button";
import { BoardPage } from "@/features/board/components/board-page";
import type { BoardSummary } from "@/features/board/types";
import { useBoard, useBoards } from "@/hooks/use-board-data";
import { useCreateBoard, useDeleteBoardMutation } from "@/hooks/use-board-mutations";
import { useCreateColumnMutation } from "@/hooks/use-column-mutations";
import { AppHeader } from "@/layout/app-header";
import { AppShell } from "@/layout/app-shell";
import { AppSidebar } from "@/layout/app-sidebar";

const EMPTY_BOARDS: BoardSummary[] = [];
const AUTH_REDIRECT_URI = window.location.origin;

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isCreateBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [isCreateColumnDialogOpen, setCreateColumnDialogOpen] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const [hasAutoLoginAttempted, setHasAutoLoginAttempted] = useState(false);

  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const boardRouteMatch = useMatch("/boards/:boardId");
  const routeBoardId = boardRouteMatch?.params.boardId ?? null;

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    loginWithRedirect,
    logout,
    user,
    error: authError,
  } = useAuth0();

  const hasAuthCallbackParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.has("code") && searchParams.has("state");
  }, [location.search]);

  const boardsQuery = useBoards(isAuthenticated);
  const boards = useMemo(() => boardsQuery.data ?? EMPTY_BOARDS, [boardsQuery.data]);

  const activeBoardId = useMemo(() => {
    if (routeBoardId && boards.some((board) => board.id === routeBoardId)) {
      return routeBoardId;
    }

    if (!routeBoardId) {
      return boards[0]?.id ?? null;
    }

    return null;
  }, [boards, routeBoardId]);

  const boardQuery = useBoard(activeBoardId, isAuthenticated);
  const createBoardMutation = useCreateBoard();
  const deleteBoardMutation = useDeleteBoardMutation();
  const createColumnMutation = useCreateColumnMutation();

  const board = boardQuery.data;
  const activeBoardSummary = boards.find((boardSummary) => boardSummary.id === activeBoardId) ?? null;
  const userDisplayName = useMemo(() => {
    const name =
      (typeof user?.name === "string" && user.name.trim().length > 0 ? user.name : null) ??
      (typeof user?.nickname === "string" && user.nickname.trim().length > 0 ? user.nickname : null) ??
      (typeof user?.email === "string" && user.email.trim().length > 0
        ? user.email.split("@")[0]?.trim() ?? null
        : null);

    return name ?? "User";
  }, [user]);
  const userEmail = typeof user?.email === "string" ? user.email : "";
  const userAvatarUrl = typeof user?.picture === "string" ? user.picture : undefined;

  const isLoading =
    isAuthLoading ||
    (isAuthenticated && (boardsQuery.isLoading || (Boolean(activeBoardId) && boardQuery.isLoading)));

  const hasError = Boolean(boardsQuery.error) || (Boolean(activeBoardId) && Boolean(boardQuery.error));

  useEffect(() => {
    if (boardsQuery.error) {
      toast.error(getApiErrorMessage(boardsQuery.error, "Could not load boards"));
    }
  }, [boardsQuery.error]);

  useEffect(() => {
    if (boardQuery.error) {
      toast.error(getApiErrorMessage(boardQuery.error, "Could not load board"));
    }
  }, [boardQuery.error]);

  useEffect(() => {
    if (authError) {
      toast.error(authError.message);
    }
  }, [authError]);

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || boardsQuery.isLoading) {
      return;
    }

    if (boards.length === 0) {
      return;
    }

    if (!routeBoardId || !boards.some((boardSummary) => boardSummary.id === routeBoardId)) {
      navigate(`/boards/${boards[0].id}`, { replace: true });
    }
  }, [boards, boardsQuery.isLoading, isAuthLoading, isAuthenticated, navigate, routeBoardId]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setSessionExpired(true);
      toast.error("Session expired. Please sign in again.");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Normalized auth flow: once authenticated, ensure expired gate is cleared.
    setSessionExpired(false);
  }, [isAuthenticated]);

  const handleRetry = () => {
    boardsQuery.refetch();

    if (activeBoardId) {
      boardQuery.refetch();
    }
  };

  const handleCreateBoardSubmit = (values: CreateBoardFormValues) => {
    createBoardMutation.mutate(values, {
      onSuccess: (createdBoard) => {
        setCreateBoardDialogOpen(false);
        navigate(`/boards/${createdBoard.id}`);
      },
    });
  };

  const handleCreateColumnSubmit = (values: CreateColumnFormValues) => {
    if (!board) {
      return;
    }

    const nextPosition =
      board.columns.length === 0
        ? "1024"
        : (BigInt(board.columns[board.columns.length - 1]?.position ?? "0") + 1024n).toString();

    createColumnMutation.mutate({
      boardId: board.id,
      payload: {
        boardId: board.id,
        title: values.title,
        position: nextPosition,
      },
    }, {
      onSuccess: () => {
        setCreateColumnDialogOpen(false);
      },
    });
  };

  const handleDeleteBoard = (boardId: string) => {
    if (deleteBoardMutation.isPending) {
      return;
    }

    const nextBoardId = boards.find((boardSummary) => boardSummary.id !== boardId)?.id ?? null;
    const nextPath = nextBoardId ? `/boards/${nextBoardId}` : "/boards";
    const isDeletingActiveBoard = activeBoardId === boardId || routeBoardId === boardId;

    setDeletingBoardId(boardId);
    deleteBoardMutation.mutate(boardId, {
      onSuccess: () => {
        if (isDeletingActiveBoard) {
          navigate(nextPath, { replace: true });
        }
      },
      onSettled: () => {
        setDeletingBoardId(null);
      },
    });
  };

  const handleLogin = useCallback(() => {
    setSessionExpired(false);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const returnTo = currentPath.startsWith("/login") ? "/boards" : (currentPath || "/boards");

    void loginWithRedirect({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? "https://taskboard-api",
        redirect_uri: AUTH_REDIRECT_URI,
      },
      appState: {
        returnTo,
      },
    });
  }, [loginWithRedirect]);

  useEffect(() => {
    if (location.pathname !== "/login" && hasAutoLoginAttempted) {
      setHasAutoLoginAttempted(false);
    }
  }, [hasAutoLoginAttempted, location.pathname]);

  useEffect(() => {
    if (isAuthLoading || isAuthenticated || authError || hasAuthCallbackParams) {
      return;
    }

    if (location.pathname !== "/login" || hasAutoLoginAttempted) {
      return;
    }

    setHasAutoLoginAttempted(true);
    handleLogin();
  }, [
    authError,
    handleLogin,
    hasAuthCallbackParams,
    hasAutoLoginAttempted,
    isAuthLoading,
    isAuthenticated,
    location.pathname,
  ]);

  useEffect(() => {
    if (isAuthLoading || isAuthenticated || !hasAuthCallbackParams || authError) {
      return;
    }

    // Recover from stale/failed callback params so the user can retry sign-in.
    navigate("/login", { replace: true });
  }, [authError, hasAuthCallbackParams, isAuthLoading, isAuthenticated, navigate]);

  const handleLogout = () => {
    setSessionExpired(false);
    window.sessionStorage.removeItem("auth:unauthorized-notified");
    window.sessionStorage.removeItem("auth:token-logged");
    queryClient.clear();
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  if (!isAuthenticated && isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#f6f9ff_0%,_#eef2f8_52%,_#edf0f5_100%)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white/85 p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-semibold text-slate-700">Completing sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Please wait while we finish authentication.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#f6f9ff_0%,_#eef2f8_52%,_#edf0f5_100%)] px-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white/85 p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <h2 className="text-lg font-semibold text-slate-700">Sign in required</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {authError
                    ? "Authentication failed. Retry sign in."
                    : "Redirecting to Auth0. If nothing happens, use the button below."}
                </p>
                {authError ? (
                  <p className="mt-2 text-xs text-red-500">{authError.message}</p>
                ) : null}
                <Button className="mt-4" onClick={handleLogin}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {authError ? "Retry Sign In" : "Sign In"}
                </Button>
              </div>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (sessionExpired) {
    return (
      <AppShell
        sidebar={
          <AppSidebar
            projects={[]}
            activeProjectId={null}
            onCreateBoard={() => setCreateBoardDialogOpen(true)}
            onDeleteBoard={handleDeleteBoard}
            deletingBoardId={deletingBoardId}
          />
        }
        header={
          <AppHeader
            projectTitle="Task Board"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchDisabled
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userAvatarUrl={userAvatarUrl}
            onLogout={handleLogout}
          />
        }
      >
        <div className="mx-auto mt-20 max-w-md rounded-2xl border border-slate-200/70 bg-white/85 p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-semibold text-slate-700">Session expired</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your token was rejected by the API. Re-authenticate to continue.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              onClick={handleLogin}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Re-authenticate
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                logout({
                  logoutParams: {
                    returnTo: window.location.origin,
                  },
                })
              }
            >
              Logout
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const renderBoardContent = () => {
    const canCreateBoardFromError = boards.length === 0;

    if (isLoading) {
      return <LoadingBoard />;
    }

    if (hasError) {
      return (
        <ErrorState
          title={canCreateBoardFromError ? "Could not load boards" : "Could not load board"}
          description={
            canCreateBoardFromError
              ? "We couldn't fetch your boards right now. You can retry or create a board."
              : "Please check the connection and try again."
          }
          onRetry={handleRetry}
          secondaryActionLabel={canCreateBoardFromError ? "Create Board" : undefined}
          onSecondaryAction={canCreateBoardFromError ? () => setCreateBoardDialogOpen(true) : undefined}
          secondaryActionPending={createBoardMutation.isPending}
        />
      );
    }

    if (boards.length === 0) {
      return (
        <NoBoardsState
          onCreateBoard={() => setCreateBoardDialogOpen(true)}
          onRetry={handleRetry}
          isCreating={createBoardMutation.isPending}
        />
      );
    }

    if (!board) {
      return <LoadingBoard />;
    }

    return (
      <BoardPage
        board={board}
        searchTerm={searchTerm}
        onCreateColumn={() => setCreateColumnDialogOpen(true)}
        isCreatingColumn={createColumnMutation.isPending}
      />
    );
  };

  return (
    <AppShell
      sidebar={
        <AppSidebar
          projects={boards}
          activeProjectId={activeBoardId}
          onCreateBoard={() => setCreateBoardDialogOpen(true)}
          onDeleteBoard={handleDeleteBoard}
          deletingBoardId={deletingBoardId}
        />
      }
      header={
        <AppHeader
          projectTitle={board?.title ?? activeBoardSummary?.title ?? "Task Board"}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchDisabled={!board}
          userDisplayName={userDisplayName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          onLogout={handleLogout}
        />
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/boards" replace />} />
        <Route path="/boards" element={renderBoardContent()} />
        <Route path="/boards/:boardId" element={renderBoardContent()} />
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>

      <CreateBoardDialog
        open={isCreateBoardDialogOpen}
        isSubmitting={createBoardMutation.isPending}
        onOpenChange={setCreateBoardDialogOpen}
        onSubmit={handleCreateBoardSubmit}
      />
      <CreateColumnDialog
        open={isCreateColumnDialogOpen}
        isSubmitting={createColumnMutation.isPending}
        onOpenChange={setCreateColumnDialogOpen}
        onSubmit={handleCreateColumnSubmit}
      />
    </AppShell>
  );
}

export default App;
