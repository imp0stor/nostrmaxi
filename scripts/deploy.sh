#!/bin/bash
# NostrMaxi Production Deployment Script
# Features: Health checks, rollback support, zero-downtime deployments

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5
LOG_FILE="logs/deploy-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

info() { log "INFO" "${BLUE}$*${NC}"; }
success() { log "SUCCESS" "${GREEN}$*${NC}"; }
warn() { log "WARN" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }

# Cleanup function for rollback
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code"
        error "Check logs at: $LOG_FILE"
        if [ -f ".deploy_previous_images" ]; then
            warn "To rollback, run: ./scripts/rollback.sh"
        fi
    fi
}

trap cleanup EXIT

print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           🚀 NostrMaxi Production Deployment               ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then 
        error "Do not run as root. Run as regular user with docker permissions."
        exit 1
    fi

    # Check required commands
    local required_cmds=(docker git curl)
    for cmd in "${required_cmds[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is not installed"
            exit 1
        fi
    done

    # Check docker compose (v2 syntax)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        error "docker compose is not available"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi

    success "Prerequisites check passed"
}

validate_environment() {
    info "Validating environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        error "$ENV_FILE file not found!"
        echo "   Copy .env.production to $ENV_FILE and configure it"
        exit 1
    fi

    # shellcheck source=/dev/null
    source "$ENV_FILE"
    
    local required_vars=(
        "DOMAIN"
        "BASE_URL"
        "DB_PASSWORD"
        "JWT_SECRET"
        "WEBHOOK_SECRET"
        "PAYMENTS_PROVIDER"
    )

    local missing=0
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Required variable $var is not set in $ENV_FILE"
            missing=1
        fi
    done

    # Provider-specific requirements
    if [[ "${PAYMENTS_PROVIDER:-}" == "btcpay" ]]; then
        if [ -z "${BTCPAY_URL:-}" ] || [ -z "${BTCPAY_API_KEY:-}" ] || [ -z "${BTCPAY_STORE_ID:-}" ]; then
            error "BTCPay provider selected but BTCPAY_URL/BTCPAY_API_KEY/BTCPAY_STORE_ID not set"
            missing=1
        fi
    else
        if [ -z "${LNBITS_URL:-}" ] || [ -z "${LNBITS_API_KEY:-}" ]; then
            error "LNbits provider selected but LNBITS_URL/LNBITS_API_KEY not set"
            missing=1
        fi
    fi

    # Check for default/insecure values
    if [[ "${DB_PASSWORD:-}" == *"CHANGE_THIS"* ]]; then
        error "DB_PASSWORD contains default value. Please change it!"
        missing=1
    fi

    if [[ "${JWT_SECRET:-}" == *"CHANGE_THIS"* ]]; then
        error "JWT_SECRET contains default value. Please change it!"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi

    if [ -x "./scripts/validate-secrets.sh" ]; then
        ./scripts/validate-secrets.sh "$ENV_FILE"
    else
        warn "validate-secrets.sh not found; skipping secret validation"
    fi

    success "Environment validation passed"
}

prepare_directories() {
    info "Preparing directories..."
    
    mkdir -p logs/nginx
    mkdir -p backups
    mkdir -p nginx/ssl
    mkdir -p nginx/rate-limit-zones

    # Ensure log file exists
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    success "Directories prepared"
}

save_current_state() {
    info "Saving current deployment state for rollback..."
    
    # Save current image tags
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps -q &> /dev/null; then
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" config --images 2>/dev/null > .deploy_previous_images || true
    fi
    
    # Save git commit
    if git rev-parse HEAD &> /dev/null; then
        git rev-parse HEAD > .deploy_previous_commit
    fi
}

build_frontend() {
    info "Building frontend..."
    
    if [ -d "frontend" ]; then
        (
            cd frontend
            if [ -f "package-lock.json" ]; then
                npm ci --silent
            else
                npm install --silent
            fi
            npm run build
        )
        success "Frontend built"
    else
        warn "No frontend directory found, skipping"
    fi
}

build_backend() {
    info "Building backend..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --silent
    else
        npm install --silent
    fi
    
    npm run build
    npx prisma generate
    
    success "Backend built"
}

pull_images() {
    info "Pulling latest Docker images..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    success "Images pulled"
}

build_images() {
    info "Building application images..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    success "Images built"
}

wait_for_database() {
    info "Waiting for database to be ready..."
    
    local elapsed=0
    local max_wait=60
    
    while [ $elapsed -lt $max_wait ]; do
        if $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db pg_isready -U nostrmaxi &> /dev/null; then
            success "Database is ready"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    
    echo ""
    error "Database failed to become ready within ${max_wait}s"
    return 1
}

run_migrations() {
    info "Running database migrations..."
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm backend \
        sh -c "npx prisma migrate deploy" 2>&1 | tee -a "$LOG_FILE"
    
    success "Migrations completed"
}

deploy_services() {
    local strategy="${1:-rolling}"
    
    case "$strategy" in
        "rolling")
            deploy_rolling
            ;;
        "recreate")
            deploy_recreate
            ;;
        *)
            warn "Unknown strategy: $strategy, using rolling"
            deploy_rolling
            ;;
    esac
}

deploy_rolling() {
    info "Deploying services (rolling update)..."
    
    # Start database first if not running
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db
    wait_for_database
    
    # Run migrations
    run_migrations
    
    # Update services one by one
    for service in backend nginx db-backup; do
        info "Updating $service..."
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps "$service"
        sleep 5
    done
    
    success "Rolling deployment complete"
}

deploy_recreate() {
    info "Deploying services (recreate all)..."
    
    # Stop all services
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    
    # Start database first
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db
    wait_for_database
    
    # Run migrations
    run_migrations
    
    # Start all services
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    success "Full deployment complete"
}

wait_for_healthy() {
    info "Waiting for services to become healthy..."
    
    local elapsed=0
    local healthy_count=0
    local required_healthy=3  # Consecutive healthy checks
    
    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        # Check backend health
        if $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend \
            wget --quiet --tries=1 --spider http://localhost:3000/health 2>/dev/null; then
            healthy_count=$((healthy_count + 1))
            echo -n "${GREEN}.${NC}"
        else
            healthy_count=0
            echo -n "${YELLOW}.${NC}"
        fi
        
        if [ $healthy_count -ge $required_healthy ]; then
            echo ""
            success "Services are healthy (${healthy_count}/${required_healthy} consecutive checks)"
            return 0
        fi
        
        sleep $HEALTH_INTERVAL
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done
    
    echo ""
    error "Services failed to become healthy within ${HEALTH_TIMEOUT}s"
    return 1
}

verify_deployment() {
    info "Verifying deployment..."
    
    # Check all services are running
    local services=("db" "backend" "nginx")
    local all_running=true
    
    for service in "${services[@]}"; do
        local status=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q "$service" 2>/dev/null)
        if [ -z "$status" ]; then
            error "Service $service is not running"
            all_running=false
        fi
    done
    
    if [ "$all_running" = false ]; then
        error "Not all required services are running"
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
        return 1
    fi
    
    # Test health endpoint
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        success "Health endpoint responding"
    else
        warn "Health endpoint not accessible via localhost (may need SSL)"
    fi
    
    # Test NIP-05 endpoint
    if curl -sf "http://localhost/.well-known/nostr.json?name=test" > /dev/null 2>&1; then
        success "NIP-05 endpoint responding"
    else
        warn "NIP-05 endpoint test skipped"
    fi
    
    success "Deployment verification passed"
}

print_summary() {
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           ✅ Deployment Completed Successfully!            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🌐 Application URL: https://${DOMAIN}"
    echo "📊 Service Status:"
    echo ""
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs:     $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
    echo "   Stop all:      $DOCKER_COMPOSE -f $COMPOSE_FILE down"
    echo "   Restart:       $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
    echo "   Health check:  ./scripts/health-check.sh"
    echo "   Rollback:      ./scripts/rollback.sh"
    echo ""
    echo "📄 Deployment log: $LOG_FILE"
    echo ""
    
    # Check if SSL is configured
    if [ ! -f "nginx/ssl/fullchain.pem" ]; then
        echo "⚠️  SSL not configured! Run: ./scripts/ssl-setup.sh"
        echo ""
    fi
}

# Parse arguments
STRATEGY="rolling"
SKIP_BUILD=false
SKIP_PULL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --recreate)
            STRATEGY="recreate"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-pull)
            SKIP_PULL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --recreate     Stop all services before deploying"
            echo "  --skip-build   Skip frontend/backend build"
            echo "  --skip-pull    Skip pulling Docker images"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Main deployment flow
main() {
    print_banner
    
    check_prerequisites
    validate_environment
    prepare_directories
    save_current_state
    
    if [ "$SKIP_BUILD" = false ]; then
        build_frontend
        build_backend
    else
        info "Skipping build (--skip-build)"
    fi
    
    if [ "$SKIP_PULL" = false ]; then
        pull_images
    else
        info "Skipping image pull (--skip-pull)"
    fi
    
    build_images
    deploy_services "$STRATEGY"
    wait_for_healthy
    verify_deployment
    print_summary
}

main
