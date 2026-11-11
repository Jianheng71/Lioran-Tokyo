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
          : /HTML|HTTP 404/i.test(hermes.detail)
            ? "HERMES_BASE_URL returned HTML or HTTP 404 for GET /v1/models — set .env HERMES_BASE_URL to a working OpenAI-compatible base (example when Ollama serves hermes3:8b: http://127.0.0.1:11434). Verify on your machine; do not assume 43127."
            : "Set HERMES_BASE_URL to an OpenAI-compatible base where GET /v1/models works, then confirm chat jobs that need the model",
      },
      hyperframes: {
        ...hyperframes,
        version: config.hyperframesVersion,
      },
    },
  };
}
