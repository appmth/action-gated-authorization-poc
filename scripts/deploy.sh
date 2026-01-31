#!/bin/bash
# ===========================================
# AGA PoC - Deploy Script
# ===========================================
# Usage:
#   ./scripts/deploy.sh prod service-a    # Deploy service-a to Cloud Run
#   ./scripts/deploy.sh prod all          # Deploy all services to Cloud Run
#   ./scripts/deploy.sh local             # Start all services locally (docker-compose up)
#   ./scripts/deploy.sh local down        # Stop local services (docker-compose down)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGION="asia-northeast1"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load environment file
load_env() {
    local env_file="$1"
    if [[ -f "$env_file" ]]; then
        log_info "Loading $env_file"
        set -a
        source "$env_file"
        set +a
    else
        log_error "Environment file not found: $env_file"
        exit 1
    fi
}

# Deploy to Cloud Run
deploy_cloud_run() {
    local service="$1"
    local source_dir="$PROJECT_ROOT/$service"

    if [[ ! -d "$source_dir" ]]; then
        log_error "Service directory not found: $source_dir"
        return 1
    fi

    log_info "Deploying $service to Cloud Run..."

    case "$service" in
        service-a)
            gcloud run deploy "$service" \
                --source "$source_dir" \
                --region "$REGION" \
                --allow-unauthenticated \
                --min-instances 0 \
                --max-instances 5 \
                --set-env-vars "PDP_URL=$PDP_URL,TOOL_URL=$TOOL_URL,ENVOY_URL=$ENVOY_URL,VERTEX_PROJECT=$VERTEX_PROJECT,VERTEX_LOCATION=$VERTEX_LOCATION,VERTEX_MODEL=$VERTEX_MODEL"
            ;;
        service-b)
            gcloud run deploy "$service" \
                --source "$source_dir" \
                --region "$REGION" \
                --allow-unauthenticated \
                --min-instances 0 \
                --max-instances 5 \
                --port 8080 \
                --set-env-vars "ENVIRONMENT=$ENVIRONMENT,OPA_LOG_LEVEL=$OPA_LOG_LEVEL,OPA_LOG_FORMAT=$OPA_LOG_FORMAT"
            ;;
        service-c)
            gcloud run deploy "$service" \
                --source "$source_dir" \
                --region "$REGION" \
                --allow-unauthenticated \
                --min-instances 0 \
                --max-instances 5 \
                --set-secrets "TOOL_API_KEY=tool-api-key:latest"
            ;;
        envoy-gateway)
            gcloud run deploy "$service" \
                --source "$source_dir" \
                --region "$REGION" \
                --allow-unauthenticated \
                --min-instances 0 \
                --max-instances 5 \
                --port 8080 \
                --set-env-vars "^;^SERVICE_A_HOST=$SERVICE_A_HOST;SERVICE_A_PORT=$SERVICE_A_PORT;SERVICE_C_HOST=$SERVICE_C_HOST;SERVICE_C_PORT=$SERVICE_C_PORT;JWKS_URI=$JWKS_URI;UPSTREAM_TLS_SERVICE_A=$UPSTREAM_TLS_SERVICE_A;UPSTREAM_TLS_SERVICE_C=$UPSTREAM_TLS_SERVICE_C" \
                --set-secrets "TOOL_API_KEY=tool-api-key:latest"
            ;;
        judgment-ui|gov-ui)
            gcloud run deploy "$service" \
                --source "$source_dir" \
                --region "$REGION" \
                --allow-unauthenticated \
                --memory 512Mi \
                --set-env-vars "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
            ;;
        *)
            log_error "Unknown service: $service"
            return 1
            ;;
    esac

    log_info "$service deployed successfully!"
}

# Deploy all services
deploy_all() {
    local services=("service-b" "service-c" "service-a" "envoy-gateway")
    for svc in "${services[@]}"; do
        deploy_cloud_run "$svc"
    done
    log_info "All services deployed!"
}

# Local docker-compose operations
local_up() {
    log_info "Starting local environment with docker-compose..."
    cd "$PROJECT_ROOT"

    if [[ ! -f ".env.local" ]]; then
        log_warn ".env.local not found. Copying from .env.local.example..."
        cp .env.local.example .env.local
    fi

    docker-compose --env-file .env.local up -d --build
    log_info "Local environment started!"
    echo ""
    echo "Services:"
    echo "  service-a (Judgment): http://localhost:8080"
    echo "  service-b (PDP/OPA):  http://localhost:8181"
    echo "  service-c (Tool):     http://localhost:8082"
    echo "  envoy-gateway:        http://localhost:10000"
}

local_down() {
    log_info "Stopping local environment..."
    cd "$PROJECT_ROOT"
    docker-compose down
    log_info "Local environment stopped!"
}

# Show usage
usage() {
    echo "Usage: $0 <environment> [service|command]"
    echo ""
    echo "Environments:"
    echo "  prod    Deploy to Cloud Run (GCP)"
    echo "  local   Run locally with docker-compose"
    echo ""
    echo "Commands for 'prod':"
    echo "  service-a      Deploy service-a"
    echo "  service-b      Deploy service-b"
    echo "  service-c      Deploy service-c"
    echo "  envoy-gateway  Deploy envoy-gateway"
    echo "  judgment-ui    Deploy judgment-ui"
    echo "  gov-ui         Deploy gov-ui"
    echo "  all            Deploy all backend services"
    echo ""
    echo "Commands for 'local':"
    echo "  (none)         docker-compose up"
    echo "  down           docker-compose down"
    echo ""
    echo "Examples:"
    echo "  $0 prod service-a    # Deploy service-a to Cloud Run"
    echo "  $0 prod all          # Deploy all services"
    echo "  $0 local             # Start local environment"
    echo "  $0 local down        # Stop local environment"
}

# Main
main() {
    local env="${1:-}"
    local target="${2:-}"

    if [[ -z "$env" ]]; then
        usage
        exit 1
    fi

    case "$env" in
        prod)
            load_env "$PROJECT_ROOT/.env.prod"
            if [[ -z "$target" ]]; then
                log_error "Service name required for prod deployment"
                usage
                exit 1
            fi
            if [[ "$target" == "all" ]]; then
                deploy_all
            else
                deploy_cloud_run "$target"
            fi
            ;;
        local)
            if [[ "$target" == "down" ]]; then
                local_down
            else
                local_up
            fi
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            log_error "Unknown environment: $env"
            usage
            exit 1
            ;;
    esac
}

main "$@"
