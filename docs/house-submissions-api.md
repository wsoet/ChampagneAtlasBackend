# Ontbrekend champagnehuis melden

Deze module is bewust los van de bestaande HTML-adminpagina gebouwd. Het nieuwe adminpanel kan de JSON-beheer-API opnemen zonder de huidige adminbron of het lopende redesign te overschrijven.

## Gebruikersflow

- `POST /api/v1/house-submissions` — ingelogde gebruiker meldt een huis.
- `GET /api/v1/house-submissions` — alleen de eigen meldingen.
- `GET /api/v1/house-submissions/:id` — alleen de eigen melding.
- Alle antwoorden zijn `private, no-store` en objectautorisatie is owner-only.
- Maximaal vijf meldingen per gebruiker per 24 uur.
- Vereist: `name`, `city`, `sourceUrl` (HTTPS).
- Optioneel: `address`, `websiteUrl`, `notes`, `photoData`.
- `photoData` is een JPEG/PNG/WebP data-URL van maximaal 180 KB. De app vermeldt dat alleen een zelfgemaakte foto mag worden geüpload.

Statussen: `SUBMITTED`, `IN_REVIEW`, `NEEDS_INFO`, `DUPLICATE`, `APPROVED`, `REJECTED`, `PUBLISHED`.

## Admin-redesign contract

De beheer-API gebruikt de bestaande Google-adminsessie. Schrijfacties vereisen daarnaast de bestaande CSRF-token in header `X-CSRF-Token`.

- `GET /api/admin/house-submissions?status=&search=&limit=` — wachtrij.
- `GET /api/admin/house-submissions/:id` — volledig dossier, melder en redactionele velden.
- `GET /api/admin/house-submissions/:id/photo` — privaat bronbeeld.
- `PATCH /api/admin/house-submissions/:id` — controle, aanvulling en statuswijziging.

Een PATCH stuurt het volledige bewerkbare object plus de actuele `version`. Een verouderde versie geeft `409 VERSION_CONFLICT`. Voor `PUBLISHED` is `publishedHouseId` verplicht. Het redesigned adminpanel maakt/completeert het huis via de bestaande huizen-editor en koppelt daarna dat definitieve ID aan de melding.

Bij iedere relevante statuswijziging krijgt de melder een bericht in de notificatie-inbox. Als push aanstaat, wordt dezelfde melding via de bestaande push-outbox bezorgd. `PUBLISHED` en `DUPLICATE` linken naar het gekoppelde huis; andere statussen linken naar de melding.

## Migratie en release

```sh
npm run migrate:house-submissions:dry-run
npm run migrate:house-submissions
```

Daarna alleen de API opnieuw bouwen. Er wordt niets aan bestaande huizen-, Slice-1-, Slice-2- of admin-HTML-tabellen gewijzigd.
