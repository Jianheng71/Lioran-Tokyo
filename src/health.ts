import { hermesReachable } from "./llm/hermes.js";
import { probeFfmpeg, probeHyperframesCli } from "./renderer/index.js";
import { config } from "./config.js";

export async function buildHealth() {
  const ffmpeg = probeFfmpeg();
  const hermes = await hermesReachable();
  const hyperframes = probeHyperframesCli();

  return {
    ok: ffmpeg.ok && hyperframes.ok,
    service: "Lioran—Tokyo",
    port: config.port,
    checks: {
      ffmpeg,
      hermes: {
        ok: hermes.ok,
        detail: hermes.detail,
        requiredFor: "jobs that need the model / dialog understanding",
        fixtureRenderRequiresHermes: false,
      },
      hyperframes: {
        ...hyperframes,
        version: config.hyperframesVersion,
      },
    },
  };
}
