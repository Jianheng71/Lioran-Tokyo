import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { isRejectImageUrl, preferLargerImageUrl } from "./imageQuality.js";
import {
  detectCurrency,
  extractAmount,
  formatDisplayPrice,
  isMarketplaceHost,
  resolveProductBrand,
} from "./priceBrand.js";
import { clipReadable, videoSpecFromFacts } from "../llm/fallback.js";
import { extForImageFile, fillTemplate } from "../templater/index.js";
import { config } from "../config.js";
import type { ProductFacts, VideoSpec } from "../schemas.js";

describe("imageQuality (host-agnostic)", () => {
  it("rejects favicons, sprites, and tiny thumbs without requiring amazon.com", () => {
    assert.equal(isRejectImageUrl("https://cdn.example.com/favicon.ico"), true);
    assert.equal(isRejectImageUrl("https://cdn.example.com/assets/sprite.png"), true);
    assert.equal(isRejectImageUrl("https://cdn.example.com/icons/cart.svg"), true);
    assert.equal(
      isRejectImageUrl("https://cdn.shopify.com/s/files/1/0000/p_100x100.jpg"),
      true,
    );
    assert.equal(
      isRejectImageUrl("https://images.example.com/product/40x40/mug.jpg"),
      true,
    );
    assert.equal(
      isRejectImageUrl("https://images.example.com/product.jpg?w=40&h=40"),
      true,
    );
    // Usable product media on a generic CDN
    assert.equal(
      isRejectImageUrl("https://cdn.example.com/products/mug-1200.jpg"),
      false,
    );
  });

  it("optional Amazon rewrite is an enhancement, not the only pass path", () => {
    const amazon = preferLargerImageUrl(
      "https://m.media-amazon.com/images/I/abc._AC_SX100_.jpg",
    );
    assert.match(amazon, /AC_SL1500/);
    const shopify = preferLargerImageUrl(
      "https://cdn.shopify.com/s/files/1/0000/mug_200x200.jpg",
    );
    assert.match(shopify, /_1200x/);
    // Generic CDN URL passes through unchanged and is still acceptable
    const plain = "https://cdn.example.com/products/mug-hero.jpg";
    assert.equal(preferLargerImageUrl(plain), plain);
    assert.equal(isRejectImageUrl(plain), false);
  });
});

describe("priceBrand (host-agnostic)", () => {
  it("formats HKD without mixing ¥ and does not invent currency from zh locale", () => {
    assert.equal(detectCurrency("HK$1,685.94", "HKD"), "HKD");
    assert.equal(extractAmount("HK$1,685.94"), "1685.94");
    assert.equal(formatDisplayPrice("HK$1,685.94", "HKD"), "HK$1685.94");
    assert.equal(formatDisplayPrice("¥1,685.94 HKD", "HKD"), "HK$1685.94");
    assert.equal(detectCurrency("49.00", null, "zh"), null);
    assert.equal(formatDisplayPrice("49.00", null, "zh"), "49.00");
  });

  it("resolves product brand on Amazon and non-Amazon marketplaces", () => {
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
        brand: null,
        title: "Acme Ceramic Mug — Matte Black",
        urlHost: "acme-store.myshopify.com",
        ogSiteName: "Shopify",
      }),
      "Acme",
    );
    assert.notEqual(
      resolveProductBrand({
        brand: null,
        title: "Acme Ceramic Mug — Matte Black",
        urlHost: "acme-store.myshopify.com",
        ogSiteName: "Shopify",
      }),
      "acme-store.myshopify.com",
    );
    assert.equal(
      resolveProductBrand({
        brand: "Acme",
        title: "Ceramic Mug",
        urlHost: "shop.example.com",
        ogSiteName: "Example Shop",
      }),
      "Acme",
    );
    assert.ok(isMarketplaceHost("amazon.com"));
    assert.ok(isMarketplaceHost("acme.myshopify.com"));
    assert.ok(isMarketplaceHost("ebay.com"));
    assert.equal(isMarketplaceHost("brand.example.com"), false);
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

describe("Chinese title/caption completeness", () => {
  it("does not hard-clip Chinese at ~22 into incomplete text", () => {
    const longZh =
      "联想Idea Tab十一英寸安卓平板电脑长续航学习娱乐轻薄金属机身";
    assert.ok(longZh.length > 22);
    const caption = clipReadable(longZh, 42);
    assert.ok(caption.length > 22);
    assert.doesNotMatch(caption, /…|\.\.\./);
    assert.ok(caption.startsWith("联想"));
  });

  it("videoSpecFromFacts keeps Chinese captions above the old 22-char cut", () => {
    const facts: ProductFacts = {
      sourceUrl: "https://shop.example.com/products/idea-tab",
      title: "联想Idea Tab十一英寸安卓平板电脑长续航轻薄金属机身",
      brand: "联想",
      price: "HK$1685.94",
      currency: "HKD",
      compareAtPrice: null,
      description: "高清显示屏。全天续航。轻薄金属机身。适合学习与娱乐。",
      images: ["/tmp/product.png"],
      urlHost: "shop.example.com",
      localeHint: "zh",
      logo: null,
    };
    const spec = videoSpecFromFacts(facts);
    assert.ok(spec.title.length > 22);
    assert.ok(spec.captions[0].length > 22);
    assert.doesNotMatch(spec.title, /…/);
    assert.doesNotMatch(spec.captions[0], /…/);
  });
});

describe("videoSpecFromFacts quality", () => {
  it("uses product brand, clean price, and no banned filler on a generic PDP", () => {
    const facts: ProductFacts = {
      sourceUrl: "https://acme-store.myshopify.com/products/ceramic-mug",
      title: "Acme Ceramic Mug Matte Black",
      brand: "Acme",
      price: "$28.00",
      currency: "USD",
      compareAtPrice: null,
      description: "Matte black ceramic. Dishwasher safe. 12 oz everyday mug.",
      images: ["/tmp/product.png"],
      urlHost: "acme-store.myshopify.com",
      localeHint: "en",
      logo: null,
    };
    const spec = videoSpecFromFacts(facts);
    assert.equal(spec.brand, "Acme");
    assert.equal(spec.price, "$28.00");
    assert.doesNotMatch(spec.headline, /一起看清这一页|十五秒|本地短片|See this page clearly/i);
    for (const c of spec.captions) {
      assert.doesNotMatch(c, /一起看清这一页|十五秒|本地短片|See this page clearly/i);
      assert.ok(c.length > 0);
    }
    assert.equal(spec.templateId, "product-promo");
  });
});

describe("mid section product hero vs brandMark", () => {
  const fixtureProduct = path.join(config.root, "fixtures", "assets", "product.png");
  const fixtureLogo = path.join(config.root, "templates", "product-promo", "assets", "logo.png");

  const spec: VideoSpec = {
    locale: "en",
    brand: "Acme",
    title: "Acme Ceramic Mug Matte Black",
    price: "$28.00",
    compareAtPrice: "",
    headline: "Matte black ceramic",
    captions: ["Acme Ceramic Mug Matte Black", "Dishwasher safe", "12 oz everyday mug"],
    cta: "Learn more",
    tagline: "Everyday mug",
    urlHost: "acme-store.myshopify.com",
    theme: { background: "#0a0a0f", accent: "#C41E3A" },
    templateId: "product-promo",
  };

  it("stages mid hero with byte-matched extension, separate from brandMark", () => {
    const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-fill-"));
    try {
      const productCopy = path.join(jobDir, "hero-src.png");
      const logoCopy = path.join(jobDir, "logo-src.png");
      fs.copyFileSync(fixtureProduct, productCopy);
      fs.copyFileSync(fixtureLogo, logoCopy);
      const productBytes = fs.readFileSync(productCopy);
      const logoBytes = fs.readFileSync(logoCopy);
      const midExt = extForImageFile(productCopy);

      const filled = fillTemplate({
        jobId: "job_testfill0001",
        jobDir,
        spec,
        assets: { logo: logoCopy, productImage: productCopy },
      });

      const midHero = path.join(filled.projectDir, "assets", `product${midExt}`);
      assert.ok(fs.existsSync(midHero));
      assert.deepEqual(fs.readFileSync(midHero), productBytes);
      assert.match(filled.variables.brandMark, /^assets\/logo/);
      const brandMarkFile = path.join(filled.projectDir, filled.variables.brandMark);
      assert.ok(fs.existsSync(brandMarkFile));
      assert.deepEqual(fs.readFileSync(brandMarkFile), logoBytes);
      assert.notDeepEqual(fs.readFileSync(midHero), logoBytes);

      const midHtml = fs.readFileSync(
        path.join(filled.projectDir, "compositions", "scene2-4-canvas.html"),
        "utf8",
      );
      assert.match(
        midHtml,
        new RegExp(`class="product-hero-img"\\s+src="assets/product\\${midExt}"`),
      );
      assert.doesNotMatch(midHtml, /product-hero-img[\s\S]{0,80}data-var-src="brandMark"/);
    } finally {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
  });

  it("mid composition is a product stage, not browser chrome, with stable mid tweens", () => {
    const html = fs.readFileSync(
      path.join(config.root, "templates/product-promo/compositions/scene2-4-canvas.html"),
      "utf8",
    );
    assert.match(html, /class="product-hero-img"[\s\S]*?src="assets\/product\.png"/);
    assert.doesNotMatch(
      html,
      /product-hero-img[\s\S]{0,120}data-var-src="brandMark"/,
    );
    assert.match(html, /class="web-frame"/);
    assert.match(html, /class="ui-content"/);
    assert.match(html, /data-duration="9\.375"/);
    assert.match(html, /tl\.duration\(tl\.duration\(\) \* 15 \/ 20\)/);
    assert.doesNotMatch(html, /\.web-frame\s*\{[^}]*background:\s*white/);
    assert.doesNotMatch(html, /\.ui-content\s*\{[^}]*background:\s*white/);
    // Old demo reformat must not shift/shrink the product stage
    assert.doesNotMatch(html, /\.hero-section",\s*\{\s*y:\s*-150/);
    assert.doesNotMatch(html, /\.hero-heading",\s*\{\s*scale:\s*0\.8/);
    assert.match(html, /\.hero-section",\s*\{\s*y:\s*0/);
    assert.match(html, /\.hero-heading",\s*\{\s*scale:\s*1/);
  });
});
