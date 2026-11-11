# Lioran—Tokyo

Local service: open an AI dialog, confirm the request, crawl **any public page URL** you have the right to use (not only product PDPs), ask Hermes for **VideoSpec JSON only**, fill the official HyperFrames **`product-promo`** template through official variables, and render a **silent 9:16 (1080×1920 @ 30fps) MP4**. Incomplete pages soft-fill existing slots (no new slots; locked 15s timeline unchanged). A later “change one line” reuses the last VideoSpec (no recrawl) and re-renders; the old MP4 is kept.

Pinned renderer: **`hyperframes@0.9.32`** (do not bump).

UI standard: **`AESTHETICS.md`** (2026-11-11, fix-0.1) — P5 chat window matches a **Grok-standard** layout and interaction (sidebar, calm empty canvas, pill composer, full-width assistant bubbles + action toolbar). Product identity stays **Lioran—Tokyo** (confirmed rounded-square mark on favicon, sidebar, and top bar); no Grok/xAI protected assets or reskin. Code substrate may still draw from [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui) parts in `ui/chat-window/` (MIT). Chrome, prompts, and buttons are **Chinese/English bilingual** (language switch; default Chinese first). Chat UI self-hosts **Noto Sans SC** (from `templates/product-promo` fonts; no Google Fonts). On-video text still follows the product-page language. Film fill stays on official HyperFrames variables via `--variables-file` / `--strict-variables`.

## Template (this round)

Chat and confirm jobs use **`product-promo` only** (official 15s fill-in template; do not alter `templates/product-promo/`).

Four community template directories may exist on the tree from an earlier merge (`cinematic-product`, `kinetic-typo`, `brand-story`, `social-ad`). They stay on disk **on hold** — not offered in chat this round.

Firmware (Hermes not required):

```bash
npm run render:fixture                 # product-promo → data/jobs/fixture/video.mp4
```

Do not commit the MP4s.

## Requirements

- Node.js 20+
- **FFmpeg** and **ffprobe** on `PATH`  
  - Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y ffmpeg`  
  - macOS: `brew install ffmpeg`
- **Chrome / Chromium** (Crawlee crawl + HyperFrames render)  
  - Auto-detected from common paths / `PATH` when possible  
  - If auto-detect fails (Puppeteer “Failed to launch browser”), set `CHROME_PATH` in `.env` to the browser binary, e.g. `CHROME_PATH=/usr/bin/google-chrome-stable`
- **Hermes / AlinGPT** already deployed on this machine from [Jianheng71/Lioran](https://github.com/Jianheng71/Lioran) (one-time host setup; do **not** vendor a model here)  
  - Default `HERMES_BASE_URL=http://127.0.0.1:43127` (`hermes3:8b`)  
  - Doctor probes `GET /v1/models`  
  - If that address returns **HTTP 404**, something else is usually bound on the port, or Hermes is not serving `/v1/models` — start the Lioran Hermes stack or fix `HERMES_BASE_URL`  
  - `npm run render:fixture` and fixture-related health still work without Hermes (`fixtureRenderRequiresHermes: false`). Confirmed chat jobs that need the model require a healthy Hermes.

`npm run doctor` prints concrete install / path hints for the checks above.

## Clone → install → env → doctor → dev

```bash
git clone https://github.com/Jianheng71/Lioran-Tokyo.git
cd Lioran-Tokyo
npm install
cp .env.example .env
# Optional: CHROME_PATH=/usr/bin/google-chrome-stable
# HERMES_BASE_URL defaults to http://127.0.0.1:43127
npm run doctor
npm run dev
```

Open **[http://127.0.0.1:8787](http://127.0.0.1:8787)**. The main UI is the AI dialog (not a competing URL form).

## Compliance

This tool is only for pages you have the right to use. Do not crawl behind logins. Do not commit third-party product images or rendered MP4s. Trademarks and product content belong to their owners. The firmware uses redistributable placeholder images and copy.

## Main APIs (default port 8787)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/health` | ffmpeg, Chrome, Hermes reachability, HyperFrames CLI (missing Hermes does not block fixture render) |
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
src/templater/         VideoSpec → variables.json + local assets
src/chrome.ts          Chrome/Chromium auto-detect + CHROME_PATH
src/renderer/          official CLI; render lock 1 + browser lock 1
templates/product-promo/   official template this round (do not alter)
templates/*/               community copies may exist on disk; chat does not offer them yet
fixtures/              firmware VideoSpec + placeholder images
public/                Grok-standard chat window (static, served by Hono)
ui/chat-window/        upstream chat parts + SOURCE.md (Jakob Hoeg Mørk, MIT)
AESTHETICS.md          P5 UI + 0.1 fix governor lock (authoritative)
scripts/               doctor + render:fixture*
data/                  jobs, sessions, downloads, videos (gitignored)
```

## Locked motion (`product-promo`)

Do not change `data-duration` or segment starts: **0–1.125 / 1.125–10.5 / 10.5–15**. Intro/outro prefer logo + brand name, else main image + brand name. Audio MVP is silent. Keep Noto Sans SC for on-screen CJK.

## Fill path (official only)

1. Template declares `data-composition-variables`; nodes use `data-var-text` / `data-var-src` / `var(--id)` / `getVariables()`.
2. Server writes `variables.json` only (no Handlebars/EJS; Hermes never emits HTML).
3. Render with `--variables-file` and `--strict-variables` against a job-local copy of `product-promo`.

## Environment

See `.env.example`: `PORT`, `HERMES_BASE_URL` (reuse Lioran Hermes), `HERMES_MODEL`, `HYPERFRAMES_VERSION=0.9.32`, `CHROME_PATH` (optional override), crawl/Hermes/render timeouts, `JOB_RETENTION`.
