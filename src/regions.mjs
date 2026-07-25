function slug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const regions = [
  {
    id: "aube",
    name: "Aube",
    alternativeName: "Côte des Bar",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Zuidelijk Champagne-district dat vaak samenvalt met Côte des Bar. Bekend als sterk Pinot noir-gebied en als zuidelijker, duidelijk apart deel van de AOC.",
    sourceUrl: "https://en.wikipedia.org/wiki/Champagne_wine_region",
    sourceName: "Regios.xlsx",
    aliases: ["Aube", "Cote des Bar", "Côte des Bar"]
  },
  {
    id: "cote-des-blancs",
    name: "Côte des Blancs",
    alternativeName: "",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Krijtrijk gebied dat sterk met Chardonnay wordt geassocieerd. De naam verwijst naar de witte druif; de kalkrijke hellingen geven finesse en frisheid.",
    sourceUrl: "https://en.wikipedia.org/wiki/Champagne_wine_region",
    sourceName: "Regios.xlsx",
    aliases: ["Cote des Blancs", "Côte des Blancs"]
  },
  {
    id: "cote-de-sezanne",
    name: "Côte de Sézanne",
    alternativeName: "",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Aanvullend district dat vaak apart wordt genoemd in de vijf-districten-indeling. Wordt gezien als verwant aan de Côte des Blancs en levert vergelijkbare eigenschappen voor blends.",
    sourceUrl: "https://en.wikipedia.org/wiki/Champagne_wine_region",
    sourceName: "Regios.xlsx",
    aliases: ["Cote de Sezanne", "Côte de Sézanne", "Coteaux du Sezannais", "Coteaux du Sézannais"]
  },
  {
    id: "montagne-de-reims",
    name: "Montagne de Reims",
    alternativeName: "",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Heuvelachtig gebied rond Reims, tussen de Vesle en de Marne, met veel bos en hellingen. Pinot noir is hier de meest voorkomende druif en geeft structuur aan veel blends.",
    sourceUrl: "https://en.wikipedia.org/wiki/Champagne_wine_region",
    sourceName: "Regios.xlsx",
    aliases: ["Montagne de Reims"]
  },
  {
    id: "vallee-de-la-marne",
    name: "Vallée de la Marne",
    alternativeName: "Marne Valley",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Langgerekte vallei langs de rivier de Marne met wijngaarden op steile hellingen. In het oosten komt veel Pinot noir voor; verder westelijk wordt Meunier dominant.",
    generalFacts: "Ligging: langs de rivier de Marne tussen Aÿ en Château-Thierry\nOppervlakte: ±12.000 ha\nAandeel Champagne: ±35% van de totale aanplant\nBelangrijkste druif: Pinot Meunier\nBelangrijkste centrum: Épernay",
    location: "De Vallée de la Marne volgt de rivier de Marne en vormt de verbinding tussen de Montagne de Reims en de Côte des Blancs. De zuid- en zuidoostgerichte hellingen profiteren van een gunstige expositie en een gematigd microklimaat.",
    history: "De streek behoort tot de oudste wijnbouwgebieden van Champagne. Rond Hautvillers legde Dom Pérignon de basis voor moderne kwaliteitsverbeteringen zoals zorgvuldige assemblage en wijngaardselectie.",
    terroir: "De bodems bestaan uit krijt, klei, mergel, zand en alluviale afzettingen. Vooral de klei- en mergelrijke gronden zijn uitstekend geschikt voor Pinot Meunier.",
    climate: "Het klimaat is koel en semi-continentaal met Atlantische invloeden. De Marne beperkt temperatuurverschillen en vermindert de kans op voorjaarsvorst.",
    grapeVarieties: "Chardonnay\nPinot Noir\nPinot Meunier\n\nDe Vallée de la Marne is het belangrijkste gebied voor Pinot Meunier, een druif die bekendstaat om haar fruitige karakter en relatief late uitloop.",
    cruClassification: "Grand Cru: Aÿ en Tours-sur-Marne.\n\nBelangrijke Premier Cru-dorpen: Hautvillers, Dizy, Mareuil-sur-Aÿ, Cumières, Damery en Bisseuil.",
    sourceUrl: "",
    sourceName: "01-Vallee_de_la_Marne V.20.pdf",
    aliases: ["Vallee de la Marne", "Vallée de la Marne", "Marne Valley"]
  }
];

const regionByAlias = new Map(
  regions.flatMap((region) =>
    [region.name, region.alternativeName, ...region.aliases]
      .filter(Boolean)
      .map((alias) => [slug(alias), region])
  )
);

export function regionForName(name, regionList = regions) {
  if (regionList === regions) return regionByAlias.get(slug(name)) || null;
  const needle = slug(name);
  return regionList.find((region) =>
    [region.name, region.alternativeName, ...(region.aliases || [])]
      .filter(Boolean)
      .some((alias) => slug(alias) === needle)
  ) || null;
}

export function regionById(id, regionList = regions) {
  return regionList.find((region) => region.id === id) || null;
}

export function regionWithProducers(region, producers, regionList = regions) {
  const matches = producers.filter((producer) => regionForName(producer.region, regionList)?.id === region.id);
  return {
    ...region,
    aliases: undefined,
    producerCount: matches.length,
    producerIds: matches.map((producer) => producer.id)
  };
}
