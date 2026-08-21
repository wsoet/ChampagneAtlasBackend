const FLAG_NAMES = [
  "explore",
  "journey",
  "tripPlanner",
  "chefDeCave",
  "automaticContent"
];

function enabledFromEnvironment(name) {
  const key = `FEATURE_${name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`;
  return ["1", "true", "yes", "on"].includes(
    String(process.env[key] || "").trim().toLowerCase()
  );
}

function pilotEmails() {
  return new Set(
    String(process.env.CHAMPAGNE_ATLAS_2_PILOT_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function featureConfiguration(user = null) {
  const email = String(user?.email || "").trim().toLowerCase();
  const pilot = Boolean(email && pilotEmails().has(email));
  const features = Object.fromEntries(
    FLAG_NAMES.map((name) => [name, pilot || enabledFromEnvironment(name)])
  );

  return {
    version: 1,
    product: "Champagne Atlas",
    releaseChannel: pilot ? "pilot" : "production",
    platformPolicy: {
      primaryClient: "android",
      iosReadyContracts: true
    },
    features,
    policies: {
      chatRetentionDays: 15,
      offlineScope: "saved_trips",
      visitPhotos: false,
      preserveLegacyVisitsWithoutDate: true,
      premiumEnforced: true
    }
  };
}
