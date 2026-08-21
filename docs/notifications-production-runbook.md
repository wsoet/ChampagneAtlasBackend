# Notifications production runbook

Release: `notifications-prodmerge-20260802T171912Z`

Production layout: the backend contents (`src`, `scripts`, `migrations`,
`package.json`, `compose.yaml`) live directly in `/opt/champagne-atlas`. There
is no `/opt/champagne-atlas/backend` directory.

Target host: `root@82.165.177.44`. The verified ed25519 fingerprint observed on
2026-08-02 is:

```text
SHA256:VPXVNtBzV2hGfZYgacqDqB1TWQN1ncDCjSmFmQtJ0jg
```

Do not continue on a different fingerprint. The release is fail-closed and
must stop on a failed preflight, backup, patch check, backend test, migration
dry-run, migration, or smoke test. It recreates only the `api` service.

## Upload

Verify the archive against its detached checksum, then upload both files using
an already approved non-interactive SSH credential. Never put a password on a
command line.

```powershell
Get-FileHash .\champagne-atlas-notifications-prodmerge-20260802T171912Z.zip -Algorithm SHA256
Get-Content .\champagne-atlas-notifications-prodmerge-20260802T171912Z.zip.sha256
```

```text
pscp -hostkey SHA256:VPXVNtBzV2hGfZYgacqDqB1TWQN1ncDCjSmFmQtJ0jg champagne-atlas-notifications-prodmerge-20260802T171912Z.zip root@82.165.177.44:/tmp/
pscp -hostkey SHA256:VPXVNtBzV2hGfZYgacqDqB1TWQN1ncDCjSmFmQtJ0jg champagne-atlas-notifications-prodmerge-20260802T171912Z.zip.sha256 root@82.165.177.44:/tmp/
```

## Extract and verify

Run as root on the host:

```sh
set -eu
cd /tmp
sha256sum -c champagne-atlas-notifications-prodmerge-20260802T171912Z.zip.sha256
release_dir=/opt/champagne-atlas/releases/notifications-prodmerge-20260802T171912Z
test ! -e "$release_dir"
install -d -m 750 "$release_dir"
unzip -q champagne-atlas-notifications-prodmerge-20260802T171912Z.zip -d "$release_dir"
cd "$release_dir"
sha256sum -c MANIFEST.sha256
```

## Deploy

The script accepts only an extracted release directory below
`/opt/champagne-atlas/releases/`. It verifies the real production root, makes a
root-only source/configuration backup and full PostgreSQL dump, checks all
patches against the current production files before changing them, installs
only additive files, builds and tests the new image, executes migration dry-run
then apply, recreates only API, and performs health/auth/no-store/table smokes.
Before backup or patching it also verifies SHA-256 for the four production files
downloaded on 2026-08-02 (`src/server.mjs`, `src/trip-group-store.mjs`,
`package.json`, and `README.md`). Any intervening production change stops the
release and requires a fresh mergebase.

If available, set one short-lived owner token without echoing it. This enables
the authenticated list/preferences smoke. It is optional; the automated suite
already contract-tests two-user object isolation and the deploy script never
requires a second token.

```sh
export SMOKE_TOKEN_OWNER='<short-lived token>'
sh /opt/champagne-atlas/releases/notifications-prodmerge-20260802T171912Z/deploy-notifications-production.sh \
  /opt/champagne-atlas/releases/notifications-prodmerge-20260802T171912Z
unset SMOKE_TOKEN_OWNER
```

Without a token:

```sh
sh /opt/champagne-atlas/releases/notifications-prodmerge-20260802T171912Z/deploy-notifications-production.sh \
  /opt/champagne-atlas/releases/notifications-prodmerge-20260802T171912Z
```

The script prints the backup path, database/source checksums, deployed source
checksums, and API image ID. Preserve that output as release evidence.

### File permissions

The script starts with `umask 077` so backups and smoke artifacts remain
root-only. Immediately before applying source patches it switches to
`umask 022`, explicitly sets `src/server.mjs`, `src/trip-group-store.mjs`,
`package.json`, and `README.md` to mode `0644`, and installs all eleven additive
runtime/test/documentation files as `0644`. It then restores `umask 077`. This
is required because a patch under `umask 077` can replace otherwise readable
source with mode `0600`, preventing the non-root Node user in the API image from
reading bind-mounted or build-context files.

### Production test drift

The isolated current suite, using the downloaded production server, trip-group
store, package, README, producer enrichment and producer import modules, passed
86/86 before release. The tests currently stored on production contain older
fixture assumptions, including an exact 300-house count and a superseded upload
fixture, so that production copy of the complete suite is not green independent
of notifications.

The two notification test files are always mandatory and must pass before the
migration. The script also runs the full production suite and stores its output
in the protected backup directory. It targets only `test/*.test.mjs`, preventing
extracted release artifacts or backup trees elsewhere below the production root
from being discovered as duplicate tests. By default any failure stops the release.
After verifying that failures are limited to the documented pre-existing stale
fixtures, an operator may explicitly acknowledge that drift before the first
run:

```sh
export ALLOW_KNOWN_PRODUCTION_TEST_DRIFT=1
```

This override never applies to the notification tests, build, migration
dry-run, migration apply, health checks, privacy headers, or table checks.

## Provider configuration

The in-app inbox works immediately after migration. Secure device registration
requires this protected environment variable:

```text
NOTIFICATION_TOKEN_ENCRYPTION_KEY=<exactly 32 random bytes, base64>
```

FCM HTTP v1 delivery additionally requires `FCM_PROJECT_ID`,
`FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`. They belong only in the protected
production environment, never in source, the archive, logs, or Compose YAML.
When they are absent, push remains safely disabled and the private inbox keeps
working.

## Rollback

The migration is additive; an old API safely ignores the new tables. If the
post-release application regresses, restore the source archive reported by the
script and recreate only API. Retain the database dump and notification tables
for investigation unless a separate data rollback is explicitly approved.

```sh
cd /opt/champagne-atlas
failed_dir="/opt/champagne-atlas/failed-notifications-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$failed_dir"
mv src scripts migrations docs test package.json README.md "$failed_dir"/
tar -xzf '<backup-dir>/source-before.tgz' -C /opt/champagne-atlas
docker compose build api
docker compose up -d --no-deps api
curl -fsS https://api.champagneatlas.nl/health
```
