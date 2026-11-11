import { z } from "zod";

const hexColor = z.string().regex(/^#([0-9A-Fa-f]{6})$/);

export const TemplateIdSchema = z.enum([
  "product-promo",
  "cinematic-product",
  "kinetic-typo",
  "brand-story",
  "social-ad",
]);

export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const ProductFactsSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  brand: z.string().min(1),
  price: z.string().nullable(),
  currency: z.string().nullable(),
  compareAtPrice: z.string().nullable(),
  description: z.string(),
  images: z.array(z.string().min(1)).min(1),
  urlHost: z.string().min(1),
  localeHint: z.string().min(2),
  logo: z.string().nullable().optional(),
});

export type ProductFacts = z.infer<typeof ProductFactsSchema>;

/** Models emit null for absent slots; official variables need plain strings. */
const optionalSlot = (max: number) =>
  z.string().max(max).nullish().transform((value) => value ?? "");

export const VideoSpecSchema = z.object({
  locale: z.string().min(2).max(16),
  brand: z.string().min(1).max(40),
  title: z.string().min(1).max(48),
  price: optionalSlot(24),
  compareAtPrice: optionalSlot(24),
  headline: z.string().min(1).max(48),
  captions: z.tuple([
    z.string().min(1).max(42),
    z.string().min(1).max(42),
    z.string().min(1).max(42),
  ]),
  cta: z.string().min(1).max(24),
  tagline: optionalSlot(48),
  urlHost: z.string().min(1).max(40),
  theme: z.object({
    background: hexColor,
    accent: hexColor,
  }),
  /** Which fillable HyperFrames template to render. Default: official product-promo. */
  templateId: TemplateIdSchema.default("product-promo"),
});

export type VideoSpec = z.infer<typeof VideoSpecSchema>;

export const DialogPlanSchema = z.object({
  reply: z.string().min(1),
  status: z.enum(["need_clarification", "ready_to_confirm", "confirmed"]),
  understood: z.object({
    mode: z.enum(["new_from_url", "revise", "unclear"]),
    url: z.string().nullable(),
    instruction: z.string().nullable(),
    templateId: TemplateIdSchema.nullable().default(null),
  }),
  questions: z.array(z.string()).default([]),
});

export type DialogPlan = z.infer<typeof DialogPlanSchema>;

export type JobStatus =
  | "queued"
  | "crawling"
  | "generating"
  | "filling"
  | "rendering"
  | "done"
  | "failed";

export interface JobRecord {
  jobId: string;
  sessionId: string;
  status: JobStatus;
  error: string | null;
  videoUrl: string | null;
  videoSpec: VideoSpec | null;
  createdAt: string;
  updatedAt: string;
  kind: "url" | "instruction";
  url?: string;
  instruction?: string;
  templateId?: TemplateId;
  stageDetail?: string;
}

export interface SessionRecord {
  sessionId: string;
  lastVideoSpec: VideoSpec | null;
  lastFacts: ProductFacts | null;
  lastJobId: string | null;
  lastVideoUrl: string | null;
  assetPaths: {
    logo: string | null;
    productImage: string | null;
  };
  chat: {
    messages: Array<{ role: "user" | "assistant" | "system"; content: string; at: string }>;
    draft: {
      mode: "new_from_url" | "revise" | "unclear" | null;
      url: string | null;
      instruction: string | null;
      summary: string | null;
      templateId: TemplateId | null;
    };
    phase:
      | "idle"
      | "clarifying"
      | "awaiting_confirm"
      | "running"
      | "done"
      | "failed";
    activeJobId: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
