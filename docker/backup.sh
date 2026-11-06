#!/bin/sh
# Back up the TravelTrace database and original photo files.
#
#   ./docker/backup.sh [output-directory]
#
# Restore with:
#   docker compose exec -T db pg_restore -U traveltrace -d traveltrace --clean --if-exists < backup.dump
#   docker compose exec -T backend tar -C /data -xf - < traveltrace-uploads.tar
set -eu

OUTPUT=${1:-backups}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUTPUT"

echo "Dumping PostgreSQL…"
docker compose exec -T db pg_dump -U traveltrace -d traveltrace -Fc \
    > "$OUTPUT/traveltrace-db-$STAMP.dump"

echo "Archiving uploaded originals…"
docker compose exec -T backend tar -C /data -cf - uploads \
    > "$OUTPUT/traveltrace-uploads-$STAMP.tar"

echo "Backups written:"
ls -lh "$OUTPUT"/traveltrace-*"$STAMP"*
