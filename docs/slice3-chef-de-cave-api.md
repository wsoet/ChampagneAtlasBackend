# Slice 3 — Chef de Cave API

Deze slice is additief. Slice 1 en Slice 2 blijven eigenaar van catalogus, bezoeken, favorieten, reizen en routevoorstellen. Chef de Cave leest die contracten via een allowlist en schrijft uitsluitend na een afzonderlijke bevestiging.

## Migratie en retentie

```sh
npm run migrate:chef:dry-run
npm run migrate:chef
npm run purge:chef
```

Plan `purge:chef` dagelijks. Berichten krijgen bij opslag een `retention_until` van 15 dagen. De purge verwijdert verlopen berichten, sluit verlopen drafts en soft-deletet oude gesprekken. `003_chef_de_cave.down.sql` verwijdert alleen Chef-tabellen; het bestaande smaakprofiel blijft behouden.

## Configuratie

- `OPENAI_API_KEY`: uitsluitend server-side.
- Antoine gebruikt een deterministische, server-side modelrouter zonder extra modelcall:
  - `OPENAI_MODEL_CHEF_VISION` (default exact `gpt-5.6-luna`) voor OCR, etikettekst, producenthypothese en beeldclassificatie. Luna schrijft nooit het eindantwoord.
  - `OPENAI_MODEL_CHEF_STANDARD` (default exact `gpt-5.6-terra`) voor standaardvragen, praktische live-vragen en een flesdossier na duidelijke beeldextractie.
  - `OPENAI_MODEL_CHEF_COMPLEX` (default exact `gpt-5.6-sol`) uitsluitend voor bronconflicten, uitgebreide routes, expliciet complexe analyse en onzekere/ambigue herkenning.
  De legacyvariabelen `OPENAI_MODEL_CHEF_LUNA`, `OPENAI_MODEL_CHEF_TERRA` en `OPENAI_MODEL_CHEF_SOL` blijven als aliases bruikbaar. De algemene `OPENAI_MODEL` bepaalt deze router niet meer.
- `CHEF_TIMEOUT_MS`: standaard 40000; houd de client-timeout hier minimaal 20 seconden boven.
- `CHEF_BREAKER_THRESHOLD`: standaard 5 tijdelijke providerfouten.
- `CHEF_BREAKER_COOLDOWN_MS`: standaard 15000. Model-, schema- en validatiefouten openen de circuitbreaker niet.
- `CHEF_REASONING_EFFORT`: standaard `low` voor voorspelbare chatlatency; verhoog alleen na representatieve CdC-evals.
- `CHEF_MAX_OUTPUT_TOKENS`: optionele vaste override. Zonder override gebruikt CdC 1600 voor tekst, 1800 voor beeld en 2000 voor routes, met één begrensde retry als een gestructureerd antwoord toch wordt afgekapt.
- `CHEF_RATE_LIMIT_PER_MINUTE`: standaard 20 per gebruiker.
- `GOOGLE_MAPS_API_KEY`: server-side key met Places API (New). Antoine gebruikt Place Details voor actuele openingstijden, adres en contactgegevens van een eenduidig herkend Atlashuis. Resultaten worden tien minuten gecachet; de key wordt nooit naar Android of logs gestuurd.
- `CHEF_WEB_SEARCH`: standaard `1`. De Responses API krijgt de web-searchtool met een lage zoekcontext en `tool_choice=auto`. Antoine zoekt alleen wanneer informatie actueel, onbekend of niet volledig gedekt is door Atlas/Places. Zet op `0` om de fallback uit te schakelen.

De Responses API wordt met `store:false` gebruikt. De backend logt alleen een SHA-256-inputhash, gekozen model/tier, een vaste routerreden, prompt/toolversie, status, latency en tokengebruik; geen chattekst. Foto's gaan uitsluitend naar Luna; het eindmodel krijgt daarna alleen de gestructureerde extractie plus gecontroleerde Atlas-/brondata.

## Gestructureerd antwoord

`POST /api/v2/chef/responses`

```json
{ "message": "Plan een dagroute rond Épernay", "conversation_id": null, "locale": "nl-NL" }
```

Optioneel kan één afbeelding worden meegestuurd als `attachment` met `type=image`,
`mime_type` (`image/jpeg`, `image/png` of `image/webp`), `data_base64` en `name`.
De limiet is standaard 2 MB (`CHEF_MAX_IMAGE_BYTES`). De backend stuurt de afbeelding
met `detail=low` naar het model, maar bewaart uitsluitend mime-type, naam en bytegrootte;
de beelddata komt niet in chatgeschiedenis of logs terecht.

Het antwoord bevat `schema_version=1.0`, `answer_type`, `title`, `summary`, `blocks`, `citations`, `action_drafts`, `confidence`, `warnings` en `follow_up_suggestions`. Alleen citation-id's uit approved knowledge, de actuele Atlas-catalogus of aantoonbaar gebruikte Responses-websearchannotaties worden doorgelaten. Iedere citation heeft `checked_at`, `expires_at` en status `CURRENT`, `STALE`, `CONFLICT` of `UNKNOWN`.

## Geschiedenis

- `GET /api/v2/chef/conversations`
- `GET /api/v2/chef/conversations/:id`
- `DELETE /api/v2/chef/conversations/:id`

Alle queries zijn owner-scoped. Een object van een andere gebruiker wordt niet teruggegeven. Private responses hebben `Cache-Control: no-store`.

## Action drafts

Een routeantwoord kan een `CREATE_TRIP`-draft teruggeven. Het voorstel muteert Slice 2 niet. Bevestigen gebeurt apart:

`POST /api/v2/action-drafts/:id/confirm`

Headers: `Idempotency-Key: <uuid>`

```json
{ "payload_hash": "...", "confirmation_version": 1 }
```

De server controleert eigenaar, expiry, payloadhash, bevestigingsversie en idempotency. Een retry met dezelfde key retourneert hetzelfde resultaat; stabiele Slice-2 client-id's voorkomen dubbele reizen/items.

## Veiligheid en fouten

Approved knowledge is deny-by-default. Gebruikersinstructies en opgehaalde tekst kunnen de systeemregels, toolallowlist of broncontrole niet wijzigen. Deze bescherming draait op de achtergrond: Antoine begint met het bruikbare antwoord en toont alleen een waarschuwing wanneer die voor de beslissing relevant is. De backend onderscheidt onder andere `AUTH_REQUIRED`, `TASTE_PROFILE_REQUIRED`, `RATE_LIMITED`, `TIMEOUT`, `PROVIDER_ERROR`, `DRAFT_CONFLICT` en `NOT_FOUND`. Providerverkeer heeft een timeout en circuit breaker; geen enkele fout schrijft een draft automatisch weg.

## Tests en evals

`npm test` bevat contract-, retrieval-, injection-, tool-, auth-, no-store- en objectisolatietests naast alle Slice-1/2-regressies. `npm run eval:chef` valideert de vaste evalset offline. Met `CHEF_EVAL_BASE_URL` en `CHEF_EVAL_TOKEN` voert het dezelfde set live uit en rapporteert per case schema, citations, confirmation en no-mutation.
