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
    inStock: true,
    contentLanguage: "en",
    deliveredContentLanguage: "und",
    sourceLanguage: "und",
    originalName: "Ruinart Rosé geurset",
    attribution: { provider:"Muselet.nl", sourceUrl:"https://muselet.nl/shop/ruinart-rose-geurset/" }
  }]);
});

test("Muselet cache is isolated per requested language", async () => {
  clearMuseletProductCache();
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response(JSON.stringify([{id:99,name:"Brut Reserve",permalink:"https://muselet.nl/shop/brut/",prices:{price:"3995",currency_minor_unit:2,currency_code:"EUR"},images:[],is_in_stock:true,is_purchasable:true}]),{status:200})};
  const en=await museletProductsForProducer("Locale Cache House",{fetchImpl,locale:"en-US",now:1});
  const nl=await museletProductsForProducer("Locale Cache House",{fetchImpl,locale:"nl-NL",now:1});
  assert.equal(calls,2);
  assert.equal(en[0].contentLanguage,"en");
  assert.equal(nl[0].contentLanguage,"nl");
  assert.equal(en[0].attribution.provider,"Muselet.nl");
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
