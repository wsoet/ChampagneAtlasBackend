import { openDataProducers } from "./open-data.mjs";
import { wikipediaHouses } from "./wikipedia-houses.mjs";

export const sources = [
  {
    id: "comite-champagne",
    name: "Comité Champagne",
    kind: "OFFICIAL_DIRECTORY",
    url: "https://www.champagne.fr/fr/visiter-la-champagne/annuaire-caves-champagne",
    reuse: "Link naar de officiële producenten- en bezoekersdirectory."
  },
  {
    id: "umc",
    name: "Union des Maisons de Champagne",
    kind: "TRADE_ASSOCIATION",
    url: "https://maisons-champagne.com/fr/maisons/liste-des-maisons/",
    reuse: "Publieke ledenlijst; redactionele teksten worden niet gekopieerd."
  },
  {
    id: "champagne-de-vignerons",
    name: "Champagne de Vignerons",
    kind: "TRADE_ASSOCIATION",
    url: "https://www.champagnedevignerons.fr/annuaire-des-vignerons/",
    reuse: "Publiek register van vignerons en coöperaties; deeplink naar de bron."
  },
  {
    id: "club-tresors",
    name: "Club Trésors de Champagne",
    kind: "PRODUCER_ASSOCIATION",
    url: "https://www.clubtresorsdechampagne.com/en/",
    reuse: "Publieke ledennamen en vestigingsplaatsen; deeplink naar de bron."
  },
  {
    id: "champagne-club",
    name: "Champagne Club",
    kind: "EDITORIAL",
    url: "https://www.champagneclub.com/producer-profiles/",
    reuse: "Alleen linken; profielen en beoordelingen vereisen toestemming."
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    kind: "OPEN_DATA",
    url: "https://www.openstreetmap.org/copyright",
    reuse: "ODbL; attributie en voorwaarden zijn verplicht."
  },
  {
    id: "wikidata",
    name: "Wikidata",
    kind: "OPEN_DATA",
    url: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    reuse: "CC0 gestructureerde achtergrondgegevens."
  },
  {
    id: "wikipedia-champagne-houses",
    name: "Wikipedia – List of champagne houses",
    kind: "OPEN_CONTENT",
    url: "https://en.wikipedia.org/wiki/List_of_champagne_houses",
    reuse: "CC BY-SA 4.0; bronvermelding en gelijk delen zijn van toepassing."
  }
];

const clubTresorsMembers = [
  ["paul-bara", "Champagne Paul Bara", "Bouzy"],
  ["roland-champion", "Champagne Roland Champion", "Chouilly"],
  ["charlier-et-fils", "Champagne Charlier & Fils", "Montigny-sous-Châtillon"],
  ["gaston-chiquet", "Champagne Gaston Chiquet", "Dizy"],
  ["dumenil", "Champagne Dumenil", "Sacy"],
  ["forget-chemin", "Champagne Forget-Chemin", "Ludes"],
  ["fresnet-juillet", "Champagne Fresnet-Juillet", "Verzy"],
  ["pierre-gimonnet", "Champagne Pierre Gimonnet & Fils", "Cuis"],
  ["morel", "Champagne Morel", "Les Riceys"],
  ["henri-goutorbe", "Champagne Henri Goutorbe", "Aÿ-Champagne"],
  ["grongnet", "Champagne Grongnet", "Étoges"],
  ["marc-hebrart", "Champagne Marc Hébrart", "Mareuil-sur-Aÿ"],
  ["hervieux-dumez", "Champagne Hervieux-Dumez", "Sacy"],
  ["vincent-joudart", "Champagne Vincent Joudart", "Fèrebrianges"],
  ["juillet-lallement", "Champagne Juillet-Lallement", "Verzy"],
  ["j-lassalle", "Champagne J. Lassalle", "Chigny-les-Roses"],
  ["pertois-moriset", "Champagne Pertois-Moriset", "Le Mesnil-sur-Oger"],
  ["loriot-pagel", "Champagne Loriot-Pagel", "Festigny"],
  ["a-margaine", "Champagne A. Margaine", "Villers-Marmery"],
  ["remy-massin", "Champagne Rémy Massin & Fils", "Ville-sur-Arce"],
  ["jose-michel", "Champagne José Michel", "Moussy"],
  ["nomine-renard", "Champagne Nominé-Renard", "Villevenard"],
  ["salmon", "Champagne Salmon", "Chaumuzy"],
  ["sanchez-le-guedard", "Champagne Sanchez Le Guédard", "Cumières"],
  ["vazart-coquart", "Champagne Vazart-Coquart & Fils", "Chouilly"]
];

const accents = ["FFC7A45A", "FF496B65", "FFB8795E", "FF6B7698", "FF87734E", "FF55766F"];
const civcDirectoryUrl =
  "https://www.champagne.fr/fr/visiter-la-champagne/annuaire-caves-champagne";

function initials(name) {
  return name
    .replace(/^Champagne\s+/i, "")
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const clubTresorsProducers = clubTresorsMembers.map(([id, name, city], index) => ({
  id,
  name,
  type: "GROWER",
  city,
  address: `${name}, ${city}, France`,
  region: "Club Trésors de Champagne",
  description:
    `${name} is lid van Club Trésors de Champagne, de vereniging achter de Spécial Club-cuvées.`,
  website: "",
  directoryUrl: "https://www.clubtresorsdechampagne.com/en/",
  initials: initials(name),
  accent: accents[index % accents.length],
  sourceIds: ["club-tresors"]
}));

function normalizedProducerName(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/^champagne\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

export const producers = [...clubTresorsProducers, ...openDataProducers, ...wikipediaHouses]
  .filter((producer, index, all) => {
    const key = normalizedProducerName(producer.name);
    return all.findIndex((candidate) =>
      normalizedProducerName(candidate.name) === key &&
      (
        candidate.city.toLowerCase() === producer.city.toLowerCase() ||
        candidate.city === "Champagne" ||
        producer.city === "Champagne"
      )
    ) === index;
  })
  .map((producer) => ({
    ...producer,
    sourceUrl: producer.directoryUrl,
    directoryUrl: civcDirectoryUrl,
    mapsUrl: producer.latitude != null && producer.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${producer.latitude},${producer.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${producer.name}, ${producer.address}`
        )}`
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
