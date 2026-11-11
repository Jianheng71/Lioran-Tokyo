import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { resolveChromePath } from "./chrome.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const chromeResolved = resolveChromePath(process.env.CHROME_PATH || "");

/** Propagate detected Chrome so Puppeteer / HyperFrames child processes can launch. */
if (chromeResolved.path) {
  if (!process.env.CHROME_PATH) process.env.CHROME_PATH = chromeResolved.path;
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromeResolved.path;
  }
}

export const config = {
  root,
  port: intEnv("PORT", 8787),
  hermesBaseUrl: (process.env.HERMES_BASE_URL || "http://127.0.0.1:43127").replace(/\/$/, ""),
  hermesModel: process.env.HERMES_MODEL || "hermes3:8b",
  hermesTimeoutMs: intEnv("HERMES_TIMEOUT_MS", 60_000),
  hyperframesVersion: process.env.HYPERFRAMES_VERSION || "0.9.32",
  crawlTimeoutMs: intEnv("CRAWL_TIMEOUT_MS", 45_000),
  renderTimeoutMs: intEnv("RENDER_TIMEOUT_MS", 600_000),
  jobRetention: intEnv("JOB_RETENTION", 20),
  chromePath: chromeResolved.path || "",
  chromeDetail: chromeResolved.detail,
  paths: {
    /** Default / official template (product-promo). Prefer templateDir(id) for others. */
    templates: path.join(root, "templates", "product-promo"),
    templatesRoot: path.join(root, "templates"),
    fixtures: path.join(root, "fixtures"),
    data: path.join(root, "data"),
    jobs: path.join(root, "data", "jobs"),
    sessions: path.join(root, "data", "sessions"),
    downloads: path.join(root, "data", "downloads"),
    public: path.join(root, "public"),
    renderLock: path.join(root, ".render.lock"),
    browserLock: path.join(root, ".browser.lock"),
  },
} as const;

export function ensureDataDirs(): void {
  for (const dir of [
    config.paths.data,
    config.paths.jobs,
    config.paths.sessions,
    config.paths.downloads,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
