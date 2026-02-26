 ![Alt text](https://cdn.prod.website-files.com/68b510e785c9b2f4b960016e/68ca15d1404821bbdabef514_Keeyu%20Logo.svg)
# Task Board Monorepo

This repository contains:

- `api/`: Fastify + Prisma + Auth0 backend
- `web/`: React + Vite + TypeScript frontend
- `docker-compose.yml`: local deployment for API + Web + Postgres
- `k8s/`: Kubernetes manifests + management script

## Prerequisites

- Docker + Docker Compose

## Local Deployment (Docker Compose)

1. Copy env template:

```bash
cp .env.example .env
```

2. Set Auth0 values in `.env`:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE` (default is `https://taskboard-api`)
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE` (default is `https://taskboard-api`)

3. Build and start:

```bash
docker compose up -d --build
```

4. Verify status:

```bash
docker compose ps
```

5. Open apps:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- API health: `http://localhost:3000/health`

## Useful Commands

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
docker compose down
docker compose down -v
```

## Troubleshooting

If the UI shows `Could not load boards` and the API response is:
`503 INTERNAL_SERVER_ERROR: Database connection failed.`

1. Ensure Postgres is running:
```bash
docker compose up -d postgres
```
2. Confirm DB health:
```bash
docker compose ps
docker compose logs -f postgres
```
3. If credentials changed previously, recreate the Postgres volume:
```bash
docker compose down -v
docker compose up -d --build
```

## Notes

- API container runs Prisma generate + migrate deploy on startup before starting the server.
- Frontend is served by Nginx with SPA fallback and `/healthz` endpoint.

## Kubernetes (minikube/kind)

1. Ensure a cluster is running and `kubectl` points to it.
2. Deploy with required Auth0 values:

```bash
AUTH0_DOMAIN=dev-your-tenant.us.auth0.com \
POSTGRES_PASSWORD=change_me \
VITE_AUTH0_CLIENT_ID=your_spa_client_id \
./k8s/manage.sh deploy
```

3. Check status:

```bash
./k8s/manage.sh status
```

4. Stream logs:

```bash
./k8s/manage.sh logs api
./k8s/manage.sh logs web
./k8s/manage.sh logs postgres
```

5. Teardown:

```bash
./k8s/manage.sh teardown
```

Access locally via port-forward:

```bash
kubectl -n task-board port-forward svc/task-board-api 3000:3000
kubectl -n task-board port-forward svc/task-board-web 5173:80
```

> **Note — Vite build-time environment variables:** `VITE_*` variables are compiled into the
> JavaScript bundle at image build time (not injected at runtime). This means changing
> `VITE_API_URL` or `VITE_AUTH0_*` requires a full image rebuild and redeployment of the web
> pod. `manage.sh deploy` handles this automatically by rebuilding images and rolling out the
> deployment on every run.

---

## Auth0 Configuration Checklist

Complete these steps in the [Auth0 dashboard](https://manage.auth0.com) before running the app.

### 1. Create a Tenant

Sign up or log in to Auth0 and note your **tenant domain** (e.g. `dev-abc123.us.auth0.com`).

### 2. Create the API

1. Go to **Applications → APIs → Create API**.
2. Set **Name**: `Task Board API`.
3. Set **Identifier (Audience)**: `https://taskboard-api` (this becomes `AUTH0_AUDIENCE`).
4. Leave **Signing Algorithm** as `RS256`.
5. Save. Auth0 generates a JWKS endpoint at `https://<your-domain>/.well-known/jwks.json`.

### 3. Create the SPA Application

1. Go to **Applications → Applications → Create Application**.
2. Choose **Single Page Application**.
3. Set **Name**: `Task Board Web`.
4. Note the **Client ID** (this becomes `VITE_AUTH0_CLIENT_ID`).

### 4. Configure Allowed URLs

In the SPA application settings, set all three fields to match your running origin(s):

| Field | Local dev | K8s port-forward |
|---|---|---|
| Allowed Callback URLs | `http://localhost:5173` | `http://localhost:5173` |
| Allowed Logout URLs | `http://localhost:5173` | `http://localhost:5173` |
| Allowed Web Origins | `http://localhost:5173` | `http://localhost:5173` |

Add additional origins (comma-separated) if you expose the app on a different port or domain.

### 5. Enable Refresh Token Rotation (optional but recommended)

In the SPA application settings → **Refresh Token Rotation**: enable **Rotation** and set
an appropriate **Leeway** (e.g. 30 seconds). This allows silent re-authentication without a
full redirect.

### 6. Configure Roles (for the admin endpoint)

The API exposes `GET /admin/stats` which requires the `admin` role.

1. Go to **User Management → Roles → Create Role**.
2. Set **Name**: `admin`.
3. Assign the role to a user: go to **User Management → Users**, select a user, open the
   **Roles** tab, and assign `admin`.

Auth0 does not include roles in access tokens by default. Add an **Action** to inject the role:

1. Go to **Actions → Flows → Login → Add Action → Build from scratch**.
2. Name it `Add roles to token`.
3. Paste:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://taskboard-api";
  const roles = event.authorization?.roles ?? [];
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

4. Deploy the action and drag it into the Login flow.

> The API reads roles from the `https://taskboard-api/roles` claim in the access token.

### 7. Environment Variable Summary

| Variable | Where to find it |
|---|---|
| `AUTH0_DOMAIN` | Tenant settings → Domain (without `https://`) |
| `AUTH0_AUDIENCE` | APIs → Task Board API → Identifier |
| `AUTH0_ISSUER` | `https://<AUTH0_DOMAIN>/` (auto-derived by manage.sh) |
| `VITE_AUTH0_DOMAIN` | Same as `AUTH0_DOMAIN` |
| `VITE_AUTH0_CLIENT_ID` | Applications → Task Board Web → Client ID |
| `VITE_AUTH0_AUDIENCE` | Same as `AUTH0_AUDIENCE` |

---

## Architecture Decisions & Trade-offs

Full rationale lives in [api/API_ARCHITECTURE.md](api/API_ARCHITECTURE.md) and
[web/FRONTEND_ARCHITECTURE.md](web/FRONTEND_ARCHITECTURE.md). Key decisions summarised:

### Auth: Auth0 Authorization Code + PKCE

The frontend uses the Auth0 React SDK (`@auth0/auth0-react` v2), which implements the
**Authorization Code flow with PKCE** (Proof Key for Code Exchange) by default for SPAs.
PKCE replaces the implicit flow: no tokens are exposed in the URL fragment, and the
authorization code is bound to a per-request code verifier that only the initiating client
can redeem. No explicit PKCE configuration is needed beyond using the SDK — this is the
correct and secure default for public clients.

The API validates access tokens using **JWKS** (RS256): the signing key is resolved
dynamically from `https://<AUTH0_DOMAIN>/.well-known/jwks.json` by `kid`, so key rotation
is transparent.

**Trade-off:** `cacheLocation="localstorage"` is set in the frontend so that the Auth0
session survives a full page refresh without a redirect round-trip. The trade-off is that
localStorage is accessible to any JavaScript running on the page (XSS surface). The
safer alternative is `"memory"` (lost on refresh, poor UX) or `"sessionstorage"` (lost
on tab close). For a dev/assessment context, localStorage is acceptable; a production app
should pair this with a strict Content-Security-Policy and subresource integrity.

### Database: Prisma Migrations

**Why Prisma** over Flyway, Liquibase, or raw SQL:
- Single-language toolchain — schema, migrations, and the type-safe query client all live
  inside the Node.js project with no JVM or extra runtime.
- Auto-generated TypeScript types from the schema eliminate a whole class of runtime bugs.
- `prisma migrate deploy` is safe to run on startup in the API container: it applies only
  pending migrations and is idempotent.
- **Trade-off:** Prisma's migration history must be committed and the `_prisma_migrations`
  table is the source of truth. Diverging the schema without a migration (e.g. manual
  `ALTER TABLE`) will desync the shadow database. For teams comfortable with SQL, Flyway
  gives more explicit control; Prisma's DSL trades that control for developer velocity.

### Ordering: Gap-based BIGINT Positions

Every ordered entity (board, column, task) stores a `BigInt` position. New items append at
`lastPosition + 1024`. Reorder computes a midpoint; if integer space is exhausted the
sibling list is rebalanced in a single batch write. This keeps reorder writes O(1) in the
common case and avoids renumbering the entire list on every drag.

**Trade-off:** Positions are opaque integers, not ranks. Client code must sort by position
before rendering. Rebalance is rare but causes a multi-row update; under high concurrency
a compare-and-swap or optimistic lock would be needed.

### Role-Based Access: Admin Stats Endpoint

`GET /admin/stats` is the single role-gated route, requiring the `admin` role.

**Why this route:** A read-only analytics endpoint is the safest surface to demonstrate
role enforcement — it cannot cause data mutation, it is straightforward to test without
side effects, and it exercises the full RBAC stack (Auth0 role claim → JWT extraction →
`requireRole` middleware → ownership bypass for admins). Protecting a destructive admin
action (e.g. delete-any-board) would also be valid but harder to test without seeded data
and a provisioned admin account.

**Why `admin` vs. permissions:** A binary user/admin enum maps cleanly to the two distinct
access tiers in this app (own-resources vs. all-resources). A permission-based model (e.g.
`can:read:any-board`) would be more granular and is Auth0-supported, but is over-engineered
for an app that has no multi-tenant or delegated-access requirements.

### Frontend State: React Query + Optimistic Updates

React Query manages all server state. Optimistic updates are applied on drag-end by writing
the predicted board directly into the query cache before the HTTP request returns. On error
the cache rolls back to a saved snapshot. This gives immediate visual feedback with
automatic consistency recovery, at the cost of a brief flicker if the server rejects the move.

### Infrastructure: Kubernetes + Docker Compose

Docker Compose is the recommended local dev path (single command, no cluster required).
Kubernetes manifests target minikube/kind for the assessment cluster requirement.
Both share the same images; `manage.sh` builds, loads, and deploys in one command.
**Trade-off:** the web image bakes `VITE_*` config at build time. Changing frontend config
means a new image build, unlike a server-rendered app where config can be injected at runtime.

---

## What to Improve Given More Time

### Frontend
- Inline task composer (currently uses a modal; an inline input in the column would be faster).
- Keyboard drag-and-drop accessibility and screen-reader announcements via dnd-kit's keyboard sensor.
- Dedicated board picker route at `/boards` instead of auto-redirecting to the first board.
- Runtime Zod validation on API responses to catch schema drift early.
- E2E tests (Playwright) covering drag reorder, cross-column move, and auth redirect.

### Backend
- Pagination on `GET /boards` and `GET /boards/:id/full` for large datasets.
- Task search endpoint (currently client-side filter only).
- Soft delete / archive for boards and tasks rather than hard cascade.
- Idempotency keys on task creation to prevent duplicate submissions on retry.
- Admin UI — `GET /admin/stats` returns data but there is no frontend page to display it.

### Infrastructure
- Ingress + TLS termination (currently port-forward only for local K8s).
- Horizontal Pod Autoscaler for the API based on CPU/request-rate.
- Separate read replica or connection pooler (PgBouncer) for the database.
- Structured JSON logging with log-level control via env var (API currently uses Fastify's default pretty logger in dev).
- CI pipeline (GitHub Actions) to build images, run tests, and validate manifests on PR.
