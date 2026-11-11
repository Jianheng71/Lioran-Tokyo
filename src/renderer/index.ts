import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { withRenderAndBrowserLock } from "../locks.js";

function hasAudioStream(file: string): boolean {
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

function stripAudio(file: string): void {
  const tmp = `${file}.silent.mp4`;
  execFileSync("ffmpeg", ["-y", "-i", file, "-c:v", "copy", "-an", tmp], {
    stdio: "inherit",
  });
  fs.renameSync(tmp, file);
}

function run(command: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd, env: process.env });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Render timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (signal) reject(new Error(`${command} terminated by signal ${signal}`));
      else if (code !== 0) reject(new Error(`${command} exited with code ${code ?? 1}`));
      else resolve();
    });
  });
}

export async function renderJobVideo(opts: {
  projectDir: string;
  variablesPath: string;
  outputMp4: string;
}): Promise<string> {
  fs.mkdirSync(path.dirname(opts.outputMp4), { recursive: true });

  await withRenderAndBrowserLock(async () => {
    const version = config.hyperframesVersion;
    const args = [
      "--yes",
      `hyperframes@${version}`,
      "render",
      opts.projectDir,
      "--output",
      opts.outputMp4,
      "--fps",
      "30",
      "--variables-file",
      opts.variablesPath,
      "--strict-variables",
    ];
    console.log(`npx ${args.join(" ")}`);
    await run("npx", args, config.root, config.renderTimeoutMs);

    if (hasAudioStream(opts.outputMp4)) {
      console.log("Stripping audio track (MVP is silent).");
      stripAudio(opts.outputMp4);
    }
  });

  if (!fs.existsSync(opts.outputMp4)) {
    throw new Error(`Render finished but output missing: ${opts.outputMp4}`);
  }
  return opts.outputMp4;
}

export function probeHyperframesCli(): { ok: boolean; detail: string } {
  try {
    const out = execFileSync(
      "npx",
      ["--yes", `hyperframes@${config.hyperframesVersion}`, "--version"],
      {
        encoding: "utf8",
        cwd: config.root,
        timeout: 120_000,
        env: process.env,
      },
    );
    return { ok: true, detail: out.trim() || `hyperframes@${config.hyperframesVersion}` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function probeFfmpeg(): { ok: boolean; detail: string } {
  try {
    const out = execFileSync("ffmpeg", ["-version"], { encoding: "utf8" });
    return { ok: true, detail: out.split("\n")[0] || "ffmpeg" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
