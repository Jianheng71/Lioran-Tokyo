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
  let brand = ogSite || null;
  let price = null;
  let currency = null;
  const compareAtPrice = null;
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
    }
    takeImages(product.image);
  }

  if (pageNode) {
    if (!ldTitle && typeof pageNode.name === "string") ldTitle = pageNode.name;
    if (!ldTitle && typeof pageNode.headline === "string") ldTitle = pageNode.headline;
    if (!ldDesc && typeof pageNode.description === "string") ldDesc = pageNode.description;
    if (!brand && typeof pageNode.name === "string" && !product) brand = pageNode.name;
    takeImages(pageNode.image);
    takeImages(pageNode.logo);
  }

  const visibleTitle =
    text("h1") || text('[itemprop="name"]') || document.title?.trim() || null;
  const visiblePrice =
    text('[itemprop="price"]') || text(".price") || text('[class*="price" i]') || null;

  const images = [];
  const pushImg = (u) => {
    const a = abs(u);
    if (a && !images.includes(a)) images.push(a);
  };
  pushImg(ogImage);
  ldImages.forEach((u) => pushImg(u));
  for (const img of Array.from(document.querySelectorAll("main img, article img, img"))) {
    if (images.length >= 6) break;
    const el = img;
    pushImg(el.currentSrc || el.src || el.getAttribute("data-src"));
  }

  const logoEl = document.querySelector(
    'img[alt*="logo" i], link[rel="apple-touch-icon"], link[rel="icon"]',
  );
  const logo =
    abs(
      logoEl && "href" in logoEl
        ? logoEl.getAttribute("href")
        : logoEl?.src || null,
    ) || null;

  const textSample = (document.body?.innerText || "").replace(/\\s+/g, " ").slice(0, 1200);

  return {
    title: ogTitle || ldTitle || visibleTitle,
    brand,
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
