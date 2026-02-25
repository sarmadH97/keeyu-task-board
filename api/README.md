# Task Board API

## Board Scoping
All `/boards` endpoints are scoped to the authenticated user (`request.userContext.id`).

- `GET /boards` returns only the caller's boards.
- `GET /boards/:boardId` and `GET /boards/:boardId/full` only return data when the board is owned by the caller.
- Non-owned boards return `404` to avoid leaking resource existence.

## Delete Behavior
Board deletion is hard-delete with relational cascade at the database level.

- `DELETE /boards/:boardId` removes the board.
- Related columns and tasks are deleted automatically via `onDelete: Cascade` relations:
  - `Board -> Column`
  - `Column -> Task`
