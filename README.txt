Physiology Bank (By System) — FILTER FIX
Version: physiology-system-1000-v2-filterfix
Date: 2026-02-01

What changed:
- Every question now includes BOTH:
  - system_key (normalized): one of cardiovascular, respiratory, renal, neuro, endocrine, gi, immune, reproductive, acidbase, thermo
  - system (display label)
- Added common aliases used by filters: subcategory/subcategory_key, category/category_key, bank_key
- Ensured choices array exists so UIs that assume q.choices do not crash.

Files:
- banks/physiology_systems_manifest.json
- banks/physiology_<system>.json (10 files; 100 questions each; total 1000)

Install:
1) Unzip into your repo, merging the /banks folder (overwrite existing physiology_* files).
2) Refresh the app.
3) Use the System dropdown to filter (it should match system or system_key depending on your UI).
