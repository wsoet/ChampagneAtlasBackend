export const PLAN_LIMITS = Object.freeze({
  FREE: Object.freeze({
    chefTotalPerWeek: 5, chefPhotosPerWeek: 2,
    favoriteHouses: 20, favoriteChampagnes: 20, tastingJournalEntries: 30,
    tastingJournalPhotoScan: false, offlineMaps: false, smartTripPlanning: false
  }),
  PRO: Object.freeze({
    chefTotalPerWeek: 30, chefPhotosPerWeek: 5,
    favoriteHouses: null, favoriteChampagnes: null, tastingJournalEntries: 150,
    tastingJournalPhotoScan: true, offlineMaps: true, smartTripPlanning: true
  }),
  PRO_PLUS: Object.freeze({
    chefTotalPerWeek: 50, chefPhotosPerWeek: 20,
    favoriteHouses: null, favoriteChampagnes: null, tastingJournalEntries: null,
    tastingJournalPhotoScan: true, offlineMaps: true, smartTripPlanning: true
  }),
  TRIP_PASS: Object.freeze({
    chefTotalPerWeek: 30, chefPhotosPerWeek: 5,
    favoriteHouses: null, favoriteChampagnes: null, tastingJournalEntries: 150,
    tastingJournalPhotoScan: true, offlineMaps: true, smartTripPlanning: true
  })
});

export function entitlementPlan(entitlement) {
  if (!entitlement) return "FREE";
  const explicit = String(entitlement.plan || "").toUpperCase();
  if (PLAN_LIMITS[explicit]) return explicit;
  return entitlement.kind === "TRIP_PASS" ? "TRIP_PASS" : "PRO";
}

export function limitsForEntitlement(entitlement, enforced = true) {
  if (!enforced) return Object.freeze({
    chefTotalPerWeek: null, chefPhotosPerWeek: null,
    favoriteHouses: null, favoriteChampagnes: null, tastingJournalEntries: null,
    tastingJournalPhotoScan: true, offlineMaps: true, smartTripPlanning: true
  });
  return PLAN_LIMITS[entitlementPlan(entitlement)];
}
