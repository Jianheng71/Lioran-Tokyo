# Lioran—Tokyo

Local service: open an AI dialog, confirm the request, crawl a public product page, ask Hermes for **VideoSpec JSON only**, fill a **locked** HyperFrames `product-promo` template through official variables, and render a **silent 15-second 9:16 (1080×1920 @ 30fps) MP4**. A later “change one line” reuses the last VideoSpec (no recrawl) and re-renders a new 15s file; the old MP4 is kept.

Pinned renderer: **`hyperframes@0.9.32`** (do not bump).

## Requirements

- Node.js 20+
- FFmpeg and ffprobe on `PATH`
- Chrome / Chromium (used by HyperFrames and the Crawlee crawler)
- Optional: local Hermes / AlinGPT at `http://127.0.0.1:43127` (`hermes3:8b`)

## Clone → install → env → doctor → dev

```bash
git clone <this-repo>
cd Lioran-Tokyo
npm install
cp .env.example .env
# optional: HERMES_BASE_URL, HERMES_MODEL, PORT
npm run doctor
npm run dev
```

Open **[http://127.0.0.1:8787](http://127.0.0.1:8787)**. The main UI is the AI dialog (not a competing URL form).

Firmware render (no Hermes, no network product page):

```bash
npm run render:fixture
```

Writes `data/jobs/fixture/video.mp4` via:

```bash
npx hyperframes@0.9.32 render <job-local template copy> \
  --output data/jobs/fixture/video.mp4 \
  --fps 30 \
  --variables-file data/jobs/fixture/variables.json \
  --strict-variables
```

## Compliance

This tool is only for pages you have the right to use. Do not crawl behind logins. Do not commit third-party product images or rendered MP4s. Trademarks and product content belong to their owners. The firmware uses redistributable placeholder images and copy.

## Main APIs (default port 8787)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/health` | ffmpeg, Hermes reachability, HyperFrames CLI (missing Hermes does not block fixture render) |
| `POST` | `/v1/chat` | Dialog understand → clarify → ready to confirm |
| `POST` | `/v1/chat/:sessionId/confirm` | Confirm, then enqueue a job |
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
src/templater/         VideoSpec → variables.json + local assets
src/renderer/          official CLI; render lock 1 + browser lock 1
templates/product-promo/   locked template (read-only at render time)
fixtures/              firmware VideoSpec + placeholder images
public/                AI dialog UI
scripts/               doctor + render:fixture
data/                  jobs, sessions, downloads, videos (gitignored)
```

## Locked motion

Do not change `data-duration` or segment starts: **0–1.125 / 1.125–10.5 / 10.5–15**. Intro/outro prefer logo + brand name, else main image + brand name. Audio MVP is silent.

## Fill path (official only)

1. Template declares `data-composition-variables`; nodes use `data-var-text` / `data-var-src` / `var(--id)` / `getVariables()`.
2. Server writes `variables.json` only (no Handlebars/EJS; Hermes never emits HTML).
3. Render with `--variables-file` and `--strict-variables`.

## Environment

See `.env.example`: `PORT`, `HERMES_BASE_URL`, `HERMES_MODEL`, `HYPERFRAMES_VERSION=0.9.32`, crawl/Hermes/render timeouts, `JOB_RETENTION`.
