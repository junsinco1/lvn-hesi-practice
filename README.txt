LVN HESI Practice Web App
Version: STABLE v1.11
Build: Fix initials crash (missing #initialsInput)

WHAT WAS WRONG
- App crashed on load because app_v1_10.js wrote to #initialsInput, but the HTML did not include it.

FIX
- Added the Initials input back into the left panel (under Accent).
- Added JS guards so the app will NOT crash if the initials input is ever missing again.
- New JS filename: app_v1_11.js

FILES
- index.html (now includes #initialsInput and loads app_v1_11.js)
- app_v1_11.js
- styles.css + rest of existing files (questions manifest/parts)

DEPLOY
Upload all files in this ZIP to your repo root (replace older files).
Delete app_v1_10.js if it still exists in the repo.
Open:
https://junsinco1.github.io/lvn-hesi-practice/index.html?v=999
