import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRejectImageUrl, preferLargerImageUrl } from "./imageQuality.js";
import {
  detectCurrency,
  extractAmount,
  formatDisplayPrice,
  resolveProductBrand,
} from "./priceBrand.js";
import { videoSpecFromFacts } from "../llm/fallback.js";
import type { ProductFacts } from "../schemas.js";

describe("imageQuality", () => {
  it("rejects favicons, sprites, and tiny Amazon thumbs", () => {
    assert.equal(isRejectImageUrl("https://example.com/favicon.ico"), true);
    assert.equal(isRejectImageUrl("https://cdn.example/sprite.png"), true);
    assert.equal(
      isRejectImageUrl("https://m.media-amazon.com/images/I/abc._SS40_.jpg"),
      true,
    );
    assert.equal(
      isRejectImageUrl("https://m.media-amazon.com/images/I/abc._AC_SL1500_.jpg"),
      false,
    );
  });

  it("rewrites Amazon thumbs toward larger media", () => {
    const out = preferLargerImageUrl(
      "https://m.media-amazon.com/images/I/abc._AC_SX100_.jpg",
    );
    assert.match(out, /AC_SL1500/);
  });
});

describe("priceBrand", () => {
  it("formats HKD without mixing ¥", () => {
    assert.equal(detectCurrency("HK$1,685.94", "HKD"), "HKD");
    assert.equal(extractAmount("HK$1,685.94"), "1685.94");
    assert.equal(formatDisplayPrice("HK$1,685.94", "HKD"), "HK$1685.94");
    assert.equal(formatDisplayPrice("¥1,685.94 HKD", "HKD"), "HK$1685.94");
  });

  it("resolves Lenovo from title instead of amazon.com host", () => {
    assert.equal(
      resolveProductBrand({
        brand: null,
        title: "Lenovo Idea Tab, 11\" Android Tablet",
        urlHost: "amazon.com",
        ogSiteName: "Amazon",
      }),
      "Lenovo",
    );
    assert.equal(
      resolveProductBrand({
        brand: "Lenovo",
        title: "Something",
        urlHost: "amazon.com",
      }),
      "Lenovo",
    );
    assert.notEqual(
      resolveProductBrand({
        brand: null,
        title: "Lenovo Idea Tab",
        urlHost: "amazon.com",
      }),
      "amazon.com",
    );
  });
});

describe("videoSpecFromFacts quality", () => {
  const facts: ProductFacts = {
    sourceUrl: "https://www.amazon.com/dp/example",
    title: "Lenovo Idea Tab 11 inch Android Tablet with Long Battery",
    brand: "Lenovo",
    price: "HK$1685.94",
    currency: "HKD",
    compareAtPrice: null,
    description:
      "Bright display. All-day battery. Slim aluminum design. Ideal for study and entertainment.",
    images: ["/tmp/product.png"],
    urlHost: "amazon.com",
    localeHint: "zh",
    logo: null,
  };

  it("uses product brand, clean HKD price, and no banned filler", () => {
    const spec = videoSpecFromFacts(facts);
    assert.equal(spec.brand, "Lenovo");
    assert.equal(spec.price, "HK$1685.94");
    assert.doesNotMatch(spec.headline, /一起看清这一页|十五秒|本地短片/);
    for (const c of spec.captions) {
      assert.doesNotMatch(c, /一起看清这一页|十五秒|本地短片/);
      assert.ok(c.length > 0);
    }
    assert.equal(spec.templateId, "product-promo");
  });
});
