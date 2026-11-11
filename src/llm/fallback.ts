import type { ProductFacts, VideoSpec } from "../schemas.js";

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function formatPrice(facts: ProductFacts): string {
  if (!facts.price) return "";
  const cur = (facts.currency || "").toUpperCase();
  if (cur === "CNY" || cur === "RMB" || facts.localeHint.startsWith("zh")) {
    return facts.price.startsWith("¥") ? facts.price : `¥${facts.price}`;
  }
  if (cur === "JPY") {
    return facts.price.startsWith("¥") || facts.price.startsWith("￥")
      ? facts.price
      : `¥${facts.price}`;
  }
  if (cur === "USD") {
    return facts.price.startsWith("$") ? facts.price : `$${facts.price}`;
  }
  return facts.price;
}

function formatCompare(facts: ProductFacts): string {
  if (!facts.compareAtPrice) return "";
  const fake: ProductFacts = { ...facts, price: facts.compareAtPrice };
  return formatPrice(fake);
}

/** Deterministic VideoSpec from ProductFacts when Hermes fails validation twice. */
export function videoSpecFromFacts(
  facts: ProductFacts,
  templateId: VideoSpec["templateId"] = "product-promo",
): VideoSpec {
  const zh = facts.localeHint.toLowerCase().startsWith("zh");
  const title = clip(facts.title, 48);
  const brand = clip(facts.brand || facts.urlHost, 40);
  const desc = clip(facts.description || title, 42);

  const priceText = clip(formatPrice(facts), 24);
  const captions: [string, string, string] = zh
    ? [
        clip(`${brand} · ${title}`, 22),
        clip(desc || (priceText ? `参考价 ${priceText}` : "锁定要点，跟住节奏。"), 22),
        clip(priceText ? "十五秒，把这一页说清楚。" : "十五秒，把这一页说清楚。", 22),
      ]
    : [
        clip(`${brand}: ${title}`, 42),
        clip(desc || (priceText ? `From ${priceText}` : "Key points, kept on beat."), 42),
        clip("Fifteen seconds. Clear and done.", 42),
      ];

  return {
    locale: facts.localeHint.slice(0, 8),
    brand,
    title,
    price: priceText,
    compareAtPrice: clip(formatCompare(facts), 24),
    headline: clip(zh ? "一起看清这一页" : "See this page clearly", 48),
    captions,
    cta: zh ? "立即了解" : "Learn more",
    tagline: clip(zh ? "本地短片，跟着页面语言。" : "Local short film, page language first.", 48),
    urlHost: clip(facts.urlHost, 40),
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
