const stableCheckedAt = "2026-08-02T00:00:00.000Z";
const stableExpiresAt = "2027-08-02T00:00:00.000Z";
const practicalExpiresAt = "2026-08-09T00:00:00.000Z";

const source = ({ id, title, url, body, tags, authority = 95, sourceType = "COMITE_CHAMPAGNE", claimType = "FACT", expiresAt = stableExpiresAt, confidence = 0.97 }) => ({
  id, title, url, body, tags, authority, sourceType, claimType,
  checkedAt: stableCheckedAt, expiresAt, confidence, conflict: false
});

const curated = [
  source({
    id: "official:dosage-classifications", title: "Comité Champagne — dosagecategorieën",
    url: "https://www.champagne.fr/en/about-champagne/how-champagne-is-made/dosage",
    body: "Dosage is de laatste toevoeging vóór het kurken. Brut nature bevat minder dan 3 g/l en geen toegevoegde suiker, extra brut maximaal 6 g/l, brut minder dan 12 g/l, extra dry 12–17 g/l, sec 17–32 g/l, demi-sec 32–50 g/l en doux meer dan 50 g/l.",
    tags: ["dosage", "brut nature", "extra brut", "brut", "extra dry", "sec", "demi-sec", "doux", "suiker", "gram per liter"]
  }),
  source({
    id: "official:dosage-purpose", title: "Comité Champagne — functie van dosage",
    url: "https://www.champagne.fr/en/about-champagne/how-champagne-is-made/dosage",
    body: "De liqueur de dosage bestaat doorgaans uit rietsuiker opgelost in wijn. Naast het restsuikerniveau kan de keuze van de liqueur de stijl afronden; een producent kan bijvoorbeeld een neutrale liqueur of een liqueur met reservewijn gebruiken.",
    tags: ["dosage", "liqueur", "reservewijn", "stijl", "degorgement", "dégorgement"]
  }),
  source({
    id: "official:grapes-main", title: "Comité Champagne — belangrijkste druivenrassen",
    url: "https://www.champagne.fr/en/about-champagne/a-great-blended-wine/champagne-and-its-grape-varieties",
    body: "Pinot Noir brengt doorgaans body, kracht en structuur met associaties van rood fruit en bloemen. Chardonnay brengt frisheid en vaak florale, citrus- en minerale nuances en kan goed rijpen. Meunier brengt rondheid en een soepel, fruitig karakter.",
    tags: ["pinot noir", "chardonnay", "meunier", "druif", "structuur", "frisheid", "rondheid", "rood fruit", "citrus"]
  }),
  source({
    id: "official:grapes-authorized", title: "Comité Champagne — toegestane druivenrassen",
    url: "https://www.champagne.fr/en/about-champagne/a-great-blended-wine/champagne-and-its-grape-varieties",
    body: "Chardonnay, Pinot Noir en Meunier zijn de drie belangrijkste rassen. De appellatie kent daarnaast historische toegestane rassen, waaronder Arbane, Petit Meslier, Pinot Blanc en Pinot Gris; Chardonnay Rose is sinds 2025 opnieuw als toegestaan ras opgenomen.",
    tags: ["toegestane druiven", "arbane", "petit meslier", "pinot blanc", "pinot gris", "chardonnay rose", "appellatie"]
  }),
  source({
    id: "official:region", title: "Comité Champagne — afbakening en subregio’s",
    url: "https://www.champagne.fr/en/about-champagne/a-great-blended-wine/the-champagne-region",
    body: "De wettelijk afgebakende Champagne-productiezone omvat ongeveer 34.300 hectare en 319 crus of dorpen. De vier belangrijkste wijnbouwsubregio’s zijn Montagne de Reims, Vallée de la Marne, Côte des Blancs en Côte des Bar.",
    tags: ["regio", "subregio", "montagne de reims", "vallee de la marne", "vallée de la marne", "cote des blancs", "côte des blancs", "cote des bar", "côte des bar", "319", "hectare"]
  }),
  source({
    id: "official:soil-grapes", title: "Comité Champagne — bodem en druiven",
    url: "https://www.champagne.fr/en/about-champagne/the-champagne-terroir/champagne-and-its-soil",
    body: "Bodem en ondergrond verschillen per gebied. Chardonnay is sterk vertegenwoordigd in Côte des Blancs en Côte de Sézanne, Pinot Noir in Montagne de Reims, het oostelijke deel van Vallée de la Marne en Côte des Bar, en Meunier in het westelijke deel van Vallée de la Marne. Dit zijn regionale patronen, geen garantie voor de assemblage of smaak van een specifieke cuvée.",
    tags: ["bodem", "krijt", "terroir", "cote de sezanne", "côte de sézanne", "pinot noir", "chardonnay", "meunier", "regio"]
  }),
  source({
    id: "official:rose-methods", title: "Comité Champagne — roséproductie",
    url: "https://www.champagne.fr/en/about-champagne/a-great-blended-wine/champagne-and-its-grape-varieties",
    body: "Champagne rosé kan worden gemaakt door maceratie van blauwe druiven of door assemblage waarbij stille rode Champagnewijn aan witte basiswijnen wordt toegevoegd vóór de tweede gisting.",
    tags: ["rose", "rosé", "maceratie", "assemblage", "rode wijn", "tweede gisting"]
  }),
  source({
    id: "official:blending", title: "Comité Champagne — assemblage",
    url: "https://www.champagne.fr/system/files/2022-11/brochure_civc_2020_en_bd.pdf",
    body: "Assemblage kan wijnen uit verschillende druivenrassen, wijngaarden en jaren combineren. Non-vintage kan reservewijnen bevatten; millésimé drukt één oogstjaar uit. Blanc de blancs gebruikt witte druiven en blanc de noirs blauwe druiven.",
    tags: ["assemblage", "blend", "reservewijn", "non vintage", "millesime", "millésimé", "blanc de blancs", "blanc de noirs"]
  }),
  source({
    id: "official:serving", title: "Comité Champagne — serveren en glaswerk",
    url: "https://www.champagne.fr/en/champagne-tasting/the-tasting-experience",
    body: "Comité Champagne adviseert doorgaans een serveertemperatuur van 8–10 °C. Een fijn, tulpvormig glas geeft de wijn ruimte om aroma’s te tonen; een te smal of zeer breed glas is minder geschikt om het volledige karakter te ervaren.",
    tags: ["serveren", "temperatuur", "8", "10", "glas", "tulp", "proeven"]
  }),
  source({
    id: "official:tasting-method", title: "OIV — sensorische beoordeling van wijn",
    url: "https://www.oiv.int/node/4055",
    body: "Een professionele sensorische beoordeling onderscheidt visuele indruk, intensiteit en kwaliteit van de neus, intensiteit en kwaliteit van smaak en retronasale sensaties, mondgevoel en de algemene harmonie. Een proefnotitie blijft een sensorische beoordeling en is geen laboratoriumfeit.",
    tags: ["proeven", "sensorisch", "neus", "smaak", "retronasaal", "mondgevoel", "harmonie", "oiv"], sourceType: "OIV", claimType: "METHOD"
  }),
  source({
    id: "official:label", title: "Comité Champagne — etiket lezen",
    url: "https://www.champagne.fr/system/files/2023-06/Fiches_Savoir-%C3%89tiquettes_EN.pdf",
    body: "Een Champagne-etiket kan onder meer dosagecategorie, vintage, wijnstijl, producentcategorie, druivenrassen en dégorgementinformatie vermelden. Niet al deze gegevens zijn verplicht; ontbrekende informatie mag niet worden ingevuld op basis van aannames.",
    tags: ["etiket", "label", "rm", "nm", "producent", "vintage", "degorgement", "dégorgement", "dosage"]
  }),
  source({
    id: "official:champagne-sensory-ontology", title: "Comité Champagne — proefstructuur en aromafamilies",
    url: "https://www.champagne.fr/system/files/2025-09/FICHE%20D%C3%89GUSTER%20EN%204%20TEMPS%20EN%202025.pdf",
    body: "Comité Champagne structureert proeven als kijken, ruiken en proeven, met op het palet onder meer effervescence, zoetheid, levendigheid, body, aromatische persistentie, complexiteit en balans. Aromabeschrijvingen worden gegroepeerd in jeugd, rijpheid en plenitude en in families zoals floraal, fruitig, mineraal, plantaardig, patisserie, lactisch, kruidig en geroosterd of rokerig.",
    tags: ["proeven", "sensorische ontologie", "effervescence", "zoetheid", "levendigheid", "body", "persistentie", "complexiteit", "balans", "aroma"], claimType: "METHOD", confidence: 0.99
  }),
  source({
    id: "official:food-pairing", title: "Comité Champagne — gerechten en Champagnestijlen",
    url: "https://www.champagne.fr/en/champagne-tasting/food-and-champagne-pairings",
    body: "Comité Champagne presenteert foodpairing als een keuze tussen kenmerken van het gerecht en brede Champagnestijlen, waaronder non-vintage Brut, Blanc de Blancs, Blanc de Noirs, rosé, millésimé en sec tot doux. Een pairing blijft advies: bereiding, saus, intensiteit en persoonlijke voorkeur kunnen de uitkomst veranderen.",
    tags: ["foodpairing", "pairing", "gerecht", "eten", "dessert", "vis", "vlees", "kaas", "brut", "blanc de blancs", "blanc de noirs", "rose", "millésimé"], claimType: "METHOD", confidence: 0.98
  }),
  source({
    id: "atlas:visit-safety", title: "Champagne Atlas — praktische bezoekinformatie",
    url: "https://www.champagne.fr/en/visit-champagne",
    body: "Beschikbaarheid, openingstijden, prijzen en reserveringsvoorwaarden kunnen wijzigen. Controleer praktische bezoekinformatie altijd bij het huis voordat je vertrekt.",
    tags: ["bezoek", "route", "opening", "reserveren", "proeverij", "prijs"], authority: 80, sourceType: "ATLAS", claimType: "PRACTICAL", expiresAt: practicalExpiresAt, confidence: 0.98
  })
];

const stopWords = new Set(["aan", "als", "bij", "dat", "de", "den", "der", "dit", "een", "en", "er", "geen", "het", "hoe", "ik", "in", "is", "kan", "met", "naar", "niet", "of", "om", "op", "over", "te", "tot", "uit", "van", "voor", "wat", "welke", "wil", "wordt", "zijn"]);
const words = (value) => new Set((String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().match(/[a-z0-9-]{2,}/g) || []).filter((word) => !stopWords.has(word)));

function ranking(item, tokens) {
  const tagWords = words((item.tags || []).join(" "));
  const titleWords = words(item.title);
  const bodyWords = words(item.body);
  let lexical = 0;
  for (const token of tokens) {
    if (tagWords.has(token)) lexical += 6;
    else if (titleWords.has(token)) lexical += 4;
    else if (bodyWords.has(token)) lexical += 2;
    else if ([...tagWords, ...titleWords].some((word) => word.startsWith(token) || token.startsWith(word))) lexical += 1;
  }
  return lexical ? lexical * 1000 + Number(item.authority || 50) * 10 + Number(item.confidence || 0.5) * 100 : 0;
}

export async function retrieveApprovedKnowledge(query, store, limit = 6) {
  const byId = new Map(curated.map((item) => [item.id, item]));
  try {
    for (const item of await store?.approvedKnowledge?.() || []) {
      byId.set(item.id, { authority: 80, sourceType: "APPROVED_DATABASE", claimType: "FACT", ...item });
    }
  } catch {}
  const tokens = words(query);
  if (!tokens.size) return [];
  return [...byId.values()].map((item) => ({ item, score: ranking(item, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map(({ item }) => item);
}

export function approvedKnowledgeSeed() { return curated.map((item) => ({ ...item, tags: [...item.tags] })); }
export const CHEF_SOURCE_POLICY_VERSION = "2026-08-02.2";
