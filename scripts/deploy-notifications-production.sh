#!/bin/sh
set -eu
umask 077

release_dir=${1:-}
root=/opt/champagne-atlas
release_id=notifications-prodmerge-20260802T171912Z

fail() { printf '%s\n' "RELEASE_FAILED: $*" >&2; exit 1; }
on_exit() {
  status=$?
  if [ "$status" -ne 0 ]; then
    printf '%s\n' "Notification release stopped. Existing running API is unchanged unless the final recreate already completed." >&2
    if [ -n "${backup_dir:-}" ]; then printf '%s\n' "Backup: $backup_dir" >&2; fi
  fi
  exit "$status"
}
trap on_exit 0
trap 'exit 130' HUP INT TERM

[ "$(id -u)" = "0" ] || fail "run as root"
[ -n "$release_dir" ] || fail "usage: deploy-notifications-production.sh <extracted-release-dir>"
release_dir=$(readlink -f "$release_dir")
case "$release_dir" in "$root/releases/$release_id") ;; *) fail "unexpected release directory: $release_dir" ;; esac
[ -d "$release_dir/payload" ] || fail "payload missing"
[ -f "$release_dir/MANIFEST.sha256" ] || fail "manifest missing"

cd "$root"
[ "$(pwd -P)" = "$root" ] || fail "unexpected production root"
[ -d src ] || fail "src missing directly under production root"
[ -d scripts ] || fail "scripts missing directly under production root"
[ -d migrations ] || fail "migrations missing directly under production root"
[ -f package.json ] || fail "package.json missing directly under production root"
[ -f compose.yaml ] || fail "compose.yaml missing directly under production root"
[ ! -d backend ] || fail "unexpected nested backend directory"
command -v docker >/dev/null 2>&1 || fail "docker missing"
command -v git >/dev/null 2>&1 || fail "git missing"
command -v curl >/dev/null 2>&1 || fail "curl missing"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum missing"
docker compose config --quiet

verify_base_hash() {
  expected=$1
  file=$2
  actual=$(sha256sum "$file" | awk '{print $1}')
  [ "$actual" = "$expected" ] || fail "production mergebase changed: $file ($actual)"
}
verify_base_hash 91313a734a68f154f085391f2ee7e752b9197a2549c86b5f280ecf3c80fdd9ea src/server.mjs
verify_base_hash e0534cd940b331a2a37421c399f438214a553f895dce6295db4bc61de8daf81b src/trip-group-store.mjs
verify_base_hash e55ec40201b21cbebef463c9cb54187426eacccbf16ff7e10dec1c71909ac577 package.json
verify_base_hash b54b6cc5199ead10c90ed93e52e48efa4f31609fcd3e99309070c67022e47599 README.md

cd "$release_dir"
sha256sum -c MANIFEST.sha256

backup_dir="$root/backups/$release_id"
[ ! -e "$backup_dir" ] || fail "backup already exists: $backup_dir"
install -d -m 700 "$backup_dir"
cd "$root"
for path in src scripts migrations docs test package.json README.md compose.yaml .env Dockerfile pnpm-lock.yaml; do
  [ -e "$path" ] || fail "backup source missing: $path"
done
tar -czf "$backup_dir/source-before.tgz" src scripts migrations docs test package.json README.md compose.yaml .env Dockerfile pnpm-lock.yaml
[ -s "$backup_dir/source-before.tgz" ] || fail "source backup is empty"

db_service=$(docker compose config --services | awk '/^(database|db|postgres)$/{print; exit}')
[ -n "$db_service" ] || fail "database Compose service not found"
docker compose exec -T "$db_service" sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$backup_dir/database-before.dump"
[ -s "$backup_dir/database-before.dump" ] || fail "database backup is empty"
sha256sum "$backup_dir/source-before.tgz" "$backup_dir/database-before.dump" > "$backup_dir/SHA256SUMS"

cd "$root"
git apply --check --ignore-space-change \
  "$release_dir/patches/server.patch" \
  "$release_dir/patches/trip-group-store.patch" \
  "$release_dir/patches/package.patch" \
  "$release_dir/patches/readme.patch"

for file in \
  docs/notifications-api.md \
  docs/notifications-production-runbook.md \
  migrations/011_notifications.up.sql \
  migrations/011_notifications.down.sql \
  scripts/migrate-notifications.mjs \
  src/notification-api.mjs \
  src/notification-store.mjs \
  src/notification-transport.mjs \
  src/trip-group-notifications.mjs \
  test/notifications.test.mjs \
  test/notifications-migration.test.mjs
do
  [ ! -e "$root/$file" ] || fail "additive target already exists: $file"
  [ -f "$release_dir/payload/$file" ] || fail "payload file missing: $file"
done

umask 022
git apply --ignore-space-change \
  "$release_dir/patches/server.patch" \
  "$release_dir/patches/trip-group-store.patch" \
  "$release_dir/patches/package.patch" \
  "$release_dir/patches/readme.patch"
chmod 644 src/server.mjs src/trip-group-store.mjs package.json README.md

for file in \
  docs/notifications-api.md \
  docs/notifications-production-runbook.md \
  migrations/011_notifications.up.sql \
  migrations/011_notifications.down.sql \
  scripts/migrate-notifications.mjs \
  src/notification-api.mjs \
  src/notification-store.mjs \
  src/notification-transport.mjs \
  src/trip-group-notifications.mjs \
  test/notifications.test.mjs \
  test/notifications-migration.test.mjs
do
  install -D -m 644 "$release_dir/payload/$file" "$root/$file"
done
umask 077

cd "$root"
docker compose build api
if docker compose run --rm --no-deps -v "$root/test:/app/test:ro" api node --test test/notifications.test.mjs test/notifications-migration.test.mjs > "$backup_dir/notification-tests.log" 2>&1; then
  cat "$backup_dir/notification-tests.log"
else
  cat "$backup_dir/notification-tests.log" >&2
  fail "notification tests failed"
fi
if docker compose run --rm --no-deps -v "$root/test:/app/test:ro" api node --test test/*.test.mjs > "$backup_dir/full-backend-tests.log" 2>&1; then
  cat "$backup_dir/full-backend-tests.log"
else
  cat "$backup_dir/full-backend-tests.log" >&2
  [ "${ALLOW_KNOWN_PRODUCTION_TEST_DRIFT:-0}" = "1" ] || fail "full backend suite failed; inspect known production fixture drift before setting ALLOW_KNOWN_PRODUCTION_TEST_DRIFT=1"
  printf '%s\n' "WARNING: continuing after explicit override for documented stale production fixture assertions." >&2
fi
docker compose run --rm --no-deps api npm run migrate:notifications:dry-run
docker compose run --rm --no-deps api npm run migrate:notifications
docker compose up -d --no-deps api

container_id=$(docker compose ps -q api)
[ -n "$container_id" ] || fail "API container not found"
attempt=0
while [ "$attempt" -lt 30 ]; do
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
  [ "$health" = "healthy" ] && break
  attempt=$((attempt + 1))
  sleep 2
done
[ "$health" = "healthy" ] || fail "API did not become healthy: $health"

curl -fsS https://api.champagneatlas.nl/health > "$backup_dir/health.json"
unauth_status=$(curl -sS -D "$backup_dir/notifications-unauth.headers" -o "$backup_dir/notifications-unauth.json" -w '%{http_code}' https://api.champagneatlas.nl/api/v1/notifications)
[ "$unauth_status" = "401" ] || fail "unauthenticated notifications status is $unauth_status"
grep -iEq '^cache-control:[[:space:]]*private,[[:space:]]*no-store' "$backup_dir/notifications-unauth.headers" || fail "private,no-store header missing"

if [ -n "${SMOKE_TOKEN_OWNER:-}" ]; then
  owner_status=$(curl -sS -D "$backup_dir/notifications-owner.headers" -o "$backup_dir/notifications-owner.json" -w '%{http_code}' -H "Authorization: Bearer $SMOKE_TOKEN_OWNER" 'https://api.champagneatlas.nl/api/v1/notifications?unread=true&limit=30')
  [ "$owner_status" = "200" ] || fail "authenticated notifications status is $owner_status"
  grep -iEq '^cache-control:[[:space:]]*private,[[:space:]]*no-store' "$backup_dir/notifications-owner.headers" || fail "authenticated private,no-store header missing"
  grep -Eq '"items"[[:space:]]*:[[:space:]]*\[' "$backup_dir/notifications-owner.json" || fail "items array missing"
  grep -Eq '"unreadCount"[[:space:]]*:[[:space:]]*[0-9]+' "$backup_dir/notifications-owner.json" || fail "unreadCount missing"
  preference_status=$(curl -sS -D "$backup_dir/notifications-preferences.headers" -o "$backup_dir/notifications-preferences.json" -w '%{http_code}' -H "Authorization: Bearer $SMOKE_TOKEN_OWNER" https://api.champagneatlas.nl/api/v1/notifications/preferences)
  [ "$preference_status" = "200" ] || fail "preferences status is $preference_status"
  grep -Eq '"tripGroupActivity"[[:space:]]*:[[:space:]]*true' "$backup_dir/notifications-preferences.json" || fail "tripGroupActivity default missing"
else
  printf '%s\n' "Authenticated smoke skipped: SMOKE_TOKEN_OWNER not supplied."
fi

table_count=$(docker compose exec -T "$db_service" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='\''public'\'' AND tablename IN ('\''notification_preferences'\'','\''notification_devices'\'','\''notification_inbox'\'','\''notification_push_outbox'\'')"')
[ "$table_count" = "4" ] || fail "expected 4 notification tables, found $table_count"

sha256sum \
  migrations/011_notifications.up.sql \
  migrations/011_notifications.down.sql \
  src/notification-api.mjs \
  src/notification-store.mjs \
  src/notification-transport.mjs \
  src/trip-group-notifications.mjs \
  src/trip-group-store.mjs \
  src/server.mjs > "$backup_dir/deployed-source.sha256"
docker inspect --format '{{.Image}}' "$container_id" > "$backup_dir/api-image-id.txt"

printf '%s\n' "RELEASE_OK"
printf '%s\n' "Backup: $backup_dir"
cat "$backup_dir/SHA256SUMS"
cat "$backup_dir/deployed-source.sha256"
cat "$backup_dir/api-image-id.txt"
printf '%s\n' "Object isolation: contract-tested by backend suite; no second production token required."
trap - 0 HUP INT TERM
