import assert from "node:assert/strict";
import test from "node:test";
import {
  clearMuseletProductCache,
  museletProductsForProducer
} from "../src/muselet-products.mjs";

test("Muselet products are reduced to safe app fields and euro amounts", async () => {
  clearMuseletProductCache();
  let requestedUrl;
  const products = await museletProductsForProducer("Champagne Ruinart", {
    now: 1,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify([{
        id: 26340,
        name: "Ruinart Rosé geurset",
        permalink: "https://muselet.nl/shop/ruinart-rose-geurset/",
        prices: { price: "9900", currency_code: "EUR", currency_minor_unit: 2 },
        images: [{ thumbnail: "https://muselet.nl/wp-content/uploads/ruinart.jpg" }],
        is_purchasable: true,
        is_in_stock: true
      }]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });

  assert.equal(requestedUrl.searchParams.get("search"), "Ruinart");
  assert.deepEqual(products, [{
    id: 26340,
    name: "Ruinart Rosé geurset",
    price: 99,
    currency: "EUR",
    imageUrl: "https://muselet.nl/wp-content/uploads/ruinart.jpg",
    productUrl: "https://muselet.nl/shop/ruinart-rose-geurset/",
    inStock: true
  }]);
});

test("Muselet products reject external product and image links", async () => {
  clearMuseletProductCache();
  const products = await museletProductsForProducer("Testhuis", {
    now: 1,
    fetchImpl: async () => new Response(JSON.stringify([{
      id: 1,
      name: "Unsafe",
      permalink: "https://example.com/product",
      prices: { price: "1000", currency_minor_unit: 2 },
      images: [{ src: "https://example.com/image.jpg" }],
      is_purchasable: true
    }]), { status: 200 })
  });
  assert.deepEqual(products, []);
});
