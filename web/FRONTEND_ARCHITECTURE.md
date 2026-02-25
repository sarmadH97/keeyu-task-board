# FRONTEND_ARCHITECTURE

## 1. Overview
### Goals of the frontend
- Deliver a production-grade Kanban board with a calm, premium B2B SaaS visual language.
- Support task creation, drag-and-drop reorder, and cross-column movement with predictable UX.
- Keep the UI modular and maintainable with strict TypeScript and feature-oriented structure.

### Alignment with backend requirements
The frontend API layer is built around the required endpoints:
- `GET /boards` to list available boards.
- `GET /boards/:id` to fetch a board with columns and tasks.
- `POST /tasks` to create new tasks from column actions.
- `PATCH /tasks/:id` (supported in API layer for task edits).
- `PATCH /tasks/reorder` to persist task position and column changes after drag-and-drop.

The data layer normalizes responses (including wrapped payloads like `{ board }` or `{ boards }`) and preserves `position` as a string to safely support BIGINT ordering.

## 2. Brand Alignment Explanation
The interface intentionally stays minimal and premium:
- Soft neutral gradient page background and white cards with low-contrast borders.
- Spacious layout, clear grouping, and restrained typography for enterprise clarity.
- Rounded corners (`rounded-lg` / `rounded-xl`) and soft shadows for depth without visual noise.
- Muted blue accents for focus states, counts, and icons.
- Calm motion: subtle shadow transitions and smooth drag interactions, no aggressive hover behaviors.
- No dark mode and no loud saturation to preserve the requested brand tone.

## 3. Component Architecture
### Layout structure
- `layout/app-shell.tsx`: global two-pane shell (left sidebar + main content).
- `layout/app-header.tsx`: project context, search, avatar.
- `layout/app-sidebar.tsx`: minimal project navigation.

### Separation rationale
- Shared primitives in `components/ui/` (`Button`, `Input`, `Card`, `Badge`, `Avatar`, `Skeleton`) keep style and interaction consistent.
- Shared states in `components/` (`LoadingBoard`, `ErrorState`, `EmptyState`) avoid duplicated UX logic.
- Board-specific rendering and logic live in `features/board/`:
  - Types and ordering utilities.
  - DnD ids and move transformation logic.
  - Feature components (`kanban-board`, `board-column`, `task-card`).
- Data access in `api/` and query orchestration in `hooks/` keep UI components thin.

### Why React Query
React Query was selected because it provides:
- Declarative server-state fetching and caching.
- Built-in mutation lifecycle hooks for optimistic updates and rollback.
- Simple retry/invalidation behavior that keeps board state fresh while preserving responsive UX.

## 4. Drag & Drop Design
### How dnd-kit is used
- `DndContext` wraps the board.
- `SortableContext` is used per column for task lists.
- Each task has a stable draggable id (`task:<id>`), each column has a droppable id (`column:<id>`).
- `DragOverlay` renders a premium lightweight preview while dragging.

### Optimistic updates flow
1. On drag end, frontend computes the resulting board state using pure move logic.
2. Mutation `onMutate` immediately updates cache with the predicted board.
3. Request is sent to `PATCH /tasks/reorder` with changed tasks only.
4. On error, cache rolls back to the previous board snapshot.
5. On settle, query invalidates to re-sync with backend truth.

### Gap-based BIGINT ordering
- Task positions are treated as BIGINT-compatible strings.
- New order position is computed between neighboring tasks.
- If gap space is exhausted, target list is rebalanced using a fixed BIGINT step (`1024`) to restore spacing.
- Persisted payload includes updated `columnId` and `position` for changed tasks.

## 5. Performance Considerations
- React Query avoids redundant requests via caching and stale time.
- Memoization is used for derived board views (filtered columns, active drag item).
- Task and column components are memoized to reduce avoidable re-renders.
- Updates sent to reorder endpoint are diff-based (only changed tasks), minimizing payload size and backend work.

## 6. Error Handling Strategy
- **Loading state**: structured skeletons for header and columns.
- **Error state**: retryable UI for board fetch failures.
- **Empty state**:
  - No boards available.
  - No columns configured.
  - Empty column placeholders for task-level emptiness.
- Mutation failures surface inline sync warnings and automatically revalidate state.

## 7. AI-Assisted Development Strategy
GPT-5.3-Codex was used as an engineering accelerator for:
- Initial feature scaffolding and folder organization.
- Repetitive TypeScript patterns (typed DTO mapping, UI primitives, query hooks).
- Boilerplate reduction in DnD wiring and optimistic mutation lifecycle setup.

Human-led architectural decisions included:
- Domain boundaries (`api/`, `hooks/`, `features/board/`, `layout/`, `components/`).
- Data consistency strategy for BIGINT positions and rebalance behavior.
- UX constraints matching the premium SaaS brand (visual hierarchy, spacing, motion restraint).
- Final correctness checks through local production build verification.

Validation approach:
- Strict TypeScript compile in build pipeline.
- Production bundle build to verify import resolution and runtime packaging.
- Manual audit for required states (loading/error/empty) and drag interaction paths.

## 8. Tradeoffs
### What would improve with more time
- Inline task composer instead of default “New Task N” creation.
- Keyboard drag-and-drop accessibility polish and richer announcements.
- Dedicated board selector routing instead of defaulting to first board.
- Stronger runtime schema validation (e.g., Zod) on API responses.

### Scaling considerations
- Add pagination/virtualization for very large boards and columns.
- Move toward WebSocket or SSE syncing for multi-user real-time collaboration.
- Introduce permission-aware UI states and optimistic conflict resolution.
- Add E2E tests for drag/move/reorder edge cases across large datasets.
