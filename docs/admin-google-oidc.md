# Google OpenID Connect voor het beheerpaneel

De adminlogin gebruikt een eigen Google Web OAuth-client en staat volledig los van de Google-login van Android-gebruikers. Alleen het expliciet ingestelde stabiele Google `sub` krijgt toegang.

## Google Cloud Console

1. Open het bestaande Google Cloud-project van Champagne Atlas.
2. Maak onder **APIs & Services → Credentials** een nieuwe **OAuth 2.0 Client ID** van type **Web application**. Hergebruik de Android-client of de gewone app-webclient niet.
3. Naam: `Champagne Atlas Admin`.
4. Authorized JavaScript origin: `https://admin.champagneatlas.nl`.
5. Authorized redirect URI (exact):
   `https://admin.champagneatlas.nl/auth/admin/google/callback`
6. Bewaar de Client ID en Client Secret uitsluitend in de serveromgeving.

Gebruik voor het toegestane account tweestapsverificatie en bij voorkeur een passkey of fysieke beveiligingssleutel.

## Serveromgeving

```env
ADMIN_BASE_URL=https://admin.champagneatlas.nl
ADMIN_GOOGLE_CLIENT_ID=<aparte web-client-id>
ADMIN_GOOGLE_CLIENT_SECRET=<secret, uitsluitend server-side>
ADMIN_GOOGLE_SUB=<stabiele Google OIDC subject-id>
ADMIN_GOOGLE_EMAIL=<optionele gecontroleerde bootstrap/weergave>
SESSION_SECRET=<minimaal 32 willekeurige tekens>
ADMIN_PASSWORD_LOGIN_ENABLED=false
```

`ADMIN_GOOGLE_SUB` is de primaire, deny-by-default allowlist. `ADMIN_GOOGLE_EMAIL` verleent zelfstandig nooit toegang en wordt alleen aanvullend gecontroleerd met `email_verified=true`.

De stabiele `sub` kan tijdens een eenmalige gecontroleerde bootstrap worden vastgesteld uit een lokaal gevalideerd Google ID-token of tijdelijk uit de privacyveilige `subjectRef` worden herleid door een beheerder met servertoegang. Log nooit het volledige ID-token of authorization code.

## Beveiliging

- aparte routes: `/auth/admin/google/start` en `/auth/admin/google/callback`;
- state, nonce en PKCE S256;
- cryptografische RS256-validatie via Google JWKS;
- issuer, audience, `iat`, `exp`, nonce, verified email en exact `sub` worden gecontroleerd;
- state en ID-token zijn eenmalig;
- admincookie: `Secure`, `HttpOnly`, `SameSite=Strict`, maximaal acht uur;
- nieuwe login roteert de sessie; logout maakt de huidige sessie ongeldig;
- bestaande CSRF-beveiliging blijft gelden voor alle adminmutaties;
- audit bevat alleen actie, resultaat, route en een korte hashreferentie, nooit tokens of e-mail.

## Rollout

1. Houd `ADMIN_PASSWORD_LOGIN_ENABLED=false` tijdens normaal gebruik.
2. Controleer een toegestane Google-login, een geweigerd tweede Google-account, logout, CSRF en de bestaande adminmodules.
3. Controleer dat de loginpagina alleen **Doorgaan met Google** toont.
4. Bewaar de noodgebruikersnaam en het unieke noodwachtwoord uitsluitend in een persoonlijke wachtwoordmanager; zet deze nooit in broncode of documentatie.

## Rollback

Log via SSH in op de VPS, zet tijdelijk `ADMIN_PASSWORD_LOGIN_ENABLED=true` en recreate uitsluitend de API. Iedere geslaagde of mislukte poging wordt als `break_glass` in de privacyveilige adminaudit vastgelegd. Herstel de Google-configuratie, zet de flag direct terug op `false` en recreate opnieuw alleen de API. Verwijder of wijzig geen gewone appgebruikers en geen catalogusdata.
