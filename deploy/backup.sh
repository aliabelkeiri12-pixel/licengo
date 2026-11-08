#!/bin/sh
# Sauvegarde chiffrée (GPG AES-256) de la base et des documents, quotidienne à BACKUP_HOUR (UTC), rétention 30 jours.
# En production : synchroniser /backups vers un bucket d'une autre région UE (rclone / aws s3 sync).
set -eu
backup() {
  TS=$(date +%Y%m%d-%H%M)
  pg_dump -h "${PGHOST:-db}" -U licengo -Fc licengo | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "/backups/db-$TS.dump.gpg"
  tar -C /data -cz storage | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "/backups/documents-$TS.tgz.gpg"
  find /backups -type f -mtime +30 -delete
  echo "backup $TS ok"
}
[ "${1:-}" = "--now" ] && { backup; exit 0; }
LAST=""
while true; do
  if [ "$(date +%H)" = "${BACKUP_HOUR:-01}" ] && [ "$LAST" != "$(date +%F)" ]; then backup && LAST=$(date +%F); fi
  sleep 300
done
