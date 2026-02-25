#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="${ROOT_DIR}/k8s"
NAMESPACE="task-board"

API_IMAGE="${API_IMAGE:-task-board-api:latest}"
WEB_IMAGE="${WEB_IMAGE:-task-board-web:latest}"

POSTGRES_DB="${POSTGRES_DB:-taskboard}"
POSTGRES_USER="${POSTGRES_USER:-taskboard}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
DATABASE_URL="${DATABASE_URL:-}"

AUTH0_DOMAIN="${AUTH0_DOMAIN:-}"
AUTH0_AUDIENCE="${AUTH0_AUDIENCE:-https://taskboard-api}"
AUTH0_ISSUER="${AUTH0_ISSUER:-}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173}"

VITE_API_URL="${VITE_API_URL:-http://localhost:3000}"
VITE_AUTH0_DOMAIN="${VITE_AUTH0_DOMAIN:-${AUTH0_DOMAIN}}"
VITE_AUTH0_CLIENT_ID="${VITE_AUTH0_CLIENT_ID:-}"
VITE_AUTH0_AUDIENCE="${VITE_AUTH0_AUDIENCE:-${AUTH0_AUDIENCE}}"

usage() {
  cat <<'USAGE'
Usage:
  k8s/manage.sh deploy
  k8s/manage.sh teardown
  k8s/manage.sh status
  k8s/manage.sh logs <api|web|postgres>

Environment variables for deploy:
  AUTH0_DOMAIN              (required)
  VITE_AUTH0_CLIENT_ID      (required)
  AUTH0_AUDIENCE            (default: https://taskboard-api)
  AUTH0_ISSUER              (default: https://<AUTH0_DOMAIN>/)
  CORS_ORIGIN               (default: http://localhost:5173)
  VITE_API_URL              (default: http://localhost:3000)
  VITE_AUTH0_DOMAIN         (default: AUTH0_DOMAIN)
  VITE_AUTH0_AUDIENCE       (default: AUTH0_AUDIENCE)
  POSTGRES_DB               (default: taskboard)
  POSTGRES_USER             (default: taskboard)
  POSTGRES_PASSWORD         (required unless DATABASE_URL is set)
  DATABASE_URL              (optional, overrides generated Postgres URL)
  API_IMAGE                 (default: task-board-api:latest)
  WEB_IMAGE                 (default: task-board-web:latest)
  SKIP_BUILD=1              (optional)
  SKIP_IMAGE_LOAD=1         (optional)
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

normalize_auth0_domain() {
  local domain="$1"
  domain="${domain#http://}"
  domain="${domain#https://}"
  domain="${domain%/}"
  printf "%s" "$domain"
}

build_images() {
  echo "Building API image: ${API_IMAGE}"
  docker build -t "${API_IMAGE}" -f "${ROOT_DIR}/api/Dockerfile" "${ROOT_DIR}/api"

  echo "Building web image: ${WEB_IMAGE}"
  docker build \
    -t "${WEB_IMAGE}" \
    --build-arg "VITE_API_URL=${VITE_API_URL}" \
    --build-arg "VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}" \
    --build-arg "VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}" \
    --build-arg "VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}" \
    -f "${ROOT_DIR}/web/Dockerfile" \
    "${ROOT_DIR}/web"
}

load_images_into_cluster() {
  local context
  context="$(kubectl config current-context 2>/dev/null || true)"

  if [[ "${context}" == kind-* ]]; then
    require_cmd kind
    echo "Loading images into kind cluster (${context})"
    kind load docker-image "${API_IMAGE}" "${WEB_IMAGE}"
    return
  fi

  if [[ "${context}" == minikube* ]]; then
    if command -v minikube >/dev/null 2>&1; then
      echo "Loading images into minikube (${context})"
      minikube image load "${API_IMAGE}"
      minikube image load "${WEB_IMAGE}"
    else
      echo "minikube context detected but minikube CLI is missing; skip image load."
    fi
    return
  fi

  echo "Context '${context:-unknown}' detected; skipping automatic image load."
  echo "Ensure the cluster can pull ${API_IMAGE} and ${WEB_IMAGE}."
}

apply_runtime_config() {
  local normalized_auth0_domain
  normalized_auth0_domain="$(normalize_auth0_domain "${AUTH0_DOMAIN}")"
  local issuer
  issuer="${AUTH0_ISSUER:-https://${normalized_auth0_domain}/}"
  local database_url
  database_url="${DATABASE_URL}"
  if [[ -z "${database_url}" ]]; then
    database_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres.${NAMESPACE}.svc.cluster.local:5432/${POSTGRES_DB}?schema=public"
  fi

  kubectl -n "${NAMESPACE}" create configmap task-board-config \
    --from-literal=NODE_ENV=production \
    --from-literal=HOST=0.0.0.0 \
    --from-literal=PORT=3000 \
    --from-literal=CORS_ORIGIN="${CORS_ORIGIN}" \
    --from-literal=AUTH0_AUDIENCE="${AUTH0_AUDIENCE}" \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl -n "${NAMESPACE}" create secret generic task-board-secrets \
    --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
    --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
    --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    --from-literal=DATABASE_URL="${database_url}" \
    --from-literal=AUTH0_DOMAIN="${normalized_auth0_domain}" \
    --from-literal=AUTH0_ISSUER="${issuer}" \
    --dry-run=client -o yaml | kubectl apply -f -
}

deploy() {
  require_cmd kubectl
  require_cmd docker

  if [[ -z "${AUTH0_DOMAIN}" ]]; then
    echo "AUTH0_DOMAIN is required for deploy." >&2
    exit 1
  fi
  if [[ -z "${VITE_AUTH0_CLIENT_ID}" ]]; then
    echo "VITE_AUTH0_CLIENT_ID is required for deploy." >&2
    exit 1
  fi
  if [[ -z "${DATABASE_URL}" && -z "${POSTGRES_PASSWORD}" ]]; then
    echo "POSTGRES_PASSWORD is required when DATABASE_URL is not provided." >&2
    exit 1
  fi

  kubectl apply -f "${K8S_DIR}/namespace.yaml"
  apply_runtime_config

  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    build_images
  fi

  if [[ "${SKIP_IMAGE_LOAD:-0}" != "1" ]]; then
    load_images_into_cluster
  fi

  kubectl apply -f "${K8S_DIR}/postgres.yaml"
  kubectl apply -f "${K8S_DIR}/api.yaml"
  kubectl apply -f "${K8S_DIR}/web.yaml"

  kubectl -n "${NAMESPACE}" set image deployment/task-board-api api="${API_IMAGE}"
  kubectl -n "${NAMESPACE}" set image deployment/task-board-web web="${WEB_IMAGE}"

  kubectl -n "${NAMESPACE}" rollout status statefulset/task-board-postgres --timeout=240s
  kubectl -n "${NAMESPACE}" rollout status deployment/task-board-api --timeout=240s
  kubectl -n "${NAMESPACE}" rollout status deployment/task-board-web --timeout=240s

  echo "Deploy complete."
  echo "Port-forward examples:"
  echo "  kubectl -n ${NAMESPACE} port-forward svc/task-board-api 3000:3000"
  echo "  kubectl -n ${NAMESPACE} port-forward svc/task-board-web 5173:80"
}

teardown() {
  require_cmd kubectl
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true
}

status() {
  require_cmd kubectl
  kubectl -n "${NAMESPACE}" get pods,svc,deploy,statefulset,pvc
}

logs_cmd() {
  require_cmd kubectl
  local target="${1:-}"
  case "${target}" in
    api)
      kubectl -n "${NAMESPACE}" logs -f deployment/task-board-api
      ;;
    web)
      kubectl -n "${NAMESPACE}" logs -f deployment/task-board-web
      ;;
    postgres)
      kubectl -n "${NAMESPACE}" logs -f statefulset/task-board-postgres
      ;;
    *)
      echo "Usage: k8s/manage.sh logs <api|web|postgres>" >&2
      exit 1
      ;;
  esac
}

main() {
  local cmd="${1:-}"
  case "${cmd}" in
    deploy)
      deploy
      ;;
    teardown)
      teardown
      ;;
    status)
      status
      ;;
    logs)
      logs_cmd "${2:-}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
