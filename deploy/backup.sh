#!/bin/sh
# Sauvegarde quotidienne chiffrée (GPG AES-256) de la base et des documents, rétention 30 jours.
# En production : synchroniser /backups vers un bucket objet d'une autre région UE (rclone / aws s3 sync).
set -eu
TS=$(date +%Y%m%d-%H%M)
pg_dump -h db -U licengo -Fc licengo | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "/backups/db-$TS.dump.gpg"
tar -C /data -cz storage | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "/backups/documents-$TS.tgz.gpg"
find /backups -type f -mtime +30 -delete
echo "backup $TS ok"
