import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { config } from "./config.js";
import { handleChatConfirm, handleChatMessage } from "./chat/handler.js";
import { newJobId, newSessionId } from "./ids.js";
import { enqueueUrlJob } from "./jobs/queue.js";
import { getJob, saveJob } from "./jobs/store.js";
import type { DialogPlan, JobRecord, ProductFacts, SessionRecord, VideoSpec } from "./schemas.js";
import {
  createSession,
  getSession,
  saveSession,
  updateSessionAfterJob,
} from "./session/store.js";
import { assertHttpUrl } from "./urls.js";
import { crawlProductPage } from "./crawler/index.js";

const PKG = path.join(config.root, "package.json");
const SPEC: VideoSpec = {
  locale: "en",
  brand: "Lioran",
  title: "Desk",
  price: "¥199",
  compareAtPrice: "",
  headline: "A quiet desk",
  captions: ["One", "Two", "Three"],
  cta: "Look",
  tagline: "",
  urlHost: "example.com",
  theme: { background: "#0a0a0f", accent: "#C41E3A" },
};

const createdSessions: string[] = [];
const createdJobs: string[] = [];
let canaryDir: string | null = null;
let app: typeof import("./server.js").app;

function trackSession(session: SessionRecord): SessionRecord {
  createdSessions.push(session.sessionId);
  return session;
}

function jobNames(): string[] {
  if (!fs.existsSync(config.paths.jobs)) return [];
  return fs.readdirSync(config.paths.jobs).sort();
}

function assertHttpStatus(err: unknown, status: number, pattern?: RegExp): true {
  assert.ok(err instanceof Error);
  assert.equal((err as { status?: number }).status, status);
  if (pattern) assert.match(err.message, pattern);
  return true;
}

function plan(partial: DialogPlan): DialogPlan {
  return partial;
}

describe("path safety and confirm gating", { concurrency: false }, () => {
  before(async () => {
    process.env.LIORAN_DISABLE_LISTEN = "1";
    const mod = await import("./server.js");
    app = mod.app;
  });

  after(() => {
    for (const id of createdSessions) {
      fs.rmSync(path.join(config.paths.sessions, `${id}.json`), { force: true });
      fs.rmSync(path.join(config.paths.sessions, id), { recursive: true, force: true });
    }
    for (const id of createdJobs) {
      fs.rmSync(path.join(config.paths.jobs, id), { recursive: true, force: true });
    }
    if (canaryDir) fs.rmSync(canaryDir, { recursive: true, force: true });
  });

  it("rejects session and job ids that are not ses_/job_ plus 12 hex chars", () => {
    const pkgBefore = fs.readFileSync(PKG);
    const session = trackSession(createSession());
    assert.match(session.sessionId, /^ses_[0-9a-f]{12}$/);
    assert.match(newSessionId(), /^ses_[0-9a-f]{12}$/);
    assert.match(newJobId(), /^job_[0-9a-f]{12}$/);
    assert.equal(getSession(session.sessionId)?.sessionId, session.sessionId);
    assert.equal(getSession("ses_0123456789ab"), null);
    assert.equal(getJob("job_0123456789ab"), null);

    for (const id of [
      "../../package",
      "ses_aaaaaaaaaaaa/../../../package",
      "..\\..\\package",
      "/etc/passwd",
      "ses_0123456789AB",
      "SES_0123456789ab",
      "ses_0123456789",
    ]) {
      assert.throws(() => getSession(id), (err) => assertHttpStatus(err, 400, /Invalid session id/));
    }

    const tampered = { ...session, sessionId: "../../package" };
    assert.throws(() => saveSession(tampered), (err) => assertHttpStatus(err, 400, /Invalid session id/));
    assert.deepEqual(fs.readFileSync(PKG), pkgBefore);

    for (const id of ["../../package", "job_aaaaaaaaaaaa/../../x", "job_0123456789AB"]) {
      assert.throws(() => getJob(id), (err) => assertHttpStatus(err, 400, /Invalid job id/));
    }

    const escapedDir = path.join(config.root, "package");
    const escapedBefore = fs.existsSync(escapedDir);
    try {
      assert.throws(
        () =>
          saveJob({
            jobId: "../../package",
            sessionId: session.sessionId,
            status: "queued",
            error: null,
            videoUrl: null,
            videoSpec: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            kind: "instruction",
            instruction: "x",
          } satisfies JobRecord),
        (err) => assertHttpStatus(err, 400, /Invalid job id/),
      );
      assert.equal(fs.existsSync(path.join(escapedDir, "job.json")), false);
    } finally {
      if (!escapedBefore && fs.existsSync(escapedDir)) {
        fs.rmSync(escapedDir, { recursive: true, force: true });
      }
    }
    assert.deepEqual(fs.readFileSync(PKG), pkgBefore);
  });

  it("does not read a job.json or session json outside data/", () => {
    canaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "lioran-canary-"));
    const jobFile = path.join(canaryDir, "job.json");
    fs.writeFileSync(jobFile, JSON.stringify({ marker: "CANARY", jobId: "pwned" }));
    const jobRel = path.relative(config.paths.jobs, canaryDir);
    assert.match(jobRel, /\.\./);
    assert.throws(() => getJob(jobRel), (err) => assertHttpStatus(err, 400));
    assert.match(fs.readFileSync(jobFile, "utf8"), /CANARY/);

    const sessionFile = path.join(canaryDir, "notes.json");
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({
        sessionId: "../../package",
        marker: "CANARY",
        chat: {
          phase: "idle",
          messages: [],
          draft: { mode: null, url: null, instruction: null, summary: null },
          activeJobId: null,
        },
      }),
    );
    const sessionRel = path.relative(config.paths.sessions, sessionFile).replace(/\.json$/, "");
    assert.match(sessionRel, /\.\./);
    assert.throws(() => getSession(sessionRel), (err) => assertHttpStatus(err, 400));
    assert.match(fs.readFileSync(sessionFile, "utf8"), /CANARY/);
  });

  it("keeps product images after the job directory is removed", () => {
    const session = trackSession(createSession());
    const jobId = "job_abc123abc123";
    createdJobs.push(jobId);
    const assetDir = path.join(config.paths.jobs, jobId, "assets");
    fs.mkdirSync(assetDir, { recursive: true });
    const product = path.join(assetDir, "img_0.png");
    const extra = path.join(assetDir, "img_1.png");
    const logo = path.join(assetDir, "logo_src.png");
    fs.copyFileSync(path.join(config.root, "fixtures", "assets", "product.png"), product);
    fs.copyFileSync(path.join(config.root, "fixtures", "assets", "logo.png"), extra);
    fs.copyFileSync(path.join(config.root, "fixtures", "assets", "logo.png"), logo);
    const productBytes = fs.readFileSync(product);
    const facts: ProductFacts = {
      sourceUrl: "https://example.com/p",
      title: "Desk",
      brand: "Lioran",
      price: "¥199",
      currency: "JPY",
      compareAtPrice: null,
      description: "A desk",
      images: [product, extra],
      urlHost: "example.com",
      localeHint: "en",
      logo,
    };
    session.lastFacts = facts;
    session.assetPaths = { logo, productImage: product };
    saveSession(session);

    const updated = updateSessionAfterJob({
      sessionId: session.sessionId,
      jobId,
      videoSpec: SPEC,
      facts,
      videoUrl: `/v1/videos/${jobId}.mp4`,
      assetPaths: { logo, productImage: product },
    });

    fs.rmSync(path.join(config.paths.jobs, jobId), { recursive: true, force: true });

    const saved = getSession(session.sessionId);
    assert.ok(saved);
    const assetRoot = path.join(config.paths.sessions, session.sessionId, "assets") + path.sep;
    for (const file of [saved.assetPaths.productImage, saved.assetPaths.logo, ...saved.lastFacts!.images]) {
      assert.ok(file);
      assert.equal(path.resolve(file).startsWith(assetRoot), true);
      assert.equal(file.includes(`${path.sep}jobs${path.sep}`), false);
      assert.equal(fs.existsSync(file), true);
    }
    assert.equal(saved.lastFacts!.images.length, 2);
    assert.equal(saved.lastFacts!.logo, saved.assetPaths.logo);
    assert.deepEqual(fs.readFileSync(saved.assetPaths.productImage!), productBytes);
    assert.equal(updated.assetPaths.productImage, saved.assetPaths.productImage);
  });

  it("does not enqueue when confirmed is not awaiting, and does not double confirm", async () => {
    const jobsBefore = jobNames();
    const first = await handleChatMessage({
      message: "https://example.com/product",
      understand: async () => ({
        source: "rules",
        plan: plan({
          reply: "Starting the promo now.",
          status: "confirmed",
          understood: {
            mode: "new_from_url",
            url: "https://example.com/product",
            instruction: null,
          },
          questions: [],
        }),
      }),
    });
    createdSessions.push(first.sessionId);
    assert.equal(first.jobId, null);
    assert.equal(first.status, "ready_to_confirm");
    assert.equal(first.phase, "awaiting_confirm");
    assert.match(first.reply, /Nothing is queued yet/);
    assert.deepEqual(jobNames(), jobsBefore);

    const running = trackSession(createSession());
    running.chat.phase = "running";
    running.chat.activeJobId = "job_0123456789ab";
    running.chat.draft = {
      mode: "revise",
      url: null,
      instruction: "make the headline shorter",
      summary: "revise",
    };
    running.lastVideoSpec = SPEC;
    saveSession(running);
    const during = await handleChatMessage({
      sessionId: running.sessionId,
      message: "yes",
      understand: async () => ({
        source: "rules",
        plan: plan({
          reply: "Starting another.",
          status: "confirmed",
          understood: {
            mode: "revise",
            url: null,
            instruction: "make the headline shorter",
          },
          questions: [],
        }),
      }),
    });
    assert.equal(during.jobId, null);
    assert.equal(during.phase, "running");
    assert.equal(during.status, "need_clarification");
    assert.match(during.reply, /already running/);
    assert.equal(getSession(running.sessionId)?.chat.phase, "running");

    const chatWait = trackSession(createSession());
    chatWait.chat.phase = "awaiting_confirm";
    chatWait.chat.draft = {
      mode: "revise",
      url: null,
      instruction: "change the price to 10",
      summary: "revise",
    };
    chatWait.lastVideoSpec = SPEC;
    saveSession(chatWait);
    const honored = await handleChatMessage({
      sessionId: chatWait.sessionId,
      message: "yes",
      understand: async () => ({
        source: "rules",
        plan: plan({
          reply: "Understood. Starting the 15 second promo now.",
          status: "confirmed",
          understood: {
            mode: "revise",
            url: null,
            instruction: "change the price to 10",
          },
          questions: [],
        }),
      }),
    });
    assert.ok(honored.jobId);
    createdJobs.push(honored.jobId);
    assert.equal(honored.status, "confirmed");
    assert.equal(honored.phase, "running");

    const done = trackSession(createSession());
    done.chat.phase = "done";
    done.chat.draft = {
      mode: "revise",
      url: null,
      instruction: "change the price",
      summary: "revise",
    };
    done.lastVideoSpec = SPEC;
    saveSession(done);
    assert.throws(() => handleChatConfirm(done.sessionId), (err) =>
      assertHttpStatus(err, 400, /Nothing awaiting confirmation/),
    );

    const waiting = trackSession(createSession());
    waiting.chat.phase = "awaiting_confirm";
    waiting.chat.draft = {
      mode: "revise",
      url: null,
      instruction: "change the price to 10",
      summary: "revise",
    };
    waiting.lastVideoSpec = SPEC;
    saveSession(waiting);
    const queued = handleChatConfirm(waiting.sessionId);
    createdJobs.push(queued.jobId);
    assert.equal(queued.status, "queued");
    assert.throws(() => handleChatConfirm(waiting.sessionId), (err) =>
      assertHttpStatus(err, 400, /Nothing awaiting confirmation/),
    );
    assert.equal(jobNames().filter((name) => name === queued.jobId).length, 1);

    const started = Date.now();
    const waitIds = [queued.jobId, honored.jobId].filter((id): id is string => Boolean(id));
    let pending = true;
    while (pending && Date.now() - started < 2000) {
      pending = waitIds.some((id) => getJob(id)?.status === "queued");
      if (pending) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    for (const id of waitIds) {
      const failed = getJob(id);
      assert.equal(failed?.status, "failed");
      assert.match(failed?.error || "", /no local product images/);
    }

    assert.throws(() => handleChatConfirm("ses_0123456789ab"), (err) => assertHttpStatus(err, 404));
    assert.equal(fs.existsSync(path.join(config.paths.sessions, "ses_0123456789ab.json")), false);
  });

  it("rejects non-http job URLs before crawl or enqueue", async () => {
    const jobsBefore = jobNames();
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "ftp://example.com/a", "data:text/html,hi"]) {
      assert.throws(() => enqueueUrlJob({ url }), (err) => assertHttpStatus(err, 400, /http\(s\)/));
    }
    assert.equal(assertHttpUrl("https://example.com/p"), "https://example.com/p");
    assert.equal(assertHttpUrl("HTTP://Example.com/a"), "http://example.com/a");
    assert.deepEqual(jobNames(), jobsBefore);

    const session = trackSession(createSession());
    session.chat.phase = "awaiting_confirm";
    session.chat.draft = {
      mode: "new_from_url",
      url: "file:///etc/passwd",
      instruction: null,
      summary: "file",
    };
    saveSession(session);
    assert.throws(() => handleChatConfirm(session.sessionId), (err) =>
      assertHttpStatus(err, 400, /http\(s\)/),
    );
    assert.equal(getSession(session.sessionId)?.chat.phase, "awaiting_confirm");
    assert.deepEqual(jobNames(), jobsBefore);

    const dest = path.join(os.tmpdir(), `lioran-no-crawl-${process.pid}`);
    await assert.rejects(() => crawlProductPage("file:///etc/passwd", dest), (err) =>
      assertHttpStatus(err, 400, /http\(s\)/),
    );
    assert.equal(fs.existsSync(dest), false);
  });

  it("serves public files and rejects traversed ids over HTTP", async () => {
    const pkgBefore = fs.readFileSync(PKG);
    const home = await app.request("/");
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Lioran—Tokyo/);

    const pkg = JSON.parse(pkgBefore.toString()) as { name: string };
    for (const reqPath of [
      "/../package.json",
      "/../../package.json",
      "/%2e%2e/%2e%2e/package.json",
      "/..%2f..%2fpackage.json",
    ]) {
      const res = await app.request(reqPath);
      const text = await res.text();
      assert.equal(text.includes(`"name": "${pkg.name}"`), false, reqPath);
    }

    const encoded = encodeURIComponent("../../package");
    const sessionRes = await app.request(`/v1/sessions/${encoded}`);
    assert.equal(sessionRes.status, 400);
    assert.match((await sessionRes.json()).error, /Invalid session id/);

    const jobRes = await app.request(`/v1/jobs/${encoded}`);
    assert.equal(jobRes.status, 400);
    assert.match((await jobRes.json()).error, /Invalid job id/);

    const chatRes = await app.request("/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "../../package", message: "hi" }),
    });
    assert.equal(chatRes.status, 400);
    assert.match((await chatRes.json()).error, /Invalid session id/);

    const urlRes = await app.request("/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" }),
    });
    assert.equal(urlRes.status, 400);
    assert.match((await urlRes.json()).error, /http\(s\)/);

    const missing = trackSession(createSession());
    missing.chat.phase = "running";
    missing.chat.draft = {
      mode: "new_from_url",
      url: "https://example.com/p",
      instruction: null,
      summary: "go",
    };
    saveSession(missing);
    const confirmRes = await app.request(`/v1/chat/${missing.sessionId}/confirm`, { method: "POST" });
    assert.equal(confirmRes.status, 400);
    assert.match((await confirmRes.json()).error, /Nothing awaiting confirmation/);
    assert.deepEqual(fs.readFileSync(PKG), pkgBefore);
  });
});
