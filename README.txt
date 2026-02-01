LVN HESI Practice Web App
Version: STABLE v1.8
Build: Clean Layout Fix (undo the broken v1.7 layout)

WHAT WAS BROKEN
- The v1.7 HTML structure placed the Question card and Answer panel in the wrong columns.

WHAT THIS FIX DOES
- Left column: filters/buttons + Gamification + Answer (Submit/Show rationale) + Rationale output.
- Right column: Question/Case/Vitals/Nurse/MD Orders/Labs tabs with Question default.
- No Submit buttons appear under the answers anymore.

FILES INCLUDED
- index.html (clean layout)
- index_app.html (redirect)
- app_v1_7.js
- styles.css
- manifest.json
- questions_manifest.json + parts
- questions.json (fallback)
- README.txt

DEPLOY (NO CODING)
1) Upload ALL files from this ZIP to repo root (replace old).
2) Delete app.js if it exists (site uses app_v1_7.js).
3) Open:
   https://junsinco1.github.io/lvn-hesi-practice/index.html?v=999
