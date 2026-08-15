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
    id: "user-regios-xlsx",
    name: "Regios.xlsx",
    kind: "REGION_METADATA",
    url: "",
    reuse: "Door de gebruiker aangeleverde regio-informatie voor webpagina’s en appintegratie."
  }
];

export const producers = [...spreadsheetHouses]
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
