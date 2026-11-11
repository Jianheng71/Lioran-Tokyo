import { newJobId } from "../ids.js";
import { getOrCreateSession, saveSession } from "../session/store.js";
import type { JobRecord } from "../schemas.js";
import { saveJob } from "./store.js";
import { runJob } from "./runner.js";

type QueueItem = { jobId: string };

const queue: QueueItem[] = [];
let pumping = false;

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const item = queue.shift()!;
      const { getJob } = await import("./store.js");
      const job = getJob(item.jobId);
      if (!job) continue;
      await runJob(job);
    }
  } finally {
    pumping = false;
    if (queue.length) void pump();
  }
}

export function enqueueUrlJob(opts: {
  url: string;
  sessionId?: string;
  templateId?: JobRecord["templateId"];
}): JobRecord {
  const session = getOrCreateSession(opts.sessionId);
  const now = new Date().toISOString();
  const job: JobRecord = {
    jobId: newJobId(),
    sessionId: session.sessionId,
    status: "queued",
    error: null,
    videoUrl: null,
    videoSpec: null,
    createdAt: now,
    updatedAt: now,
    kind: "url",
    url: opts.url,
    templateId: opts.templateId || session.chat.draft.templateId || undefined,
  };
  saveJob(job);
  session.chat.phase = "running";
  session.chat.activeJobId = job.jobId;
  saveSession(session);
  queue.push({ jobId: job.jobId });
  void pump();
  return job;
}

export function enqueueInstructionJob(opts: {
  sessionId: string;
  instruction: string;
  templateId?: JobRecord["templateId"];
}): JobRecord {
  const session = getOrCreateSession(opts.sessionId);
  if (!session.lastVideoSpec) {
    throw Object.assign(
      new Error("No previous VideoSpec on this session. Start with a product URL first."),
      { status: 400 },
    );
  }
  // FIFO: same-session revises naturally wait behind earlier queue items
  const now = new Date().toISOString();
  const job: JobRecord = {
    jobId: newJobId(),
    sessionId: session.sessionId,
    status: "queued",
    error: null,
    videoUrl: null,
    videoSpec: null,
    createdAt: now,
    updatedAt: now,
    kind: "instruction",
    instruction: opts.instruction,
    templateId: opts.templateId || session.chat.draft.templateId || undefined,
  };
  saveJob(job);
  session.chat.phase = "running";
  session.chat.activeJobId = job.jobId;
  saveSession(session);
  queue.push({ jobId: job.jobId });
  void pump();
  return job;
}
