import { regionForName } from "./regions.mjs";

export const placeIds = [
  "ambonnay", "arrentieres", "avenay-val-d-or", "avize", "ay", "baroville",
  "bar-sur-seine", "bethon", "bisseuil", "bligny", "bonneil", "boursault",
  "bouzy", "buxeuil", "buxieres-sur-arce", "celles-sur-ource",
  "chalons-en-champagne", "champillon", "charly-sur-marne", "chateau-thierry",
  "chavot", "chigny-les-roses", "chouilly", "congy", "cormicy", "courteron",
  "cramant", "cuis", "damery", "dizy", "ecueil", "epernay", "festigny",
  "flavigny", "fontette", "hautvillers", "jouy-les-reims", "les-riceys",
  "le-mesnil-sur-oger", "louvois", "ludes", "mardeuil", "mareuil-sur-ay",
  "marne", "merfy", "oeuilly", "oger", "passy-grigny", "pierry", "polisot",
  "port-a-binson", "pouillon", "reims", "rilly-la-montagne",
  "rouvres-les-vignes", "sacy", "sillery", "taissy", "talus-saint-prix",
  "tours-sur-marne", "trigny", "trois-puits", "troyes", "urville", "venteuil",
  "vertus", "verzenay", "verzy", "villedommange", "villers-sous-chatillon",
  "vinay", "vincelles", "vitry-en-perthois", "vrigny"
];

export function placeId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fallbackName(id) {
  return id.split("-").map((part) =>
    ["a", "de", "des", "du", "en", "la", "le", "les", "sur"].includes(part)
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1)
  ).join(" ").replace(/^./, (value) => value.toUpperCase());
}

export function basePlaces(producers, regions) {
  const producersByPlace = new Map(placeIds.map((id) => [id, []]));
  for (const producer of producers) {
    const id = placeId(producer.city || producer.locationType);
    if (producersByPlace.has(id)) producersByPlace.get(id).push(producer);
  }

  return placeIds.map((id) => {
    const matches = producersByPlace.get(id);
    const nameCounts = new Map();
    const regionCounts = new Map();
    for (const producer of matches) {
      const city = String(producer.city || producer.locationType || "").trim();
      if (city) nameCounts.set(city, (nameCounts.get(city) || 0) + 1);
      const region = regionForName(producer.region, regions);
      if (region) regionCounts.set(region.id, (regionCounts.get(region.id) || 0) + 1);
    }
    const name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallbackName(id);
    const regionId = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const region = regions.find((item) => item.id === regionId);
    return {
      id,
      name,
      regionId,
      region: region?.name || "",
      description: "",
      sourceName: "Plaatsen Banners",
      producerCount: matches.length,
      producerIds: matches.map((producer) => producer.id),
      producers: matches.map((producer) => ({
        id: producer.id,
        name: producer.name,
        website: producer.website,
        logoUrl: producer.logoUrl
      }))
    };
  });
}

export function placeById(id, places) {
  return places.find((place) => place.id === id) || null;
}
