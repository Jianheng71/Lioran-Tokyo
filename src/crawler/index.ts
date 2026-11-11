import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PuppeteerCrawler } from "crawlee";
import { config } from "../config.js";
import { withBrowserLock } from "../locks.js";
import { ProductFactsSchema, type ProductFacts } from "../schemas.js";
import { assertHttpUrl } from "../urls.js";
import { EXTRACT_PAGE_FIELDS } from "./extract-page-fields.js";

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

        // Pass a pure JS string — never a TS callback — so esbuild keepNames
        // cannot inject __name(...) into the browser context.
        const data = (await page.evaluate(EXTRACT_PAGE_FIELDS)) as Omit<
          Extracted,
          "httpStatus"
        > & { httpStatus: number | null };

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
