#!/bin/bash
# Continuous monitoring script for NostrMaxi

set -e

DOMAIN="${1:-localhost}"
CHECK_INTERVAL="${2:-300}"  # 5 minutes default
LOG_FILE="logs/monitor.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create log directory
mkdir -p logs

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    local message="$1"
    log "ALERT: $message"
    # Add notification here (email, telegram, etc.)
    # Example: curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    #   -d "chat_id=$CHAT_ID" -d "text=$message"
}

check_health() {
    if curl -f -s "http://$DOMAIN/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_disk() {
    local usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        alert "Disk usage critical: ${usage}%"
        return 1
    elif [ "$usage" -gt 75 ]; then
        log "Warning: Disk usage at ${usage}%"
    fi
    return 0
}

check_memory() {
    local available=$(free -m | grep Mem | awk '{print $7}')
    if [ "$available" -lt 200 ]; then
        alert "Low memory: ${available}MB available"
        return 1
    fi
    return 0
}

check_docker() {
    local unhealthy=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    if [ "$unhealthy" -gt 0 ]; then
        local containers=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | tr '\n' ', ')
        alert "Unhealthy containers: $containers"
        return 1
    fi
    return 0
}

check_database() {
    if docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U nostrmaxi > /dev/null 2>&1; then
        return 0
    else
        alert "Database not responding!"
        return 1
    fi
}

check_ssl() {
    if [ "$DOMAIN" != "localhost" ]; then
        local expiry=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | \
                      openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        
        if [ -n "$expiry" ]; then
            local days_left=$(( ( $(date -d "$expiry" +%s) - $(date +%s) ) / 86400 ))
            
            if [ "$days_left" -lt 7 ]; then
                alert "SSL certificate expires in $days_left days!"
            elif [ "$days_left" -lt 30 ]; then
                log "Warning: SSL certificate expires in $days_left days"
            fi
        else
            alert "Could not check SSL certificate"
            return 1
        fi
    fi
    return 0
}

check_logs() {
    # Check for recent errors in backend logs
    local errors=$(docker-compose -f docker-compose.prod.yml logs --since 5m backend 2>/dev/null | grep -ci error || true)
    
    if [ "$errors" -gt 10 ]; then
        alert "High error rate detected: $errors errors in last 5 minutes"
        return 1
    fi
    return 0
}

# Main monitoring loop
log "Starting monitor for $DOMAIN (check interval: ${CHECK_INTERVAL}s)"

while true; do
    STATUS="✓"
    FAILED=0
    
    # Run all checks
    check_health || { STATUS="✗"; FAILED=$((FAILED+1)); }
    check_disk || FAILED=$((FAILED+1))
    check_memory || FAILED=$((FAILED+1))
    check_docker || FAILED=$((FAILED+1))
    check_database || FAILED=$((FAILED+1))
    check_ssl || FAILED=$((FAILED+1))
    check_logs || FAILED=$((FAILED+1))
    
    if [ $FAILED -eq 0 ]; then
        log "All checks passed $STATUS"
    else
        log "Some checks failed ($FAILED failures)"
    fi
    
    sleep "$CHECK_INTERVAL"
done
