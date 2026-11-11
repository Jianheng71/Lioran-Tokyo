import fs from "node:fs";
import path from "node:path";
import { config, ensureDataDirs } from "../config.js";
import { assertSessionId, newSessionId } from "../ids.js";
import type { ProductFacts, SessionRecord, VideoSpec } from "../schemas.js";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function sessionPath(sessionId: string): string {
  return path.join(config.paths.sessions, `${assertSessionId(sessionId)}.json`);
}

export function sessionAssetsDir(sessionId: string): string {
  return path.join(config.paths.sessions, assertSessionId(sessionId), "assets");
}

function imageExt(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return IMAGE_EXT.has(ext) ? ext : ".img";
}

function isInside(parent: string, target: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(target));
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

function copyAsset(dir: string, src: string | null | undefined, stem: string): string | null {
  if (!src || !fs.existsSync(src)) return null;
  const absSrc = path.resolve(src);
  if (!fs.statSync(absSrc).isFile()) return null;
  const dest = path.join(dir, `${stem}${imageExt(absSrc)}`);
  if (!isInside(dir, dest)) {
    throw new Error("Refusing to write a session asset outside the session directory");
  }
  const absDest = path.resolve(dest);
  if (absSrc !== absDest) fs.copyFileSync(absSrc, absDest);
  return absDest;
}

/**
 * Copy logo / product images into data/sessions/<id>/assets and point the
 * session at those files. Job directories are pruned; session files are not.
 */
export function retainSessionAssets(
  session: SessionRecord,
  facts: ProductFacts | null,
): { logo: string | null; productImage: string | null } {
  const dir = sessionAssetsDir(session.sessionId);
  fs.mkdirSync(dir, { recursive: true });

  const imageSources = facts?.images?.length
    ? facts.images
    : session.assetPaths.productImage
      ? [session.assetPaths.productImage]
      : [];
  const copiedImages: string[] = [];
  imageSources.forEach((src, index) => {
    const copied = copyAsset(dir, src, `image_${index}`);
    if (copied) copiedImages.push(copied);
  });

  const logoSrc = facts ? (facts.logo ?? null) : session.assetPaths.logo;
  const logo = copyAsset(dir, logoSrc, "logo");

  if (copiedImages.length || logo) {
    if (facts) {
      if (copiedImages.length) facts.images = copiedImages;
      facts.logo = logo;
      session.lastFacts = facts;
    }
    session.assetPaths = {
      logo,
      productImage: copiedImages[0] ?? null,
    };
  }

  return { logo: session.assetPaths.logo, productImage: session.assetPaths.productImage };
}

function blankSession(sessionId: string): SessionRecord {
  const now = new Date().toISOString();
  return {
    sessionId,
    lastVideoSpec: null,
    lastFacts: null,
    lastJobId: null,
    lastVideoUrl: null,
    assetPaths: { logo: null, productImage: null },
    chat: {
      messages: [],
      draft: { mode: null, url: null, instruction: null, summary: null },
      phase: "idle",
      activeJobId: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createSession(): SessionRecord {
  ensureDataDirs();
  const session = blankSession(newSessionId());
  saveSession(session);
  return session;
}

export function getSession(sessionId: string): SessionRecord | null {
  ensureDataDirs();
  const file = sessionPath(sessionId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as SessionRecord;
}

export function requireSession(sessionId: string): SessionRecord {
  const session = getSession(sessionId);
  if (!session) {
    throw Object.assign(new Error(`Session not found: ${sessionId}`), { status: 404 });
  }
  return session;
}

export function saveSession(session: SessionRecord): void {
  ensureDataDirs();
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionPath(session.sessionId), `${JSON.stringify(session, null, 2)}\n`);
}

export function getOrCreateSession(sessionId?: string | null): SessionRecord {
  if (sessionId) {
    const existing = getSession(sessionId);
    if (existing) return existing;
  }
  return createSession();
}

export function updateSessionAfterJob(opts: {
  sessionId: string;
  jobId: string;
  videoSpec: VideoSpec;
  facts: ProductFacts | null;
  videoUrl: string;
  assetPaths: { logo: string | null; productImage: string | null };
}): SessionRecord {
  const session = requireSession(opts.sessionId);
  session.lastJobId = opts.jobId;
  session.lastVideoSpec = opts.videoSpec;
  session.lastVideoUrl = opts.videoUrl;
  if (opts.facts) session.lastFacts = opts.facts;
  session.assetPaths = opts.assetPaths;
  retainSessionAssets(session, session.lastFacts);
  session.chat.phase = "done";
  session.chat.activeJobId = opts.jobId;
  saveSession(session);
  return session;
}
