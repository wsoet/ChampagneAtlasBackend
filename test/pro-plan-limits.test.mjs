import test from "node:test";
import assert from "node:assert/strict";
import { entitlementPlan, limitsForEntitlement, PLAN_LIMITS } from "../src/plan-limits.mjs";

test("plan matrix matches the product limits", () => {
  assert.deepEqual(PLAN_LIMITS.FREE, {
    chefTotalPerWeek: 5, chefPhotosPerWeek: 2,
    favoriteHouses: 20, favoriteChampagnes: 20, tastingJournalEntries: 30,
    tastingJournalPhotoScan: false, offlineMaps: false, smartTripPlanning: false
  });
  assert.equal(PLAN_LIMITS.PRO.chefTotalPerWeek, 30);
  assert.equal(PLAN_LIMITS.PRO.chefPhotosPerWeek, 5);
  assert.equal(PLAN_LIMITS.PRO.tastingJournalEntries, 150);
  assert.equal(PLAN_LIMITS.PRO_PLUS.chefTotalPerWeek, 50);
  assert.equal(PLAN_LIMITS.PRO_PLUS.chefPhotosPerWeek, 20);
  assert.equal(PLAN_LIMITS.PRO_PLUS.tastingJournalEntries, null);
  assert.deepEqual(PLAN_LIMITS.TRIP_PASS, PLAN_LIMITS.PRO);
});

test("expired or missing access falls back to Free and legacy paid access maps to Pro", () => {
  assert.equal(entitlementPlan(null), "FREE");
  assert.equal(entitlementPlan({ kind: "SUBSCRIPTION" }), "PRO");
  assert.equal(entitlementPlan({ kind: "TRIP_PASS" }), "TRIP_PASS");
  assert.equal(entitlementPlan({ kind: "SUBSCRIPTION", plan: "PRO_PLUS" }), "PRO_PLUS");
  assert.equal(limitsForEntitlement(null, true).favoriteHouses, 20);
  assert.equal(limitsForEntitlement(null, false).favoriteHouses, null);
});
