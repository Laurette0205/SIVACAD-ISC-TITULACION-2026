#!/bin/bash
# SIVACAD-ISC — Script de backup automático de MySQL
# Uso: bash scripts/backup.sh
# Cron: 0 2 * * * /path/to/backend/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="C:/Xampp/htdocs/SIVACAD-ISC/backups"
MYSQL_BIN="C:/xampp/mysql/bin/mysqldump.exe"
DB_NAME="sivacad_isc"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sivacad_isc_${TIMESTAMP}.sql"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Dump completo
"$MYSQL_BIN" -u root "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null

# Comprimir
gzip "$BACKUP_FILE"

echo "[$(date)] Backup completado: ${BACKUP_FILE}.gz"

# Limpiar backups de más de 30 días
find "$BACKUP_DIR" -name "sivacad_isc_*.sql.gz" -mtime +30 -delete 2>/dev/null

echo "[$(date)] Backups antiguos (>30 días) eliminados."
