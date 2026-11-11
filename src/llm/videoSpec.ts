import type { ProductFacts, VideoSpec } from "../schemas.js";
import { VideoSpecSchema } from "../schemas.js";
import { HermesUnavailableError, extractJsonObject, hermesChatJson } from "./hermes.js";
import { mergeSpecDefaults, videoSpecFromFacts } from "./fallback.js";
import { VIDEO_SPEC_SYSTEM, factsToSpecUserPrompt, reviseSpecUserPrompt } from "./prompts.js";

function parseSpec(raw: string, prev?: VideoSpec): VideoSpec {
  const parsed = extractJsonObject(raw);
  const result = VideoSpecSchema.safeParse(parsed);
  if (result.success) return result.data;
  if (prev && parsed && typeof parsed === "object") {
    const merged = mergeSpecDefaults(parsed as Partial<VideoSpec>, prev);
    return VideoSpecSchema.parse(merged);
  }
  throw new Error(result.error.issues.map((i) => i.message).join("; "));
}

async function generateWithRetry(user: string, prev?: VideoSpec): Promise<VideoSpec> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await hermesChatJson({
        system: VIDEO_SPEC_SYSTEM,
        user:
          attempt === 0
            ? user
            : `${user}\n\nPrevious attempt failed validation. Return strict JSON only. Fix: ${
                lastError instanceof Error ? lastError.message : String(lastError)
              }`,
      });
      return parseSpec(raw, prev);
    } catch (err) {
      if (err instanceof HermesUnavailableError) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function generateVideoSpecFromFacts(facts: ProductFacts): Promise<{
  spec: VideoSpec;
  source: "hermes" | "fallback";
}> {
  try {
    const spec = await generateWithRetry(factsToSpecUserPrompt(facts));
    return { spec, source: "hermes" };
  } catch (err) {
    if (err instanceof HermesUnavailableError) {
      return { spec: videoSpecFromFacts(facts), source: "fallback" };
    }
    // Validation exhausted → template sentences from Facts
    return { spec: videoSpecFromFacts(facts), source: "fallback" };
  }
}

export async function reviseVideoSpec(
  prev: VideoSpec,
  instruction: string,
  facts: ProductFacts | null,
): Promise<{ spec: VideoSpec; source: "hermes" | "fallback" }> {
  try {
    const spec = await generateWithRetry(reviseSpecUserPrompt(prev, instruction), prev);
    return { spec, source: "hermes" };
  } catch (err) {
    if (err instanceof HermesUnavailableError) {
      // Lightweight local revise for common price edits when Hermes is down
      const local = localRevise(prev, instruction);
      if (local) return { spec: local, source: "fallback" };
      if (facts) return { spec: videoSpecFromFacts(facts), source: "fallback" };
      throw err;
    }
    const local = localRevise(prev, instruction);
    if (local) return { spec: local, source: "fallback" };
    if (facts) return { spec: videoSpecFromFacts(facts), source: "fallback" };
    return { spec: prev, source: "fallback" };
  }
}

function localRevise(prev: VideoSpec, instruction: string): VideoSpec | null {
  const priceMatch = instruction.match(
    /(?:价格|價錢|price|yen|jpy|¥|￥|\$)\s*(?:改成|改为|換成|换成|to|=|:)?\s*([¥￥$€£]?\s?\d+[\d,.]*)/i,
  );
  if (priceMatch?.[1]) {
    const price = priceMatch[1].replace(/\s+/g, "");
    return VideoSpecSchema.parse({ ...prev, price });
  }
  const ctaMatch = instruction.match(/(?:cta|按钮|按鈕)\s*(?:改成|改为|換成|换成|to|=|:)?\s*[「"']?([^」"']+)[」"']?/i);
  if (ctaMatch?.[1]) {
    return VideoSpecSchema.parse({ ...prev, cta: ctaMatch[1].trim().slice(0, 24) });
  }
  return null;
}
