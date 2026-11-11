# Lioran—Tokyo

Local service: open an AI dialog, confirm the request, crawl a public product page, ask Hermes for **VideoSpec JSON only**, fill a **HyperFrames** template through official variables, and render a **silent 9:16 (1080×1920 @ 30fps) MP4**. A later “change one line” reuses the last VideoSpec (no recrawl) and re-renders; the old MP4 is kept.

Pinned renderer: **`hyperframes@0.9.32`** (do not bump).

UI standard: **`AESTHETICS.md`** (2026-11-11) — P5 chat window follows [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui) parts in `ui/chat-window/`. Wordmark **Lioran—Tokyo**. Chrome, prompts, and buttons are **Chinese/English bilingual** (language switch; default Chinese first). On-video text still follows the product-page language. Film fill stays on official HyperFrames variables via `--variables-file` / `--strict-variables`.

## Templates (five selectable)

| `templateId` | Role | Duration |
| --- | --- | --- |
| `product-promo` | **Default** official fill-in template (untouched) | 15s |
| `cinematic-product` | Optional four-act cinematic product reveal | 18s (4+5+5+4) |
| `kinetic-typo` | Optional kinetic typography | ~15.15s (original GSAP chain) |
| `brand-story` | Optional elegant brand narrative | 26s (original GSAP chain) |
| `social-ad` | Optional flash-sale / social ad | 15s |

Community four are converted fillable copies of [2boysfromtown/hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion) @ `83cfdad9` (MIT, Copyright (c) 2026 2 Boys From Town). Unmodified originals live under `references/hyperframes-motion/`. They are **not** a Web UI frame.

### How a user or the model chooses a template

- In the P5 dialog, **name a template** (e.g. “用 cinematic-product”, “kinetic-typo”, “brand-story”, “social-ad”, or “product-promo”).
- If unspecified, the model picks the most suitable of the five; **ordinary product-promo requests still default to `product-promo`**.
- The choice is stored on the chat draft and on `VideoSpec.templateId`, then the same official CLI path fills and renders that template directory.

Firmware examples (Hermes not required):

```bash
npm run render:fixture                 # product-promo → data/jobs/fixture/video.mp4
npm run render:fixture:cinematic       # cinematic-product
npm run render:fixture:kinetic         # kinetic-typo
npm run render:fixture:brand           # brand-story
npm run render:fixture:social          # social-ad
```

Do not commit the MP4s.

## Requirements

- Node.js 20+
- FFmpeg and ffprobe on `PATH`
- Chrome / Chromium (used by HyperFrames and the Crawlee crawler)
- Local Hermes / AlinGPT already deployed on this machine from [Jianheng71/Lioran](https://github.com/Jianheng71/Lioran) (one-time download that stays on the host). This repo **auto-connects** to `http://127.0.0.1:43127` (`hermes3:8b`) — do **not** vendor or re-download a model here. If Hermes is not running, `npm run render:fixture*` and `GET /health` still work (`fixtureRenderRequiresHermes: false`).

## Clone → install → env → doctor → dev

```bash
git clone https://github.com/Jianheng71/Lioran-Tokyo.git
cd Lioran-Tokyo
npm install
cp .env.example .env
# HERMES_BASE_URL defaults to http://127.0.0.1:43127 — reuse the existing Lioran Hermes
npm run doctor
npm run dev
```

Open **[http://127.0.0.1:8787](http://127.0.0.1:8787)**. The main UI is the AI dialog (not a competing URL form).

## Compliance

This tool is only for pages you have the right to use. Do not crawl behind logins. Do not commit third-party product images or rendered MP4s. Trademarks and product content belong to their owners. The firmware uses redistributable placeholder images and copy.

## Main APIs (default port 8787)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/health` | ffmpeg, Hermes reachability, HyperFrames CLI (missing Hermes does not block fixture render) |
| `POST` | `/v1/chat` | Dialog understand → clarify → ready to confirm (`jobId` stays null until confirm) |
| `POST` | `/v1/chat/:sessionId/confirm` | Confirm, then enqueue a job (crawl / render only after this) |
| `POST` | `/v1/jobs` | `{ url }` or `{ sessionId, instruction }` (execution layer after confirm) |
| `GET` | `/v1/jobs/:jobId` | Status, error, videoUrl, videoSpec |
| `GET` | `/v1/sessions/:sessionId` | lastVideoSpec, lastFacts, lastJobId, lastVideoUrl |
| `GET` | `/v1/videos/:jobId.mp4` | Serve that job’s MP4 (never overwrites an older job) |

Job status advances: `queued` → `crawling` → `generating` → `filling` → `rendering` → `done` / `failed`.

## Layout

```
src/server.ts          HTTP entry (8787)
src/jobs/              FIFO queue + state machine
src/session/           last VideoSpec / facts under data/sessions/
src/crawler/           Crawlee → ProductFacts (OG / JSON-LD / visible fields)
src/llm/               Hermes client + prompts + Zod (JSON only)
src/templater/         VideoSpec → variables.json + local assets (per templateId)
src/templates/catalog.ts  template ids, durations, selection helpers
src/renderer/          official CLI; render lock 1 + browser lock 1
templates/product-promo/      default official template (do not alter)
templates/cinematic-product/  optional 18s four-act fillable copy
templates/kinetic-typo/       optional kinetic typography fillable copy
templates/brand-story/        optional brand narrative fillable copy
templates/social-ad/          optional 15s social ad fillable copy
references/hyperframes-motion/  unmodified MIT originals + LICENSE/NOTICE/SOURCE
fixtures/              firmware VideoSpec + placeholder images
public/                ollama-llm-ui–style chat window (static, served by Hono)
ui/chat-window/        upstream chat parts + SOURCE.md (Jakob Hoeg Mørk, MIT)
references/hyperkuy/   historical visual reference only (not a template source)
AESTHETICS.md          P5 UI + five-template governor lock (authoritative)
scripts/               doctor + render:fixture*
data/                  jobs, sessions, downloads, videos (gitignored)
```

## Fill path (official only)

1. Template declares `data-composition-variables`; nodes use `data-var-text` / `data-var-src` / `var(--id)` / `getVariables()`.
2. Server writes `variables.json` only (no Handlebars/EJS; Hermes never emits HTML).
3. Render with `--variables-file` and `--strict-variables` against a job-local copy of the chosen template.

## Environment

See `.env.example`: `PORT`, `HERMES_BASE_URL` (reuse Lioran Hermes), `HERMES_MODEL`, `HYPERFRAMES_VERSION=0.9.32`, crawl/Hermes/render timeouts, `JOB_RETENTION`.
