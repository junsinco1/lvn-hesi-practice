LVN HESI Practice Web App
Version: STABLE v1.2
Build: UI Fix – Case Tabs REALLY on Top

WHAT CHANGED
- Moved Case Tabs block (Case / Vitals / Nurse did / MD orders / Labs) to the TOP of the question card:
  directly under the Topic/Type/Difficulty header and ABOVE the stem and answer choices.
- Removed the redundant small “case preview” box so the chart tabs are the primary case view.
- Default open tab is now VITALS (more realistic chart-first workflow).

FILES INCLUDED
- index.html (updated layout)
- app.js (vitals tab default + safe guards)
- styles.css
- manifest.json
- questions_manifest.json
- questions_part01.json
- questions.json
- README.txt

DEPLOY (NO CODING)
1) Upload ALL files from this ZIP to your GitHub repo root (replace previous files).
2) Ensure service-worker.js is not in the repo.
3) Open with a hard refresh:
   https://junsinco1.github.io/lvn-hesi-practice/?v=999

NOTES
- No changes to question loading logic beyond safe-guarding removed elements.
- Exam/leaderboard/timer behavior unchanged.
