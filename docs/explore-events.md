# Explore eventkalender

De Explore-agenda wordt door de Node.js-backend gevuld en door Android uitsluitend via
`GET /api/v1/explore/events` gelezen. De DATAtourisme-key komt nooit in de app of in Git.

## Configuratie

1. Vraag een gratis API-key aan via de DATAtourisme API-portal.
2. Voeg op de server toe aan `.env`:

   ```dotenv
   DATATOURISME_API_KEY=...
   ```

3. Geef de variabele door aan de `api`-service in `compose.yaml`:

   ```yaml
   DATATOURISME_API_KEY: ${DATATOURISME_API_KEY:-}
   ```

4. Pas migratie `004_explore_events.up.sql` eerst als dry-run en daarna definitief toe:

   ```sh
   docker compose exec -T api npm run migrate:explore-events:dry-run
   docker compose exec -T api npm run migrate:explore-events
   ```

5. Test een eerste sync:

   ```sh
   docker compose exec -T api npm run sync:explore-events
   curl -fsS 'https://api.champagneatlas.nl/api/v1/explore/events?limit=6'
   ```

Zonder key zijn mapping, deduplicatie en foutgedrag testbaar met
`test/fixtures/datatourisme-events.json`; live providerverkeer blijft dan bewust uitgeschakeld.

## Scheduler

Gebruik één scheduler op de Strato-host, niet één timer per API-container. Voor elke zes uur:

```cron
17 */6 * * * cd /opt/champagne-atlas && /usr/bin/docker compose exec -T api npm run sync:explore-events >> /opt/champagne-atlas/logs/explore-events-sync.log 2>&1
```

De sync is idempotent via `(provider, provider_external_id)`. Bij een providerfout wordt de
bestaande eventdataset niet aangepast. Verlopen items worden gearchiveerd, niet verwijderd.

## Publiek contract

`GET /api/v1/explore/events?from=&to=&lat=&lng=&radius=&limit=` retourneert alleen actieve,
niet-verlopen items. Uitgelichte items komen eerst, daarna de redactionele volgorde en datum.
De response bevat per item concrete `sourceName`, `sourceUrl`, `producerName`,
`providerUpdatedAt`, `syncedAt` en eventuele fotocredit/rechtenperiode.

## Beheer

`/admin/events` gebruikt de bestaande adminsession en CSRF-beveiliging. De beheerder kan:

- zoeken en filteren op status, bron en datum;
- handmatige redactionele evenementen toevoegen/bewerken;
- feeditems uitlichten, ordenen of verbergen;
- bron-, producent- en fotocredits beheren;
- syncstatus en foutmelding bekijken;
- een idempotente sync handmatig starten.

Champagne.fr wordt alleen handmatig/redactioneel gebruikt. Er wordt niet gescrapet. OpenAgenda
kan later als tweede provider-adapter worden toegevoegd; de dedupe-sleutel is al brononafhankelijk.

## Deploymentcontrole

- `DATATOURISME_API_KEY` alleen server-side aanwezig;
- migratie-dry-run en backup uitgevoerd;
- backendtests groen;
- `/health`, `/api/v1/producers` en `/api/v1/explore/events` geven HTTP 200;
- `/admin/events` alleen voor `wsoet` beschikbaar;
- cronregel en logmap aanwezig;
- Android-build verwijst naar de productie-API en toont cache bij netwerkuitval.
