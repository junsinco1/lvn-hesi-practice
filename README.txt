LVN HESI Practice Web App
Version: STABLE v1 (2026-01-31)
Goal: Replace broken builds with a known-good, non-caching, bulletproof loader.

WHAT THIS FIXES (code-level)
- Prevents startup crashes from null localStorage values (mastery/settings/leaderboard).
- Uses defer-loaded JS + DOMContentLoaded init (no missing element refs).
- No service worker at all (no caching logic or registration).
- Loader tries: questions_manifest.json (parts) -> fallback questions.json.
- Shows on-screen error box + captures uncaught errors and promise rejections.
- Diagnostics dialog performs fetch checks and prints statuses.

FILES INCLUDED
- index.html
- styles.css
- app.js
- manifest.json
- questions_manifest.json
- questions_part01.json  (sample)
- questions.json         (sample)

HOW TO DEPLOY (NO CODING)
1) Upload ALL files in this folder to your GitHub repo root (same place as index.html).
2) IMPORTANT: Remove service-worker.js from your repo (if present) so no SW can register.
3) Wait for GitHub Pages to finish building.
4) Open:
   https://junsinco1.github.io/lvn-hesi-practice/?v=999

HOW TO USE YOUR BIG BANK
- Keep this app.js/index.html/styles.css.
- Replace questions_manifest.json + questions_partXX.json files with your real chunks
  (or replace questions.json with your full bank).
- The loader will automatically prefer manifest+parts if present.

NOTES
- If you still see "Loading questions…" click Diagnostics.
  It will show fetch status codes for manifest/parts/questions.
