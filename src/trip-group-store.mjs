import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { notificationStore as defaultNotificationStore } from "./notification-store.mjs";
import { classifySnapshotChange } from "./trip-group-notifications.mjs";

let pool;
const iso = value => value ? new Date(value).toISOString() : null;
const date = value => value ? String(value).slice(0, 10) : null;
const hash = value => createHash("sha256").update(value).digest("hex");
export class TripGroupError extends Error { constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); } }
function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is required");
  const sslOff = ["0", "false", "disable"].includes(String(process.env.DATABASE_SSL || "").toLowerCase()) || url.includes("localhost");
  return pool ||= new pg.Pool({ connectionString: url, ssl: sslOff ? false : { rejectUnauthorized: false } });
}
const memberDto = row => ({ userId: row.user_id, displayName: row.display_name || "", avatarUrl: row.avatar_url || "", role: row.role, acceptedAt: iso(row.accepted_at) });
const inviteDto = row => ({ id: row.id, email: row.normalized_email, displayName: row.display_name || "", role: row.role, status: row.status, expiresAt: iso(row.expires_at), createdAt: iso(row.created_at) });

export class TripGroupStore {
  constructor({ notifier = defaultNotificationStore() } = {}) { this.notifier = notifier; }
  async membership(query, userId, groupId) {
    const row = (await query.query(`SELECT g.*,m.role FROM trip_groups g JOIN trip_group_members m ON m.group_id=g.id WHERE g.id=$1 AND m.user_id=$2`, [groupId, userId])).rows[0];
    if (!row) throw new TripGroupError(404, "NOT_FOUND", "Trip group not found");
    return row;
  }
  async dto(query, userId, groupId) {
    const group = await this.membership(query, userId, groupId);
    const members = (await query.query(`SELECT m.*,u.display_name,u.avatar_url FROM trip_group_members m JOIN app_users u ON u.id=m.user_id WHERE m.group_id=$1 ORDER BY m.accepted_at`, [groupId])).rows.map(memberDto);
    const invitations = group.role === "OWNER" ? (await query.query(`SELECT * FROM trip_group_invitations WHERE group_id=$1 AND status='PENDING' AND expires_at>NOW() ORDER BY created_at`, [groupId])).rows.map(inviteDto) : undefined;
    return { id: group.id, clientTripId: group.client_trip_id, title: group.title, startDate: date(group.start_date), endDate: date(group.end_date), revision: group.revision, content: group.content_json, role: group.role, createdAt: iso(group.created_at), updatedAt: iso(group.updated_at), members, ...(invitations ? { invitations } : {}) };
  }
  async audit(query, groupId, actor, action, metadata = {}) { return (await query.query(`INSERT INTO trip_group_audit(group_id,actor_user_id,action,metadata_json) VALUES($1,$2,$3,$4) RETURNING id`, [groupId, actor, action, JSON.stringify(metadata)])).rows[0].id; }
  async notify(query, groupId, actor, auditId, type, metadata = {}) { return this.notifier.enqueueTripGroupEvent(query, { groupId, actorUserId: actor, eventId: `audit:${auditId}`, type, metadata }); }
  async deliver(userIds) { try { await this.notifier.dispatchPendingForUsers([...new Set(userIds)]); } catch (error) { console.error("Notification dispatch deferred:", error instanceof Error ? error.message : "Unknown error"); } }
  async create(userId, input) {
    const client = await database().connect();
    try { await client.query("BEGIN");
      const existing = (await client.query(`SELECT id FROM trip_groups WHERE owner_user_id=$1 AND (client_trip_id=$2 OR idempotency_key=$3) LIMIT 1`, [userId, input.clientTripId, input.idempotencyKey])).rows[0];
      if (existing) { await client.query("COMMIT"); return this.dto(database(), userId, existing.id); }
      const id = randomUUID();
      await client.query(`INSERT INTO trip_groups(id,owner_user_id,client_trip_id,title,start_date,end_date,content_json,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id, userId, input.clientTripId, input.title, input.startDate, input.endDate, JSON.stringify(input.content), input.idempotencyKey]);
      await this.audit(client, id, userId, "GROUP_CREATED"); await client.query("COMMIT"); return this.dto(database(), userId, id);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async list(userId) { const rows = (await database().query(`SELECT g.id FROM trip_groups g JOIN trip_group_members m ON m.group_id=g.id WHERE m.user_id=$1 ORDER BY g.updated_at DESC`, [userId])).rows; return Promise.all(rows.map(row => this.dto(database(), userId, row.id))); }
  async get(userId, groupId) { return this.dto(database(), userId, groupId); }
  async updateSnapshot(userId, groupId, revision, content) {
    const client = await database().connect(); let recipients=[]; try { await client.query("BEGIN"); const group = await this.membership(client, userId, groupId);
      if (!['OWNER','EDITOR'].includes(group.role)) throw new TripGroupError(403, "FORBIDDEN", "Write access required");
      if (group.revision !== revision) throw new TripGroupError(409, "REVISION_CONFLICT", "Snapshot revision has changed", { serverRevision: group.revision });
      const change=classifySnapshotChange(group.content_json,content);
      const row = (await client.query(`UPDATE trip_groups SET content_json=$3,title=$4,start_date=$5,end_date=$6,revision=revision+1,updated_at=NOW() WHERE id=$1 AND revision=$2 RETURNING revision`, [groupId, revision, JSON.stringify(content),content.name,content.startDate,content.endDate])).rows[0];
      if (!row) throw new TripGroupError(409, "REVISION_CONFLICT", "Snapshot revision has changed"); const auditId=await this.audit(client, groupId, userId, "SNAPSHOT_UPDATED", { revision: row.revision }); if(change)recipients=await this.notify(client,groupId,userId,auditId,change.type,{...change.metadata,revision:row.revision}); await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await this.deliver(recipients);return this.dto(database(), userId, groupId);
  }
  async createInvitation(userId, groupId, input) {
    const client = await database().connect(); try { await client.query("BEGIN"); const group = await this.membership(client, userId, groupId); if (group.role !== "OWNER") throw new TripGroupError(404, "NOT_FOUND", "Trip group not found");
      const count = Number((await client.query(`SELECT COUNT(*) n FROM trip_group_invitations WHERE group_id=$1 AND status='PENDING' AND expires_at>NOW()`, [groupId])).rows[0].n); if (count >= 25) throw new TripGroupError(429, "INVITATION_LIMIT", "Too many active invitations");
      const recent = await client.query(`SELECT 1 FROM trip_group_invitations WHERE invited_by_user_id=$1 AND normalized_email=$2 AND created_at>NOW()-INTERVAL '60 seconds' LIMIT 1`, [userId, input.email]); if (recent.rowCount) throw new TripGroupError(429, "RATE_LIMITED", "Please wait before inviting this address again");
      const token = randomBytes(32).toString("base64url"), id = randomUUID();
      const row = (await client.query(`INSERT INTO trip_group_invitations(id,group_id,invited_by_user_id,token_hash,normalized_email,display_name,role,status,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING',NOW()+INTERVAL '7 days') RETURNING *`, [id, groupId, userId, hash(token), input.email, input.displayName, input.role])).rows[0];
      await this.audit(client, groupId, userId, "INVITATION_CREATED", { invitationId: id, role: input.role }); await client.query("COMMIT"); return { invitation: inviteDto(row), token, groupTitle: group.title };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async deliveryFailed(userId, groupId, invitationId) { await database().query(`UPDATE trip_group_invitations SET status='DELIVERY_FAILED',updated_at=NOW() WHERE id=$1 AND group_id=$2 AND invited_by_user_id=$3 AND status='PENDING'`, [invitationId, groupId, userId]); await this.audit(database(), groupId, userId, "INVITATION_DELIVERY_FAILED", { invitationId }); }
  async revoke(userId, groupId, invitationId) { const group = await this.membership(database(), userId, groupId); if (group.role !== "OWNER") throw new TripGroupError(404,"NOT_FOUND","Trip group not found"); const row=(await database().query(`UPDATE trip_group_invitations SET status='REVOKED',updated_at=NOW() WHERE id=$1 AND group_id=$2 AND status='PENDING' RETURNING id`,[invitationId,groupId])).rows[0]; if(!row)throw new TripGroupError(404,"NOT_FOUND","Invitation not found"); await this.audit(database(),groupId,userId,"INVITATION_REVOKED",{invitationId}); return {revoked:true}; }
  async resolveInvitation(userId, token, accepted) {
    const client=await database().connect();let recipients=[],result; try{await client.query("BEGIN"); const invitation=(await client.query(`SELECT i.*,u.email account_email FROM trip_group_invitations i JOIN app_users u ON u.id=$2 WHERE token_hash=$1 FOR UPDATE`,[hash(token),userId])).rows[0]; if(!invitation)throw new TripGroupError(404,"NOT_FOUND","Invitation not found");
      if(invitation.normalized_email!==String(invitation.account_email||"").trim().toLowerCase())throw new TripGroupError(403,"EMAIL_MISMATCH","Invitation belongs to another account");
      if(invitation.expires_at<=new Date()&&invitation.status==='PENDING'){await client.query(`UPDATE trip_group_invitations SET status='EXPIRED',updated_at=NOW() WHERE id=$1`,[invitation.id]);throw new TripGroupError(410,"INVITATION_EXPIRED","Invitation has expired");}
      const target=accepted?'ACCEPTED':'DECLINED'; if(invitation.status===target&&(!accepted||invitation.accepted_by_user_id===userId)){await client.query("COMMIT");result=accepted?await this.dto(database(),userId,invitation.group_id):{status:target};return result;} if(invitation.status!=='PENDING')throw new TripGroupError(409,"INVITATION_UNAVAILABLE","Invitation is no longer available");
      if(accepted)await client.query(`INSERT INTO trip_group_members(group_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(group_id,user_id) DO UPDATE SET role=EXCLUDED.role,updated_at=NOW()`,[invitation.group_id,userId,invitation.role]); await client.query(`UPDATE trip_group_invitations SET status=$2,accepted_by_user_id=CASE WHEN $2='ACCEPTED' THEN $3 ELSE NULL END,updated_at=NOW() WHERE id=$1`,[invitation.id,target,userId]); const auditId=await this.audit(client,invitation.group_id,userId,accepted?"INVITATION_ACCEPTED":"INVITATION_DECLINED",{invitationId:invitation.id});recipients=await this.notify(client,invitation.group_id,userId,auditId,accepted?"TRIP_INVITATION_ACCEPTED":"TRIP_INVITATION_DECLINED"); await client.query("COMMIT");result=accepted?await this.dto(database(),userId,invitation.group_id):{status:target};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    await this.deliver(recipients);return result;
  }
  async changeRole(userId,groupId,memberId,role){const client=await database().connect();let recipients=[];try{await client.query("BEGIN");const group=await this.membership(client,userId,groupId);if(group.role!=="OWNER")throw new TripGroupError(404,"NOT_FOUND","Trip group not found");if(memberId===group.owner_user_id)throw new TripGroupError(409,"OWNER_REQUIRED","Primary owner role cannot be changed");const existing=(await client.query(`SELECT role FROM trip_group_members WHERE group_id=$1 AND user_id=$2 FOR UPDATE`,[groupId,memberId])).rows[0];if(!existing)throw new TripGroupError(404,"NOT_FOUND","Member not found");if(existing.role!==role){await client.query(`UPDATE trip_group_members SET role=$3,updated_at=NOW() WHERE group_id=$1 AND user_id=$2`,[groupId,memberId,role]);const auditId=await this.audit(client,groupId,userId,"MEMBER_ROLE_CHANGED",{memberUserId:memberId,role});recipients=await this.notify(client,groupId,userId,auditId,"TRIP_MEMBER_ROLE_CHANGED",{role});}await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}await this.deliver(recipients);return{userId:memberId,role};}
  async removeMember(userId,groupId,memberId){const client=await database().connect();let recipients=[];try{await client.query("BEGIN");const group=await this.membership(client,userId,groupId);if(group.role!=="OWNER")throw new TripGroupError(404,"NOT_FOUND","Trip group not found");if(memberId===group.owner_user_id)throw new TripGroupError(409,"OWNER_REQUIRED","Primary owner cannot be removed");const result=await client.query(`DELETE FROM trip_group_members WHERE group_id=$1 AND user_id=$2`,[groupId,memberId]);if(!result.rowCount)throw new TripGroupError(404,"NOT_FOUND","Member not found");const auditId=await this.audit(client,groupId,userId,"MEMBER_REMOVED",{memberUserId:memberId});recipients=await this.notify(client,groupId,userId,auditId,"TRIP_MEMBER_REMOVED");await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}await this.deliver(recipients);return{removed:true};}
  async leave(userId,groupId){const client=await database().connect();let recipients=[];try{await client.query("BEGIN");const group=await this.membership(client,userId,groupId);if(group.role==='OWNER')throw new TripGroupError(409,"OWNER_REQUIRED","Last owner cannot leave");await client.query(`DELETE FROM trip_group_members WHERE group_id=$1 AND user_id=$2`,[groupId,userId]);const auditId=await this.audit(client,groupId,userId,"MEMBER_LEFT");recipients=await this.notify(client,groupId,userId,auditId,"TRIP_MEMBER_LEFT");await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}await this.deliver(recipients);return{left:true};}
}
export const tripGroupStore = () => new TripGroupStore();
