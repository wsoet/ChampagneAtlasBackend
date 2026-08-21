#!/bin/sh
set -eu

cd /opt/champagne-atlas
expected_old="29beb8442cd3e8780b8ca60985e559dc6cebc5c1f102f3af309b812f42b1d06b"
actual_old="$(sha256sum src/chef-orchestrator.mjs | awk '{print $1}')"
[ "$actual_old" = "$expected_old" ] || { echo "STOP drift: $actual_old"; exit 20; }

vision="$(docker compose exec -T api sh -c 'printf %s "${OPENAI_MODEL_CHEF_VISION:-${OPENAI_MODEL_CHEF_LUNA:-gpt-5.6-luna}}"')"
standard="$(docker compose exec -T api sh -c 'printf %s "${OPENAI_MODEL_CHEF_STANDARD:-${OPENAI_MODEL_CHEF_TERRA:-gpt-5.6-terra}}"')"
complex="$(docker compose exec -T api sh -c 'printf %s "${OPENAI_MODEL_CHEF_COMPLEX:-${OPENAI_MODEL_CHEF_SOL:-gpt-5.6-sol}}"')"
printf 'model-config vision=%s standard=%s complex=%s\n' "$vision" "$standard" "$complex"
[ "$vision" = "gpt-5.6-luna" ] && [ "$standard" = "gpt-5.6-terra" ] && [ "$complex" = "gpt-5.6-sol" ] || { echo "STOP unexpected model config"; exit 21; }

docker compose exec -T api node --input-type=module -e '
const expected=["gpt-5.6-luna","gpt-5.6-terra","gpt-5.6-sol"];
if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
const r=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(10000)});
if(!r.ok) throw new Error(`models endpoint HTTP ${r.status}`);
const ids=new Set((await r.json()).data.map(x=>x.id));
const missing=expected.filter(x=>!ids.has(x));
console.log("model-access",missing.length?`missing=${missing.join(",")}`:"all-present");
if(missing.length) process.exit(22);'

docker compose run --rm --no-deps -v /tmp/chef-router-production.mjs:/app/.router.mjs:ro api node --check /app/.router.mjs

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/opt/champagne-atlas/deploy/backups/${stamp}-cdc-model-router"
mkdir -p "$backup"
cp src/chef-orchestrator.mjs "$backup/chef-orchestrator.mjs"
docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/pre-router.dump"
test -s "$backup/pre-router.dump"
docker compose exec -T database pg_restore --list < "$backup/pre-router.dump" >/dev/null
cp /tmp/chef-router-production.mjs src/chef-orchestrator.mjs
chmod 644 src/chef-orchestrator.mjs

docker compose build api
docker compose up -d --no-deps --force-recreate api
i=0
while [ "$i" -lt 30 ]; do
  state="$(docker inspect champagne-atlas-api-1 --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null || true)"
  [ "$state" = "running healthy" ] && break
  i=$((i+1)); sleep 2
done
[ "${state:-}" = "running healthy" ] || { docker compose logs --tail=100 api; exit 23; }

curl -fsS https://api.champagneatlas.nl/health
printf '\n'
code="$(curl -sS -o /tmp/chef-router-auth.out -w '%{http_code}' -X POST https://api.champagneatlas.nl/api/v2/chef/responses -H 'Content-Type: application/json' -d '{"message":"test"}')"
[ "$code" = "401" ] || { echo "unexpected chef auth HTTP $code"; exit 24; }
cache="$(curl -sS -D - -o /dev/null -X POST https://api.champagneatlas.nl/api/v2/chef/responses -H 'Content-Type: application/json' -d '{"message":"test"}' | tr -d '\r' | awk 'tolower($1)=="cache-control:"{$1="";sub(/^ /,"");print;exit}')"
echo "chef-auth=$code cache-control=$cache"
docker compose logs --tail=80 api | grep -E 'listening on 3000|error|Error|failed|FAILED' || true
echo "backup=$backup"
echo "orchestrator_sha=$(sha256sum src/chef-orchestrator.mjs | awk '{print $1}')"
echo "image=$(docker inspect champagne-atlas-api-1 --format '{{.Image}}')"
echo "state=$state"
