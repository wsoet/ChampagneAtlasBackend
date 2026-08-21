# Champagne Atlas website-accountcontract

## Authenticatie

- `GET /auth/web/google/start?return_to=/...` start Google OIDC met state, nonce en PKCE. Alleen een pad op `https://champagneatlas.nl` wordt als `return_to` geaccepteerd.
- Google callback: `https://api.champagneatlas.nl/auth/web/google/callback`.
- De callback zet `ca_web_session` (`HttpOnly`, `Secure`, `SameSite=Strict`, 30 dagen) en een afzonderlijk CSRF-cookie en stuurt terug naar de veilige website-URL.
- `GET /api/v1/web/session` retourneert `account`, `csrfToken` en `entitlement`. Het access/refresh-token van de Android-app wordt nooit in browseropslag geplaatst.
- `POST /auth/web/logout` trekt de serversessie in en wist beide cookies. `GET` blijft als compatibele redirect beschikbaar.

Alle accountresponses zijn `Cache-Control: private, no-store`. Browsermutaties sturen de waarde `csrfToken` in `X-CSRF-Token`. GET/HEAD hebben geen CSRF-header nodig.

## Gedeelde owner-API's

Deze routes accepteren zowel de bestaande Android Bearer-auth als de veilige websessie en blijven object-/owner-scoped:

- `/api/v1/user-saved-houses`
- `/api/v1/visits`
- `/api/v1/trips`
- `/api/v1/tasting-journal`
- `/api/v1/chef/profile` (alleen het gedeelde smaakprofiel)
- `/api/v1/entitlements/me`

`/api/v2/chef/*` en `/api/v1/chef/chat` geven voor een websessie `403 APP_ONLY`. Camera/etiketscan en offline regiopakketten hebben geen webcontract.

## Entitlementmatrix

| Functie | Free | Pro · € 4,99/m | Pro Plus · € 9,99/m | Trip Pass · € 3,99/week |
|---|---:|---:|---:|---:|
| Publieke catalogus, kaart, regio's, plaatsen, Explore, Viator, Muselet | ja | ja | ja | ja |
| Antoine totaal per ISO-week | 5 | 30 | 50 | 30 |
| Waarvan fotoanalyses | 2 | 5 | 20 | 5 |
| Favoriete huizen | 20 | onbeperkt | onbeperkt | onbeperkt |
| Favoriete champagnes | 20 | onbeperkt | onbeperkt | onbeperkt |
| Zichtbare proefboeknotities | 30 | 150 | onbeperkt | 150 |
| Proefboek-fotoscan | nee | ja | ja | ja |
| Persoonlijke dagplanner / automatisch vullen | nee | ja | ja | ja |
| Routeoptimalisatie | nee | ja | ja | ja |
| Offline regiopakketten | nee | ja | ja | ja |

Serverfout voor betaalde functies: HTTP `402` met `{error:{code:"ENTITLEMENT_REQUIRED",message,details:{feature}}}`. De actuele status komt uit `GET /api/v1/entitlements/me` of `web/session.entitlement`. Google Play-aankopen vereisen vóór publieke betaalde livegang nog productie-verificatie en server-side omzetting naar `pro_entitlements`; handmatig uitgegeven Trip Passes zijn al server-side controleerbaar.

Een actieve Champagne Trip Pass kost € 3,99 en is zeven dagen geldig. Gedurende die week levert de pas dezelfde featuretoegang en quota als Pro. Na afloop gelden de Free-limieten. Inhoud boven die limieten blijft bewaard maar wordt tijdelijk verborgen en verschijnt opnieuw zodra Pro, Pro Plus of een Trip Pass wordt geactiveerd.

## Migraties

- `014_tasting_journal`: privé/accountgebonden proefnotities en foto, owner-isolatie en tombstones.
- `015_web_sessions`: gehashte websessies, gehashte CSRF-binding en eenmalige OAuth-state. Down-migratie verwijdert uitsluitend deze additieve tabellen.
