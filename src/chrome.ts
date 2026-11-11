import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  path.join(
    os.homedir(),
    ".cache/puppeteer/chrome",
  ),
].filter((v): v is string => Boolean(v && v.trim()));

function looksLikeChromeBinary(filePath: string): boolean {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return false;
    // Executable bit or Windows .exe
    if (process.platform !== "win32" && (st.mode & 0o111) === 0) return false;
    return true;
  } catch {
    return false;
  }
}

function which(cmd: string): string | null {
  try {
    const out = execFileSync("which", [cmd], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Chrome/Chromium binary for Puppeteer / HyperFrames.
 * Honors CHROME_PATH first, then common install locations and PATH names.
 */
export function resolveChromePath(explicit?: string | null): {
  path: string | null;
  source: "env" | "path" | "which" | "none";
  detail: string;
} {
  const fromEnv = (explicit || process.env.CHROME_PATH || "").trim();
  if (fromEnv) {
    if (looksLikeChromeBinary(fromEnv)) {
      return { path: fromEnv, source: "env", detail: `CHROME_PATH=${fromEnv}` };
    }
    return {
      path: null,
      source: "env",
      detail: `CHROME_PATH is set to ${fromEnv} but that file is missing or not executable`,
    };
  }

  for (const candidate of CANDIDATES) {
    if (candidate.includes(".cache/puppeteer/chrome")) {
      // Puppeteer cache is a directory tree — skip shallow check
      continue;
    }
    if (looksLikeChromeBinary(candidate)) {
      return { path: candidate, source: "path", detail: candidate };
    }
  }

  for (const name of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "chrome"]) {
    const found = which(name);
    if (found && looksLikeChromeBinary(found)) {
      return { path: found, source: "which", detail: found };
    }
  }

  return {
    path: null,
    source: "none",
    detail:
      "No Chrome/Chromium found. Install Google Chrome or Chromium, or set CHROME_PATH to the browser binary so Puppeteer/HyperFrames can launch.",
  };
}

export function probeChrome(explicit?: string | null): { ok: boolean; detail: string; path: string | null } {
  const resolved = resolveChromePath(explicit);
  if (!resolved.path) {
    return { ok: false, detail: resolved.detail, path: null };
  }
  try {
    const ver = execFileSync(resolved.path, ["--version"], {
      encoding: "utf8",
      timeout: 8_000,
    })
      .trim()
      .split("\n")[0];
    return {
      ok: true,
      detail: `${ver} (${resolved.source}: ${resolved.path})`,
      path: resolved.path,
    };
  } catch (err) {
    return {
      ok: false,
      detail: `Found ${resolved.path} but --version failed: ${err instanceof Error ? err.message : String(err)}`,
      path: resolved.path,
    };
  }
}
