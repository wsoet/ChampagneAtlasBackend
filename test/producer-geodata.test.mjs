import assert from "node:assert/strict";
import test from "node:test";
import { producerGeodata } from "../src/producer-geodata.mjs";

test("bundled producer geodata contains unique, complete records", () => {
  const ids = producerGeodata.map((record) => record.producerId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(producerGeodata.every((record) =>
    record.producerId && record.googlePlaceId && record.formattedAddress &&
    Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
  ));
});

test("Moet and Chandon has the verified Google Places record", () => {
  const moet = producerGeodata.find(
    (record) => record.producerId === "xlsx-moet-chandon-epernay"
  );
  assert.deepEqual(moet, {
    producerId: "xlsx-moet-chandon-epernay",
    latitude: 49.0428539,
    longitude: 3.9597722,
    formattedAddress: "20 Av. de Champagne, 51200 Épernay, France",
    googlePlaceId: "ChIJM7T7XkVr6UcRJ2fRLEVCubU"
  });
});
