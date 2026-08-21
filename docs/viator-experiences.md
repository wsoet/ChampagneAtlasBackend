# Viator Tours & ervaringen

Champagne Atlas gebruikt Viator als aparte bron voor boekbare tours en ervaringen. Deze records
worden niet gemengd met de datumgebonden evenementenkalender van DATAtourisme.

## Omgevingen en productiebeveiliging

De standaardconfiguratie blijft bewust fail-closed op Sandbox:

```env
VIATOR_API_KEY=...
VIATOR_API_ENVIRONMENT=sandbox
VIATOR_API_BASE_URL=https://api.sandbox.viator.com/partner
VIATOR_CAMPAIGN_VALUE=champagne-atlas-explore
VIATOR_PRODUCTION_APPROVED=0
```

Alleen de backend krijgt de sleutel. Zet de sleutel nooit in Android, Git, een release-zip of logs.

## Synchronisatie

```sh
npm run migrate:explore-experiences:dry-run
npm run migrate:explore-experiences
npm run sync:explore-experiences
```

De provider gebruikt Basic Access read-only: destinations en free-text product search. De app toont
de bewaarde selectie en opent de ongewijzigde `productUrl` van Viator voor reservering. Champagne
Atlas claimt niet dat een tijdslot beschikbaar is en boekt niet zelf.

De productieomgeving gebruikt uitsluitend na expliciete goedkeuring:

```env
VIATOR_API_ENVIRONMENT=production
VIATOR_API_BASE_URL=https://api.viator.com/partner
VIATOR_CAMPAIGN_VALUE=champagne-atlas-explore
VIATOR_PRODUCTION_APPROVED=1
```

## Verplichte controle vóór livegang

Dit is een harde releasevoorwaarde, geen geheugensteun:

1. Viator production access en affiliate-attributie zijn schriftelijk bevestigd.
2. De productselectie, vertaling, prijzen, foto's, reviews en affiliate-links zijn opnieuw getest.
3. `VIATOR_API_KEY` wordt vervangen door de production key.
4. `VIATOR_API_ENVIRONMENT=production`.
5. `VIATOR_API_BASE_URL=https://api.viator.com/partner`.
6. Pas na review: `VIATOR_PRODUCTION_APPROVED=1`.
7. Migratie dry-run, sync, publieke endpoint-smoke en Android-clickthrough opnieuw uitvoeren.

Zonder stap 6 weigert de provider de production endpoint te gebruiken.
