import { understandMessage } from "../llm/dialog.js";
import { enqueueInstructionJob, enqueueUrlJob } from "../jobs/queue.js";
import { getOrCreateSession, saveSession } from "../session/store.js";
import type { DialogPlan, JobRecord, SessionRecord } from "../schemas.js";

function applyDraft(session: SessionRecord, plan: DialogPlan): void {
  session.chat.draft = {
    mode: plan.understood.mode === "unclear" ? null : plan.understood.mode,
    url: plan.understood.url,
    instruction: plan.understood.instruction,
    summary: plan.reply,
  };
  if (plan.status === "need_clarification") session.chat.phase = "clarifying";
  else if (plan.status === "ready_to_confirm") session.chat.phase = "awaiting_confirm";
}

function startFromDraft(session: SessionRecord): JobRecord {
  const draft = session.chat.draft;
  if (draft.mode === "revise") {
    if (!draft.instruction) {
      throw Object.assign(new Error("Missing revision instruction"), { status: 400 });
    }
    return enqueueInstructionJob({
      sessionId: session.sessionId,
      instruction: draft.instruction,
    });
  }
  if (draft.mode === "new_from_url") {
    if (!draft.url) {
      throw Object.assign(new Error("Missing product URL"), { status: 400 });
    }
    return enqueueUrlJob({ url: draft.url, sessionId: session.sessionId });
  }
  throw Object.assign(new Error("Nothing to confirm yet"), { status: 400 });
}

export async function handleChatMessage(opts: {
  sessionId?: string;
  message: string;
}): Promise<{
  sessionId: string;
  reply: string;
  phase: SessionRecord["chat"]["phase"];
  status: DialogPlan["status"];
  draft: SessionRecord["chat"]["draft"];
  jobId: string | null;
  messages: SessionRecord["chat"]["messages"];
  source: "hermes" | "rules";
}> {
  const message = opts.message.trim();
  if (!message) {
    throw Object.assign(new Error("message is required"), { status: 400 });
  }

  const session = getOrCreateSession(opts.sessionId);
  session.chat.messages.push({
    role: "user",
    content: message,
    at: new Date().toISOString(),
  });

  const { plan, source } = await understandMessage(session, message);
  applyDraft(session, plan);

  let jobId: string | null = null;
  if (plan.status === "confirmed") {
    const job = startFromDraft(session);
    jobId = job.jobId;
    session.chat.phase = "running";
    session.chat.activeJobId = job.jobId;
  }

  session.chat.messages.push({
    role: "assistant",
    content: plan.reply,
    at: new Date().toISOString(),
  });
  saveSession(session);

  return {
    sessionId: session.sessionId,
    reply: plan.reply,
    phase: session.chat.phase,
    status: plan.status,
    draft: session.chat.draft,
    jobId,
    messages: session.chat.messages,
    source,
  };
}

export function handleChatConfirm(sessionId: string): {
  sessionId: string;
  jobId: string;
  status: "queued";
  reply: string;
} {
  const session = getOrCreateSession(sessionId);
  if (session.chat.phase !== "awaiting_confirm" && !session.chat.draft.mode) {
    throw Object.assign(new Error("Nothing awaiting confirmation on this session"), {
      status: 400,
    });
  }
  const job = startFromDraft(session);
  session.chat.messages.push({
    role: "user",
    content: "Confirm",
    at: new Date().toISOString(),
  });
  session.chat.messages.push({
    role: "assistant",
    content: "Understood. Starting the 15 second promo now.",
    at: new Date().toISOString(),
  });
  session.chat.phase = "running";
  session.chat.activeJobId = job.jobId;
  saveSession(session);
  return {
    sessionId: session.sessionId,
    jobId: job.jobId,
    status: "queued",
    reply: "Understood. Starting the 15 second promo now.",
  };
}
