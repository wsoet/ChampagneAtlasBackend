# Slice 2 — Visit & Collect API

Additieve API voor de hoofdapp. Alle routes vereisen `Authorization: Bearer <access-token>` en antwoorden met `Cache-Control: private, no-store`. UUID's zijn RFC-4122 UUID's; tijden zijn ISO-8601 UTC. De bestaande catalogus-, admin- en `user_house_status`-contracten blijven ongewijzigd.

## Fouten

```json
{"error":{"code":"VERSION_CONFLICT","message":"The object has changed","details":{"serverVersion":3}}}
```

Validatie gebruikt 400, ontbrekende auth 401, niet-eigendom wordt als 404 behandeld en optimistic-lockconflicten gebruiken 409.

## Opgeslagen huizen

- `GET /api/v1/user-saved-houses`
- `PUT /api/v1/user-saved-houses/:houseId`

```json
{"saved":true,"idempotencyKey":"810a2f4e-0cf4-4f16-aaef-b98d624f88db","clientUpdatedAt":"2026-08-01T08:00:00.000Z"}
```

GET retourneert `{ "items": [{"houseId","saved","savedAt","updatedAt","deletedAt"}], "syncCursor": "..." }`.

## Reizen en stops

- `GET /api/v1/trips?includeItems=true`
- `POST /api/v1/trips`
- `GET|PATCH|DELETE /api/v1/trips/:id`
- `POST /api/v1/trips/:tripId/items`
- `PATCH|DELETE /api/v1/trips/:tripId/items/:itemId`
- `PUT /api/v1/trips/:tripId/items/order`

Trip maken:

```json
{"clientGeneratedId":"2f17cf5e-aeea-4712-8589-45a29ae1602e","name":"Weekend Reims","startDate":"2026-09-12","endDate":"2026-09-13","notes":"","idempotencyKey":"3c0d1462-615a-4674-83b0-b612c4d13f8e"}
```

`TripDto` bevat `id`, `clientGeneratedId`, `name`, datums, `notes`, `status` (`DRAFT|PLANNED|COMPLETED`), `version`, timestamps en `items`. Een item bevat dezelfde identity/versionvelden plus `houseId`, `position`, `plannedArrival`, `durationMinutes`, `notes` en `status` (`PLANNED|VISITED|SKIPPED`). PATCH en DELETE vereisen de actuele `version`.

Volgorde wijzigen:

```json
{"itemIds":["...","..."],"version":3}
```

## Routevoorstel

`POST /api/v1/trips/:id/route-proposal`

```json
{"travelMode":"DRIVING","itemIds":["..."],"dayStartTime":"09:30","dayEndTime":"18:00","idempotencyKey":"c30e4818-1df9-46b8-8b3e-a5b60cf54192"}
```

Antwoord: `tripId`, `generatedAt`, `orderedItemIds`, afstand/duur, `legs`, `warnings`, `calculation` en `mutatedTripOrder:false`. De server wijzigt de tripvolgorde nooit stilzwijgend. De huidige berekening is een expliciet gemarkeerde rechte-lijnschatting; ontbrekende coördinaten leveren een waarschuwing.

## Offline bezoeken en synchronisatie

- `PUT /api/v1/visits/:clientVisitId`
- `DELETE /api/v1/visits/:clientVisitId`
- `GET /api/v1/visits?changedSince=<ISO-8601>`

```json
{"clientVisitId":"f25f1c07-dd64-4d35-aea5-0a399d059e7d","houseId":"bollinger","visitedAt":"2026-08-01T08:00:00.000Z","timezoneOffsetMinutes":120,"source":"MANUAL","idempotencyKey":"28902b58-b9a0-43b6-96f8-0a46442dbec1","clientUpdatedAt":"2026-08-01T08:00:00.000Z"}
```

Voor `source:"TRIP"` is `tripId` verplicht en `tripItemId` optioneel. De combinatie gebruiker + `clientVisitId` is uniek: dezelfde offline write resulteert altijd in één event. DELETE verwacht `{ "idempotencyKey":"..." }` en maakt een tombstone. Sync retourneert `{items,tombstones,syncCursor}`.

## Mijn Reis

`GET /api/v1/journey`

Retourneert `stats`, `regionProgress`, gededupliceerde `visited` en `savedHouseIds`. `visitedHouseCount` telt unieke `houseId`-waarden uit actieve visit-events; dezelfde canonieke query voedt de bezoeklijst.

## Badges

`GET /api/v1/badge-progress?rulesVersion=1`

```json
{"rulesVersion":1,"evaluatedAt":"...","badges":[{"badgeId":"first-visit","ruleVersion":1,"title":"Eerste bezoek","description":"Bezoek je eerste huis","state":"UNLOCKED","current":1,"target":1,"unlockedAt":"...","metadata":{}}]}
```

Badge-ID's zijn stabiel. Regelversie 1 bevat eerste bezoek, 10 huizen, 20 huizen, alle regio's gestart en een voltooiingsbadge per regio. Onbekende versies krijgen `UNSUPPORTED_RULES_VERSION`.

## Database

Voorwaarden: bestaande tabellen `app_users` en `user_house_status` uit de huidige cloudauth. Migratie:

```bash
npm run migrate:slice2:dry-run
npm run migrate:slice2
```

Rollback gebruikt `migrations/002_slice2_visit_collect.down.sql` en verwijdert uitsluitend de zes Slice-2-tabellen. De up-migratie importeert legacy `visited`-statussen deterministisch en herhaalbaar als `LEGACY_IMPORT`, zonder de legacytabel te wijzigen.

