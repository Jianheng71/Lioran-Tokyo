import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getMimeType } from "hono/utils/mime";
import { config, ensureDataDirs } from "./config.js";
import { buildHealth } from "./health.js";
import { enqueueInstructionJob, enqueueUrlJob } from "./jobs/queue.js";
import { getJob, jobDir } from "./jobs/store.js";
import { handleChatConfirm, handleChatMessage } from "./chat/handler.js";
import { getSession } from "./session/store.js";

ensureDataDirs();

export const app = new Hono();

app.get("/health", async (c) => c.json(await buildHealth()));

app.post("/v1/jobs", async (c) => {
  let body: { url?: string; sessionId?: string; instruction?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.url && !body.instruction) {
      const job = enqueueUrlJob({ url: body.url, sessionId: body.sessionId });
      return c.json({ jobId: job.jobId, sessionId: job.sessionId, status: "queued" as const });
    }
    if (body.sessionId && body.instruction) {
      const job = enqueueInstructionJob({
        sessionId: body.sessionId,
        instruction: body.instruction,
      });
      return c.json({ jobId: job.jobId, sessionId: job.sessionId, status: "queued" as const });
    }
    return c.json(
      { error: "Provide { url } or { sessionId, instruction }. Prefer confirming via /v1/chat first." },
      400,
    );
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

app.get("/v1/jobs/:jobId", (c) => {
  try {
    const job = getJob(c.req.param("jobId"));
    if (!job) return c.json({ error: "Job not found" }, 404);
    return c.json({
      jobId: job.jobId,
      sessionId: job.sessionId,
      status: job.status,
      error: job.error,
      videoUrl: job.videoUrl,
      videoSpec: job.videoSpec,
      stageDetail: job.stageDetail ?? null,
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

app.get("/v1/sessions/:sessionId", (c) => {
  try {
    const session = getSession(c.req.param("sessionId"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json({
      sessionId: session.sessionId,
      lastVideoSpec: session.lastVideoSpec,
      lastFacts: session.lastFacts,
      lastJobId: session.lastJobId,
      lastVideoUrl: session.lastVideoUrl,
      chat: {
        phase: session.chat.phase,
        draft: session.chat.draft,
        activeJobId: session.chat.activeJobId,
        messages: session.chat.messages,
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

app.get("/v1/videos/:file", (c) => {
  try {
    const file = c.req.param("file");
    const m = file.match(/^(job_[a-f0-9]{12})\.mp4$/);
    if (!m || !m[1]) return c.json({ error: "Not found" }, 404);
    const jobId = m[1];
    const mp4 = path.join(jobDir(jobId), "video.mp4");
    if (!fs.existsSync(mp4)) return c.json({ error: "Video not ready" }, 404);
    const buf = fs.readFileSync(mp4);
    return c.body(buf, 200, {
      "content-type": "video/mp4",
      "content-length": String(buf.length),
      "cache-control": "no-store",
    });
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

app.post("/v1/chat", async (c) => {
  let body: { sessionId?: string; message?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  try {
    const result = await handleChatMessage({
      sessionId: body.sessionId,
      message: body.message || "",
    });
    return c.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

app.post("/v1/chat/:sessionId/confirm", async (c) => {
  try {
    const result = handleChatConfirm(c.req.param("sessionId"));
    return c.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
  }
});

function servePublic(c: { req: { path: string } }) {
  let reqPath = c.req.path;
  if (reqPath === "/") reqPath = "/index.html";
  const safe = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(config.paths.public, safe);
  if (!filePath.startsWith(config.paths.public)) return null;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const mime = getMimeType(filePath) || "application/octet-stream";
  return { filePath, mime };
}

app.get("/*", (c) => {
  const hit = servePublic(c);
  if (!hit) return c.text("Not found", 404);
  const buf = fs.readFileSync(hit.filePath);
  return c.body(buf, 200, { "content-type": hit.mime });
});

// Tests import this module with LIORAN_DISABLE_LISTEN=1 and must not bind a port.
if (process.env.LIORAN_DISABLE_LISTEN !== "1") {
  const port = config.port;
  console.log(`Lioran—Tokyo listening on http://127.0.0.1:${port}`);
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
}
