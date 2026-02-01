v5.2 NO SERVICE WORKER

This build disables service-worker caching entirely to stop old assets from overriding new deployments.
Deploy: upload ALL files (index.html, app.js, styles.css, manifest.json, questions_manifest.json, questions_part01..10.json, service-worker.js).
Then simply refresh (no special cache clear needed, though browser cache can still be cleared if desired).
