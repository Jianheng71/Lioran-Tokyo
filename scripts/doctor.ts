#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { config } from "../src/config.js";
import { probeChrome } from "../src/chrome.js";
import { hermesReachable } from "../src/llm/hermes.js";
import { probeFfmpeg, probeHyperframesCli } from "../src/renderer/index.js";

function line(ok: boolean, label: string, detail: string) {
  const mark = ok ? "ok" : "MISSING";
  console.log(`[${mark}] ${label}: ${detail}`);
}

function ffmpegInstallHint(): string {
  if (process.platform === "darwin") {
    return "Install with: brew install ffmpeg";
  }
  if (process.platform === "linux") {
    return "Install with: sudo apt-get update && sudo apt-get install -y ffmpeg  (or your distro equivalent)";
  }
  return "Install ffmpeg and ensure ffmpeg + ffprobe are on PATH";
}

function chromeInstallHint(): string {
  return [
    "Install Google Chrome or Chromium, then re-run doctor.",
    "Or set CHROME_PATH in .env to the browser binary (example: /usr/bin/google-chrome-stable).",
    "Without a browser binary, Puppeteer/HyperFrames will fail with “Failed to launch browser”.",
  ].join(" ");
}

function hermesHint(detail: string): string {
  const base = config.hermesBaseUrl;
  const bits = [
    `Point HERMES_BASE_URL at an already-deployed OpenAI-compatible base URL where GET /v1/models works (current value: ${base}).`,
    "Doctor probes GET {HERMES_BASE_URL}/v1/models.",
    "The repo default http://127.0.0.1:43127 is only a starting guess — on some machines that port is a different app (for example a Next.js HTML page) and /v1/models returns 404.",
  ];
  if (/HTML|HTTP 404/i.test(detail)) {
    bits.push(
      "Got HTML or HTTP 404: set HERMES_BASE_URL in .env to the working local OpenAI-compatible address (one common example is http://127.0.0.1:11434 when Ollama is serving hermes3:8b there). Do not assume 43127 or 11434 for every environment — verify GET /v1/models on your machine.",
    );
  } else if (/fetch failed|ECONNREFUSED|unreachable|timed out|abort/i.test(detail)) {
    bits.push(
      "Nothing answered on that address — start your local Hermes/Ollama (or other OpenAI-compatible) service, set HERMES_BASE_URL to its base URL, then re-run doctor.",
    );
  }
  bits.push(
    "Fixture render (npm run render:fixture) does not need Hermes. Confirmed chat jobs that need the model do.",
  );
  return bits.join(" ");
}

async function main() {
  console.log("Lioran—Tokyo doctor\n");

  line(true, "node", process.version);
  line(
    process.version.startsWith("v2") || Number(process.versions.node.split(".")[0]) >= 20,
    "node>=20",
    process.version,
  );

  const ffmpeg = probeFfmpeg();
  line(ffmpeg.ok, "ffmpeg", ffmpeg.ok ? ffmpeg.detail : `${ffmpeg.detail} — ${ffmpegInstallHint()}`);

  let ffprobeOk = false;
  let ffprobeDetail = "";
  try {
    ffprobeDetail = execFileSync("ffprobe", ["-version"], { encoding: "utf8" }).split("\n")[0];
    ffprobeOk = true;
  } catch (err) {
    ffprobeDetail = `${err instanceof Error ? err.message : String(err)} — ${ffmpegInstallHint()}`;
  }
  line(ffprobeOk, "ffprobe", ffprobeDetail);

  const chrome = probeChrome(config.chromePath || process.env.CHROME_PATH || "");
  line(
    chrome.ok,
    "chrome/chromium",
    chrome.ok ? chrome.detail : `${chrome.detail} — ${chromeInstallHint()}`,
  );

  const hf = probeHyperframesCli();
  line(hf.ok, `hyperframes@${config.hyperframesVersion}`, hf.detail);

  const hermes = await hermesReachable();
  line(
    hermes.ok,
    "hermes",
    hermes.ok ? hermes.detail : `${hermes.detail} — ${hermesHint(hermes.detail)}`,
  );

  const templateOk = fs.existsSync(config.paths.templates);
  line(templateOk, "locked template", config.paths.templates);

  const fixtureOk = fs.existsSync(`${config.root}/fixtures/sample-product.spec.json`);
  line(fixtureOk, "firmware fixture", "fixtures/sample-product.spec.json");

  console.log("\nHints:");
  console.log(`  CHROME_PATH=${config.chromePath || "(auto-detect failed — set explicitly)"}`);
  console.log(`  HERMES_BASE_URL=${config.hermesBaseUrl}`);
  console.log("  Community templates on disk are on hold this round; chat uses product-promo only.");

  console.log("\nNext:");
  console.log("  npm run render:fixture   # silent 15s MP4, no Hermes");
  console.log(`  npm run doctor           # re-check after installing deps`);
  console.log(`  npm run dev              # http://127.0.0.1:${config.port}`);

  if (!ffmpeg.ok || !ffprobeOk || !chrome.ok || !hf.ok || !templateOk || !fixtureOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
