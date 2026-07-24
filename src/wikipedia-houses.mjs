const sourceUrl = "https://en.wikipedia.org/wiki/List_of_champagne_houses";
const civcDirectoryUrl =
  "https://www.champagne.fr/fr/visiter-la-champagne/annuaire-caves-champagne";

const houses = [
  ["Abelé", "Reims"],
  ["Ayala", "Aÿ-Champagne"],
  ["Billecart-Salmon", "Mareuil-sur-Aÿ"],
  ["Binet", "Reims"],
  ["Boizel", "Épernay"],
  ["Boll & Cie", "Reims"],
  ["Bollinger", "Aÿ-Champagne"],
  ["Bruno Paillard", "Reims"],
  ["Burtin - Besserat de Bellefon", "Épernay"],
  ["Canard-Duchêne", "Ludes"],
  ["Cattier", "Chigny-les-Roses"],
  ["Chanoine Frères", "Reims"],
  ["Charles Heidsieck", "Reims"],
  ["De Castellane", "Épernay"],
  ["De Cazanove", "Reims"],
  ["De Venoge", "Épernay"],
  ["Delamotte", "Le Mesnil-sur-Oger"],
  ["Deutz", "Aÿ-Champagne"],
  ["Duval-Leroy", "Vertus"],
  ["Gosset", "Épernay"],
  ["Alfred Gratien", "Épernay"],
  ["Heidsieck & Co Monopole", "Épernay"],
  ["Henriot", "Reims"],
  ["Jacquesson", "Dizy"],
  ["Krug", "Reims"],
  ["Lanson", "Reims"],
  ["Laurent-Perrier", "Tours-sur-Marne"],
  ["Mercier", "Épernay"],
  ["Moët & Chandon", "Épernay"],
  ["G. H. Mumm", "Reims"],
  ["Pannier", "Château-Thierry"],
  ["Perrier-Jouët", "Épernay"],
  ["Francis Pétret", "Chouilly"],
  ["Piper-Heidsieck", "Reims"],
  ["Pol Roger", "Épernay"],
  ["Pommery", "Reims"],
  ["Louis Roederer", "Reims"],
  ["Ruinart", "Reims"],
  ["Salon", "Le Mesnil-sur-Oger"],
  ["Taittinger", "Reims"],
  ["Thiénot", "Reims"],
  ["Veuve Clicquot Ponsardin", "Reims"],
  ["Delbeck", "Reims"],
  ["Drappier", "Urville"],
  ["Gauthier", "Épernay"],
  ["Nicolas Feuillatte", "Chouilly"],
  ["Selosse", "Avize"],
  ["Paul Goerg", "Vertus"],
  ["Vilmart", "Rilly-la-Montagne"]
];

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(value) {
  return value
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export const wikipediaHouses = houses.map(([name, city]) => {
  const displayName = name.startsWith("Champagne ") ? name : `Champagne ${name}`;
  const mapQuery = encodeURIComponent(`${displayName}, ${city}, France`);
  return {
    id: `wikipedia-${slug(name)}`,
    name: displayName,
    type: "HOUSE",
    city,
    address: `${displayName}, ${city}, France`,
    region: "Champagne",
    description:
      `${displayName} staat vermeld in de Wikipedia-lijst van prominente champagnehuizen.`,
    website: "",
    directoryUrl: civcDirectoryUrl,
    sourceUrl,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
    initials: initials(name),
    accent: "FFC7A45A",
    sourceIds: ["wikipedia-champagne-houses"]
  };
});
