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

De API bevat alleen publiek verifieerbare namen, plaatsen en bronlinks. Teksten,
scores en foto's van externe redacties worden niet gekopieerd.

## Lokaal

```bash
npm start
npm test
```

## Render

1. Push de volledige repository naar GitHub of GitLab.
2. Maak in Render een Blueprint aan op basis van `render.yaml`.
3. Kopieer na deployment de HTTPS-URL.
4. Zet in `gradle.properties` van de Android-build:

```properties
CHAMPAGNE_API_BASE_URL=https://jouw-service.onrender.com
```

Laat `ALLOWED_ORIGINS=*` staan voor de native Android-app. Als later een webapp
wordt toegevoegd, beperk deze variabele tot de toegestane weborigin(s).

### Beheerpagina

```text
ADMIN_USERNAME=<gebruikersnaam>
ADMIN_PASSWORD_HASH=scrypt$<salt>$<hash>
SESSION_SECRET=<willekeurige geheime waarde van minimaal 32 tekens>
```

Het wachtwoord zelf wordt nooit als omgevingsvariabele opgeslagen. Render kan
`SESSION_SECRET` vanuit `render.yaml` automatisch genereren. De beheerpagina staat op:

```text
https://champagne-atlas-api.onrender.com/admin
```
