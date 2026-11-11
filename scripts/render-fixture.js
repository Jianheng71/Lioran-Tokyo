#!/usr/bin/env node
/**
 * Lioran—Tokyo P1 firmware render.
 *
 * Maps fixtures/sample-product.spec.json to a flat official variables file,
 * then calls HyperFrames:
 *   npx hyperframes@0.9.32 render <job-local project copy of templates/product-promo> \
 *     --output data/jobs/fixture/video.mp4 \
 *     --fps 30 \
 *     --variables-file data/jobs/fixture/variables.json \
 *     --strict-variables
 *
 * No Handlebars/EJS HTML generation, no crawler, no LLM.
 * Intro/outro slots use brandMark (logo if present, otherwise the main product
 * image) plus brand name. Video is silent. Motion and 15s timings stay locked
 * in the template. The template directory is not modified.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockedTemplateDir = path.join(here, "templates", "product-promo");
const fixturePath = path.join(here, "fixtures", "sample-product.spec.json");
const schemaPath = path.join(here, "fixtures", "sample-product.spec.schema.json");
const jobDir = path.join(here, "data", "jobs", "fixture");
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

/**
 * Materialize a job-local copy of the locked template (left untouched) and
 * place the chosen mark under that copy's assets/ so the HyperFrames file
 * server can serve it. Returns a project-relative path for data-var-src.
 */
function materializeProject() {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.cpSync(lockedTemplateDir, projectDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}.hyperframes${path.sep}`) && !src.endsWith(`${path.sep}.hyperframes`),
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

function specToVariables(spec) {
  const assets = spec.assets || {};
  const logoPath = assets.logo ? resolveAsset(assets.logo) : null;
  const productPath = assets.productImage ? resolveAsset(assets.productImage) : null;
  // E4: prefer logo; if no logo, use the main product image.
  const markPath = logoPath || productPath;
  const destName = logoPath ? `logo${extOf(logoPath)}` : `product${extOf(productPath)}`;
  const brandMark = stageBrandMark(markPath, destName);

  return {
    locale: String(spec.locale),
    brand: String(spec.brand),
    title: String(spec.title),
    price: String(spec.price ?? ""),
    compareAtPrice: String(spec.compareAtPrice ?? ""),
    headline: String(spec.headline),
    caption1: String(spec.captions[0]),
    caption2: String(spec.captions[1]),
    caption3: String(spec.captions[2]),
    cta: String(spec.cta),
    tagline: String(spec.tagline ?? ""),
    urlHost: String(spec.urlHost),
    background: String(spec.theme.background),
    accent: String(spec.theme.accent),
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
  if (path.resolve(outputMp4) === path.resolve(step1Mp4)) {
    throw new Error("Refusing to overwrite step-1 output/test_product.mp4");
  }
  if (!fs.existsSync(lockedTemplateDir)) {
    throw new Error(`Locked template not found: ${lockedTemplateDir}`);
  }

  acquireLock();
  lockHeld = true;

  const spec = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  void schemaPath;
  validateSpec(spec);

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
  console.log(`npx ${args.join(" ")}`);
  await run("npx", args, here);

  if (hasAudioStream(outputMp4)) {
    console.log("Stripping audio track (P1 is silent).");
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
