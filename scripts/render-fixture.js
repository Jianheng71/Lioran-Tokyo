#!/usr/bin/env node
/**
 * Lioran—Tokyo firmware render for any fillable template.
 *
 * Usage:
 *   npm run render:fixture                         # product-promo (default)
 *   npm run render:fixture:cinematic               # cinematic-product
 *   TEMPLATE=kinetic-typo node scripts/render-fixture.js
 *
 * Maps fixtures/sample-product.spec.json (+ optional templateId) to a flat
 * official variables file, then calls:
 *   npx hyperframes@0.9.32 render <job-local project copy> \
 *     --output data/jobs/<fixtureId>/video.mp4 \
 *     --fps 30 \
 *     --variables-file data/jobs/<fixtureId>/variables.json \
 *     --strict-variables
 *
 * No Handlebars/EJS HTML generation, no crawler, no LLM.
 * Do not commit the MP4.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Reuse the same variable mapping as the server templater when available via tsx,
// otherwise fall back to an inline product-promo mapper for plain node.
const TEMPLATE_IDS = [
  "product-promo",
  "cinematic-product",
  "kinetic-typo",
  "brand-story",
  "social-ad",
];

const templateId = String(process.env.TEMPLATE || process.argv[2] || "product-promo");
if (!TEMPLATE_IDS.includes(templateId)) {
  console.error(`Unknown TEMPLATE="${templateId}". Use one of: ${TEMPLATE_IDS.join(", ")}`);
  process.exit(1);
}

const lockedTemplateDir = path.join(here, "templates", templateId);
const fixturePath = path.join(here, "fixtures", "sample-product.spec.json");
const fixtureId = templateId === "product-promo" ? "fixture" : `fixture-${templateId}`;
const jobDir = path.join(here, "data", "jobs", fixtureId);
const projectDir = path.join(jobDir, "project");
const variablesPath = path.join(jobDir, "variables.json");
const defaultOutput = path.join(jobDir, "video.mp4");
const lockPath = path.join(here, ".render.lock");
const step1Mp4 = path.resolve(here, "..", "output", "test_product.mp4");
const outputMp4 = path.resolve(process.env.OUTPUT || defaultOutput);

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}\n`);
      } finally {
        fs.closeSync(fd);
      }
      return;
    } catch (err) {
      if (!err || err.code !== "EEXIST") throw err;
      let holderRaw = "";
      try {
        holderRaw = fs.readFileSync(lockPath, "utf8").trim();
      } catch {
        holderRaw = "";
      }
      const holder = Number.parseInt(holderRaw, 10);
      if (pidAlive(holder)) {
        console.error(
          `Render lock is held (concurrency=1): ${lockPath} (pid ${holderRaw || "unknown"}).`,
        );
        process.exit(1);
      }
      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkErr) {
        if (unlinkErr && unlinkErr.code !== "ENOENT") throw unlinkErr;
      }
    }
  }
  console.error(`Render lock is held (concurrency=1): ${lockPath}. Could not acquire lock.`);
  process.exit(1);
}

let lockHeld = false;
function releaseLock() {
  if (!lockHeld) return;
  lockHeld = false;
  try {
    fs.unlinkSync(lockPath);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.error(`Failed to release lock ${lockPath}:`, err);
    }
  }
}

process.on("exit", releaseLock);
process.on("SIGINT", () => {
  releaseLock();
  process.exit(130);
});
process.on("SIGTERM", () => {
  releaseLock();
  process.exit(143);
});

function isHexColor(value) {
  return typeof value === "string" && /^#([0-9A-Fa-f]{6})$/.test(value);
}

function validateSpec(spec) {
  const errors = [];
  const need = [
    "locale",
    "brand",
    "title",
    "price",
    "headline",
    "captions",
    "cta",
    "tagline",
    "urlHost",
    "theme",
  ];
  for (const key of need) {
    if (spec[key] == null || spec[key] === "") {
      if (key === "price" || key === "tagline") continue;
      errors.push(`missing ${key}`);
    }
  }
  if (!Array.isArray(spec.captions) || spec.captions.length !== 3) {
    errors.push("captions must be an array of exactly 3 strings");
  }
  if (!spec.theme || !isHexColor(spec.theme.background) || !isHexColor(spec.theme.accent)) {
    errors.push("theme.background and theme.accent must be #RRGGBB");
  }
  const assets = spec.assets || {};
  if (!assets.logo && !assets.productImage) {
    errors.push("assets.logo or assets.productImage is required");
  }
  if (errors.length) {
    throw new Error(`sample-product.spec.json is invalid: ${errors.join("; ")}`);
  }
}

function resolveAsset(rel) {
  if (!rel) return null;
  const candidates = [
    path.join(here, "fixtures", rel),
    path.join(here, "fixtures", "assets", path.basename(rel)),
    path.join(lockedTemplateDir, rel),
    path.join(lockedTemplateDir, "assets", path.basename(rel)),
    path.isAbsolute(rel) ? rel : path.join(here, rel),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Sample image not found: ${rel}`);
}

function extOf(file) {
  const ext = path.extname(file).toLowerCase();
  return ext || ".png";
}

function materializeProject() {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.cpSync(lockedTemplateDir, projectDir, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${path.sep}.hyperframes${path.sep}`) && !src.endsWith(`${path.sep}.hyperframes`),
  });
}

function stageBrandMark(absPath, destName) {
  const destDir = path.join(projectDir, "assets");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  if (path.resolve(absPath) !== path.resolve(dest)) {
    fs.copyFileSync(absPath, dest);
  }
  return `assets/${destName}`;
}

function clip(text, max) {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function specToVariables(spec) {
  const assets = spec.assets || {};
  const logoPath = assets.logo ? resolveAsset(assets.logo) : null;
  const productPath = assets.productImage ? resolveAsset(assets.productImage) : null;
  const markPath = logoPath || productPath;
  const destName = logoPath ? `logo${extOf(logoPath)}` : `product${extOf(productPath)}`;
  const brandMark = stageBrandMark(markPath, destName);
  if (productPath) stageBrandMark(productPath, `product${extOf(productPath)}`);

  const locale = String(spec.locale);
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
  const background = String(spec.theme.background);
  const accent = String(spec.theme.accent);

  if (templateId === "product-promo") {
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
      background,
      accent,
      brandMark,
    };
  }
  if (templateId === "cinematic-product") {
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
      background: background === "#0a0a0f" ? "#0a0a0a" : background,
      accent: accent === "#C41E3A" ? "#00ff88" : accent,
      brandMark,
    };
  }
  if (templateId === "kinetic-typo") {
    const impact = clip(headline || title || brand, 16).toUpperCase();
    const words = `${c1} ${c2}`.trim().split(/\s+/).filter(Boolean);
    return {
      locale,
      impact,
      line1: clip(words[0] || (locale.startsWith("zh") ? "不要" : "DON'T"), 16).toUpperCase(),
      line2: clip(
        words.slice(1).join(" ") || c2 || (locale.startsWith("zh") ? "将就" : "SETTLE"),
        20,
      ).toUpperCase(),
      highlight: clip(c3 || title, 24).toUpperCase(),
      brand: clip(brand, 20).toUpperCase(),
      cta,
      background: "#0a0a0a",
      accent: "#ff0080",
    };
  }
  if (templateId === "brand-story") {
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
      accent: accent === "#C41E3A" ? "#e94560" : accent,
    };
  }
  // social-ad
  const flashSource = (headline || title || "FLASH SALE").trim();
  const flashParts = flashSource.split(/\s+/);
  return {
    locale,
    flash1: clip(flashParts[0] || (locale.startsWith("zh") ? "限时" : "FLASH"), 12).toUpperCase(),
    flash2: clip(
      flashParts.slice(1).join(" ") || (locale.startsWith("zh") ? "特惠" : "SALE"),
      12,
    ).toUpperCase(),
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

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd, env: process.env });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by signal ${signal}`));
      else if (code !== 0) reject(new Error(`${command} exited with code ${code ?? 1}`));
      else resolve();
    });
  });
}

function hasAudioStream(file) {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        file,
      ],
      { encoding: "utf8" },
    ).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function stripAudio(file) {
  const tmp = `${file}.silent.mp4`;
  execFileSync("ffmpeg", ["-y", "-i", file, "-c:v", "copy", "-an", tmp], { stdio: "inherit" });
  fs.renameSync(tmp, file);
}

async function main() {
  void require;
  if (path.resolve(outputMp4) === path.resolve(step1Mp4)) {
    throw new Error("Refusing to overwrite step-1 output/test_product.mp4");
  }
  if (!fs.existsSync(lockedTemplateDir)) {
    throw new Error(`Template not found: ${lockedTemplateDir}`);
  }

  acquireLock();
  lockHeld = true;

  const spec = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  validateSpec(spec);
  spec.templateId = templateId;

  fs.mkdirSync(jobDir, { recursive: true });
  materializeProject();
  const variables = specToVariables(spec);
  fs.mkdirSync(path.dirname(variablesPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputMp4), { recursive: true });
  fs.writeFileSync(variablesPath, `${JSON.stringify(variables, null, 2)}\n`);

  const args = [
    "--yes",
    "hyperframes@0.9.32",
    "render",
    projectDir,
    "--output",
    outputMp4,
    "--fps",
    "30",
    "--variables-file",
    variablesPath,
    "--strict-variables",
  ];
  console.log(`TEMPLATE=${templateId}`);
  console.log(`npx ${args.join(" ")}`);
  await run("npx", args, here);

  if (hasAudioStream(outputMp4)) {
    console.log("Stripping audio track (MVP is silent).");
    stripAudio(outputMp4);
  }

  const stat = fs.statSync(outputMp4);
  console.log(`Wrote ${outputMp4} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  releaseLock();
  process.exit(1);
});
