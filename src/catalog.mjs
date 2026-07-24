import { spreadsheetHouses } from "./spreadsheet-houses.mjs";

export const sources = [
  {
    id: "user-champagne-xlsx",
    name: "champagne.xlsx",
    kind: "PRIMARY_SOURCE",
    url: "",
    reuse: "Door de gebruiker aangeleverde werkcatalogus en enige producentenbron."
  },
  {
    id: "comite-champagne",
    name: "Comité Champagne",
    kind: "REFERENCE_DIRECTORY",
    url: "https://www.champagne.fr/fr/visiter-la-champagne/annuaire-caves-champagne",
    reuse: "Alleen gebruikt als externe verwijzing voor aanvullende informatie."
  }
];

export const producers = [...spreadsheetHouses]
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
