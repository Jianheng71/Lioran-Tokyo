import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProductFacts } from "../schemas.js";
import { VideoSpecSchema } from "../schemas.js";
import {
  INCOMPLETE_TAIL,
  normalizeSpecCandidate,
  videoSpecFromFacts,
} from "./fallback.js";
import { parseSpec } from "./videoSpec.js";
import { DIALOG_SYSTEM, VIDEO_SPEC_SYSTEM } from "./prompts.js";

const FACTS: ProductFacts = {
  sourceUrl: "https://example.com",
  title: "Example Domain",
  brand: "Example",
  price: null,
  currency: null,
  compareAtPrice: null,
  description:
    "This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes.",
  images: ["fixtures/assets/product.png"],
  urlHost: "example.com",
  localeHint: "en",
  logo: null,
};

const BASE_SPEC = {
  locale: "en",
  brand: "Example",
  title: "Example Domain",
  headline: "For documentation examples",
  captions: ["One", "Two", "Three"],
  cta: "Learn more",
  urlHost: "example.com",
  theme: { background: "#0a0a0f", accent: "#C41E3A" },
  templateId: "product-promo",
};

test("VideoSpec accepts null optional slots and turns them into empty strings", () => {
  const spec = VideoSpecSchema.parse({
    ...BASE_SPEC,
    price: null,
    compareAtPrice: null,
    tagline: null,
  });
  assert.equal(spec.price, "");
  assert.equal(spec.compareAtPrice, "");
  assert.equal(spec.tagline, "");
});

test("normalizeSpecCandidate clips oversized slots without ellipsis or nulls", () => {
  const normalized = normalizeSpecCandidate({
    ...BASE_SPEC,
    brand: "B".repeat(80),
    title: "T".repeat(90),
    headline: "H".repeat(90),
    captions: ["C".repeat(90), null, "Fine caption"],
    cta: "X".repeat(80),
    tagline: null,
    price: null,
    compareAtPrice: null,
    theme: { background: "blue", accent: "#C41E3A" },
  }) as Record<string, unknown>;

  assert.ok(String(normalized.brand).length <= 40);
  assert.ok(String(normalized.title).length <= 48);
  assert.ok(String(normalized.headline).length <= 48);
  assert.ok(String(normalized.cta).length <= 24);
  assert.ok(!String(normalized.brand).endsWith("…"));
  assert.equal(normalized.price, "");
  assert.equal(normalized.compareAtPrice, "");
  assert.equal(normalized.tagline, "");
  const captions = normalized.captions as string[];
  assert.equal(captions.length, 3);
  assert.ok(captions.every((c) => c.length > 0 && c.length <= 42));
  assert.deepEqual(normalized.theme, { background: "#0a0a0f", accent: "#C41E3A" });
});

test("parseSpec accepts a real small-model response with nulls and oversized copy", () => {
  const raw = JSON.stringify({
    locale: "en",
    brand: "Example",
    title: "Example Domain",
    price: null,
    compareAtPrice: null,
    headline: "Discover the Power of Documentation with Example Domain",
    captions: [
      "Unrestricted Use for Any Documentation Example",
      "Perfect for Demonstrating Features and Functionality",
      "Avoid Testing and Monitoring - Designed for Examples Only",
    ],
    cta: "Learn More About the Benefits of Using Example",
    tagline: "Where Documentation Comes Alive",
    urlHost: "example.com",
    theme: { background: "#0a0a0f", accent: "#ff4500" },
    templateId: "product-promo",
  });
  const spec = parseSpec(raw);
  assert.equal(spec.price, "");
  assert.equal(spec.compareAtPrice, "");
  assert.ok(spec.captions.every((c) => c.length <= 42));
  assert.ok(spec.cta.length <= 24);
  assert.ok(spec.headline.length <= 48);
  assert.equal(spec.templateId, "product-promo");
});

test("deterministic fallback never emits a cut-off caption", () => {
  const spec = videoSpecFromFacts(FACTS);
  for (const caption of spec.captions) {
    assert.ok(!INCOMPLETE_TAIL.test(caption), `incomplete caption: ${caption}`);
    assert.ok(caption.length > 0 && caption.length <= 42);
  }
  assert.equal(spec.price, "");
});

test("prompts pin the 15-second contract, null handling and reply language", () => {
  assert.match(VIDEO_SPEC_SYSTEM, /never null/i);
  assert.match(VIDEO_SPEC_SYSTEM, /at most 42 characters/i);
  assert.match(DIALOG_SYSTEM, /15-second/i);
  assert.match(DIALOG_SYSTEM, /Never say 30 seconds/i);
  assert.match(DIALOG_SYSTEM, /same language as the user/i);
});
