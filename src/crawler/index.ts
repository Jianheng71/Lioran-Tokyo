import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PuppeteerCrawler } from "crawlee";
import { config } from "../config.js";
import { withBrowserLock } from "../locks.js";
import { ProductFactsSchema, type ProductFacts } from "../schemas.js";
import { assertHttpUrl } from "../urls.js";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function inferLocale(opts: {
  htmlLang: string | null;
  ogLocale: string | null;
  textSample: string;
}): string {
  const raw = (opts.ogLocale || opts.htmlLang || "").toLowerCase().replace("_", "-");
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("en")) return "en";
  const sample = opts.textSample.slice(0, 800);
  if (/[\u3040-\u30ff]/.test(sample)) return "ja";
  if (/[\u4e00-\u9fff]/.test(sample)) return "zh";
  return "en";
}

async function downloadImage(url: string, destDir: string, index: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "LioranTokyoLocalBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) return null;
    let ext = ".jpg";
    if (ctype.includes("png") || url.includes(".png")) ext = ".png";
    else if (ctype.includes("webp") || url.includes(".webp")) ext = ".webp";
    else if (ctype.includes("gif")) ext = ".gif";
    const name = `img_${index}_${createHash("sha1").update(url).digest("hex").slice(0, 8)}${ext}`;
    const dest = path.join(destDir, name);
    fs.writeFileSync(dest, buf);
    return dest;
  } catch {
    return null;
  }
}

/** Copy a redistributable fixture image so fills never fail for image-less pages. */
function stagePlaceholderImage(destDir: string): string {
  const src = path.join(config.root, "fixtures", "assets", "product.png");
  const dest = path.join(destDir, "img_placeholder_product.png");
  fs.copyFileSync(src, dest);
  return dest;
}

type Extracted = {
  title: string | null;
  brand: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  compareAtPrice: string | null;
  images: string[];
  logo: string | null;
  htmlLang: string | null;
  ogLocale: string | null;
  textSample: string;
  httpStatus: number | null;
};

/**
 * Generic public-page crawl via Crawlee (PuppeteerCrawler).
 * Works for any public URL the user has the right to use — not only product PDPs.
 * Extracts OG / JSON-LD / visible primary fields and soft-fills missing slots.
 * No site-specific adapters. No login-wall crawling. No Python.
 */
export async function crawlProductPage(url: string, assetDir: string): Promise<ProductFacts> {
  url = assertHttpUrl(url);
  fs.mkdirSync(assetDir, { recursive: true });

  const extracted = await withBrowserLock(async (): Promise<Extracted> => {
    const holder: { result: Extracted | null; crawlError: Error | null } = {
      result: null,
      crawlError: null,
    };

    const crawler = new PuppeteerCrawler({
      maxRequestsPerCrawl: 1,
      requestHandlerTimeoutSecs: Math.ceil(config.crawlTimeoutMs / 1000),
      navigationTimeoutSecs: Math.ceil(config.crawlTimeoutMs / 1000),
      headless: true,
      launchContext: {
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          ...(config.chromePath ? { executablePath: config.chromePath } : {}),
        },
      },
      async requestHandler({ page, request, response }) {
        page.setDefaultTimeout(config.crawlTimeoutMs);
        const status = response?.status() ?? null;
        if (status != null && status >= 400) {
          throw new Error(`Public page HTTP ${status}`);
        }

        const data = await page.evaluate(() => {
          const abs = (u: string | null | undefined) => {
            if (!u) return null;
            try {
              return new URL(u, location.href).href;
            } catch {
              return null;
            }
          };
          const meta = (sel: string) =>
            document.querySelector(sel)?.getAttribute("content")?.trim() || null;
          const text = (sel: string) =>
            (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim() || null;

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

          const jsonLdBlocks: Array<Record<string, unknown>> = [];
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

          const products: Array<Record<string, unknown>> = [];
          const pages: Array<Record<string, unknown>> = [];
          const visit = (node: unknown) => {
            if (!node || typeof node !== "object") return;
            const obj = node as Record<string, unknown>;
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
          let brand: string | null = ogSite || null;
          let price: string | null = null;
          let currency: string | null = null;
          const compareAtPrice: string | null = null;
          let ldTitle: string | null = null;
          let ldDesc: string | null = null;
          const ldImages: string[] = [];

          const takeImages = (img: unknown) => {
            if (typeof img === "string") ldImages.push(img);
            else if (Array.isArray(img)) {
              for (const i of img) if (typeof i === "string") ldImages.push(i);
            } else if (img && typeof img === "object" && typeof (img as { url?: string }).url === "string") {
              ldImages.push((img as { url: string }).url);
            }
          };

          if (product) {
            ldTitle = typeof product.name === "string" ? product.name : null;
            ldDesc = typeof product.description === "string" ? product.description : null;
            const b = product.brand;
            if (typeof b === "string") brand = b;
            else if (b && typeof b === "object" && typeof (b as { name?: string }).name === "string") {
              brand = (b as { name: string }).name;
            }
            const offers = product.offers;
            const offer = Array.isArray(offers) ? offers[0] : offers;
            if (offer && typeof offer === "object") {
              const o = offer as Record<string, unknown>;
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

          const images: string[] = [];
          const pushImg = (u: string | null) => {
            const a = abs(u);
            if (a && !images.includes(a)) images.push(a);
          };
          pushImg(ogImage);
          ldImages.forEach((u) => pushImg(u));
          for (const img of Array.from(document.querySelectorAll("main img, article img, img"))) {
            if (images.length >= 6) break;
            const el = img as HTMLImageElement;
            pushImg(el.currentSrc || el.src || el.getAttribute("data-src"));
          }

          const logoEl = document.querySelector(
            'img[alt*="logo" i], link[rel="apple-touch-icon"], link[rel="icon"]',
          ) as HTMLImageElement | HTMLLinkElement | null;
          const logo =
            abs(
              logoEl && "href" in logoEl
                ? logoEl.getAttribute("href")
                : (logoEl as HTMLImageElement | null)?.src || null,
            ) || null;

          const textSample = (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 1200);

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
            httpStatus: null as number | null,
          };
        });

        holder.result = { ...data, httpStatus: status };

        // Refuse obvious login walls with no page signals
        const loginish =
          /sign in|log in|login|登录|登錄|サインイン/i.test(data.title || "") &&
          data.images.length === 0 &&
          !(data.description || "").trim();
        if (loginish) {
          throw new Error("Refusing to crawl a login wall. Use a public page you have the right to use.");
        }

        // Single-URL crawl; request kept for Crawlee handler signature
        void request;
      },
      failedRequestHandler({ error }) {
        holder.crawlError = error instanceof Error ? error : new Error(String(error));
      },
    });

    await crawler.run([url]);

    if (holder.crawlError) throw holder.crawlError;
    if (!holder.result) throw new Error("Crawlee finished without extracting page fields.");
    return holder.result;
  });

  const host = hostOf(url);
  const title =
    (extracted.title || "").trim() ||
    (extracted.description || "").trim().slice(0, 48) ||
    host;
  const brand = (extracted.brand || "").trim() || host;
  const description = (extracted.description || extracted.textSample || title).slice(0, 800);

  const localImages: string[] = [];
  for (let i = 0; i < extracted.images.length && localImages.length < 4; i++) {
    const local = await downloadImage(extracted.images[i], assetDir, i);
    if (local) localImages.push(local);
  }

  let localLogo: string | null = null;
  if (extracted.logo) {
    localLogo = await downloadImage(extracted.logo, assetDir, 90);
  }

  // Soft-fill: incomplete pages still get a usable brandMark image for product-promo.
  if (localImages.length === 0) {
    if (localLogo) {
      localImages.push(localLogo);
    } else {
      localImages.push(stagePlaceholderImage(assetDir));
    }
  }

  return ProductFactsSchema.parse({
    sourceUrl: url,
    title,
    brand,
    price: extracted.price,
    currency: extracted.currency,
    compareAtPrice: extracted.compareAtPrice,
    description,
    images: localImages,
    urlHost: host,
    localeHint: inferLocale({
      htmlLang: extracted.htmlLang,
      ogLocale: extracted.ogLocale,
      textSample: `${title} ${description} ${extracted.textSample}`,
    }),
    logo: localLogo,
  });
}
