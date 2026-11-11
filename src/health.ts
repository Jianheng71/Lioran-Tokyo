import { hermesReachable } from "./llm/hermes.js";
import { probeChrome } from "./chrome.js";
import { probeFfmpeg, probeHyperframesCli } from "./renderer/index.js";
import { config } from "./config.js";

export async function buildHealth() {
  const ffmpeg = probeFfmpeg();
  const hermes = await hermesReachable();
  const hyperframes = probeHyperframesCli();
  const chrome = probeChrome(config.chromePath || process.env.CHROME_PATH || "");

  return {
    ok: ffmpeg.ok && hyperframes.ok && chrome.ok,
    service: "Lioran—Tokyo",
    port: config.port,
    checks: {
      ffmpeg,
      chrome: {
        ok: chrome.ok,
        detail: chrome.detail,
        path: chrome.path,
        hint: chrome.ok
          ? undefined
          : "Set CHROME_PATH to your Chrome/Chromium binary if auto-detect fails",
      },
      hermes: {
        ok: hermes.ok,
        detail: hermes.detail,
        baseUrl: config.hermesBaseUrl,
        requiredFor: "jobs that need the model / dialog understanding",
        fixtureRenderRequiresHermes: false,
        hint: hermes.ok
          ? undefined
          : /HTTP 404/i.test(hermes.detail)
            ? "HTTP 404 at HERMES_BASE_URL usually means the wrong service is on that port, or /v1/models is missing — start Lioran Hermes or fix HERMES_BASE_URL"
            : "Start Hermes at HERMES_BASE_URL (default http://127.0.0.1:43127) before confirming chat jobs that need the model",
      },
      hyperframes: {
        ...hyperframes,
        version: config.hyperframesVersion,
      },
    },
  };
}
