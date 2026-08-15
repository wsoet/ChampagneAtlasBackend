# Champagne Atlas API

Kleine, dependencyvrije Node.js API voor de Champagne Atlas Android-app.

## Endpoints

- `GET /health`
- `GET /api/v1/sources`
- `GET /api/v1/producers`
- `GET /api/v1/producers?q=bouzy`
- `GET /api/v1/producers?source=club-tresors`
- `GET /api/v1/producers/:id`
- `GET /admin` (read-only beheerpagina met beveiligde adminlogin)

De beveiligde, additieve Slice-2-routes voor opgeslagen huizen, reizen,
routevoorstellen, offline bezoeken, Mijn Reis en badges staan beschreven in
[`docs/slice2-visit-collect-api.md`](docs/slice2-visit-collect-api.md).

De API bevat alleen publiek verifieerbare namen, plaatsen en bronlinks. Teksten,
scores en foto's van externe redacties worden niet gekopieerd.

## Lokaal

```bash
npm start
npm test
npm run migrate:slice2:dry-run
```

## STRATO VPS

Productie draait op `https://api.champagneatlas.nl`. Deze repository wordt niet
automatisch gedeployed. Voer een migratie en deployment alleen uit na expliciete
goedkeuring. De Android-build gebruikt:

```properties
CHAMPAGNE_API_BASE_URL=https://api.champagneatlas.nl
```

Voor Slice 2 zijn daarnaast `DATABASE_URL`, `DATABASE_SSL` en dezelfde
`CLOUD_TOKEN_SECRET` als de bestaande Android-cloudauth vereist.

## App-login

De Android-app ondersteunt gastgebruik, Google OAuth en een wachtwoordloze
e-maillink. Google en e-mail worden op genormaliseerd e-mailadres aan hetzelfde
`app_users`-profiel gekoppeld. De e-maillink is eenmalig, verloopt na 15 minuten
en alleen de SHA-256-hash wordt opgeslagen.

Benodigde servervariabelen:

```text
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
CLOUD_TOKEN_SECRET=...minimaal-32-tekens...
APP_AUTH_REDIRECT_URI=nl.champagneatlas://auth/callback
RESEND_API_KEY=...
AUTH_EMAIL_FROM=Champagne Atlas <login@champagneatlas.nl>
```

Voor activering van e-maillogin:

```text
npm run migrate:email-auth:dry-run
npm run migrate:email-auth
```

De afzender moet in Resend zijn geverifieerd. De requestroute geeft geen
informatie prijs over het wel of niet bestaan van een account en beperkt een
nieuw verzoek per e-mailadres tot eenmaal per minuut.

## Chef de Cave — gecontroleerde kennis

Antoine gebruikt uitsluitend allowlisted kennisclaims uit `chef-knowledge.mjs`
en de tabel `chef_approved_knowledge`. Iedere claim bevat een primaire bron,
controledatum, vervaldatum, confidence, bronsoort, claimsoort en een
autoriteitsscore. Databaseclaims vullen de vaste officiële kern aan; ze
vervangen die kern niet automatisch.

De bronprioriteit is: INAO/wetgeving, Comité Champagne en OIV, officiële
producentfiches, gecontroleerde Atlas-data en pas daarna interpretatie. Bij
ontbrekend bewijs moet Antoine de claim als onbekend of onbevestigd behandelen.

Officiële cuvéegegevens staan versieerbaar in `chef_cuvee_editions`: per
millésime, basisjaar en dégorgement waar de producent die context publiceert.
De gecontroleerde import staat in `data/chef-cuvee-editions.json` en accepteert
alleen HTTPS-bronnen op het officiële domein van het huis. Een ontbrekende
dosage of editiecontext blijft expliciet onbekend; Antoine mag die niet uit een
andere editie afleiden. Bij strijdige officiële fiches wordt niets stilzwijgend
overschreven: de betreffende waarde blijft buiten de seed totdat het conflict
als afzonderlijke bronstatus kan worden getoond.

Voor een release:

```text
npm run migrate:chef:dry-run
npm run migrate:chef
npm run seed:chef-knowledge:dry-run
npm run seed:chef-knowledge
npm run seed:chef-cuvees:dry-run
npm run seed:chef-cuvees
npm run eval:chef
```

`seed:chef-knowledge` is transactioneel en upsert alleen Chef-kennis. De live
eval vereist `CHEF_EVAL_BASE_URL` en `CHEF_EVAL_TOKEN`. Zonder die variabelen
controleert het script alleen of de lokale evalsuite geldig en compleet is.

## Chef de Cave — fase B kwaliteitskring

Fase B voegt menselijke sommeliercontrole toe zonder antwoorden automatisch
als waarheid terug te voeren. De evalset bevat 36 praktijksituaties voor
feiten, cuvée-edities, smaakredenering, pairing, privacy, actualiteit en writes.
Met `CHEF_EVAL_QUEUE_REVIEW=1` worden uitsluitend evalantwoorden — geen live
gebruikersgesprekken — gedurende maximaal 90 dagen in de reviewwachtrij gezet.

Een reviewer beoordeelt factualiteit, bronkwaliteit, sensorische redenering en
bruikbaarheid op een vijfpuntsschaal. Correcties blijven reviewdata. Promotie
naar `chef_approved_knowledge` vereist altijd een aparte, gecontroleerde seed.

```text
CHEF_EVAL_QUEUE_REVIEW=1 npm run eval:chef
npm run review:chef-queue
npm run review:chef-import -- --file=reviews.json
npm run report:chef-quality
```

Het kwaliteitsrapport toont approval/correction rate en gemiddelde scores over
de laatste 30 dagen. `--days=90` kan worden gebruikt voor een langere periode.
Het importformaat staat in `data/chef-sommelier-reviews.example.json`.

## Chef de Cave — fase C topsommelier

De sensorische redeneerlaag gebruikt de proefstructuur van Comité Champagne en
de scheiding tussen waarneming en beoordeling uit de OIV-methodiek. De
ontologie ordent uiterlijk, neus, palet en conclusie; iedere uitspraak wordt
behandeld als waarneming, bronfeit, producentclaim, interpretatie of onbekend.

Foodpairing verloopt via gerechtintensiteit, vet, zuur, zoet, zout, umami,
scherpte, textuur en bereiding. Antoine vergelijkt die met uitsluitend
onderbouwde wijnkenmerken, benoemt zowel aansluiting als spanning, geeft een
alternatief en vraagt door wanneer saus of bereiding de uitkomst verandert.
De scorefunctie is nadrukkelijk een heuristiek en nooit een objectief smaakfeit.

Drie compacte sommelier-redeneervoorbeelden sturen de aanpak voor zilte en
delicate gerechten, romige aardse gerechten en zoete desserts. Ze worden niet
als kant-en-klare antwoorden gekopieerd. De contract-evalset bevat nu 48 cases.

## Chef de Cave — fase D persoonlijke smaak

Persoonlijke matches combineren de ingevulde onboarding met uitsluitend
expliciet bevestigde smaakbewijzen. Een matchscore verschijnt alleen wanneer
ook goedgekeurde kandidaatdata beschikbaar is. Iedere score bevat redenen,
brondekking en een lage of middelmatige zekerheid; het is geen garantie.

Na een aanbeveling kan de gebruiker aangeven of het advies nuttig was. Deze
feedback staat los van het blijvende smaakprofiel. Een eventuele afleiding wordt
30 dagen als `OBSERVED` bewaard en levert alleen een `SAVE_TASTE_PREFERENCE`
action draft op. Pas na de bestaande expliciete bevestigingsstap wordt hiervan
`CONFIRMED` smaakbewijs gemaakt. De evalset bevat nu 60 praktijksituaties.

## Chef de Cave — fotoherkenning met broncontrole

Foto’s worden in twee strikt gescheiden stappen verwerkt. De eerste modelcall
leest zichtbare tekst en geeft alleen hypotheses voor type, producent, cuvée,
vintage, dosage en plaats. Die termen starten vervolgens read-only zoekacties
in de Atlas en officiële cuvée-fiches. De tweede modelcall krijgt zowel het
beeld als de gecontroleerde matches en mag alleen daarop identificeren.

Zonder bronmatch blijft herkenning een visuele hypothese. Bij meerdere matches
moet Antoine keuzes tonen. Vintage, dosage en dégorgement worden niet vanuit
een andere fleseditie ingevuld. Beelden worden niet door OpenAI opgeslagen en
beelddata komt niet in chatgeschiedenis of logs. De evalset bevat nu 68 cases.

### Beheerpagina

```text
ADMIN_USERNAME=<gebruikersnaam>
ADMIN_PASSWORD_HASH=scrypt$<salt>$<hash>
SESSION_SECRET=<willekeurige geheime waarde van minimaal 32 tekens>
```

Het wachtwoord zelf wordt nooit als omgevingsvariabele opgeslagen. De beheerpagina staat op:

```text
https://admin.champagneatlas.nl/admin
```
# Champagne Atlas backend

## Viator tours en ervaringen

De Viator Basic-integratie staat standaard en fail-closed op Sandbox. Configuratie,
synchronisatie en de verplichte omzetting vóór livegang staan in
[`docs/viator-experiences.md`](docs/viator-experiences.md). Production wordt technisch
geblokkeerd zolang `VIATOR_PRODUCTION_APPROVED=1` niet bewust is gezet.

The additive shared trip-groups contract is documented in [`docs/shared-trip-groups-api.md`](docs/shared-trip-groups-api.md). It is currently implemented and tested locally only; production deployment requires separate approval.

The additive private notification inbox, trip-group event matrix, Android API
contract, encrypted FCM device registration, and optional FCM HTTP v1 transport
are documented in [`docs/notifications-api.md`](docs/notifications-api.md). The
notification migration and provider configuration have not been applied or
deployed by this local change.

## Ontbrekende champagnehuizen

Ingelogde appgebruikers kunnen op de Huizen-pagina een ontbrekend huis melden.
De additieve module bewaart de controlewachtrij, eigenaarstatus en een optionele
zelfgemaakte foto. Het lopende admin-redesign integreert alleen de losse
beheer-API; bestaande admin-HTML is niet aangepast. Zie
[`docs/house-submissions-api.md`](docs/house-submissions-api.md).
