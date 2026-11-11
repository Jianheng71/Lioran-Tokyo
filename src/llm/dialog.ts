import type { DialogPlan, SessionRecord, TemplateId } from "../schemas.js";
import { DialogPlanSchema } from "../schemas.js";
import { HermesUnavailableError, extractJsonObject, hermesChatJson } from "./hermes.js";
import { DIALOG_SYSTEM } from "./prompts.js";
import { chooseTemplateId, inferTemplateId } from "../templates/catalog.js";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  return m[0].replace(/[.,;:!?)]+$/, "");
}

function resolveTemplate(
  session: SessionRecord,
  message: string,
  fromModel: TemplateId | null | undefined,
): TemplateId {
  return chooseTemplateId({
    named: fromModel || inferTemplateId(message) || session.chat.draft.templateId,
    message,
    instruction: session.chat.draft.instruction,
  });
}

function ruleBasedDialog(session: SessionRecord, message: string): DialogPlan {
  const url = extractUrl(message);
  const lower = message.toLowerCase();
  const named = inferTemplateId(message);
  const affirms =
    /^(y|yes|ok|okay|sure|confirm|confirmed|do it|go ahead|开始|開始|确认|確認|可以|行|好的|嗯)$/i.test(
      message.trim(),
    ) || /(确认|確認|开始做|開始做|就这样|就這樣|没问题|沒問題)/.test(message);

  if (session.chat.phase === "awaiting_confirm" && affirms && session.chat.draft.mode) {
    const templateId = resolveTemplate(session, message, session.chat.draft.templateId);
    return {
      reply: "Understood. Starting the official product-promo template now.",
      status: "confirmed",
      understood: {
        mode: session.chat.draft.mode === "revise" ? "revise" : "new_from_url",
        url: session.chat.draft.url,
        instruction: session.chat.draft.instruction,
        templateId,
      },
      questions: [],
    };
  }

  if (url) {
    const templateId = resolveTemplate(session, message, named);
    return {
      reply: "I read this as a new promo from that public page. On-screen copy will follow the page language. Missing fields will be filled reasonably. Reply confirm when this matches what you want, or tell me what to change first.",
      status: "ready_to_confirm",
      understood: { mode: "new_from_url", url, instruction: null, templateId },
      questions: [],
    };
  }

  if (session.lastVideoSpec) {
    const looksLikeRevise =
      /(改|换|換|价格|價錢|price|cta|标题|標題|headline|caption|字幕|tagline|模版|模板|template)/i.test(
        message,
      ) || message.trim().length > 0;
    if (looksLikeRevise && message.trim().length > 0) {
      const templateId = resolveTemplate(session, message, named);
      return {
        reply: "I will revise the last video from your note without recrawling the page. Reply confirm to render a new file, or clarify the change.",
        status: "ready_to_confirm",
        understood: { mode: "revise", url: null, instruction: message.trim(), templateId },
        questions: [],
      };
    }
  }

  if (/hermes|model|ai/i.test(lower) && false) {
    // unreachable placeholder
  }

  return {
    reply: session.lastVideoSpec
      ? "Tell me what to change in the last video, or paste a new public page link."
      : "Paste any public page link you have the right to use, and say anything you need about tone or language. I will confirm before starting.",
    status: "need_clarification",
    understood: { mode: "unclear", url: null, instruction: null, templateId: named },
    questions: session.lastVideoSpec
      ? ["What should change in the last promo?"]
      : ["Which public page should I use?"],
  };
}

export async function understandMessage(
  session: SessionRecord,
  message: string,
): Promise<{ plan: DialogPlan; source: "hermes" | "rules" }> {
  const context = {
    hasLastVideo: Boolean(session.lastVideoSpec),
    lastBrand: session.lastVideoSpec?.brand ?? null,
    lastPrice: session.lastVideoSpec?.price ?? null,
    lastTemplateId: session.lastVideoSpec?.templateId ?? null,
    phase: session.chat.phase,
    draft: session.chat.draft,
    recent: session.chat.messages.slice(-6),
    templates: ["product-promo"],
  };

  try {
    const raw = await hermesChatJson({
      system: DIALOG_SYSTEM,
      user: `Session context:\n${JSON.stringify(context, null, 2)}\n\nUser message:\n${message}`,
      temperature: 0.1,
    });
    const parsed = DialogPlanSchema.parse(extractJsonObject(raw));
    if (!parsed.understood.url) {
      const url = extractUrl(message);
      if (url && parsed.understood.mode !== "revise") {
        parsed.understood.url = url;
        if (parsed.understood.mode === "unclear") parsed.understood.mode = "new_from_url";
        if (parsed.status === "need_clarification" && url) {
          parsed.status = "ready_to_confirm";
        }
      }
    }
    const named = inferTemplateId(message);
    parsed.understood.templateId = resolveTemplate(
      session,
      message,
      parsed.understood.templateId || named,
    );
    return { plan: parsed, source: "hermes" };
  } catch (err) {
    if (!(err instanceof HermesUnavailableError)) {
      console.warn("Dialog Hermes parse failed, using rules:", err);
    }
    return { plan: ruleBasedDialog(session, message), source: "rules" };
  }
}
