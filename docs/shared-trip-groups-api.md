# Shared trip groups API (local contract)

Status: implemented locally; not deployed. All `/api/v1` routes require `Authorization: Bearer <cloud token>` and return `Cache-Control: private, no-store`. Cross-user and cross-group access is concealed as `404`.

## Data contract

`TripGroupDto`:

```json
{
  "id": "uuid",
  "clientTripId": "uuid",
  "title": "Herfstreis",
  "startDate": "2026-09-01",
  "endDate": "2026-09-03",
  "revision": 1,
  "content": {
    "name": "Herfstreis",
    "startDate": "2026-09-01",
    "endDate": "2026-09-03",
    "houseIds": ["ruinart"],
    "houseDates": { "ruinart": "2026-09-01" },
    "houseTimes": { "ruinart": "10:00" },
    "events": [{ "id": "event-id", "title": "Diner", "location": "Reims", "startsAt": null, "endsAt": null, "plannedDate": "2026-09-01", "plannedTime": "19:00", "latitude": 49.25, "longitude": 4.03 }]
  },
  "role": "OWNER",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "members": [{ "userId": "string", "displayName": "Werner", "avatarUrl": "https://...", "role": "OWNER", "acceptedAt": "ISO-8601" }],
  "invitations": [{ "id": "uuid", "email": "invitee@example.com", "displayName": "Naam", "role": "EDITOR", "status": "PENDING", "expiresAt": "ISO-8601", "createdAt": "ISO-8601" }]
}
```

`invitations` exists only for an owner. Member DTOs never expose account email addresses. Snapshot JSON is strictly validated and limited to 256 KB.

## Routes

- `POST /api/v1/trip-groups` — body `{clientTripId,title,startDate?,endDate?,content,idempotencyKey}`; `201 TripGroupDto`. Owner membership is seeded transactionally.
- `GET /api/v1/trip-groups` — `{items:[TripGroupDto]}`.
- `GET /api/v1/trip-groups/:groupId` — `TripGroupDto`.
- `PUT /api/v1/trip-groups/:groupId/snapshot` — body `{revision,content}`. OWNER/EDITOR only. Returns `409 REVISION_CONFLICT` with `details.serverRevision` when stale.
- `POST /api/v1/trip-groups/:groupId/invitations` — body `{email,displayName?,role:"EDITOR"|"VIEWER"}`; `201 {invitation}`. The token is sent only by email and is never returned.
- `DELETE /api/v1/trip-groups/:groupId/invitations/:invitationId` — `{revoked:true}`.
- `PATCH /api/v1/trip-groups/:groupId/members/:memberUserId` — body `{role:"EDITOR"|"VIEWER"}`.
- `DELETE /api/v1/trip-groups/:groupId/members/:memberUserId` — `{removed:true}`.
- `DELETE /api/v1/trip-groups/:groupId/members/me` — `{left:true}`. This additional route implements the required leave action; the primary/last owner receives `409 OWNER_REQUIRED`.
- `POST /api/v1/trip-invitations/accept` — body `{token}`. Signed-in account email must exactly match the normalized invitation email. Idempotent for the same accepted account.
- `POST /api/v1/trip-invitations/decline` — body `{token}`.
- Public `GET /auth/trip-invite?token=...` — `302` to `nl.champagneatlas://trip-invite?token=...`; exposes no metadata and uses `no-store`/`no-referrer`.

Errors use `{ "error": { "code": "...", "message": "...", "details": {} } }`. Important statuses: unauthenticated `401`, mismatched email/viewer write `403`, concealed object access `404`, expired invite `410`, revision/state conflict `409`, rate limit `429`, mail delivery failure `502`.

## Security and mail

- Invitation lifetime: seven days.
- Only SHA-256 `token_hash` is stored. Raw tokens are kept only long enough to construct the Resend request.
- Per inviter/e-mail cooldown: 60 seconds; maximum 25 active invitations per group.
- Failed Resend delivery changes the invitation to `DELIVERY_FAILED`, which is not shown as pending.
- Audit records actor, action, timestamp and non-sensitive IDs/roles/revisions; never token or full mail content.
- Resend uses `RESEND_API_KEY` and verified `AUTH_EMAIL_FROM` (legacy fallback `RESET_EMAIL_FROM`). No Android secret.

## Migration and later deployment

Migration `010_shared_trip_groups` is additive. It creates four tables and a trigger that transactionally seeds OWNER membership. Existing Slice 1/2 tables are not altered.

```sh
npm run migrate:trip-groups:dry-run
npm run migrate:trip-groups
```

Rollback is `migrations/010_shared_trip_groups.down.sql`. Before a future production deployment: back up PostgreSQL and affected source files, verify Resend configuration without printing secrets, run the dry-run, apply migration, recreate only API, then run auth/object-isolation and legacy regression checks. No production deployment has been performed as part of this implementation.
