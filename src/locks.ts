import fs from "node:fs";
import { config } from "./config.js";

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquire(lockPath: string, label: string): () => void {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}\n`);
      } finally {
        fs.closeSync(fd);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          fs.unlinkSync(lockPath);
        } catch (err) {
          const e = err as NodeJS.ErrnoException;
          if (e.code !== "ENOENT") {
            console.error(`Failed to release ${label} lock:`, err);
          }
        }
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "EEXIST") throw err;
      let holderRaw = "";
      try {
        holderRaw = fs.readFileSync(lockPath, "utf8").trim();
      } catch {
        holderRaw = "";
      }
      const holder = Number.parseInt(holderRaw, 10);
      if (pidAlive(holder)) {
        throw new Error(`${label} lock is held (concurrency=1): ${lockPath} (pid ${holderRaw}).`);
      }
      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkErr) {
        const u = unlinkErr as NodeJS.ErrnoException;
        if (u.code !== "ENOENT") throw unlinkErr;
      }
    }
  }
  throw new Error(`${label} lock is held (concurrency=1): ${lockPath}. Could not acquire.`);
}

export async function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = acquire(config.paths.renderLock, "Render");
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function withBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = acquire(config.paths.browserLock, "Browser");
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Acquire both locks (browser first) for HyperFrames render. */
export async function withRenderAndBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  return withBrowserLock(() => withRenderLock(fn));
}
