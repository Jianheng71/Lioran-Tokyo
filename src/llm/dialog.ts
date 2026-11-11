import type { DialogPlan, SessionRecord } from "../schemas.js";
import { DialogPlanSchema } from "../schemas.js";
import { HermesUnavailableError, extractJsonObject, hermesChatJson } from "./hermes.js";
import { DIALOG_SYSTEM } from "./prompts.js";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  return m[0].replace(/[.,;:!?)]+$/, "");
}

function ruleBasedDialog(session: SessionRecord, message: string): DialogPlan {
  const url = extractUrl(message);
  const lower = message.toLowerCase();
  const affirms =
    /^(y|yes|ok|okay|sure|confirm|confirmed|do it|go ahead|开始|開始|确认|確認|可以|行|好的|嗯)$/i.test(
      message.trim(),
    ) || /(确认|確認|开始做|開始做|就这样|就這樣|没问题|沒問題)/.test(message);

  if (session.chat.phase === "awaiting_confirm" && affirms && session.chat.draft.mode) {
    return {
      reply: "Understood. Starting the 15 second promo now.",
      status: "confirmed",
      understood: {
        mode: session.chat.draft.mode === "revise" ? "revise" : "new_from_url",
        url: session.chat.draft.url,
        instruction: session.chat.draft.instruction,
      },
      questions: [],
    };
  }

  if (url) {
    return {
      reply:
        "I read this as a new promo from that product page. On-screen copy will follow the page language. Reply confirm when this matches what you want, or tell me what to change first.",
      status: "ready_to_confirm",
      understood: { mode: "new_from_url", url, instruction: null },
      questions: [],
    };
  }

  if (session.lastVideoSpec) {
    const looksLikeRevise =
      /(改|换|換|价格|價錢|price|cta|标题|標題|headline|caption|字幕|tagline)/i.test(message) ||
      message.trim().length > 0;
    if (looksLikeRevise && message.trim().length > 0) {
      return {
        reply:
          "I will revise the last video from your note without recrawling the page. Reply confirm to render a new 15 second file, or clarify the change.",
        status: "ready_to_confirm",
        understood: { mode: "revise", url: null, instruction: message.trim() },
        questions: [],
      };
    }
  }

  if (/hermes|model|ai/i.test(lower) && false) {
    // unreachable placeholder to keep structure clear
  }

  return {
    reply: session.lastVideoSpec
      ? "Tell me what to change in the last video, or paste a new product page link."
      : "Paste a public product page link, and say anything you need about price, tone, or language. I will confirm before starting.",
    status: "need_clarification",
    understood: { mode: "unclear", url: null, instruction: null },
    questions: session.lastVideoSpec
      ? ["What should change in the last promo?"]
      : ["Which public product page should I use?"],
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
    phase: session.chat.phase,
    draft: session.chat.draft,
    recent: session.chat.messages.slice(-6),
  };

  try {
    const raw = await hermesChatJson({
      system: DIALOG_SYSTEM,
      user: `Session context:\n${JSON.stringify(context, null, 2)}\n\nUser message:\n${message}`,
      temperature: 0.1,
    });
    const parsed = DialogPlanSchema.parse(extractJsonObject(raw));
    // Prefer extracting a URL from the user message if model dropped it
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
    return { plan: parsed, source: "hermes" };
  } catch (err) {
    if (!(err instanceof HermesUnavailableError)) {
      console.warn("Dialog Hermes parse failed, using rules:", err);
    }
    return { plan: ruleBasedDialog(session, message), source: "rules" };
  }
}
