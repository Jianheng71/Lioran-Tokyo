import fs from "node:fs";
import path from "node:path";
import { config, ensureDataDirs } from "../config.js";
import { assertJobId } from "../ids.js";
import type { JobRecord, JobStatus, VideoSpec } from "../schemas.js";

export function jobDir(jobId: string): string {
  return path.join(config.paths.jobs, assertJobId(jobId));
}

function jobMetaPath(jobId: string): string {
  return path.join(jobDir(jobId), "job.json");
}

export function saveJob(job: JobRecord): void {
  ensureDataDirs();
  const dir = jobDir(job.jobId);
  fs.mkdirSync(dir, { recursive: true });
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(jobMetaPath(job.jobId), `${JSON.stringify(job, null, 2)}\n`);
}

export function getJob(jobId: string): JobRecord | null {
  const file = jobMetaPath(jobId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as JobRecord;
}

export function requireJob(jobId: string): JobRecord {
  const job = getJob(jobId);
  if (!job) {
    throw Object.assign(new Error(`Job not found: ${jobId}`), { status: 404 });
  }
  return job;
}

export function setJobStatus(
  jobId: string,
  status: JobStatus,
  patch: Partial<Pick<JobRecord, "error" | "videoUrl" | "videoSpec" | "stageDetail">> = {},
): JobRecord {
  const job = requireJob(jobId);
  job.status = status;
  if (patch.error !== undefined) job.error = patch.error;
  if (patch.videoUrl !== undefined) job.videoUrl = patch.videoUrl;
  if (patch.videoSpec !== undefined) job.videoSpec = patch.videoSpec as VideoSpec | null;
  if (patch.stageDetail !== undefined) job.stageDetail = patch.stageDetail;
  saveJob(job);
  return job;
}

export function pruneOldJobs(): void {
  const keep = config.jobRetention;
  if (!keep || keep <= 0) return;
  ensureDataDirs();
  const entries = fs
    .readdirSync(config.paths.jobs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "fixture")
    .map((d) => {
      const dir = path.join(config.paths.jobs, d.name);
      const meta = jobMetaPath(d.name);
      let mtime = 0;
      try {
        mtime = fs.statSync(fs.existsSync(meta) ? meta : dir).mtimeMs;
      } catch {
        mtime = 0;
      }
      return { name: d.name, dir, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of entries.slice(keep)) {
    try {
      fs.rmSync(old.dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`Failed to prune job ${old.name}:`, err);
    }
  }
}
