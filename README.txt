LVN HESI Practice WebApp v4.2 DIAGNOSTIC

This build fixes the most common GitHub Pages problems:
- Service worker caching old broken app.js (cache name bumped to v4-2)
- Script cache-busting: app.js?v=42
- Better error details for questions.json fetch/parse failures
- Diagnostics button shows exact URLs used

Deploy:
Upload ALL files in this zip to the SAME GitHub Pages folder:
index.html, styles.css, app.js, questions.json, manifest.json, service-worker.js

Then:
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- If iPhone: Settings > Safari > Advanced > Website Data > delete your site
