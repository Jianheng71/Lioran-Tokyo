import { understandMessage } from "../llm/dialog.js";
import { enqueueInstructionJob, enqueueUrlJob } from "../jobs/queue.js";
import { getOrCreateSession, getSession, requireSession, saveSession } from "../session/store.js";
import type { DialogPlan, JobRecord, SessionRecord } from "../schemas.js";
import { chooseTemplateId, DEFAULT_TEMPLATE_ID } from "../templates/catalog.js";

function applyDraft(session: SessionRecord, plan: DialogPlan): void {
  const templateId =
    plan.understood.templateId ||
    chooseTemplateId({
      named: session.chat.draft.templateId,
      message: plan.understood.instruction || plan.reply,
    });
  session.chat.draft = {
    mode: plan.understood.mode === "unclear" ? null : plan.understood.mode,
    url: plan.understood.url,
    instruction: plan.understood.instruction,
    summary: plan.reply,
    templateId,
  };
  if (plan.status === "need_clarification") session.chat.phase = "clarifying";
  else if (plan.status === "ready_to_confirm") session.chat.phase = "awaiting_confirm";
}

function downgradePrematureConfirm(
  plan: DialogPlan,
  phase: SessionRecord["chat"]["phase"],
): void {
  const mode = plan.understood.mode;
  const actionable =
    (mode === "new_from_url" && Boolean(plan.understood.url)) ||
    (mode === "revise" && Boolean(plan.understood.instruction));
  if (phase === "running" || !actionable) {
    plan.status = "need_clarification";
    if (phase === "running") {
      plan.reply = "A video is already running, so I did not queue another.";
    }
    return;
  }
  plan.status = "ready_to_confirm";
  plan.reply = `${plan.reply} Reply confirm to start. Nothing is queued yet.`;
}

function startFromDraft(session: SessionRecord): JobRecord {
  const draft = session.chat.draft;
  const templateId = draft.templateId || DEFAULT_TEMPLATE_ID;
  if (draft.mode === "revise") {
    if (!draft.instruction) {
      throw Object.assign(new Error("Missing revision instruction"), { status: 400 });
    }
    return enqueueInstructionJob({
      sessionId: session.sessionId,
      instruction: draft.instruction,
      templateId,
    });
  }
  if (draft.mode === "new_from_url") {
    if (!draft.url) {
      throw Object.assign(new Error("Missing product URL"), { status: 400 });
    }
    return enqueueUrlJob({ url: draft.url, sessionId: session.sessionId, templateId });
  }
  throw Object.assign(new Error("Nothing to confirm yet"), { status: 400 });
}

export async function handleChatMessage(opts: {
  sessionId?: string;
  message: string;
  /** Tests inject this so a dialog plan can be forced without Hermes. */
  understand?: typeof understandMessage;
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

  const understand = opts.understand ?? understandMessage;
  const session = getOrCreateSession(opts.sessionId);
  const phaseBefore = session.chat.phase;
  session.chat.messages.push({
    role: "user",
    content: message,
    at: new Date().toISOString(),
  });

  const { plan, source } = await understand(session, message);

  // Honor confirmed only for a plan that is still awaiting confirmation.
  // A model can return confirmed on the first message; that must not enqueue.
  if (plan.status === "confirmed" && phaseBefore === "awaiting_confirm") {
    const fresh = getSession(session.sessionId);
    if (!fresh || fresh.chat.phase !== "awaiting_confirm") {
      return {
        sessionId: session.sessionId,
        reply: "That plan is no longer waiting for confirmation.",
        phase: fresh?.chat.phase ?? phaseBefore,
        status: "need_clarification",
        draft: fresh?.chat.draft ?? session.chat.draft,
        jobId: null,
        messages: fresh?.chat.messages ?? session.chat.messages,
        source,
      };
    }
  }

  let keepRunning = false;
  if (plan.status === "confirmed" && phaseBefore !== "awaiting_confirm") {
    downgradePrematureConfirm(plan, phaseBefore);
    keepRunning = phaseBefore === "running";
  }

  applyDraft(session, plan);
  if (keepRunning) session.chat.phase = "running";

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
  const session = requireSession(sessionId);
  if (session.chat.phase !== "awaiting_confirm") {
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
    content: "Understood. Starting the official product-promo template now.",
    at: new Date().toISOString(),
  });
  session.chat.phase = "running";
  session.chat.activeJobId = job.jobId;
  saveSession(session);
  return {
    sessionId: session.sessionId,
    jobId: job.jobId,
    status: "queued",
    reply: "Understood. Starting the official product-promo template now.",
  };
}
