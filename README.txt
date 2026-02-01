LVN HESI Practice Web App
Version: STABLE v1.10
Build: Fix Fatal Init Error (localStorage-safe) + initials input restored

WHAT WAS WRONG
- App crashed during init on some browsers when localStorage access throws (privacy/blocked storage).
- Also crashes if initials input is missing.

WHAT THIS FIX DOES
- Wrapes ALL localStorage reads/writes in try/catch (lsGet/lsSet helpers).
- Restores Initials input (#initialsInput).
- Loads new JS filename app_v1_10.js (prevents old JS from being used).

FILES
- index.html (uses app_v1_10.js; includes initials input)
- index_app.html (redirect)
- app_v1_10.js
- styles.css
- questions_manifest.json + parts (and questions.json fallback)
- README.txt

DEPLOY
Upload ALL files to repo root and DELETE older JS files if present:
- app_v1_7.js
- app.js
- service-worker.js

Open:
https://junsinco1.github.io/lvn-hesi-practice/index.html?v=999
