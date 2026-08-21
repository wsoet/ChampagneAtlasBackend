import test from "node:test";
import assert from "node:assert/strict";
import { userAdminStore } from "../src/user-admin-store.mjs";
import { userAdminPage } from "../src/user-admin-page.mjs";

test("user list returns signup and current subscription without leaking secrets", async () => {
  let captured;
  const store = userAdminStore({ db: { query: async (sql, params) => { captured = { sql, params }; return { rows: [{ id:"u1", email:"test@example.com", display_name:"Test", avatar_url:"", created_at:new Date("2026-01-02"), entitlement_id:"e1", entitlement_kind:"SUBSCRIPTION", entitlement_plan:"PRO", entitlement_source:"GOOGLE_PLAY", entitlement_starts_at:new Date("2026-01-01"), entitlement_ends_at:new Date("2027-01-01") }] }; } } });
  const result = await store.list({ search:"test", plan:"PRO" });
  assert.equal(result[0].subscription.kind, "SUBSCRIPTION");
  assert.equal(result[0].email, "test@example.com");
  assert.match(captured.sql, /LEFT JOIN LATERAL/);
  assert.equal(result[0].subscription.plan, "PRO");
  assert.deepEqual(captured.params, ["test", "PRO"]);
});

test("subscription change is transactional and FREE revokes without inserting", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: sql.startsWith("SELECT") ? [{ id:"u1" }] : [] }; }, release() {} };
  const store = userAdminStore({ db: { connect: async () => client }, now: () => new Date("2026-08-01") });
  await store.setSubscription({ userId:"u1", kind:"FREE", changedBy:"wsoet" });
  assert.ok(calls.some((item) => item.sql === "BEGIN"));
  assert.ok(calls.some((item) => /UPDATE pro_entitlements/.test(item.sql)));
  assert.ok(!calls.some((item) => /INSERT INTO pro_entitlements/.test(item.sql)));
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("paid subscription requires a future expiry and inserts an admin entitlement", async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: sql.startsWith("SELECT") ? [{ id:"u1" }] : [] }; }, release() {} };
  const store = userAdminStore({ db: { connect: async () => client }, now: () => new Date("2026-08-01") });
  await store.setSubscription({ userId:"u1", kind:"TRIP_PASS", endsAt:"2026-09-01", changedBy:"wsoet" });
  assert.ok(calls.some((item) => /INSERT INTO pro_entitlements/.test(item.sql) && item.params[2] === "TRIP_PASS"));
  await assert.rejects(() => store.setSubscription({ userId:"u1", kind:"PRO", endsAt:"2026-07-01" }), /toekomstige/);
});

test("delete targets exactly one app user and page escapes identity", async () => {
  let params;
  const store = userAdminStore({ db: { query: async (_sql, input) => { params = input; return { rows:[{ id:"u1" }] }; } } });
  await store.deleteUser("u1"); assert.deepEqual(params, ["u1"]);
  const page = userAdminPage([{ id:"u1",email:"x@example.com",displayName:"<script>x</script>",createdAt:"2026-01-01",subscription:null }], { username:"wsoet" }, "csrf");
  assert.doesNotMatch(page, /<script>x<\/script>/);
  assert.match(page, /Gebruiker definitief verwijderen/);
  assert.match(page, /\/admin\/users\/subscription/);
});
