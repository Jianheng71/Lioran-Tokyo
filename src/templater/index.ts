import fs from "node:fs";
import path from "node:path";
import type { VideoSpec } from "../schemas.js";
import {
  DEFAULT_TEMPLATE_ID,
  isTemplateId,
  templateDir,
  type TemplateId,
} from "../templates/catalog.js";

export type FillAssets = {
  logo: string | null;
  productImage: string | null;
};

export type FillResult = {
  projectDir: string;
  variablesPath: string;
  variables: Record<string, string>;
  brandMarkLocal: string | null;
  templateId: TemplateId;
};

function extOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ext || ".png";
}

function resolveTemplateId(spec: VideoSpec): TemplateId {
  const raw = spec.templateId;
  if (isTemplateId(raw)) return raw;
  return DEFAULT_TEMPLATE_ID;
}

function copyTemplate(projectDir: string, id: TemplateId): void {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.cpSync(templateDir(id), projectDir, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${path.sep}.hyperframes${path.sep}`) &&
      !src.endsWith(`${path.sep}.hyperframes`),
  });
}

function stageMark(projectDir: string, absPath: string, destName: string): string {
  const destDir = path.join(projectDir, "assets");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  if (path.resolve(absPath) !== path.resolve(dest)) {
    fs.copyFileSync(absPath, dest);
  }
  return `assets/${destName}`;
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function baseTheme(spec: VideoSpec): { background: string; accent: string } {
  return {
    background: String(spec.theme.background),
    accent: String(spec.theme.accent),
  };
}

function variablesForTemplate(
  id: TemplateId,
  spec: VideoSpec,
  brandMark: string,
): Record<string, string> {
  const theme = baseTheme(spec);
  const brand = String(spec.brand);
  const title = String(spec.title);
  const price = String(spec.price ?? "");
  const headline = String(spec.headline);
  const tagline = String(spec.tagline ?? "");
  const cta = String(spec.cta);
  const urlHost = String(spec.urlHost);
  const c1 = String(spec.captions[0]);
  const c2 = String(spec.captions[1]);
  const c3 = String(spec.captions[2]);
  const locale = String(spec.locale);

  if (id === "product-promo") {
    return {
      locale,
      brand,
      title,
      price,
      compareAtPrice: String(spec.compareAtPrice ?? ""),
      headline,
      caption1: c1,
      caption2: c2,
      caption3: c3,
      cta,
      tagline,
      urlHost,
      background: theme.background,
      accent: theme.accent,
      brandMark,
    };
  }

  if (id === "cinematic-product") {
    return {
      locale,
      brand,
      tagline: tagline || headline,
      title,
      price,
      productSubtitle: headline,
      featuresTitle: locale.startsWith("zh") ? "为什么选它" : "Why Choose Us",
      caption1: c1,
      caption2: c2,
      caption3: c3,
      featureDesc1: "",
      featureDesc2: "",
      featureDesc3: "",
      ctaTitle: headline || (locale.startsWith("zh") ? "立即了解" : "Get Started"),
      ctaSubtitle: tagline || c3,
      cta,
      urlHost,
      background: theme.background === "#0a0a0f" ? "#0a0a0a" : theme.background,
      accent: theme.accent === "#C41E3A" ? "#00ff88" : theme.accent,
      brandMark,
    };
  }

  if (id === "kinetic-typo") {
    const impact = clip(headline || title || brand, 16).toUpperCase();
    const words = `${c1} ${c2}`.trim().split(/\s+/).filter(Boolean);
    const line1 = clip(words[0] || (locale.startsWith("zh") ? "不要" : "DON'T"), 16).toUpperCase();
    const line2 = clip(
      words.slice(1).join(" ") || c2 || (locale.startsWith("zh") ? "将就" : "SETTLE"),
      20,
    ).toUpperCase();
    return {
      locale,
      impact,
      line1,
      line2,
      highlight: clip(c3 || title, 24).toUpperCase(),
      brand: clip(brand, 20).toUpperCase(),
      cta,
      background: "#0a0a0a",
      accent: "#ff0080",
    };
  }

  if (id === "brand-story") {
    const zh = locale.toLowerCase().startsWith("zh");
    return {
      locale,
      welcome: zh ? "欢迎来到" : "Welcome to",
      brand: clip(brand, 24).toUpperCase(),
      tagline: tagline || headline,
      story: clip([c1, c2, c3].filter(Boolean).join(" "), 160) || headline,
      valueLine1: zh ? "以" : "Built with",
      valueHighlight1: clip(c1 || "PASSION", 18).toUpperCase(),
      valueLine2: zh ? "为你而" : "Designed for",
      valueHighlight2: clip(c2 || "YOU", 12).toUpperCase(),
      ctaPrefix: zh ? "加入" : "Join the",
      journey: clip(c3 || (zh ? "旅程" : "JOURNEY"), 18).toUpperCase(),
      cta,
      background: "#0a0a0a",
      accent: theme.accent === "#C41E3A" ? "#e94560" : theme.accent,
    };
  }

  // social-ad
  const flashSource = (headline || title || "FLASH SALE").trim();
  const flashParts = flashSource.split(/\s+/);
  const flash1 = clip(flashParts[0] || (locale.startsWith("zh") ? "限时" : "FLASH"), 12).toUpperCase();
  const flash2 = clip(
    flashParts.slice(1).join(" ") || (locale.startsWith("zh") ? "特惠" : "SALE"),
    12,
  ).toUpperCase();
  return {
    locale,
    flash1,
    flash2,
    offer: price || c1 || (locale.startsWith("zh") ? "限时优惠" : "50% OFF"),
    cta,
    brand,
    title,
    price,
    background: "#0a0a0a",
    accent: "#ff0080",
    brandMark,
  };
}

/**
 * VideoSpec → variables.json + job-local template copy.
 * Official fill path only: no HTML generation.
 */
export function fillTemplate(opts: {
  jobId: string;
  jobDir: string;
  spec: VideoSpec;
  assets: FillAssets;
}): FillResult {
  const templateId = resolveTemplateId(opts.spec);
  const projectDir = path.join(opts.jobDir, "project");
  const variablesPath = path.join(opts.jobDir, "variables.json");
  copyTemplate(projectDir, templateId);

  // Opening/closing brandMark: genuine logo first, else product hero.
  // Mid section uses a separate staged assets/product.png (not brandMark), so a
  // real brand mark never replaces the mid hero. Official variable channels
  // stay unchanged — mid hero is a fixed asset path, not a new data-var slot.
  const productPath =
    opts.assets.productImage && fs.existsSync(opts.assets.productImage)
      ? opts.assets.productImage
      : null;
  const logoPath =
    opts.assets.logo && fs.existsSync(opts.assets.logo) ? opts.assets.logo : null;
  const markPath = logoPath || productPath;
  if (!markPath) {
    throw new Error("fillTemplate requires a local product hero image");
  }
  const destName = logoPath
    ? `logo${extOf(logoPath)}`
    : `product-mark${extOf(markPath)}`;
  const brandMark = stageMark(projectDir, markPath, destName);

  // Always overwrite the mid-section product hero file. Prefer crawled hero;
  // fall back to mark only when no separate product image exists.
  const midHeroPath = productPath || markPath;
  stageMark(projectDir, midHeroPath, "product.png");

  const variables = variablesForTemplate(templateId, opts.spec, brandMark);
  fs.writeFileSync(variablesPath, `${JSON.stringify(variables, null, 2)}\n`);
  return { projectDir, variablesPath, variables, brandMarkLocal: markPath, templateId };
}
