#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/ferdavs/backups/postgres"
LOG_FILE="/home/ferdavs/backups/backup.log"
LOCK_FILE="/tmp/duda_backup.lock"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/neverpaid_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Prevent concurrent backup runs
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another backup process is already running. Exiting." >> "$LOG_FILE"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup..." >> "$LOG_FILE"

# Dump all PostgreSQL databases and compress on the fly with gzip
if docker exec neverpaid-postgres pg_dumpall -U neverpaid | gzip > "$BACKUP_FILE"; then
    FILE_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo 0)
    
    # Sanity check: compressed dump must be at least 10KB
    if [ "$FILE_SIZE" -lt 10240 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ ERROR: Backup file is suspiciously small (${FILE_SIZE} bytes). Keeping it for inspection." >> "$LOG_FILE"
        exit 1
    fi
    
    HUMAN_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup created successfully: ${BACKUP_FILE} (${HUMAN_SIZE})" >> "$LOG_FILE"
    
    # Retention policy: remove backup archives older than 14 days
    DELETED_COUNT=$(find "$BACKUP_DIR" -type f -name "neverpaid_backup_*.sql.gz" -mtime +14 | wc -l)
    find "$BACKUP_DIR" -type f -name "neverpaid_backup_*.sql.gz" -mtime +14 -delete
    TOTAL_RETAINED=$(ls -1 "$BACKUP_DIR"/neverpaid_backup_*.sql.gz 2>/dev/null | wc -l)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 Retention cleanup: deleted ${DELETED_COUNT} old archives. Total retained backups: ${TOTAL_RETAINED}" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Failed to execute pg_dumpall!" >> "$LOG_FILE"
    exit 1
fi
