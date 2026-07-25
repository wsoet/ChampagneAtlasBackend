import { spreadsheetHouses } from "./spreadsheet-houses.mjs";

export const sources = [
  {
    id: "user-champagne-xlsx",
    name: "champagne.xlsx",
    kind: "PRIMARY_SOURCE",
    url: "",
    reuse: "Door de gebruiker aangeleverde werkcatalogus en enige producentenbron."
  }
];

export const producers = [...spreadsheetHouses]
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
