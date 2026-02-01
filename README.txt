LVN HESI Practice Web App
Version: RECOVERY v3.1 (cache-bust filenames)
Build type: Recovery / Loader stability

WHAT THIS BUILD DOES
- Fixes 'stuck on Loading questions…' caused by stale cached HTML/JS on GitHub Pages/iOS Safari.
- Uses cache-busted filenames (index_v3_1.html + app_v3_1.js).
- Loads questions from questions_manifest.json + questions_part01–10.json.
- Adds no-store fetch + query-string cache busting in the loader (inside JS).

WHAT CHANGED FROM PREVIOUS VERSION (v3)
- Renamed index_app.html -> index_v3_1.html
- Renamed app.js -> app_v3_1.js
- index.html now redirects to index_v3_1.html to force a fresh load.

FILES INCLUDED (contents of this ZIP)
- README_RECOVERY.txt
- app_v3_1.js
- index.html
- index_v3_1.html
- manifest.json
- questions_manifest.json
- questions_part01.json
- questions_part02.json
- questions_part03.json
- questions_part04.json
- questions_part05.json
- questions_part06.json
- questions_part07.json
- questions_part08.json
- questions_part09.json
- questions_part10.json

HOW TO DEPLOY (NO CODING)
1) In GitHub repo: delete any old service-worker.js if present (and commit).
2) Upload ALL files from this ZIP into the SAME GitHub Pages folder (repo root).
3) After Pages rebuilds, open this URL (copy/paste):
   https://junsinco1.github.io/lvn-hesi-practice/index_v3_1.html?v=999

QUICK FILE CHECK (open these directly; they must NOT 404):
 - https://junsinco1.github.io/lvn-hesi-practice/questions_manifest.json?v=999
 - https://junsinco1.github.io/lvn-hesi-practice/questions_part01.json?v=999
 - https://junsinco1.github.io/lvn-hesi-practice/app_v3_1.js?v=999

IF IT'S STILL STUCK
- Open the app and click Diagnostics; copy the 'Load errors' lines.
- On iOS: Settings > Safari > Advanced > Website Data > delete 'junsinco1.github.io' then reload.

KNOWN NOTES
- This build does not use a Service Worker (intentionally) to avoid caching issues on iOS/Safari.