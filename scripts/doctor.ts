#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { config } from "../src/config.js";
import { hermesReachable } from "../src/llm/hermes.js";
import { probeFfmpeg, probeHyperframesCli } from "../src/renderer/index.js";

function line(ok: boolean, label: string, detail: string) {
  const mark = ok ? "ok" : "MISSING";
  console.log(`[${mark}] ${label}: ${detail}`);
}

async function main() {
  console.log("Lioran—Tokyo doctor\n");

  line(true, "node", process.version);
  line(process.version.startsWith("v2") || Number(process.versions.node.split(".")[0]) >= 20, "node>=20", process.version);

  const ffmpeg = probeFfmpeg();
  line(ffmpeg.ok, "ffmpeg", ffmpeg.detail);

  let ffprobeOk = false;
  let ffprobeDetail = "";
  try {
    ffprobeDetail = execFileSync("ffprobe", ["-version"], { encoding: "utf8" }).split("\n")[0];
    ffprobeOk = true;
  } catch (err) {
    ffprobeDetail = err instanceof Error ? err.message : String(err);
  }
  line(ffprobeOk, "ffprobe", ffprobeDetail);

  const hf = probeHyperframesCli();
  line(hf.ok, `hyperframes@${config.hyperframesVersion}`, hf.detail);

  const hermes = await hermesReachable();
  line(hermes.ok, "hermes (optional)", hermes.ok ? hermes.detail : `${hermes.detail} — fixture render still works`);

  const templateOk = fs.existsSync(config.paths.templates);
  line(templateOk, "locked template", config.paths.templates);

  const fixtureOk = fs.existsSync(`${config.root}/fixtures/sample-product.spec.json`);
  line(fixtureOk, "firmware fixture", "fixtures/sample-product.spec.json");

  console.log("\nNext:");
  console.log("  npm run render:fixture   # silent 15s MP4, no Hermes");
  console.log(`  npm run dev              # http://127.0.0.1:${config.port}`);

  if (!ffmpeg.ok || !hf.ok || !templateOk || !fixtureOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
