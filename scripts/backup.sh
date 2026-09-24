#!/usr/bin/env bash
# Backup diario de un club: dump de MariaDB + carpeta recursos/.
#
# Corre en el VPS (host), no en el contenedor. Lee la conexión del .env del club
# (DATABASE_URL; host.docker.internal se reemplaza por 127.0.0.1 porque MariaDB
# está en el mismo host).
#
#   scripts/backup.sh [carpeta-del-club]      # default: carpeta actual
#
# Variables opcionales (en el .env del club o en el entorno):
#   BACKUP_DIR              destino local            (default: <club>/backups)
#   BACKUP_RETENTION_DAYS   días que se conservan    (default: 14)
#   BACKUP_RCLONE_REMOTE    copia fuera del VPS con rclone, p. ej. b2:clubes-backups/defensores
#
# Cron (todos los días a las 4:15, ver deploy.md):
#   15 4 * * * /home/deploy/defensores/scripts/backup.sh /home/deploy/defensores >> /home/deploy/defensores/backups/backup.log 2>&1
#
# Restaurar: ver deploy.md, sección Backups.
set -euo pipefail

CLUB_DIR="$(cd "${1:-.}" && pwd)"
ENV_FILE="$CLUB_DIR/.env"

env_value() {
  # Lee KEY del .env sin ejecutarlo (sin source: el .env no es un script)
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  # "|| true": una clave ausente no debe cortar el script (set -e + pipefail)
  { grep -E "^[[:space:]]*${key}=" "$ENV_FILE" || true; } | tail -n 1 | cut -d= -f2- \
    | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

DATABASE_URL="${DATABASE_URL:-$(env_value DATABASE_URL)}"
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$CLUB_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-$(env_value BACKUP_RETENTION_DAYS)}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-$(env_value BACKUP_RCLONE_REMOTE)}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: falta DATABASE_URL (en $ENV_FILE o en el entorno)" >&2
  exit 1
fi

# mysql://usuario:clave@host:puerto/base
url="${DATABASE_URL#*://}"
creds="${url%%@*}"
hostpart="${url#*@}"
DB_USER="${creds%%:*}"
DB_PASS=""
[ "$creds" != "$DB_USER" ] && DB_PASS="${creds#*:}"
DB_NAME="${hostpart#*/}"
DB_NAME="${DB_NAME%%\?*}"
hostport="${hostpart%%/*}"
DB_HOST="${hostport%%:*}"
DB_PORT="3306"
[ "$hostport" != "$DB_HOST" ] && DB_PORT="${hostport#*:}"
[ "$DB_HOST" = "host.docker.internal" ] && DB_HOST="127.0.0.1"

DUMP_BIN="$(command -v mariadb-dump || command -v mysqldump || true)"
if [ -z "$DUMP_BIN" ]; then
  echo "ERROR: no se encontró mariadb-dump ni mysqldump" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Credenciales en un archivo temporal (no en la línea de comandos: se verían en ps)
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CNF"

DB_FILE="$BACKUP_DIR/db-$DB_NAME-$STAMP.sql.gz"
"$DUMP_BIN" --defaults-extra-file="$CNF" --single-transaction --quick --routines --triggers \
  --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$DB_FILE.tmp"
mv "$DB_FILE.tmp" "$DB_FILE"
echo "$(date -Is) base: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

if [ -d "$CLUB_DIR/recursos" ]; then
  FILES_FILE="$BACKUP_DIR/recursos-$STAMP.tar.gz"
  tar -czf "$FILES_FILE" -C "$CLUB_DIR" recursos
  echo "$(date -Is) recursos: $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1))"
fi

# Retención local
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'recursos-*.tar.gz' \) \
  -mtime +"$RETENTION_DAYS" -print -delete

# Copia fuera del VPS (el backup que vive solo en el VPS no protege de perderlo)
if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include 'db-*.sql.gz' --include 'recursos-*.tar.gz' --max-age 25h
  rclone delete "$RCLONE_REMOTE" --min-age "${RETENTION_DAYS}d" --include 'db-*.sql.gz' --include 'recursos-*.tar.gz'
  echo "$(date -Is) copiado a $RCLONE_REMOTE"
fi
