System Tab Taxonomy + Retagged Banks
Version: system-taxonomy-banks-v1
Date: 2026-02-01

Goal:
These files standardize the "System" dropdown categories to THIS list (exact labels):
- Cardiovascular
- Respiratory
- Neurologic
- Endocrine
- Renal/Urinary
- GI/Hepatic
- Musculoskeletal
- Integumentary/Wound
- Immune/Hematology
- Reproductive/OB
- Pediatrics/Growth & Development
- Psych/Mental Health
- Infectious Diseases/Micro
- Fluids & Electrolytes/Acid-Base
- Perioperative/Critical Care
- Community/Public Health
- Ethics/Legal/Professional
- Informatics/Quality,Safety

What you get:
- banks/system_taxonomy.json  (the dropdown list)
- Retagged question banks with consistent system/system_key fields:
  - banks/pharmacology.json   (1000)
  - banks/labs.json           (1000)
  - banks/medsurg.json        (1000)
  - banks/physiology_*.json   (10 files, total 1000)

Fields added/guaranteed on each question:
- system (one of the exact labels above)
- system_key (normalized slug for filtering)
- subcategory / subcategory_key (aliases)
- choices exists (prevents q.choices.forEach crashes)

Install:
1) Unzip.
2) Copy the entire /banks folder into your repo /banks folder (overwrite existing physiology/pharm/labs/medsurg files).
3) Refresh the app.
4) In your app, filter using system_key OR system/subcategory depending on how your filter is written.

If your UI reads a different field name for system filtering, tell me the exact field it checks and I'll mirror it too.
