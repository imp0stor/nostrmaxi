#!/bin/bash
# NostrMaxi Database Backup Script
# Features: Retention policies, integrity verification, optional remote upload

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-6}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Database config (from environment)
DB_HOST="${PGHOST:-db}"
DB_USER="${POSTGRES_USER:-nostrmaxi}"
DB_NAME="${POSTGRES_DB:-nostrmaxi}"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
}

# Determine backup type based on schedule
get_backup_type() {
    if [ "$DAY_OF_MONTH" = "01" ]; then
        echo "monthly"
    elif [ "$DAY_OF_WEEK" = "7" ]; then
        echo "weekly"
    else
        echo "daily"
    fi
}

# Wait for database to be ready
wait_for_db() {
    local retries=30
    local wait_time=2
    
    log "Waiting for database to be ready..."
    
    for ((i=1; i<=retries; i++)); do
        if pg_isready -h "$DB_HOST" -U "$DB_USER" -q; then
            log "Database is ready"
            return 0
        fi
        log "Attempt $i/$retries: Database not ready, waiting ${wait_time}s..."
        sleep $wait_time
    done
    
    error "Database failed to become ready after $((retries * wait_time))s"
    return 1
}

# Create backup
create_backup() {
    local backup_type=$1
    local backup_file="${BACKUP_DIR}/nostrmaxi_${backup_type}_${TIMESTAMP}.sql.gz"
    local checksum_file="${backup_file}.sha256"
    
    log "Creating $backup_type backup: $backup_file"
    
    # Create backup with pg_dump
    if ! pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --format=plain \
        2>/dev/null | gzip -9 > "$backup_file"; then
        error "pg_dump failed"
        rm -f "$backup_file"
        return 1
    fi
    
    # Verify backup was created
    if [ ! -f "$backup_file" ]; then
        error "Backup file was not created"
        return 1
    fi
    
    # Check file size
    local size=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null)
    if [ "$size" -lt 100 ]; then
        error "Backup file is too small ($size bytes), likely empty"
        rm -f "$backup_file"
        return 1
    fi
    
    # Create checksum
    sha256sum "$backup_file" > "$checksum_file"
    
    log "Backup created: $backup_file ($size bytes)"
    echo "$backup_file"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    local checksum_file="${backup_file}.sha256"
    
    log "Verifying backup integrity..."
    
    # Verify checksum
    if [ -f "$checksum_file" ]; then
        if sha256sum -c "$checksum_file" --quiet 2>/dev/null; then
            log "Checksum verification passed"
        else
            error "Checksum verification failed"
            return 1
        fi
    fi
    
    # Verify gzip integrity
    if gzip -t "$backup_file" 2>/dev/null; then
        log "Gzip integrity check passed"
    else
        error "Gzip integrity check failed"
        return 1
    fi
    
    # Verify SQL content (basic check)
    if gunzip -c "$backup_file" | head -100 | grep -q "PostgreSQL database dump"; then
        log "SQL content verification passed"
    else
        error "SQL content verification failed"
        return 1
    fi
    
    log "Backup verification complete"
    return 0
}

# Clean old backups based on retention policy
cleanup_backups() {
    log "Cleaning up old backups..."
    
    local deleted=0
    
    # Clean daily backups older than RETENTION_DAYS
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            rm -f "$file" "${file}.sha256"
            log "Deleted old daily backup: $(basename "$file")"
            deleted=$((deleted + 1))
        fi
    done < <(find "$BACKUP_DIR" -name "nostrmaxi_daily_*.sql.gz" -mtime +"$RETENTION_DAYS" 2>/dev/null)
    
    # Clean weekly backups older than RETENTION_WEEKLY weeks
    local weekly_days=$((RETENTION_WEEKLY * 7))
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            rm -f "$file" "${file}.sha256"
            log "Deleted old weekly backup: $(basename "$file")"
            deleted=$((deleted + 1))
        fi
    done < <(find "$BACKUP_DIR" -name "nostrmaxi_weekly_*.sql.gz" -mtime +"$weekly_days" 2>/dev/null)
    
    # Clean monthly backups older than RETENTION_MONTHLY months
    local monthly_days=$((RETENTION_MONTHLY * 30))
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            rm -f "$file" "${file}.sha256"
            log "Deleted old monthly backup: $(basename "$file")"
            deleted=$((deleted + 1))
        fi
    done < <(find "$BACKUP_DIR" -name "nostrmaxi_monthly_*.sql.gz" -mtime +"$monthly_days" 2>/dev/null)
    
    log "Cleanup complete: $deleted backups deleted"
}

# List current backups
list_backups() {
    log "Current backups in $BACKUP_DIR:"
    echo ""
    echo "Type    | Date       | Time   | Size"
    echo "--------|------------|--------|--------"
    
    for backup in "$BACKUP_DIR"/nostrmaxi_*.sql.gz; do
        if [ -f "$backup" ]; then
            local name=$(basename "$backup")
            local type=$(echo "$name" | cut -d'_' -f2)
            local datetime=$(echo "$name" | cut -d'_' -f3-4 | sed 's/.sql.gz//')
            local date=$(echo "$datetime" | cut -c1-8 | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/')
            local time=$(echo "$datetime" | cut -c10-15 | sed 's/\(..\)\(..\)\(..\)/\1:\2:\3/')
            local size=$(du -h "$backup" | cut -f1)
            printf "%-7s | %-10s | %-6s | %s\n" "$type" "$date" "$time" "$size"
        fi
    done
    echo ""
}

# Upload to remote storage (optional)
upload_remote() {
    local backup_file=$1
    
    # S3 upload (if AWS CLI and bucket configured)
    if command -v aws &> /dev/null && [ -n "${S3_BUCKET:-}" ]; then
        log "Uploading to S3: s3://${S3_BUCKET}/backups/"
        if aws s3 cp "$backup_file" "s3://${S3_BUCKET}/backups/" --quiet; then
            log "S3 upload complete"
        else
            error "S3 upload failed"
        fi
    fi
    
    # Restic backup (if configured)
    if command -v restic &> /dev/null && [ -n "${RESTIC_REPOSITORY:-}" ]; then
        log "Running restic backup..."
        if restic backup "$backup_file" --quiet; then
            log "Restic backup complete"
        else
            error "Restic backup failed"
        fi
    fi
}

# Health check - report backup status
health_check() {
    local latest=$(ls -t "$BACKUP_DIR"/nostrmaxi_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$latest" ]; then
        error "No backups found!"
        return 1
    fi
    
    # Check age of latest backup
    local age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest" 2>/dev/null || stat -f%m "$latest" 2>/dev/null)) / 3600 ))
    
    if [ "$age_hours" -gt 24 ]; then
        error "Latest backup is $age_hours hours old (threshold: 24h)"
        return 1
    fi
    
    log "Backup health OK: Latest backup is $age_hours hours old"
    return 0
}

# Print usage
usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  backup    Create a new backup (default)"
    echo "  verify    Verify the latest backup"
    echo "  list      List all backups"
    echo "  cleanup   Clean up old backups"
    echo "  health    Check backup health status"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_DIR          Backup directory (default: /backups)"
    echo "  RETENTION_DAYS      Daily backup retention (default: 7)"
    echo "  RETENTION_WEEKLY    Weekly backup retention in weeks (default: 4)"
    echo "  RETENTION_MONTHLY   Monthly backup retention in months (default: 6)"
    echo "  S3_BUCKET           Optional S3 bucket for remote backup"
    echo "  RESTIC_REPOSITORY   Optional restic repository"
}

# Main
main() {
    local command="${1:-backup}"
    
    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"
    
    case "$command" in
        backup)
            wait_for_db
            
            local backup_type=$(get_backup_type)
            local backup_file
            backup_file=$(create_backup "$backup_type")
            
            if verify_backup "$backup_file"; then
                cleanup_backups
                upload_remote "$backup_file"
                log "Backup process completed successfully"
                exit 0
            else
                error "Backup verification failed"
                exit 1
            fi
            ;;
        verify)
            local latest=$(ls -t "$BACKUP_DIR"/nostrmaxi_*.sql.gz 2>/dev/null | head -1)
            if [ -z "$latest" ]; then
                error "No backups found to verify"
                exit 1
            fi
            verify_backup "$latest"
            ;;
        list)
            list_backups
            ;;
        cleanup)
            cleanup_backups
            ;;
        health)
            health_check
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
