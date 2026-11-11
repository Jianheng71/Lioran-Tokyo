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
  resolveProductBrand,
} from "./priceBrand.js";
import { clipReadable, videoSpecFromFacts } from "../llm/fallback.js";
import { fillTemplate } from "../templater/index.js";
import { config } from "../config.js";
import type { ProductFacts, VideoSpec } from "../schemas.js";

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

describe("Chinese title/caption completeness", () => {
  it("does not hard-clip Chinese at ~22 into incomplete text", () => {
    const longZh =
      "联想Idea Tab十一英寸安卓平板电脑长续航学习娱乐轻薄金属机身";
    assert.ok(longZh.length > 22);
    const caption = clipReadable(longZh, 42);
    assert.ok(caption.length > 22);
    assert.doesNotMatch(caption, /…|\.\.\./);
    assert.ok(caption.startsWith("联想"));
    // Remains recognizable — includes a substantial product name prefix
    assert.ok(caption.includes("Idea Tab") || caption.includes("联想"));
  });

  it("videoSpecFromFacts keeps Chinese captions above the old 22-char cut", () => {
    const facts: ProductFacts = {
      sourceUrl: "https://www.amazon.com/dp/example",
      title: "联想Idea Tab十一英寸安卓平板电脑长续航轻薄金属机身",
      brand: "联想",
      price: "HK$1685.94",
      currency: "HKD",
      compareAtPrice: null,
      description: "高清显示屏。全天续航。轻薄金属机身。适合学习与娱乐。",
      images: ["/tmp/product.png"],
      urlHost: "amazon.com",
      localeHint: "zh",
      logo: null,
    };
    const spec = videoSpecFromFacts(facts);
    assert.ok(spec.title.length > 22);
    assert.ok(spec.captions[0].length > 22);
    assert.doesNotMatch(spec.title, /…/);
    assert.doesNotMatch(spec.captions[0], /…/);
    assert.ok(spec.title.includes("联想") || spec.title.includes("Idea"));
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

describe("mid section product hero vs brandMark", () => {
  const fixtureProduct = path.join(config.root, "fixtures", "assets", "product.png");
  const fixtureLogo = path.join(config.root, "templates", "product-promo", "assets", "logo.png");

  const spec: VideoSpec = {
    locale: "zh",
    brand: "联想",
    title: "联想Idea Tab十一英寸安卓平板电脑",
    price: "HK$1685.94",
    compareAtPrice: "",
    headline: "高清显示屏全天续航",
    captions: ["联想Idea Tab十一英寸安卓平板电脑", "高清显示屏", "全天续航"],
    cta: "了解详情",
    tagline: "轻薄金属机身",
    urlHost: "amazon.com",
    theme: { background: "#0a0a0f", accent: "#C41E3A" },
    templateId: "product-promo",
  };

  it("stages mid hero as assets/product.png separate from brandMark when logo exists", () => {
    const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-fill-"));
    try {
      const productCopy = path.join(jobDir, "hero-src.png");
      const logoCopy = path.join(jobDir, "logo-src.png");
      fs.copyFileSync(fixtureProduct, productCopy);
      fs.copyFileSync(fixtureLogo, logoCopy);
      const productBytes = fs.readFileSync(productCopy);
      const logoBytes = fs.readFileSync(logoCopy);

      const filled = fillTemplate({
        jobId: "job_testfill0001",
        jobDir,
        spec,
        assets: { logo: logoCopy, productImage: productCopy },
      });

      const midHero = path.join(filled.projectDir, "assets", "product.png");
      assert.ok(fs.existsSync(midHero));
      assert.deepEqual(fs.readFileSync(midHero), productBytes);
      assert.match(filled.variables.brandMark, /^assets\/logo/);
      const brandMarkFile = path.join(filled.projectDir, filled.variables.brandMark);
      assert.ok(fs.existsSync(brandMarkFile));
      assert.deepEqual(fs.readFileSync(brandMarkFile), logoBytes);
      // Mid hero must not be the logo when a product hero exists
      assert.notDeepEqual(fs.readFileSync(midHero), logoBytes);
    } finally {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
  });

  it("mid composition binds product.png, not brandMark, and is not a browser chrome shell", () => {
    const html = fs.readFileSync(
      path.join(config.root, "templates/product-promo/compositions/scene2-4-canvas.html"),
      "utf8",
    );
    assert.match(html, /class="product-hero-img"[\s\S]*?src="assets\/product\.png"/);
    assert.doesNotMatch(
      html,
      /product-hero-img[\s\S]{0,120}data-var-src="brandMark"/,
    );
    // Timeline selectors must remain
    assert.match(html, /class="web-frame"/);
    assert.match(html, /class="ui-content"/);
    assert.match(html, /tl\.duration\(tl\.duration\(\) \* 15 \/ 20\)/);
    // Must not still read as a white browser / Figma web-frame chrome
    assert.doesNotMatch(html, /\.web-frame\s*\{[^}]*background:\s*white/);
    assert.doesNotMatch(html, /\.ui-content\s*\{[^}]*background:\s*white/);
    assert.match(html, /display:\s*none\s*!important/); // nav-links hidden
  });
});
