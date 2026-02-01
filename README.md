Working Version Patch — Hide System/Topic/Difficulty
Version: nofilters-ui-hide-v1
Date: 2026-02-01

What changed:
- ONLY index.html was modified.
- The System, Topic, and Difficulty dropdown UI blocks were hidden by adding style="display:none" to their existing <label class="field"> wrappers.
- The underlying <select> elements and their IDs remain in the DOM so app.js remains unchanged and question loading behavior stays identical.

Files included:
- index.html (modified)
- app.js (unchanged)
- styles.css (unchanged)
- banks_manifest.json (unchanged)
