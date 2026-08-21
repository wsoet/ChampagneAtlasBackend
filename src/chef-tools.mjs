import { randomUUID } from "node:crypto";
import { cuveeEvidence } from "./chef-cuvee.mjs";
import { fetchGooglePlaceDetails } from "./chef-places.mjs";

const norm = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const searchable = (value) => norm(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const producerAliases = (name) => {
  const full = searchable(name);
  const words = full.split(" ").filter(Boolean);
  const generic = new Set(["champagne", "maison", "house", "fils", "et", "and"]);
  const core = words.filter((word) => word.length > 1 && !generic.has(word)).join(" ");
  return [...new Set([full, core, ...words.filter((word) => word.length >= 5 && !generic.has(word))])]
    .filter((alias) => alias.length >= 3);
};
const radians = (value) => value * Math.PI / 180;
const distance = (a, b) => {
  const dlat = radians(b.latitude - a.latitude), dlon = radians(b.longitude - a.longitude);
  const q = Math.sin(dlat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(q)));
};
const houseEvidence = (house) => ({
  id: `house:${house.id}`, title: house.name, url: house.website || house.mapsUrl || house.bookingUrl || "",
  body: [
    house.name, house.formattedAddress || house.address, house.city, house.region, house.cruLabel,
    house.visitable ? "bezoekbaar" : "", house.tastings ? "proeverij mogelijk" : "",
    house.website ? `website ${house.website}` : ""
  ].filter(Boolean).join(" · "),
  checkedAt: house.editedAt || new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  confidence: 0.85, conflict: false, tags: [house.name, house.city, house.region].filter(Boolean),
  authority: 85, sourceType: "ATLAS_CATALOG", claimType: "HOUSE_PROFILE"
});

const houseItem = (house) => ({
  id: house.id, name: house.name, city: house.city || "", region: house.region || "", cru: house.cruLabel || "",
  visitable: Boolean(house.visitable), tastings: Boolean(house.tastings),
  address: house.formattedAddress || house.address || "",
  latitude: Number.isFinite(house.latitude) ? house.latitude : null,
  longitude: Number.isFinite(house.longitude) ? house.longitude : null,
  googlePlaceId: house.googlePlaceId || "", mapsUrl: house.mapsUrl || "",
  bookingUrl: house.bookingUrl || "", website: house.website || ""
});

const livePlaceEvidence = (house, place) => ({
  id: `google-place:${place.placeId}`,
  title: `${house.name} · actuele praktische informatie`,
  url: place.googleMapsUrl || house.mapsUrl || house.website || "",
  body: [
    place.displayName || house.name, place.formattedAddress, place.businessStatus,
    typeof place.currentOpeningHours?.openNow === "boolean"
      ? (place.currentOpeningHours.openNow ? "nu geopend" : "nu gesloten")
      : "",
    ...(place.currentOpeningHours?.weekdayDescriptions || []),
    place.phone ? `telefoon ${place.phone}` : "",
    place.website ? `website ${place.website}` : ""
  ].filter(Boolean).join(" · "),
  checkedAt: place.checkedAt, expiresAt: place.expiresAt, confidence: 0.96, conflict: false,
  tags: [house.name, "openingstijden", "adres", "contact"],
  authority: 92, sourceType: "GOOGLE_PLACES", claimType: "CURRENT_PRACTICAL_INFO"
});

export class ChefTools {
  constructor({ catalog, slice2Store, chefStore, placeDetails = fetchGooglePlaceDetails }) {
    this.catalog = catalog; this.slice2 = slice2Store; this.chef = chefStore; this.placeDetails = placeDetails;
  }
  mentionedEntities(query, limit = 5) {
    const input = searchable(query);
    if (!input) return [];
    return this.catalog.map((house) => {
      const aliases = producerAliases(house.name);
      const matched = aliases.filter((alias) => input.includes(alias)).sort((a, b) => b.length - a.length)[0] || "";
      return { house, matched };
    }).filter(({ matched }) => matched)
      .sort((a, b) => b.matched.length - a.matched.length || a.house.name.localeCompare(b.house.name))
      .slice(0, Math.min(8, limit)).map(({ house }) => houseItem(house));
  }
  async searchEntities({ query, region = "", limit = 5 }) {
    const mentioned = this.mentionedEntities(query, limit);
    const mentionedIds = new Set(mentioned.map((house) => house.id));
    const terms = norm(`${query} ${region}`).split(/\s+/).filter((term) => term.length >= 3);
    const ranked = this.catalog.map((house) => ({
      house,
      score: terms.reduce((sum, term) => sum + (norm(`${house.name} ${house.city} ${house.region} ${house.cruLabel}`).includes(term) ? 1 : 0), 0)
    })).filter(({ score, house }) => score > 0 && !mentionedIds.has(house.id)).sort((a, b) => b.score - a.score || a.house.name.localeCompare(b.house.name)).map(({ house }) => houseItem(house));
    const selected = [...mentioned, ...ranked].slice(0, Math.min(8, limit));
    const sourceById = new Map(this.catalog.map((house) => [house.id, house]));
    return { items: selected, evidence: selected.map((item) => sourceById.get(item.id)).filter(Boolean).map(houseEvidence) };
  }
  async getEntityDetail({ id }) {
    const house = this.catalog.find((item) => item.id === id);
    if (!house) return { item: null, evidence: [] };
    return { item: houseItem(house), evidence: [houseEvidence(house)] };
  }
  async getPracticalInfo({ id }) {
    const house = this.catalog.find((item) => item.id === id);
    if (!house) return { item: null, evidence: [] };
    const live = house.googlePlaceId ? await this.placeDetails(house.googlePlaceId).catch(() => null) : null;
    return {
      item: { ...houseItem(house), live },
      evidence: [houseEvidence(house), ...(live ? [livePlaceEvidence(house, live)] : [])]
    };
  }
  async searchCuvees({ query, limit = 5 }) {
    const editions = await this.chef.searchCuveeEditions(query, limit);
    const producerNames = new Map(this.catalog.map((house) => [house.id, house.name]));
    const items = editions.map((item) => ({ ...item, producerName: producerNames.get(item.producerId) || item.producerId }));
    return {
      items: items.map((item) => ({
        editionKey: item.editionKey, producerId: item.producerId, producerName: item.producerName, cuveeName: item.cuveeName,
        vintageYear: item.vintageYear, baseVintage: item.baseVintage, disgorgementDate: item.disgorgementDate,
        grapes: item.grapes, dosageGL: item.dosageGL, reserveWinePercentage: item.reserveWinePercentage,
        malolactic: item.malolactic, oakVinification: item.oakVinification, leesAgingMonths: item.leesAgingMonths,
        villages: item.villages, officialTastingNotes: item.officialTastingNotes, officialPairing: item.officialPairing
      })),
      evidence: items.map(cuveeEvidence)
    };
  }
  async getUserJourneySummary({ userId }) { return { item: await this.slice2.journeyData(userId), evidence: [] }; }
  async getTrip({ userId, tripId }) { return { item: await this.slice2.trip(userId, tripId), evidence: [] }; }
  async calculateRoute({ houseIds }) {
    const houses = houseIds.map((id) => this.catalog.find((house) => house.id === id)).filter(Boolean);
    const warnings = [], legs = []; let totalDistanceMeters = 0;
    houses.forEach((house) => { if (!Number.isFinite(house.latitude) || !Number.isFinite(house.longitude)) warnings.push(`Geen coördinaten voor ${house.name}`); });
    for (let index = 1; index < houses.length; index += 1) {
      const from = houses[index - 1], to = houses[index];
      if (Number.isFinite(from.latitude) && Number.isFinite(from.longitude) && Number.isFinite(to.latitude) && Number.isFinite(to.longitude)) {
        const meters = distance(from, to); totalDistanceMeters += meters;
        legs.push({ fromHouseId: from.id, toHouseId: to.id, distanceMeters: meters, durationSeconds: Math.round(meters / 13.89) });
      }
    }
    return { item: { routeId: randomUUID(), orderedHouseIds: houses.map((house) => house.id), totalDistanceMeters, totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0), legs, warnings, calculation: "STRAIGHT_LINE_ESTIMATE", mutated: false }, evidence: houses.map(houseEvidence) };
  }
  async createTripDraft({ userId, conversationId, name, houseIds }) {
    const stable = { trip: randomUUID(), tripKey: randomUUID(), items: houseIds.map((houseId, position) => ({ houseId, position, clientGeneratedId: randomUUID(), idempotencyKey: randomUUID() })) };
    return this.chef.createDraft(userId, conversationId, {
      type: "CREATE_TRIP", label: "Reisplan bevestigen", summary: `${name} met ${houseIds.length} ${houseIds.length === 1 ? "huis" : "huizen"}`,
      payload: { name, houseIds, stable }
    });
  }
  async createVisitDraft({ userId, conversationId, houseId, houseName }) {
    if (!this.catalog.some((house) => house.id === houseId)) throw new Error("Unknown house");
    return this.chef.createDraft(userId, conversationId, {
      type: "MARK_VISITED", label: "Markeer als bezocht", summary: `${houseName} toevoegen aan je bezochte huizen`,
      payload: { houseId, visitedAt: new Date().toISOString(), clientVisitId: randomUUID(), idempotencyKey: randomUUID() }
    });
  }
}

export const CHEF_TOOL_ALLOWLIST = Object.freeze(["search_entities", "get_entity_detail", "get_practical_info", "search_cuvees", "get_user_journey_summary", "get_trip", "calculate_route", "create_trip_draft", "create_visit_draft"]);
