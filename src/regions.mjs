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
    description: "De Côte des Bar, ook wel de Aube genoemd, ligt ruim 100 kilometer ten zuiden van Reims. De regio onderscheidt zich door haar Kimmeridgische bodems en krachtige Pinot Noir-champagnes.",
    generalFacts: "Ligging: departement Aube, rond Bar-sur-Aube en Bar-sur-Seine\nOppervlakte: circa 8.000 hectare\nBelangrijkste druif: Pinot Noir\nBelangrijkste centra: Bar-sur-Aube, Bar-sur-Seine en Les Riceys",
    location: "De Côte des Bar ligt geïsoleerd van de overige Champagneregio's. De wijngaarden volgen de valleien van de Seine en de Aube en liggen op zonnige hellingen.",
    history: "De wijnbouw gaat terug tot de Romeinse tijd. Lange tijd stond de regio in de schaduw van Reims en Épernay, maar tegenwoordig genieten veel producenten internationale erkenning dankzij terroirgerichte Pinot Noir.",
    terroir: "De regio wordt gedomineerd door Kimmeridgische kalksteen met klei en fossiele schelpen, vergelijkbaar met Chablis. Deze bodem geeft structuur, diepgang en een kenmerkende mineraliteit.",
    climate: "Het klimaat is iets warmer en continentaler dan in Noord-Champagne. Dit bevordert een goede rijping van Pinot Noir, terwijl de koele nachten de frisheid behouden.",
    grapeVarieties: "Pinot Noir: circa 86%\nChardonnay: circa 12%\nPinot Meunier: circa 2%\n\nDe champagnes zijn vaak rijk, vol en krachtig met aroma's van rood fruit, rijpe kersen, specerijen en een kalkachtige mineraliteit.",
    cruClassification: "De Côte des Bar kent geen Grand Cru- of Premier Cru-classificaties.\n\nBelangrijke dorpen: Les Riceys, Essoyes, Urville, Celles-sur-Ource, Polisot, Noé-les-Mallets en Gyé-sur-Seine.\n\nLes Riceys is uniek omdat het drie AOC's produceert: Champagne, Coteaux Champenois en Rosé des Riceys.",
    sourceUrl: "",
    sourceName: "05-Cote_des_Bar (Aube).pdf",
    aliases: ["Aube", "Cote des Bar", "Côte des Bar"]
  },
  {
    id: "cote-des-blancs",
    name: "Côte des Blancs",
    alternativeName: "",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "De Côte des Blancs is wereldwijd de referentie voor Chardonnay in Champagne. De regio staat bekend om haar pure krijtbodems en elegante, mineraal gedreven champagnes.",
    generalFacts: "Ligging: ten zuiden van Épernay\nOppervlakte: circa 3.400 hectare\nBelangrijkste druif: Chardonnay\nAandeel Chardonnay: meer dan 90% van de aanplant",
    location: "De Côte des Blancs strekt zich uit van Cuis tot Bergères-lès-Vertus. De wijngaarden liggen voornamelijk op oostgerichte hellingen, waardoor de druiven langzaam en gelijkmatig rijpen.",
    history: "Sinds de negentiende eeuw geniet de regio een uitzonderlijke reputatie voor Chardonnay. Veel prestigieuze Blanc de Blancs-cuvées van grote champagnehuizen vinden hier hun oorsprong.",
    terroir: "Diepe lagen belemnietenkrijt vormen het dominante terroir. Het krijt zorgt voor uitstekende drainage, een stabiele watervoorziening en de kenmerkende mineraliteit van de wijnen.",
    climate: "Een koel klimaat met voldoende zonuren en een gunstige expositie levert druiven met hoge zuren, finesse en een groot rijpingspotentieel.",
    grapeVarieties: "Chardonnay: circa 95%\nPinot Noir: circa 3%\nPinot Meunier: circa 2%\n\nDe stijl wordt gekenmerkt door citrus, witte bloemen, krijt, mineraliteit en een zeer lange levensduur.",
    cruClassification: "Grand Cru-dorpen: Avize, Cramant, Chouilly, Le Mesnil-sur-Oger, Oger en Oiry.\n\nBelangrijke Premier Cru-dorpen: Cuis, Vertus, Bergères-lès-Vertus, Grauves en Voipreux.\n\nDeze dorpen vormen de kern van de productie van prestigieuze Blanc de Blancs-champagnes.",
    sourceUrl: "",
    sourceName: "03-Cotes_des_Blancs.pdf",
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
    generalFacts: "Ligging: tussen Reims en Épernay\nOppervlakte: circa 8.500 hectare\nBelangrijkste druif: Pinot Noir\nBelangrijkste plaatsen: Reims, Verzy, Ambonnay en Bouzy",
    location: "De regio ligt op een hoefijzervormige heuvelrug rondom de stad Reims. Wijngaarden liggen voornamelijk op noord-, oost- en zuidhellingen. De beschutte ligging en krijtbodem zorgen voor uitstekende omstandigheden voor Pinot Noir.",
    history: "De Montagne de Reims behoort tot de historische kern van de Champagnestreek. Dorpen als Bouzy en Ambonnay genoten al in de 18e en 19e eeuw een uitstekende reputatie voor rode basiswijnen die werden gebruikt voor prestigieuze assemblages.",
    terroir: "De ondergrond bestaat hoofdzakelijk uit diep krijt met lagen klei en kalkrijke mergel. Het krijt slaat water op en geeft dit geleidelijk af, wat zorgt voor een gelijkmatige rijping en een krachtige maar verfijnde wijnstijl.",
    climate: "Het koele, semi-continentale klimaat wordt beïnvloed door Atlantische luchtstromen. De hoogte en bosrijke omgeving beperken temperatuurextremen en creëren verschillende microklimaten.",
    grapeVarieties: "Pinot Noir: circa 56%\nChardonnay: circa 30%\nPinot Meunier: circa 14%\n\nDe regio levert krachtige, gestructureerde Pinot Noir met aroma's van rood fruit, specerijen en een uitgesproken mineraliteit.",
    cruClassification: "Grand Cru-dorpen: Ambonnay, Beaumont-sur-Vesle, Bouzy, Louvois, Mailly-Champagne, Puisieulx, Sillery, Verzenay en Verzy.\n\nBelangrijke Premier Cru-dorpen: Rilly-la-Montagne, Chigny-les-Roses, Ludes, Taissy, Sermiers, Chamery en Ville-Dommange.\n\nDeze dorpen vormen de basis voor veel prestigieuze cuvées dankzij hun uitstekende Pinot Noir en Chardonnay.",
    sourceUrl: "",
    sourceName: "02-Montagne_de_Reims.pdf",
    aliases: ["Montagne de Reims"]
  },
  {
    id: "vallee-de-la-marne",
    name: "Vallée de la Marne",
    alternativeName: "Marne Valley",
    classification: "Veelgebruikte 5-districten-indeling",
    description: "Langgerekte vallei langs de rivier de Marne met wijngaarden op steile hellingen. In het oosten komt veel Pinot noir voor; verder westelijk wordt Meunier dominant.",
    generalFacts: "Ligging: langs de rivier de Marne, van Aÿ tot Château-Thierry\nOppervlakte: circa 12.000 hectare\nAandeel Champagne: ongeveer 35% van de totale aanplant\nBelangrijkste druif: Pinot Meunier\nBelangrijkste stad: Épernay",
    location: "De Vallée de la Marne volgt de rivier de Marne door het hart van de Champagnestreek. In het oosten grenst de regio aan de Montagne de Reims en rond Épernay vormt zij de overgang naar de Côte des Blancs. De wijngaarden liggen voornamelijk op zuid-, zuidoost- en zuidwestgerichte hellingen met uitzicht over de rivier. De Marne zorgt voor een gematigd microklimaat en beperkt het risico op voorjaarsvorst.",
    history: "De regio behoort tot de oudste wijnbouwgebieden van Champagne. Rond Hautvillers werkte Dom Pérignon in de 17e eeuw aan kwaliteitsverbeteringen zoals zorgvuldige assemblage, wijngaardselectie en strengere vinificatie. De nabijheid van de Marne maakte transport naar Parijs relatief eenvoudig, waardoor de streek economisch sterk kon groeien.",
    terroir: "De bodems bestaan uit een afwisseling van krijt, klei, mergel, zand en alluviale afzettingen. De klei- en mergelrijke ondergrond houdt vocht goed vast en vormt een uitstekende basis voor Pinot Meunier. In de omgeving van Aÿ komt meer krijt voor, waardoor ook Pinot Noir hier uitzonderlijke kwaliteit bereikt.",
    climate: "Het klimaat is koel en semi-continentaal met Atlantische invloeden. De rivier werkt temperatuurdempend. Gemiddeld valt circa 650-700 mm neerslag per jaar. Pinot Meunier loopt later uit dan Pinot Noir en is daardoor minder gevoelig voor voorjaarsvorst.",
    grapeVarieties: "Pinot Meunier: circa 60%\nPinot Noir: circa 23%\nChardonnay: circa 17%\n\nPinot Meunier geeft fruitige aroma's van appel, peer, steenfruit en bloemen. Rond Aÿ speelt Pinot Noir een veel grotere rol.",
    cruClassification: "Grand Cru-dorpen: Aÿ en Tours-sur-Marne.\n\nBelangrijke Premier Cru-dorpen: Hautvillers, Dizy, Mareuil-sur-Aÿ, Cumières, Damery, Bisseuil en Chouilly (overgang richting Côte des Blancs).\n\nDeze dorpen produceren uiteenlopende stijlen: van krachtige Pinot Noir-blends rond Aÿ tot elegante Meunier-gedreven champagnes in het westelijke deel van de regio.",
    sourceUrl: "",
    sourceName: "01-Vallee_de_la_Marne.pdf",
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
