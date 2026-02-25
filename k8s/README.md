# Kubernetes Deployment

This directory contains Kubernetes manifests for:

- `postgres.yaml`: PostgreSQL `StatefulSet` + PVC + service
- `api.yaml`: API `Deployment` + service
- `web.yaml`: frontend `Deployment` + service
- `configmap.yaml`: non-secret runtime configuration
- `secret.example.yaml`: secret shape example (do not use real credentials in git)
- `manage.sh`: management script for deploy lifecycle

## Prerequisites

- `kubectl`
- A local cluster (`minikube` or `kind`)
- `docker`

## Deploy

```bash
AUTH0_DOMAIN=dev-your-tenant.us.auth0.com \
POSTGRES_PASSWORD=change_me \
VITE_AUTH0_CLIENT_ID=your_spa_client_id \
./k8s/manage.sh deploy
```

Optional vars:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL` (if set, overrides generated Postgres URL)
- `AUTH0_AUDIENCE` (defaults to `https://taskboard-api`)
- `AUTH0_ISSUER` (defaults to `https://<AUTH0_DOMAIN>/`)
- `CORS_ORIGIN` (defaults to `http://localhost:5173`)
- `VITE_API_URL` (defaults to `http://localhost:3000`)
- `API_IMAGE`, `WEB_IMAGE`
- `SKIP_BUILD=1`, `SKIP_IMAGE_LOAD=1`

## Status / Logs / Teardown

```bash
./k8s/manage.sh status
./k8s/manage.sh logs api
./k8s/manage.sh logs web
./k8s/manage.sh logs postgres
./k8s/manage.sh teardown
```

## Port-forward for local access

```bash
kubectl -n task-board port-forward svc/task-board-api 3000:3000
kubectl -n task-board port-forward svc/task-board-web 5173:80
```
