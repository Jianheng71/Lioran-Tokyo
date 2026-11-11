import type { ProductFacts, VideoSpec } from "../schemas.js";
import { formatDisplayPrice } from "../crawler/priceBrand.js";

/**
 * Fit text into an official short slot without mid-word / mid-CJK cuts and
 * without an ellipsis that makes the product name unrecognizable.
 * Prefer a natural boundary; if none, keep a complete prefix up to max.
 */
export function clipReadable(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const breakAt = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("·"),
    slice.lastIndexOf("，"),
    slice.lastIndexOf("。"),
    slice.lastIndexOf("、"),
    slice.lastIndexOf("："),
    slice.lastIndexOf(":"),
    slice.lastIndexOf("-"),
    slice.lastIndexOf("/"),
  );
  if (breakAt >= Math.floor(max * 0.45)) {
    return slice.slice(0, breakAt).trim();
  }
  // No ellipsis — keep a complete readable prefix inside the official max.
  return slice.trim();
}

function sellingPoints(facts: ProductFacts): string[] {
  const raw = `${facts.description || ""} ${facts.title || ""}`
    .replace(/\s+/g, " ")
    .trim();
  const parts = raw
    .split(/[。.!！？?\n|;；|/]/)
    .map((s) => s.replace(/^[-•\s]+/, "").trim())
    .filter((s) => s.length >= 4);
  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.includes(p) || p.includes(u))) uniq.push(p);
    if (uniq.length >= 6) break;
  }
  if (!uniq.length && facts.title) uniq.push(facts.title);
  return uniq;
}

/** Deterministic VideoSpec from ProductFacts when Hermes fails validation twice. */
export function videoSpecFromFacts(
  facts: ProductFacts,
  templateId: VideoSpec["templateId"] = "product-promo",
): VideoSpec {
  const zh = facts.localeHint.toLowerCase().startsWith("zh");
  // Use official slot maxima (title 48 / captions 42). Do not hard-clip Chinese
  // at ~22 into incomplete text — CSS wraps / tightens type on screen.
  const brand = clipReadable(facts.brand || "Brand", 40);
  const title = clipReadable(facts.title, 48);
  const priceText = formatDisplayPrice(facts.price, facts.currency, facts.localeHint);
  const compareText = formatDisplayPrice(
    facts.compareAtPrice,
    facts.currency,
    facts.localeHint,
  );
  const points = sellingPoints(facts);
  const p0 = points[0] || title;
  const p1 = points[1] || points[0] || title;
  const p2 = points[2] || points[1] || title;

  const headline = clipReadable(p0, 48);
  const captions: [string, string, string] = [
    clipReadable(title, 42),
    clipReadable(p1, 42),
    clipReadable(priceText ? `${priceText}` : p2, 42),
  ];
  // Ensure captions are product-derived, never the banned generic fillers
  const banned =
    /一起看清这一页|十五秒，把这一页说清楚|本地短片，跟着页面语言|See this page clearly|Fifteen seconds\. Clear and done|Local short film, page language first/i;
  for (let i = 0; i < 3; i++) {
    if (!captions[i] || banned.test(captions[i])) {
      captions[i] = clipReadable([title, brand, p0, p1, p2][i] || title, 42);
    }
  }

  const cta = zh ? "了解详情" : "Learn more";
  const tagline = clipReadable(p2 || p1 || title, 48);

  return {
    locale: facts.localeHint.slice(0, 8),
    brand,
    title,
    price: clipReadable(priceText, 24),
    compareAtPrice: clipReadable(compareText, 24),
    headline: banned.test(headline) ? clipReadable(title, 48) : headline,
    captions,
    cta,
    tagline: banned.test(tagline) ? clipReadable(title, 48) : tagline,
    urlHost: clipReadable(facts.urlHost, 40),
    theme: {
      background: "#0a0a0f",
      accent: "#C41E3A",
    },
    templateId,
  };
}

export function mergeSpecDefaults(next: Partial<VideoSpec>, prev: VideoSpec): VideoSpec {
  return {
    locale: next.locale || prev.locale,
    brand: next.brand || prev.brand,
    title: next.title || prev.title,
    price: next.price ?? prev.price,
    compareAtPrice: next.compareAtPrice ?? prev.compareAtPrice,
    headline: next.headline || prev.headline,
    captions: [
      next.captions?.[0] || prev.captions[0],
      next.captions?.[1] || prev.captions[1],
      next.captions?.[2] || prev.captions[2],
    ],
    cta: next.cta || prev.cta,
    tagline: next.tagline ?? prev.tagline,
    urlHost: next.urlHost || prev.urlHost,
    theme: {
      background: next.theme?.background || prev.theme.background,
      accent: next.theme?.accent || prev.theme.accent,
    },
    templateId: next.templateId || prev.templateId || "product-promo",
  };
}
