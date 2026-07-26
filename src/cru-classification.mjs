export const cruClassificationSource =
  "https://www.champagne.fr/system/files/2024-03/Cahier_des_charges_appellation.pdf";

const grandCruCommunes = [
  "Ambonnay", "Avize", "Ay", "Beaumont-sur-Vesle", "Bouzy", "Chouilly",
  "Cramant", "Louvois", "Mailly-Champagne", "Le Mesnil-sur-Oger", "Oger",
  "Oiry", "Puisieulx", "Sillery", "Tours-sur-Marne", "Verzenay", "Verzy"
];

const premierCruCommunes = [
  "Avenay-Val-d'Or", "Bergères-lès-Vertus", "Bezannes", "Billy-le-Grand",
  "Bisseuil", "Chamery", "Champillon", "Chigny-lès-Roses",
  "Coligny (Val-des-Marais)", "Cormontreuil", "Coulommes-la-Montagne", "Cuis",
  "Cumières", "Dizy", "Ecueil", "Etrechy", "Grauves", "Hautvillers",
  "Jouy-lès-Reims", "Ludes", "Mareuil-sur-Ay", "Les Mesneux", "Montbré",
  "Mutigny", "Pargny-lès-Reims", "Pierry", "Rilly-la-Montagne", "Sacy",
  "Sermiers", "Taissy", "Tauxières", "Trépail", "Trois-Puits", "Vaudemanges",
  "Vertus", "Villedommange", "Villeneuve-Renneville", "Villers-Allerand",
  "Villers-aux-Nœuds", "Villers-Marmery", "Voipreux", "Vrigny"
];

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/\bchampagne\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const aliases = new Map([
  ["ay", "ay"],
  ["ay champagne", "ay"],
  ["mareuil sur ay", "mareuil sur ay"],
  ["tauxieres mutry", "tauxieres"],
  ["bergeres les vertus", "bergeres les vertus"],
  ["villeneuve renneville chevigny", "villeneuve renneville"],
  ["coligny val des marais", "coligny val des marais"]
]);

const grandCruByName = new Map(grandCruCommunes.map((name) => [normalized(name), name]));
const premierCruByName = new Map(premierCruCommunes.map((name) => [normalized(name), name]));

export function cruClassificationForCity(city) {
  const rawKey = normalized(city);
  const key = aliases.get(rawKey) || rawKey;
  const grandCruCommune = grandCruByName.get(key);
  if (grandCruCommune) {
    return {
      cruStatus: "GRAND_CRU",
      cruLabel: "Grand Cru",
      cruCommune: grandCruCommune,
      grandCru: true,
      premierCru: true,
      cruBasis: "Vestigingsgemeente volgens het AOC Champagne-cahier des charges; dit classificeert niet automatisch alle cuvées van het huis.",
      cruSourceUrl: cruClassificationSource
    };
  }
  const premierCruCommune = premierCruByName.get(key);
  if (premierCruCommune) {
    return {
      cruStatus: "PREMIER_CRU",
      cruLabel: "Premier Cru",
      cruCommune: premierCruCommune,
      grandCru: false,
      premierCru: true,
      cruBasis: "Vestigingsgemeente volgens het AOC Champagne-cahier des charges; dit classificeert niet automatisch alle cuvées van het huis.",
      cruSourceUrl: cruClassificationSource
    };
  }
  return {
    cruStatus: "",
    cruLabel: "",
    cruCommune: "",
    grandCru: false,
    premierCru: false,
    cruBasis: "",
    cruSourceUrl: cruClassificationSource
  };
}
