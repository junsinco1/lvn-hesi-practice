LVN HESI Practice Web App
Version: STABLE v1.7
Build: HARD BYPASS + Left Answer/Rationale

KEY FIX
- This build uses a NEW script filename: app_v1_7.js (so the browser cannot accidentally keep an older app.js).
- index_app.html now redirects to index.html so old links don't show an outdated UI.

UI CHANGE
- Submit + Show rationale + the answer/rationale output are in the LEFT column under Gamification.
- The Question tab shows stem + choices only.

FILES INCLUDED
- index.html (loads app_v1_7.js)
- index_app.html (redirect to index.html)
- app_v1_7.js
- styles.css
- manifest.json
- questions_manifest.json + questions_partXX.json
- questions.json (fallback)
- README.txt

DEPLOY (NO CODING)
1) Upload ALL files from this ZIP to your repo root (replace old files).
2) DELETE these from the repo root if they exist:
   - app.js
   - service-worker.js
3) Open:
   https://junsinco1.github.io/lvn-hesi-practice/index.html?v=999

HOW TO VERIFY YOU'RE ON v1.7
- Right-click → View Source: you must see 'app_v1_7.js'
- The Submit buttons should NOT be under the answers.
