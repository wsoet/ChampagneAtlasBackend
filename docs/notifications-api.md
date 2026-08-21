# Notification API

This additive backend slice provides a private notification inbox and optional
FCM HTTP v1 delivery. It is implemented locally and is not deployed by this
change.

All endpoints require the existing bearer authentication and return
`Cache-Control: private, no-store`. Notification and device lookups are always
scoped to the authenticated `user.sub`; a foreign or unknown object returns
`404 NOT_FOUND`.

## Android inbox contract

```http
GET /api/v1/notifications?unread=true&limit=30
Authorization: Bearer <access token>
```

`unread` defaults to `false`; `limit` defaults to 30 and is capped at 100. An
opaque `cursor` returned as `nextCursor` can be supplied for the next page.

```json
{
  "items": [
    {
      "id": "6ece21d0-8a8c-4f29-9ea9-1d1cf3883894",
      "type": "TRIP_ACTIVITY_ADDED",
      "title": "Nieuwe activiteit",
      "body": "Een reisgenoot heeft een activiteit toegevoegd.",
      "createdAt": "2026-08-02T12:00:00.000Z",
      "readAt": null,
      "tripGroupId": "e11918d7-7c35-4594-8d78-8f7a7dbfaf76",
      "clientTripId": "45a9c8f6-39b4-478e-8743-96d22822b990",
      "actorName": "Sophie",
      "deepLink": {
        "route": "trip-group",
        "tripGroupId": "e11918d7-7c35-4594-8d78-8f7a7dbfaf76"
      },
      "metadata": {
        "bundled": false,
        "changeCount": 1,
        "changeTypes": ["ACTIVITY_ADDED"]
      }
    }
  ],
  "unreadCount": 1,
  "nextCursor": null
}
```

The presentation is deliberately generic. Payloads contain no email address,
invitation token, device token, trip snapshot, house/event title, or other
sensitive content. `actorName` is the existing app display name and can be an
empty string when the account no longer exists.

```http
GET /api/v1/notifications/unread-count
PATCH /api/v1/notifications/{notificationId}
POST /api/v1/notifications/read-all
```

PATCH body:

```json
{ "read": true }
```

`read-all` returns `{ "markedRead": 3 }`; unread-count returns
`{ "unreadCount": 3 }`. Marking a notification read is idempotent.

## Preferences

```http
GET /api/v1/notifications/preferences
PUT /api/v1/notifications/preferences
```

The GET creates defaults on first use. PUT is a full replacement and uses this
camelCase contract:

```json
{
  "pushEnabled": true,
  "tripGroupActivity": true,
  "tripReminders": true,
  "tripEvents": true,
  "nearby": false,
  "antoineTips": false,
  "badges": false,
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "Europe/Amsterdam"
  },
  "deliveryMode": "IMMEDIATE"
}
```

`tripGroupActivity` defaults on. `nearby`, `antoineTips`, and `badges` default
off. `DAILY` is accepted as preference/data contract; a daily summary scheduler
is intentionally outside this slice. The `TRIP_REMINDER` type and preference
are prepared, but this slice does not schedule reminders.

## Devices

```http
POST /api/v1/notifications/devices
DELETE /api/v1/notifications/devices/{deviceId}
```

Register or refresh an installation:

```json
{
  "installationId": "stable-random-installation-id",
  "platform": "ANDROID",
  "provider": "FCM",
  "pushToken": "<FCM registration token>",
  "appVersion": "2.0.0"
}
```

Registration is idempotent per authenticated user and `installationId`. The
response never returns the push token. Unregistering removes the encrypted
token material and deactivates that owner's device. A foreign device ID is
concealed as 404.

## Trip-group events

Notifications are produced only for current trip-group members other than the
actor, and only when `tripGroupActivity` is enabled:

- house or event added, edited, moved, or removed through a snapshot update;
- trip title or travel dates changed;
- invitation accepted or declined;
- member role changed, member removed, or member left.

A snapshot mutation with multiple change classes produces one
`TRIP_GROUP_ACTIVITY_BUNDLE` item with safe bundling metadata. The audit row ID
forms the dedupe key, and `(user_id, dedupe_key)` is unique. Repeated invitation
resolution and unchanged role updates therefore do not create duplicates.

The inbox and per-device push outbox rows are inserted in the same PostgreSQL
transaction as the successful trip mutation. FCM dispatch starts only after
commit and never rolls back a successful mutation. Provider failures use a
bounded exponential retry; permanently invalid tokens are deactivated.

## Provider and secret configuration

Apply locally or in a separately approved release:

```text
npm run migrate:notifications:dry-run
npm run migrate:notifications
```

Required for secure device registration:

```text
NOTIFICATION_TOKEN_ENCRYPTION_KEY=<32 random bytes, base64 encoded>
```

Optional FCM HTTP v1 transport:

```text
FCM_PROJECT_ID=<Firebase project id>
FCM_CLIENT_EMAIL=<service-account client email>
FCM_PRIVATE_KEY=<service-account private key, newline escapes accepted>
```

FCM credentials are read only from the process environment and have no database
columns. Registration tokens are AES-256-GCM encrypted and separately hashed;
they are never logged or returned. When encryption or complete FCM credentials
are absent, registration/transport fails closed or remains safely disabled while
the private in-app inbox continues to work.
