import fs from "node:fs";
import path from "node:path";
import { config, ensureDataDirs } from "../config.js";
import { newSessionId } from "../ids.js";
import type { ProductFacts, SessionRecord, VideoSpec } from "../schemas.js";

function sessionPath(sessionId: string): string {
  return path.join(config.paths.sessions, `${sessionId}.json`);
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
  session.chat.phase = "done";
  session.chat.activeJobId = opts.jobId;
  saveSession(session);
  return session;
}
