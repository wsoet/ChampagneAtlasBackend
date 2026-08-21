# Website-analyse

Champagne Atlas registreert first-party, privacyvriendelijke gebruiksstatistieken voor de publieke website. Er wordt geen externe analyticsdienst geladen en er worden geen advertentie- of analysecookies geplaatst.

## Gegevens

- bezochte route, zonder querystring of fragment;
- verwijzende host en daarvan afgeleide verkeersbron;
- browsertaal en apparaatcategorie;
- optionele ISO-landcode wanneer de vertrouwde reverse proxy die aanlevert;
- een HMAC-hash van IP-adres en user-agent, met een dagelijks wisselende saltcomponent.

Het ruwe IP-adres en de volledige verwijzende URL worden niet opgeslagen. Herhaalde bezoeken van dezelfde bezoeker aan dezelfde route worden per half uur gededupliceerd.

## Configuratie

Gebruik bij voorkeur een afzonderlijk willekeurig geheim van minimaal 24 tekens:

```text
ANALYTICS_HASH_SECRET=<lang willekeurig geheim>
```

Wanneer deze variabele ontbreekt, gebruikt de API tijdelijk `CLOUD_TOKEN_SECRET`. Voeg secrets uitsluitend toe aan de serveromgeving en nooit aan broncode of logs.

Landgegevens blijven `Onbekend` totdat de vertrouwde proxy `CF-IPCountry` of `X-Country-Code` aanlevert. Configureer zo'n header alleen server-side; accepteer hiervoor geen browserinvoer.

## Migratie

```text
npm run migrate:web-analytics:dry-run
npm run migrate:web-analytics
```

De migratie is additief en terug te draaien met `migrations/022_web_analytics.down.sql`.

## Beheer

Het scherm staat voor beheerder `wsoet` onder **Website-analyse** en ondersteunt perioden van 7, 30 en 90 dagen. De gegevens worden pas opgebouwd nadat migratie, API en de bijgewerkte `atlas.js` zijn uitgerold.
