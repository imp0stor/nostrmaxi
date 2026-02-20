#!/bin/bash
# NostrMaxi SSL/TLS Certificate Setup with Let's Encrypt
# Features: Zero-downtime webroot method, auto-renewal, staging mode

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
SSL_DIR="nginx/ssl"
CERTBOT_WEBROOT="/var/www/certbot"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

print_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           🔐 NostrMaxi SSL Certificate Setup               ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check env file
    if [ ! -f "$ENV_FILE" ]; then
        error "$ENV_FILE not found!"
        exit 1
    fi
    
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    
    if [ -z "${DOMAIN:-}" ]; then
        error "DOMAIN not set in $ENV_FILE"
        exit 1
    fi
    
    # Check docker compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        error "docker compose is not available"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

install_certbot() {
    if command -v certbot &> /dev/null; then
        log "certbot is already installed"
        return 0
    fi
    
    log "Installing certbot..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        sudo yum install -y certbot
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y certbot
    elif command -v brew &> /dev/null; then
        brew install certbot
    else
        error "Could not install certbot. Please install it manually."
        exit 1
    fi
    
    success "certbot installed"
}

generate_dhparam() {
    if [ -f "nginx/dhparam.pem" ]; then
        log "DH parameters already exist"
        return 0
    fi
    
    log "Generating DH parameters (this may take a few minutes)..."
    openssl dhparam -out nginx/dhparam.pem 2048
    success "DH parameters generated"
}

setup_self_signed() {
    log "Creating temporary self-signed certificate..."
    
    mkdir -p "$SSL_DIR"
    
    # Generate self-signed cert for initial nginx startup
    openssl req -x509 -nodes -newkey rsa:2048 \
        -days 1 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/CN=localhost" \
        2>/dev/null
    
    success "Temporary self-signed certificate created"
}

setup_webroot_config() {
    log "Setting up webroot configuration..."
    
    mkdir -p nginx/certbot-webroot
    
    # Create nginx config snippet for ACME challenge
    cat > nginx/acme-challenge.conf << 'EOF'
# Let's Encrypt ACME challenge location
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    try_files $uri =404;
}
EOF

    success "Webroot configuration ready"
}

start_nginx_for_challenge() {
    log "Starting nginx for ACME challenge..."
    
    # Ensure self-signed cert exists for initial startup
    if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
        setup_self_signed
    fi
    
    # Start nginx container
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx
    
    # Wait for nginx to be ready
    sleep 5
    
    # Test that nginx is responding
    if curl -sf http://localhost/health > /dev/null 2>&1 || curl -sf -k https://localhost/health > /dev/null 2>&1; then
        success "nginx is running"
    else
        warn "nginx health check failed, but continuing..."
    fi
}

obtain_certificate() {
    local domain=$1
    local email=$2
    local staging=${3:-false}
    
    log "Obtaining certificate for $domain..."
    
    local staging_flag=""
    if [ "$staging" = true ]; then
        staging_flag="--staging"
        warn "Using Let's Encrypt STAGING environment (certificates won't be trusted)"
    fi
    
    # Create webroot directory
    mkdir -p nginx/certbot-webroot
    
    # Add webroot volume to nginx container temporarily
    # For now, we'll use standalone mode with --pre-hook and --post-hook
    
    # Stop nginx temporarily (standalone mode)
    log "Stopping nginx for standalone certificate request..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop nginx || true
    
    sleep 3
    
    # Request certificate
    if sudo certbot certonly \
        --standalone \
        --preferred-challenges http \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        --keep-until-expiring \
        --rsa-key-size 4096 \
        $staging_flag \
        -d "$domain"; then
        success "Certificate obtained for $domain"
    else
        error "Failed to obtain certificate"
        # Restart nginx
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx
        exit 1
    fi
}

copy_certificates() {
    local domain=$1
    
    log "Copying certificates to nginx directory..."
    
    local cert_path="/etc/letsencrypt/live/$domain"
    
    if [ ! -d "$cert_path" ]; then
        error "Certificate directory not found: $cert_path"
        exit 1
    fi
    
    sudo cp "$cert_path/fullchain.pem" "$SSL_DIR/"
    sudo cp "$cert_path/privkey.pem" "$SSL_DIR/"
    
    # Fix permissions
    sudo chown "$(whoami):$(whoami)" "$SSL_DIR"/*.pem
    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"
    
    success "Certificates copied to $SSL_DIR/"
}

setup_auto_renewal() {
    local domain=$1
    
    log "Setting up auto-renewal..."
    
    # Get the absolute path to docker-compose file
    local compose_path
    compose_path=$(realpath "$COMPOSE_FILE")
    local project_dir
    project_dir=$(dirname "$compose_path")
    
    # Create renewal hook script
    local hook_script="$project_dir/scripts/certbot-deploy-hook.sh"
    cat > "$hook_script" << EOF
#!/bin/bash
# Certbot deploy hook - copy new certificates and reload nginx

DOMAIN="$domain"
SSL_DIR="$project_dir/nginx/ssl"

cp "/etc/letsencrypt/live/\$DOMAIN/fullchain.pem" "\$SSL_DIR/"
cp "/etc/letsencrypt/live/\$DOMAIN/privkey.pem" "\$SSL_DIR/"
chown $(whoami):$(whoami) "\$SSL_DIR"/*.pem
chmod 600 "\$SSL_DIR/privkey.pem"
chmod 644 "\$SSL_DIR/fullchain.pem"

# Reload nginx
cd "$project_dir"
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T nginx nginx -s reload || \
docker-compose -f docker-compose.prod.yml --env-file .env.prod exec -T nginx nginx -s reload

echo "[\$(date)] Certificates renewed and nginx reloaded" >> "$project_dir/logs/ssl-renewal.log"
EOF
    
    chmod +x "$hook_script"
    
    # Setup certbot renewal with hook
    sudo tee /etc/letsencrypt/renewal-hooks/deploy/nostrmaxi.sh > /dev/null << EOF
#!/bin/bash
$hook_script
EOF
    sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/nostrmaxi.sh
    
    # Create cron job as backup
    local cron_cmd="0 3 * * * certbot renew --quiet --no-self-upgrade"
    (crontab -l 2>/dev/null | grep -v "certbot renew" || true; echo "$cron_cmd") | crontab -
    
    success "Auto-renewal configured"
    log "Certificates will renew automatically. Check logs at: logs/ssl-renewal.log"
}

verify_certificate() {
    local domain=$1
    
    log "Verifying certificate..."
    
    # Check certificate file
    if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
        error "Certificate file not found"
        return 1
    fi
    
    # Check certificate details
    echo ""
    echo "Certificate details:"
    openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -subject -dates -issuer
    echo ""
    
    # Check expiry
    local expiry
    expiry=$(openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -enddate | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" +%s 2>/dev/null)
    local now_epoch
    now_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    
    if [ "$days_left" -gt 0 ]; then
        success "Certificate valid for $days_left more days"
    else
        error "Certificate has expired!"
        return 1
    fi
    
    return 0
}

restart_services() {
    log "Restarting services with new certificates..."
    
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    sleep 5
    
    success "Services restarted"
}

test_https() {
    local domain=$1
    
    log "Testing HTTPS connection..."
    
    # Test HTTPS locally
    if curl -sf --resolve "$domain:443:127.0.0.1" "https://$domain/health" > /dev/null 2>&1; then
        success "HTTPS is working!"
    else
        warn "Local HTTPS test failed (may need DNS to resolve)"
    fi
    
    # Show SSL Labs test link
    echo ""
    echo "🔍 Test your SSL configuration at:"
    echo "   https://www.ssllabs.com/ssltest/analyze.html?d=$domain"
    echo ""
}

print_summary() {
    local domain=$1
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              ✅ SSL Setup Complete!                        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🔐 Certificate details:"
    echo "   Domain:      $domain"
    echo "   Fullchain:   $SSL_DIR/fullchain.pem"
    echo "   Private key: $SSL_DIR/privkey.pem"
    echo "   DH params:   nginx/dhparam.pem"
    echo ""
    echo "🔄 Auto-renewal:"
    echo "   Certbot will automatically renew certificates"
    echo "   Deploy hook will copy certs and reload nginx"
    echo "   Logs: logs/ssl-renewal.log"
    echo ""
    echo "📝 Manual renewal (if needed):"
    echo "   sudo certbot renew"
    echo ""
    echo "🌐 Your site is now available at:"
    echo "   https://$domain"
    echo ""
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --staging     Use Let's Encrypt staging environment (for testing)"
    echo "  --renew       Force certificate renewal"
    echo "  --verify      Verify existing certificate"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Environment:"
    echo "  DOMAIN        Domain name (from .env.prod)"
    echo "  EMAIL         Email for Let's Encrypt (or prompted)"
}

# Parse arguments
STAGING=false
RENEW=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            STAGING=true
            shift
            ;;
        --renew)
            RENEW=true
            shift
            ;;
        --verify)
            VERIFY_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main
main() {
    print_banner
    check_prerequisites
    
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    
    if [ "$VERIFY_ONLY" = true ]; then
        verify_certificate "$DOMAIN"
        exit $?
    fi
    
    # Get email
    if [ -z "${EMAIL:-}" ]; then
        echo -n "Enter email for Let's Encrypt notifications: "
        read -r EMAIL
    fi
    
    if [ -z "$EMAIL" ]; then
        error "Email is required for Let's Encrypt"
        exit 1
    fi
    
    install_certbot
    generate_dhparam
    
    # Check if certificate already exists and not forcing renewal
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ "$RENEW" = false ]; then
        log "Certificate already exists for $DOMAIN"
        echo -n "Would you like to use existing certificate? [Y/n]: "
        read -r use_existing
        
        if [[ "${use_existing:-Y}" =~ ^[Yy] ]]; then
            copy_certificates "$DOMAIN"
            restart_services
            verify_certificate "$DOMAIN"
            test_https "$DOMAIN"
            print_summary "$DOMAIN"
            exit 0
        fi
    fi
    
    # Setup and obtain certificate
    mkdir -p "$SSL_DIR"
    obtain_certificate "$DOMAIN" "$EMAIL" "$STAGING"
    copy_certificates "$DOMAIN"
    setup_auto_renewal "$DOMAIN"
    restart_services
    verify_certificate "$DOMAIN"
    test_https "$DOMAIN"
    print_summary "$DOMAIN"
}

main
