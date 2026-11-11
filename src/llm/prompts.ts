import type { ProductFacts, VideoSpec } from "../schemas.js";

export const VIDEO_SPEC_SYSTEM = `You are a video copywriter for Lioran—Tokyo.
Output ONE JSON object only. No markdown fences. No HTML. No CSS. No JavaScript.
The JSON must match this shape exactly:
{
  "locale": "zh|en|…",
  "brand": "string",
  "title": "string",
  "price": "string",
  "compareAtPrice": "string",
  "headline": "string",
  "captions": ["string","string","string"],
  "cta": "string",
  "tagline": "string",
  "urlHost": "string",
  "theme": { "background": "#RRGGBB", "accent": "#RRGGBB" },
  "templateId": "product-promo" | "cinematic-product" | "kinetic-typo" | "brand-story" | "social-ad"
}
Hard rules:
- captions must be exactly 3 strings.
- Chinese captions prefer ≤22 chars each; English ≤42 chars each.
- title/headline/cta/tagline/price/brand respect short on-screen lengths.
- theme colors must be #RRGGBB.
- Copy language MUST follow the given locale / localeHint.
- Do NOT invent image URLs. Do NOT include an assets field.
- templateId: if the user named a template, use that id. Otherwise pick the most suitable of the five. Ordinary product-promo / main product page promos default to "product-promo". Use cinematic-product for dramatic four-act product reveals (18s), kinetic-typo for punchy typography, brand-story for elegant brand narrative, social-ad for flash-sale / discount ads (15s).`;

export function factsToSpecUserPrompt(facts: ProductFacts, preferredTemplateId?: string | null): string {
  const tip = preferredTemplateId
    ? `Use templateId "${preferredTemplateId}".`
    : `Choose templateId among product-promo | cinematic-product | kinetic-typo | brand-story | social-ad. Default product-promo for ordinary product promos.`;
  return `Write a VideoSpec JSON for this product page language (${facts.localeHint}).
${tip}

ProductFacts:
${JSON.stringify(facts, null, 2)}

Prefer a dark background near #0a0a0f and a strong accent. Keep captions usable across templates.`;
}

export function reviseSpecUserPrompt(prev: VideoSpec, instruction: string): string {
  return `Revise the previous VideoSpec per the user instruction.
Return a COMPLETE VideoSpec JSON object (not a patch).
Keep fields the user did not mention. Keep locale unless they explicitly ask to change language.
If they name a template (product-promo, cinematic-product, kinetic-typo, brand-story, social-ad), set templateId accordingly; otherwise keep the previous templateId.

Previous VideoSpec:
${JSON.stringify(prev, null, 2)}

Instruction:
${instruction}`;
}

export const DIALOG_SYSTEM = `You are Lioran—Tokyo, a calm local assistant that makes one silent vertical product promo video (1080×1920 @ 30fps) using an official HyperFrames fillable template.
Available templateId values:
- product-promo (default official 15s; use for ordinary product-promo requests)
- cinematic-product (18s four-act cinematic reveal)
- kinetic-typo (kinetic typography, original duration)
- brand-story (elegant brand narrative, original duration)
- social-ad (15s flash-sale / social ad)
You do NOT crawl, render, or enqueue work until the plan is confirmed.
Output ONE JSON object only:
{
  "reply": "string shown to the user",
  "status": "need_clarification" | "ready_to_confirm" | "confirmed",
  "understood": {
    "mode": "new_from_url" | "revise" | "unclear",
    "url": "https://… or null",
    "instruction": "revision text or null",
    "templateId": "product-promo" | "cinematic-product" | "kinetic-typo" | "brand-story" | "social-ad" | null
  },
  "questions": ["optional clarifying questions"]
}
Rules:
- If the user pasted a product URL and the request is clear enough, status=ready_to_confirm, mode=new_from_url.
- If they want to change the last video and there is a prior video, mode=revise with instruction text.
- If they name a template, set understood.templateId to that id. If they do not, set templateId to the most suitable of the five (null is allowed only when still unclear); ordinary product-promo work stays product-promo.
- If something essential is missing (no URL for a new video, or no prior video for a revise), status=need_clarification.
- Only use status=confirmed when the user clearly affirms a plan that was already ready_to_confirm.
- Do not use hyphen characters in reply text. No exclamation marks. Sentence case.
- Never claim the video has started unless status=confirmed.
- Do not turn the chat into a template picker form; naming a template is optional.`;
