import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { pushTransportFromEnv } from "./notification-transport.mjs";
import { normalizeContentLanguage } from "./locale.mjs";

let pool;
const iso = value => value ? new Date(value).toISOString() : null;
const hash = value => createHash("sha256").update(value).digest("hex");
const time = value => String(value || "").slice(0, 5);

export class NotificationError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); }
}

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  return pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
}

function encryptionKey(environment = process.env) {
  const encoded = String(environment.NOTIFICATION_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  return key.length === 32 ? key : null;
}

export function encryptDeviceToken(token, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptDeviceToken(value, key) {
  const [version, iv, tag, encrypted] = String(value).split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted device token");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

const preferenceDto = row => ({
  pushEnabled: row.push_enabled,
  tripGroupActivity: row.trip_group_activity,
  tripReminders: row.trip_reminders,
  tripEvents: row.trip_events,
  nearby: row.nearby,
  antoineTips: row.antoine_tips,
  badges: row.badges,
  quietHours: { enabled: row.quiet_hours_enabled, start: time(row.quiet_hours_start), end: time(row.quiet_hours_end), timezone: row.timezone },
  deliveryMode: row.delivery_mode,
  locale: normalizeContentLanguage(row.locale),
  updatedAt: iso(row.updated_at)
});
const deviceDto = row => ({ id: row.id, installationId: row.installation_id, platform: row.platform, provider: row.provider, appVersion: row.app_version, active: row.active, lastSeenAt: iso(row.last_seen_at), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const notificationDto = row => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  createdAt: iso(row.created_at),
  readAt: iso(row.read_at),
  tripGroupId: row.trip_group_id || null,
  clientTripId: row.client_trip_id || null,
  actorName: row.actor_name || "",
  deepLink: row.deep_link_json,
  metadata: row.metadata_json
});

export const notificationPresentation = (type, locale = "en") => {
  const language = normalizeContentLanguage(locale);
  if (language === "en") {
    if (type === "TRIP_INVITATION_ACCEPTED") return { title: "Invitation accepted", body: "A travel companion has joined the trip group." };
    if (type === "TRIP_INVITATION_DECLINED") return { title: "Invitation declined", body: "An invitation to the trip group was declined." };
    if (type === "TRIP_MEMBER_ROLE_CHANGED") return { title: "Role changed", body: "A travel companion's role was changed." };
    if (type === "TRIP_MEMBER_REMOVED") return { title: "Trip group changed", body: "A travel companion was removed from the trip group." };
    if (type === "TRIP_MEMBER_LEFT") return { title: "Travel companion left", body: "A travel companion has left the trip group." };
    if (type === "TRIP_ACTIVITY_ADDED") return { title: "New activity", body: "A travel companion added an activity." };
    if (type === "TRIP_ACTIVITY_UPDATED") return { title: "Activity changed", body: "A travel companion changed an activity." };
    if (type === "TRIP_ACTIVITY_REMOVED") return { title: "Activity removed", body: "A travel companion removed an activity." };
    if (type === "TRIP_DETAILS_UPDATED") return { title: "Trip details changed", body: "A travel companion changed the trip name or dates." };
    if (type === "TRIP_GROUP_ACTIVITY_BUNDLE") return { title: "Multiple trip changes", body: "A travel companion made several changes." };
    return { title: "Trip group updated", body: "A travel companion updated the shared trip." };
  }
  if (type === "TRIP_INVITATION_ACCEPTED") return { title: "Uitnodiging geaccepteerd", body: "Een reisgenoot heeft zich bij de reisgroep gevoegd." };
  if (type === "TRIP_INVITATION_DECLINED") return { title: "Uitnodiging afgewezen", body: "Een uitnodiging voor de reisgroep is afgewezen." };
  if (type === "TRIP_MEMBER_ROLE_CHANGED") return { title: "Rol gewijzigd", body: "De rol van een reisgenoot is gewijzigd." };
  if (type === "TRIP_MEMBER_REMOVED") return { title: "Reisgroep gewijzigd", body: "Een reisgenoot is uit de reisgroep verwijderd." };
  if (type === "TRIP_MEMBER_LEFT") return { title: "Reisgenoot vertrokken", body: "Een reisgenoot heeft de reisgroep verlaten." };
  if (type === "TRIP_ACTIVITY_ADDED") return { title: "Nieuwe activiteit", body: "Een reisgenoot heeft een activiteit toegevoegd." };
  if (type === "TRIP_ACTIVITY_UPDATED") return { title: "Activiteit gewijzigd", body: "Een reisgenoot heeft een activiteit gewijzigd." };
  if (type === "TRIP_ACTIVITY_REMOVED") return { title: "Activiteit verwijderd", body: "Een reisgenoot heeft een activiteit verwijderd." };
  if (type === "TRIP_DETAILS_UPDATED") return { title: "Reisgegevens gewijzigd", body: "Een reisgenoot heeft de naam of reisdatums gewijzigd." };
  if (type === "TRIP_GROUP_ACTIVITY_BUNDLE") return { title: "Meerdere reiswijzigingen", body: "Een reisgenoot heeft meerdere wijzigingen aangebracht." };
  return { title: "Reisgroep bijgewerkt", body: "Een reisgenoot heeft de gedeelde reis bijgewerkt." };
};

function quietDelayMs(row, now = new Date()) {
  if (!row.quiet_hours_enabled) return 0;
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: row.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(item => [item.type, item.value]));
  } catch { return 0; }
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const parse = value => { const [hours, minutes] = time(value).split(":").map(Number); return hours * 60 + minutes; };
  const start = parse(row.quiet_hours_start), end = parse(row.quiet_hours_end);
  if (start === end) return 0;
  const inside = start < end ? current >= start && current < end : current >= start || current < end;
  if (!inside) return 0;
  const minutes = current < end ? end - current : (1440 - current) + end;
  return minutes * 60_000;
}

export class NotificationStore {
  constructor({ query = database, transport = pushTransportFromEnv(), key = encryptionKey() } = {}) {
    this.querySource = query;
    this.transport = transport;
    this.key = key;
  }
  db() { return typeof this.querySource === "function" ? this.querySource() : this.querySource; }

  async preferences(userId) {
    await this.db().query(`INSERT INTO notification_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [userId]);
    return preferenceDto((await this.db().query(`SELECT * FROM notification_preferences WHERE user_id=$1`, [userId])).rows[0]);
  }
  async updatePreferences(userId, input) {
    const row = (await this.db().query(`INSERT INTO notification_preferences(
      user_id,push_enabled,trip_group_activity,trip_reminders,trip_events,nearby,antoine_tips,badges,
      quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone,delivery_mode,locale
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT(user_id) DO UPDATE SET push_enabled=EXCLUDED.push_enabled,
      trip_group_activity=EXCLUDED.trip_group_activity,trip_reminders=EXCLUDED.trip_reminders,
      trip_events=EXCLUDED.trip_events,nearby=EXCLUDED.nearby,antoine_tips=EXCLUDED.antoine_tips,
      badges=EXCLUDED.badges,quiet_hours_enabled=EXCLUDED.quiet_hours_enabled,
      quiet_hours_start=EXCLUDED.quiet_hours_start,quiet_hours_end=EXCLUDED.quiet_hours_end,
      timezone=EXCLUDED.timezone,delivery_mode=EXCLUDED.delivery_mode,locale=EXCLUDED.locale,updated_at=NOW()
    RETURNING *`, [userId,input.pushEnabled,input.tripGroupActivity,input.tripReminders,input.tripEvents,input.nearby,input.antoineTips,input.badges,input.quietHours.enabled,input.quietHours.start,input.quietHours.end,input.quietHours.timezone,input.deliveryMode,normalizeContentLanguage(input.locale)])).rows[0];
    return preferenceDto(row);
  }
  async registerDevice(userId, input) {
    if (!this.key) throw new NotificationError(503, "DEVICE_REGISTRATION_DISABLED", "Secure device registration is not configured");
    const id = randomUUID(), ciphertext = encryptDeviceToken(input.pushToken, this.key);
    const row = (await this.db().query(`INSERT INTO notification_devices(id,user_id,installation_id,platform,provider,token_hash,token_ciphertext,app_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(user_id,installation_id) DO UPDATE SET platform=EXCLUDED.platform,provider=EXCLUDED.provider,
        token_hash=EXCLUDED.token_hash,token_ciphertext=EXCLUDED.token_ciphertext,app_version=EXCLUDED.app_version,
        active=TRUE,last_seen_at=NOW(),updated_at=NOW() RETURNING *`, [id,userId,input.installationId,input.platform,input.provider,hash(input.pushToken),ciphertext,input.appVersion])).rows[0];
    return deviceDto(row);
  }
  async unregisterDevice(userId, deviceId) {
    const row = (await this.db().query(`UPDATE notification_devices SET active=FALSE,token_ciphertext='',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND active=TRUE RETURNING id`, [deviceId,userId])).rows[0];
    if (!row) throw new NotificationError(404, "NOT_FOUND", "Notification device not found");
    return { unregistered: true };
  }
  async list(userId, { limit, unread = false, beforeCreatedAt = null, beforeId = null }) {
    const rows = (await this.db().query(`SELECT n.*,g.client_trip_id,u.display_name actor_name FROM notification_inbox n
      LEFT JOIN trip_groups g ON g.id=n.trip_group_id LEFT JOIN app_users u ON u.id=n.actor_user_id
      WHERE n.user_id=$1 AND ($2::boolean=FALSE OR n.read_at IS NULL)
      AND ($3::timestamptz IS NULL OR (n.created_at,n.id)<($3::timestamptz,$4::uuid))
      ORDER BY n.created_at DESC,n.id DESC LIMIT $5`, [userId,unread,beforeCreatedAt,beforeId,limit+1])).rows;
    const hasMore = rows.length > limit, items = rows.slice(0,limit);
    const last = items.at(-1);
    const unreadCount=Number((await this.db().query(`SELECT COUNT(*) n FROM notification_inbox WHERE user_id=$1 AND read_at IS NULL`,[userId])).rows[0].n);
    return { items: items.map(notificationDto), unreadCount, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ createdAt: iso(last.created_at), id:last.id })).toString("base64url") : null };
  }
  async unreadCount(userId) { return { unreadCount: Number((await this.db().query(`SELECT COUNT(*) n FROM notification_inbox WHERE user_id=$1 AND read_at IS NULL`, [userId])).rows[0].n) }; }
  async markRead(userId, id) {
    const row = (await this.db().query(`WITH changed AS (UPDATE notification_inbox SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING *)
      SELECT changed.*,g.client_trip_id,u.display_name actor_name FROM changed LEFT JOIN trip_groups g ON g.id=changed.trip_group_id LEFT JOIN app_users u ON u.id=changed.actor_user_id`, [id,userId])).rows[0];
    if (!row) throw new NotificationError(404, "NOT_FOUND", "Notification not found");
    return notificationDto(row);
  }
  async markAllRead(userId) {
    const result = await this.db().query(`UPDATE notification_inbox SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL`, [userId]);
    return { markedRead: result.rowCount };
  }

  async enqueueTripGroupEvent(query, { groupId, actorUserId, eventId, type, metadata = {} }) {
    const recipients = (await query.query(`SELECT m.user_id,COALESCE(p.push_enabled,TRUE) push_enabled,COALESCE(p.trip_group_activity,TRUE) trip_group_activity,COALESCE(p.delivery_mode,'IMMEDIATE') delivery_mode,COALESCE(p.locale,'en') locale
      FROM trip_group_members m LEFT JOIN notification_preferences p ON p.user_id=m.user_id
      WHERE m.group_id=$1 AND m.user_id<>$2 AND COALESCE(p.trip_group_activity,TRUE)=TRUE`, [groupId,actorUserId])).rows;
    const recipientIds=[];
    for (const recipient of recipients) {
      const presentation = notificationPresentation(type, recipient.locale);
      const notificationId=randomUUID();
      const inserted=(await query.query(`INSERT INTO notification_inbox(id,user_id,actor_user_id,trip_group_id,type,title,body,deep_link_json,metadata_json,dedupe_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id`, [notificationId,recipient.user_id,actorUserId,groupId,type,presentation.title,presentation.body,JSON.stringify({route:"trip-group",tripGroupId:groupId}),JSON.stringify(metadata),`trip-group:${groupId}:${eventId}`])).rows[0];
      if (!inserted) continue;
      recipientIds.push(recipient.user_id);
      if (recipient.push_enabled && recipient.delivery_mode === "IMMEDIATE") {
        const devices=(await query.query(`SELECT id FROM notification_devices WHERE user_id=$1 AND active=TRUE`,[recipient.user_id])).rows;
        for (const device of devices) await query.query(`INSERT INTO notification_push_outbox(id,notification_id,device_id) VALUES($1,$2,$3) ON CONFLICT(notification_id,device_id) DO NOTHING`,[randomUUID(),notificationId,device.id]);
      }
    }
    return recipientIds;
  }

  async enqueueUserEvent(query, { userId, type, title, body, deepLink = {}, metadata = {}, dedupeKey }) {
    const notificationId = randomUUID();
    const inserted = (await query.query(`INSERT INTO notification_inbox(
      id,user_id,type,title,body,deep_link_json,metadata_json,dedupe_key
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id`, [
      notificationId,userId,type,title,body,JSON.stringify(deepLink),JSON.stringify(metadata),dedupeKey
    ])).rows[0];
    if (!inserted) return null;
    const preference = (await query.query(`SELECT COALESCE(push_enabled,TRUE) push_enabled,
      COALESCE(delivery_mode,'IMMEDIATE') delivery_mode FROM notification_preferences WHERE user_id=$1`, [userId])).rows[0];
    if ((preference?.push_enabled ?? true) && (preference?.delivery_mode || "IMMEDIATE") === "IMMEDIATE") {
      const devices = (await query.query(`SELECT id FROM notification_devices WHERE user_id=$1 AND active=TRUE`, [userId])).rows;
      for (const device of devices) {
        await query.query(`INSERT INTO notification_push_outbox(id,notification_id,device_id)
          VALUES($1,$2,$3) ON CONFLICT(notification_id,device_id) DO NOTHING`, [randomUUID(),notificationId,device.id]);
      }
    }
    return notificationId;
  }

  async dispatchPendingForUsers(userIds) {
    if (!this.transport.enabled || !this.key || !userIds.length) return { attempted: 0, disabled: !this.transport.enabled || !this.key };
    const rows=(await this.db().query(`SELECT o.*,d.user_id,d.token_ciphertext,n.type,n.title,n.body,n.deep_link_json,n.metadata_json,
      p.quiet_hours_enabled,p.quiet_hours_start,p.quiet_hours_end,p.timezone
      FROM notification_push_outbox o JOIN notification_devices d ON d.id=o.device_id AND d.active=TRUE
      JOIN notification_inbox n ON n.id=o.notification_id
      LEFT JOIN notification_preferences p ON p.user_id=d.user_id
      WHERE d.user_id=ANY($1::text[]) AND o.status IN ('PENDING','RETRY') AND o.next_attempt_at<=NOW() AND o.attempts<6
      ORDER BY o.created_at LIMIT 100`,[userIds])).rows;
    let attempted=0;
    for(const row of rows){
      const delay=quietDelayMs({...row,quiet_hours_enabled:row.quiet_hours_enabled??true,quiet_hours_start:row.quiet_hours_start||"22:00",quiet_hours_end:row.quiet_hours_end||"08:00",timezone:row.timezone||"Europe/Amsterdam"});
      if(delay){await this.db().query(`UPDATE notification_push_outbox SET next_attempt_at=NOW()+($2::bigint*INTERVAL '1 millisecond'),updated_at=NOW() WHERE id=$1`,[row.id,delay]);continue;}
      attempted++;
      try{
        const token=decryptDeviceToken(row.token_ciphertext,this.key);
        await this.transport.send({token,notification:{id:row.notification_id,type:row.type,title:row.title,body:row.body,deepLink:row.deep_link_json,metadata:row.metadata_json}});
        await this.db().query(`UPDATE notification_push_outbox SET status='SENT',attempts=attempts+1,sent_at=NOW(),updated_at=NOW(),last_error_code=NULL WHERE id=$1`,[row.id]);
      }catch(error){
        const permanent=Boolean(error?.permanent), code=String(error?.code||"PUSH_FAILED").slice(0,80);
        await this.db().query(`UPDATE notification_push_outbox SET status=$2,attempts=attempts+1,next_attempt_at=NOW()+(LEAST(3600,POWER(2,attempts)*30)*INTERVAL '1 second'),last_error_code=$3,updated_at=NOW() WHERE id=$1`,[row.id,permanent?"FAILED":"RETRY",code]);
        if(permanent)await this.db().query(`UPDATE notification_devices SET active=FALSE,token_ciphertext='',updated_at=NOW() WHERE id=$1`,[row.device_id]);
      }
    }
    return {attempted,disabled:false};
  }
}

export const notificationStore = options => new NotificationStore(options);
