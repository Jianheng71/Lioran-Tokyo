/**
 * Browser-side page field extraction for Puppeteer page.evaluate.
 * Must stay a plain JS string (no TypeScript callback) so tsx/esbuild
 * keepNames cannot inject __name(...) into the browser context.
 */
export const EXTRACT_PAGE_FIELDS = `(() => {
  const abs = (u) => {
    if (!u) return null;
    try {
      return new URL(u, location.href).href;
    } catch {
      return null;
    }
  };
  const meta = (sel) =>
    document.querySelector(sel)?.getAttribute("content")?.trim() || null;
  const text = (sel) =>
    document.querySelector(sel)?.innerText?.trim() || null;

  const rejectUrl = (u) => {
    if (!u) return true;
    return /favicon|apple-touch-icon|sprite|spritesheet|icon[_-]?set|transparent[_-]?pixel|spacer\\.|1x1|pixel\\.gif|blank\\.|loading[_-]?spinner|badge|cart[_-]?icon|prime[_-]?logo|smile[_-]?(?:logo|icon)|nav[_-]?logo|\\/icons?\\//i.test(
      u,
    ) || /[._-](?:SS|SX|SY|US|UX|UY|AC_US|AC_UL|AC_SX|AC_SY|_SL)(?:20|32|40|50|60|70|75|80|90|100)(?:[._,]|$)/i.test(
      u,
    );
  };

  const ogTitle = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]');
  const ogSite = meta('meta[property="og:site_name"]');
  const ogDesc =
    meta('meta[property="og:description"]') ||
    meta('meta[name="description"]') ||
    meta('meta[name="twitter:description"]');
  const ogImage =
    abs(meta('meta[property="og:image"]')) || abs(meta('meta[name="twitter:image"]'));
  const ogLocale = meta('meta[property="og:locale"]');
  const htmlLang = document.documentElement.lang || null;

  const jsonLdBlocks = [];
  for (const el of Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    try {
      const parsed = JSON.parse(el.textContent || "null");
      if (Array.isArray(parsed)) jsonLdBlocks.push(...parsed);
      else if (parsed && typeof parsed === "object") jsonLdBlocks.push(parsed);
    } catch {
      // ignore bad ld+json
    }
  }

  const products = [];
  const pages = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    const obj = node;
    const type = obj["@type"];
    const types = Array.isArray(type) ? type : type ? [type] : [];
    const lower = types.map((t) => String(t).toLowerCase());
    if (lower.some((t) => t === "product")) products.push(obj);
    if (
      lower.some((t) =>
        ["webpage", "article", "newsarticle", "blogposting", "organization", "website"].includes(
          t,
        ),
      )
    ) {
      pages.push(obj);
    }
    if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
  };
  jsonLdBlocks.forEach(visit);

  const product = products[0] || null;
  const pageNode = pages[0] || null;
  // Never seed brand from marketplace site_name (e.g. Amazon)
  let brand = null;
  let price = null;
  let currency = null;
  let compareAtPrice = null;
  let ldTitle = null;
  let ldDesc = null;
  const ldImages = [];

  const takeImages = (img) => {
    if (typeof img === "string") ldImages.push(img);
    else if (Array.isArray(img)) {
      for (const i of img) if (typeof i === "string") ldImages.push(i);
    } else if (img && typeof img === "object" && typeof img.url === "string") {
      ldImages.push(img.url);
    }
  };

  if (product) {
    ldTitle = typeof product.name === "string" ? product.name : null;
    ldDesc = typeof product.description === "string" ? product.description : null;
    const b = product.brand;
    if (typeof b === "string") brand = b;
    else if (b && typeof b === "object" && typeof b.name === "string") {
      brand = b.name;
    }
    const offers = product.offers;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer && typeof offer === "object") {
      const o = offer;
      if (o.price != null) price = String(o.price);
      if (typeof o.priceCurrency === "string") currency = o.priceCurrency;
      if (o.highPrice != null && !price) price = String(o.highPrice);
      if (o.lowPrice != null && o.highPrice != null) {
        compareAtPrice = String(o.highPrice);
        price = String(o.lowPrice);
      }
    }
    takeImages(product.image);
  }

  if (pageNode) {
    if (!ldTitle && typeof pageNode.name === "string") ldTitle = pageNode.name;
    if (!ldTitle && typeof pageNode.headline === "string") ldTitle = pageNode.headline;
    if (!ldDesc && typeof pageNode.description === "string") ldDesc = pageNode.description;
    takeImages(pageNode.image);
  }

  // Amazon-style brand row
  if (!brand) {
    brand =
      text("#brand") ||
      text("a#bylineInfo") ||
      text('[data-brand]') ||
      text('.po-brand .a-span9') ||
      text('[itemprop="brand"]') ||
      null;
  }

  const visibleTitle =
    text("#productTitle") ||
    text("h1#title") ||
    text("h1") ||
    text('[itemprop="name"]') ||
    document.title?.trim() ||
    null;

  const visiblePrice =
    text(".a-price .a-offscreen") ||
    text("#priceblock_ourprice") ||
    text("#priceblock_dealprice") ||
    text('[itemprop="price"]') ||
    text(".price") ||
    null;

  const images = [];
  const pushImg = (u) => {
    const a = abs(u);
    if (!a || rejectUrl(a) || images.includes(a)) return;
    images.push(a);
  };
  // Prefer product JSON-LD / OG product media before DOM sweep
  ldImages.forEach((u) => pushImg(u));
  pushImg(ogImage);

  const landing =
    document.querySelector("#landingImage, #imgTagWrapperId img, #main-image, img[data-old-hires]");
  if (landing) {
    pushImg(
      landing.getAttribute("data-old-hires") ||
        landing.getAttribute("data-a-dynamic-image") ||
        landing.currentSrc ||
        landing.src,
    );
    // data-a-dynamic-image is a JSON map of url→size
    try {
      const dyn = landing.getAttribute("data-a-dynamic-image");
      if (dyn) {
        const map = JSON.parse(dyn);
        Object.keys(map)
          .sort((a, b) => {
            const aa = map[a];
            const bb = map[b];
            return (bb?.[0] || 0) * (bb?.[1] || 0) - (aa?.[0] || 0) * (aa?.[1] || 0);
          })
          .slice(0, 3)
          .forEach((u) => pushImg(u));
      }
    } catch {
      // ignore
    }
  }

  for (const img of Array.from(
    document.querySelectorAll(
      "#altImages img, #imageBlock img, main img[src*='media-amazon'], main img, article img",
    ),
  )) {
    if (images.length >= 8) break;
    const el = img;
    const w = Number(el.naturalWidth || el.width || 0);
    const h = Number(el.naturalHeight || el.height || 0);
    if ((w && w < 120) || (h && h < 120)) continue;
    pushImg(
      el.getAttribute("data-old-hires") ||
        el.currentSrc ||
        el.src ||
        el.getAttribute("data-src"),
    );
  }

  // Do NOT harvest favicon / apple-touch-icon as logo for brandMark.
  const logo = null;

  const textSample = (document.body?.innerText || "").replace(/\\s+/g, " ").slice(0, 1600);

  return {
    title: ogTitle || ldTitle || visibleTitle,
    brand,
    ogSiteName: ogSite,
    description: ogDesc || ldDesc || "",
    price: price || visiblePrice,
    currency,
    compareAtPrice,
    images,
    logo,
    htmlLang,
    ogLocale,
    textSample,
    httpStatus: null,
  };
})()`;
