import { config } from "../config.js";

export class HermesUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HermesUnavailableError";
  }
}

export async function hermesReachable(): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${config.hermesBaseUrl}/v1/models`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status} from ${config.hermesBaseUrl}` };
    }
    return { ok: true, detail: `reachable at ${config.hermesBaseUrl}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function hermesChatJson(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.hermesTimeoutMs);
  try {
    const res = await fetch(`${config.hermesBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.hermesModel,
        temperature: opts.temperature ?? 0.2,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        throw new HermesUnavailableError(
          `Hermes not available (${res.status}) at ${config.hermesBaseUrl}. ${body}`.trim(),
        );
      }
      throw new Error(`Hermes HTTP ${res.status}: ${body.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Hermes returned empty content");
    }
    return content;
  } catch (err) {
    if (err instanceof HermesUnavailableError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HermesUnavailableError(
        `Hermes timed out after ${config.hermesTimeoutMs}ms at ${config.hermesBaseUrl}`,
      );
    }
    if (err instanceof TypeError || (err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message))) {
      throw new HermesUnavailableError(
        `Hermes unreachable at ${config.hermesBaseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Strip markdown fences if a model ignores json_object mode. */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim());
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model output was not valid JSON");
  }
}
