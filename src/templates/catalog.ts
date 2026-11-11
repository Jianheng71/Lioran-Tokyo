import path from "node:path";
import { config } from "../config.js";

export const TEMPLATE_IDS = [
  "product-promo",
  "cinematic-product",
  "kinetic-typo",
  "brand-story",
  "social-ad",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const DEFAULT_TEMPLATE_ID: TemplateId = "product-promo";

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function templateDir(id: TemplateId): string {
  return path.join(config.root, "templates", id);
}

/** Seconds of each fillable composition (for docs / fixture labels). */
export const TEMPLATE_DURATIONS: Record<TemplateId, number> = {
  "product-promo": 15,
  "cinematic-product": 18,
  "kinetic-typo": 15.15,
  "brand-story": 26,
  "social-ad": 15,
};

/**
 * Pick a template from free-form user / model text.
 * Ordinary product-promo requests stay on the official default.
 */
export function inferTemplateId(text: string | null | undefined): TemplateId | null {
  if (!text) return null;
  const t = text.toLowerCase();

  if (
    /\b(cinematic-product|cinematic)\b/.test(t) ||
    /电影感|电影风|四幕产品|产品揭示/.test(text)
  ) {
    return "cinematic-product";
  }
  if (
    /\b(kinetic-typo|kinetic)\b/.test(t) ||
    /字效|动态字体|kinetic|glitch|typography/.test(t)
  ) {
    return "kinetic-typo";
  }
  if (
    /\b(brand-story|brand story)\b/.test(t) ||
    /品牌故事|品牌叙事/.test(text)
  ) {
    return "brand-story";
  }
  if (
    /\b(social-ad|social ad|flash sale)\b/.test(t) ||
    /闪购|社交广告|折扣广告/.test(text)
  ) {
    return "social-ad";
  }
  if (
    /\b(product-promo|product promo)\b/.test(t) ||
    /官方模版|官方模板|默认模版|默认模板|促销模版|促销模板/.test(text)
  ) {
    return "product-promo";
  }
  return null;
}

/**
 * When the user did not name a template, choose the most suitable of the five.
 * Main product-promo work stays on official product-promo.
 */
export function chooseTemplateId(opts: {
  named: TemplateId | null;
  message?: string | null;
  instruction?: string | null;
}): TemplateId {
  if (opts.named) return opts.named;
  const fromMessage = inferTemplateId(opts.message);
  if (fromMessage) return fromMessage;
  const fromInstruction = inferTemplateId(opts.instruction);
  if (fromInstruction) return fromInstruction;

  const blob = `${opts.message || ""} ${opts.instruction || ""}`.toLowerCase();
  if (/flash|% off|折扣|闪购|shop now|限时/.test(blob)) return "social-ad";
  if (/故事|narrative|craft|journey|品牌史/.test(blob)) return "brand-story";
  if (/字|typo|slogan|冲击|不要将就|don't settle/.test(blob)) return "kinetic-typo";
  if (/电影|cinematic|spotlight|卖点三栏/.test(blob)) return "cinematic-product";
  return DEFAULT_TEMPLATE_ID;
}
