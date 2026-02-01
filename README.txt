LVN HESI Practice WebApp v5.0 (Case Lock + Trending Vitals)

New:
1) Locked progressive cases:
   - If a question has case_group {id, sequence}, students must complete seq 1→2→3→4.
   - Practice mode will auto-serve the next required sequence for any incomplete case in the current filter pool.
   - Exam mode keeps case groups in order and does not split them.

2) Trending vitals:
   - If case.vitals is an array of time blocks, the Vitals tab shows ↑ ↓ → arrows compared to the previous time.

Deploy:
- Upload index.html, styles.css, app.js, questions.json, manifest.json, service-worker.js to GitHub Pages folder.
- Hard refresh / clear site data after updating (service worker).

Notes:
- Case progression is stored locally in localStorage key: lvn_case_progress_v5
