# FarazStudio v2 — Design Spec

**Date:** 2026-10-21
**Owner:** Faraz Ali (@thefarazalii)
**Goal:** Set up the existing RankReel-style Shorts maker on a new laptop and extend it into a
viral-Shorts production studio. Keep the current single-server Express + Remotion architecture
(no framework rewrite).

## Context (as found)
- `server.js` (Express, port 4545) + Remotion renderer. 3-tab UI: Studio / Templates / Queue.
- Per-clip trim (IN/OUT) and per-clip mute already exist in the engine (`item.muted`).
- `/api/link` already downloads via `python -m yt_dlp` — **broken on the new laptop** (`python`
  resolves to a hermes venv without yt-dlp).
- FFmpeg path **hardcoded to the old laptop** (`C:\Users\Administrator\...9.0.2`). New laptop has
  FFmpeg on PATH at `...Cyber World\...8.1.2`.
- Node 24, npm 11, pm2 7.0.3, git all present. Port 4545 free.

## Decisions (user-approved)
- Music: **no-attribution** monetization-safe pack.
- Viral tools: **all four** (captions, AI title/hashtags/desc, templates+transitions, hook+CTA).
- UI: **full modernize** of Studio, keep all features.
- Run: **PM2 autostart on 4545**, no `.bat`.
- AI generator: optional **Groq** API key in Settings, with a no-key built-in fallback.

## Phase 0 — Make it run (foundation)
- **FFmpeg resolver**: `FFMPEG_DIR` env → `where ffmpeg` → WinGet glob → bare `ffmpeg` on PATH.
- **Bundle `assets/bin/yt-dlp.exe`**, call directly (drop Python dependency). Self-update on boot.
- `npm install`; pre-run Remotion `ensureBrowser()`.
- `ecosystem.config.js` + `pm2 start/save` + logon scheduled task running `pm2 resurrect`.
- **Verify**: app opens at localhost:4545; a render completes.

## Phase 1 — Download + audio
- Harden `/api/link`: TikTok no-watermark (native via yt-dlp), Instagram reels/posts, best HD format.
  Robust progress + error surfacing. Support start/end trim sections.
- **Original-audio toggle**: prominent per-clip `Keep original sound / Mute`, plus import-time default.
  Music auto-ducks when a clip's sound is on (already built).

## Phase 2 — Music library (no-attribution)
- Download curated no-attribution tracks into `assets/music/`, grouped by mood (hype/cinematic/chill/funny).
- `/api/music` returns `{file, group, needsCredit}`. Kevin MacLeod set kept + labeled needs-credit.

## Phase 3 — Modernize Studio UI
- Clip cards (thumb + inline IN/OUT + audio switch + label + drag-to-rank), cleaner layout, live mini-preview.
- New Settings area (Groq key, caption defaults). All existing features preserved.

## Phase 4 — Viral tools
- **Auto-captions**: local whisper.cpp (`@remotion/install-whisper-cpp`), word-by-word burned-in, per-Short toggle + style.
- **AI title/hashtags/description**: Groq (optional key) with built-in fallback generator.
- **More templates + transitions**: extra presets + zoom/shake/flash/whip.
- **Hook + CTA end screen**: opening hook overlay + "Follow for more" end card.

## Non-goals
- No framework rewrite, no cloud rendering, no account system, no mobile app.
