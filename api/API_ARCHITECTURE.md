# API Architecture

## Project Overview And Goals
This backend implements the task-board take-home requirements using Fastify, TypeScript, Prisma/PostgreSQL, Zod validation, and Auth0 JWT verification via JWKS.

Goals:
- Secure all business endpoints with Auth0 access token verification.
- Auto-provision users from valid JWT `sub` claims.
- Enforce role-based access (`user`, `admin`).
- Provide complete CRUD for boards, columns, and tasks.
- Support stable drag-and-drop ordering with gap-based BIGINT positions.
- Keep API error handling consistent and predictable.

## Folder Structure And Explanation

```text
api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── env.ts
│   ├── lib/
│   │   ├── access.ts
│   │   ├── errors.ts
│   │   ├── jwks.ts
│   │   ├── position.ts
│   │   ├── prisma.ts
│   │   ├── serialize.ts
│   │   └── zod.ts
│   ├── middleware/
│   │   ├── require-auth.ts
│   │   └── require-role.ts
│   ├── plugins/
│   │   └── auth.ts
│   ├── routes/
│   │   ├── admin.ts
│   │   ├── boards.ts
│   │   ├── columns.ts
│   │   ├── health.ts
│   │   ├── me.ts
│   │   └── tasks.ts
│   ├── tests/
│   │   └── position.test.ts
│   └── types/
│       ├── auth.ts
│       └── fastify.d.ts
├── API_ARCHITECTURE.md
├── package.json
└── tsconfig.json
```

Key responsibilities:
- `src/app.ts`: Fastify app composition (CORS, auth plugin, routes, error handler).
- `src/server.ts`: process bootstrap + graceful shutdown.
- `src/plugins/auth.ts`: JWT validation, user auto-provisioning, request context decoration.
- `src/middleware/*`: reusable auth/role guards.
- `src/routes/*`: endpoint-level behavior and resource access checks.
- `src/lib/errors.ts`: consistent error model and centralized handler.
- `src/lib/position.ts`: gap-based ordering math + rebalance helpers.

## Auth0 JWT And Role Logic

### JWT validation flow
1. `Authorization: Bearer <token>` is verified by `@fastify/jwt`.
2. Verification key is resolved dynamically from Auth0 JWKS (`kid` -> public key).
3. Verifier checks:
   - `alg = RS256`
   - `allowedIss = AUTH0_ISSUER`
   - `allowedAud = AUTH0_AUDIENCE`

### User provisioning and request context
After token verification:
- `sub` is required.
- User is looked up by `auth0Sub`.
- If not found, a new user is created automatically.
- Email is updated from token when present.
- `request.userContext` is attached with `{ id, auth0Sub, email, role }`.

### Role enforcement
- `requireAuth` middleware ensures the request is authenticated.
- `requireRole(["admin"])` middleware protects admin-only endpoints.
- Ownership checks in `src/lib/access.ts` allow:
  - owner access for regular users
  - full access for admins

### Why this route and why the admin role model

`GET /admin/stats` was chosen as the role-gated surface for three reasons:

1. **Safe to demonstrate:** It is read-only. Demonstrating RBAC on a destructive endpoint
   (e.g. delete-any-board) requires a provisioned admin account to exist before testing,
   and carries risk of accidental data loss. A stats endpoint has no side effects.
2. **Full stack coverage:** The route exercises the complete RBAC path — Auth0 role claim
   in the JWT → `requireRole` middleware → ownership bypass inside `access.ts` — without
   needing additional schema changes.
3. **Realistic use case:** System-wide analytics are a textbook admin-only feature in
   multi-tenant SaaS products.

**Why a role enum rather than fine-grained permissions:**
The app has exactly two access tiers: a user who owns resources, and an admin who can read
all resources. A binary `user | admin` role maps this cleanly. Fine-grained permissions
(e.g. `can:read:any-board`) would be the right choice if the app supported delegated
access, shared boards, or per-resource ACLs — none of which are in scope. Over-engineering
the permission model here would add complexity without demonstrating additional skill.

## Migration Tool: Why Prisma

Prisma was chosen over Flyway, Liquibase, or raw SQL migration scripts for the following reasons:

- **Single runtime:** No JVM, no extra CLI binary. Prisma runs inside the existing Node.js
  environment, keeping the toolchain uniform.
- **Type-safe query client:** `prisma generate` produces TypeScript types directly from the
  schema, eliminating an entire class of runtime type mismatch bugs at zero extra cost.
- **Safe startup migration:** `prisma migrate deploy` applies only pending migrations, is
  idempotent, and aborts on conflicts — making it safe to call unconditionally in the
  container entrypoint.
- **Readable schema DSL:** `schema.prisma` is a single authoritative source for the data
  model, relations, indexes, and enums, keeping schema and migration history co-located.

**Trade-offs:**
- Teams comfortable with raw SQL may prefer Flyway's explicit `.sql` files and fine-grained
  control over migration content.
- Prisma's `_prisma_migrations` table is the single source of truth; applying manual DDL
  without a corresponding migration will desync the shadow database.
- Prisma does not yet support all Postgres-specific features (e.g. partial indexes, custom
  operators) without falling back to raw SQL.

## Gap-Based BIGINT Ordering

Each ordered entity stores a BIGINT `position`:
- Boards ordered inside a user scope.
- Columns ordered inside a board.
- Tasks ordered inside a column.

Strategy:
- Default insertion appends at `lastPosition + 1024`.
- Reorder accepts `beforeId` / `afterId`.
- New position is computed by midpoint or gap step.
- If no integer gap exists, siblings are rebalanced to deterministic positions:
  - 1024, 2048, 3072, ...
- Reorder is then retried and succeeds with new spacing.

This keeps writes cheap for most reorder operations and avoids full-list rewrites unless necessary.

## Cascade Deletes

Cascade delete behavior is defined in Prisma schema:
- `Board.user` relation: `onDelete: Cascade`
- `Column.board` relation: `onDelete: Cascade`
- `Task.column` relation: `onDelete: Cascade`

Implications:
- Deleting a board removes all of its columns and tasks.
- Deleting a column removes all of its tasks.
- No manual cleanup code is required in route handlers.

## Example Non-Trivial Query (Admin Stats)

`GET /admin/stats` runs aggregates plus a SQL query for ranking users by board ownership:

- `COUNT` totals for users/boards/columns/tasks
- groupBy task priority
- raw SQL join + group + order + limit:
  - `User LEFT JOIN Board`
  - count boards per user
  - order by board count descending
  - return top 10 users

This query demonstrates cross-table analytics with aggregation and ranking.

## Error Handling

All errors resolve into a consistent top-level shape:

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "error": "BAD_REQUEST",
  "message": "Invalid request body.",
  "details": {}
}
```

Notes:
- `details` is optional and only included when additional context exists.
- `error` mirrors the error code for compatibility with common API clients.

Centralized handling in `src/lib/errors.ts` maps:
- custom `ApiError`
- Zod validation errors
- Fastify request validation errors
- JWT verification failures
- Prisma known errors (`P2002`, `P2003`, `P2025`)
- unknown exceptions -> `INTERNAL_SERVER_ERROR`

## Take-Home Requirement Mapping

- Fastify + TypeScript API setup: implemented (`src/app.ts`, `src/server.ts`).
- Prisma models/migrations: present and used (`prisma/schema.prisma`, migrations).
- Zod validation helpers: implemented (`src/lib/zod.ts`).
- Auth0 JWT validation via JWKS: implemented (`src/plugins/auth.ts`, `src/lib/jwks.ts`).
- Auto-provision users from JWT `sub`: implemented in auth plugin.
- Role middleware admin vs user: implemented (`src/middleware/require-role.ts`).
- Required routes:
  - `GET /health`
  - `GET /me`
  - boards CRUD + reorder
  - columns CRUD + reorder
  - tasks CRUD + reorder
  - `GET /admin/stats` (admin only)
- Consistent error shapes: implemented centrally (`src/lib/errors.ts`).
- Tests (optional): included for ordering helper behavior (`src/tests/position.test.ts`).
