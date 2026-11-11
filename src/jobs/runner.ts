import fs from "node:fs";
import path from "node:path";
import { crawlProductPage } from "../crawler/index.js";
import { generateVideoSpecFromFacts, reviseVideoSpec } from "../llm/videoSpec.js";
import { fillTemplate } from "../templater/index.js";
import { renderJobVideo } from "../renderer/index.js";
import { getSession, saveSession, updateSessionAfterJob } from "../session/store.js";
import { jobDir, pruneOldJobs, setJobStatus } from "./store.js";
import type { JobRecord } from "../schemas.js";

export async function runJob(job: JobRecord): Promise<void> {
  const dir = jobDir(job.jobId);
  fs.mkdirSync(dir, { recursive: true });
  const assetDir = path.join(dir, "assets");
  fs.mkdirSync(assetDir, { recursive: true });
  const outputMp4 = path.join(dir, "video.mp4");
  const videoUrl = `/v1/videos/${job.jobId}.mp4`;

  try {
    const session = getSession(job.sessionId);
    if (!session) throw new Error(`Session missing for job ${job.jobId}`);

    let facts = session.lastFacts;
    let assets = { ...session.assetPaths };

    if (job.kind === "url") {
      if (!job.url) throw new Error("URL job missing url");
      setJobStatus(job.jobId, "crawling");
      facts = await crawlProductPage(job.url, assetDir);
      assets = {
        logo: facts.logo ?? null,
        productImage: facts.images[0] ?? null,
      };
      session.lastFacts = facts;
      session.assetPaths = assets;
      saveSession(session);
    } else {
      if (!session.lastVideoSpec) {
        throw new Error("No previous VideoSpec on this session; cannot revise without recrawl.");
      }
      // Reuse prior assets; copy into this job dir for isolation
      if (assets.productImage && fs.existsSync(assets.productImage)) {
        const dest = path.join(assetDir, path.basename(assets.productImage));
        fs.copyFileSync(assets.productImage, dest);
        assets.productImage = dest;
      }
      if (assets.logo && fs.existsSync(assets.logo)) {
        const dest = path.join(assetDir, path.basename(assets.logo));
        fs.copyFileSync(assets.logo, dest);
        assets.logo = dest;
      }
      if (!assets.productImage && !assets.logo) {
        throw new Error("Previous session has no local product images to reuse.");
      }
    }

    setJobStatus(job.jobId, "generating");
    let videoSpec;
    const preferredTemplateId =
      job.templateId || session.chat.draft.templateId || session.lastVideoSpec?.templateId || null;
    if (job.kind === "url") {
      if (!facts) throw new Error("Facts missing after crawl");
      const generated = await generateVideoSpecFromFacts(facts, preferredTemplateId);
      videoSpec = generated.spec;
      if (preferredTemplateId) videoSpec.templateId = preferredTemplateId;
      setJobStatus(job.jobId, "generating", {
        stageDetail: `spec source=${generated.source}; template=${videoSpec.templateId}`,
        videoSpec,
      });
    } else {
      if (!session.lastVideoSpec) throw new Error("Missing lastVideoSpec");
      const generated = await reviseVideoSpec(
        session.lastVideoSpec,
        job.instruction || "",
        facts,
      );
      videoSpec = generated.spec;
      if (preferredTemplateId) videoSpec.templateId = preferredTemplateId;
      setJobStatus(job.jobId, "generating", {
        stageDetail: `spec source=${generated.source}; template=${videoSpec.templateId}`,
        videoSpec,
      });
    }

    setJobStatus(job.jobId, "filling", { videoSpec });
    const filled = fillTemplate({
      jobId: job.jobId,
      jobDir: dir,
      spec: videoSpec,
      assets,
    });

    setJobStatus(job.jobId, "rendering", { videoSpec });
    await renderJobVideo({
      projectDir: filled.projectDir,
      variablesPath: filled.variablesPath,
      outputMp4,
    });

    setJobStatus(job.jobId, "done", {
      videoUrl,
      videoSpec,
      error: null,
      stageDetail: "ok",
    });

    updateSessionAfterJob({
      sessionId: job.sessionId,
      jobId: job.jobId,
      videoSpec,
      facts,
      videoUrl,
      assetPaths: assets,
    });

    const s = getSession(job.sessionId);
    if (s) {
      s.chat.messages.push({
        role: "assistant",
        content: `Video ready. You can play or download it here, or ask to change one line.`,
        at: new Date().toISOString(),
      });
      s.chat.phase = "done";
      s.chat.activeJobId = job.jobId;
      saveSession(s);
    }

    pruneOldJobs();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setJobStatus(job.jobId, "failed", { error: message });
    const s = getSession(job.sessionId);
    if (s) {
      s.chat.phase = "failed";
      s.chat.messages.push({
        role: "assistant",
        content: `The job failed: ${message}`,
        at: new Date().toISOString(),
      });
      saveSession(s);
    }
  }
}
