# Compass A Question Bank v2 (1000)

## What changed (high-level)
This bank was rebuilt to **reduce repetition** across question types and to make **answer choices meaningfully different**.

Key upgrades:
- **Multiple stem archetypes** (not the same “priority finding” wording over and over).
- **SATA variety** (interventions, expected vs unexpected, teaching, documentation, order clarification, risk of deterioration).
- **Bowtie fixed**: answers always match options; options vary; no “defaulting” to the correct answer.
- **Case-tabs for most questions**: case study + vitals + labs + nursing actions + MD orders.
- **Lab panels vary by system/condition** (not the same labs repeated).

## Files
- `compass_a_v2_1000.json` — drop-in replacement bank (1000 questions)
- `CompassA_v2_REPORT.txt` — quick counts/verification

## Notes for your web app
- Keep the filename exactly as your app expects (rename to `compass_a.json` if needed).
- This bank keeps the same schema your app has been using:
  - `qtype` = `single` | `sata` | `bowtie`
  - `case.tabs` includes: `case_study`, `vitals`, `labs`, `nursing_actions`, `md_orders`
  - Bowties use `bowtie` + `answer` as `{left, middle, right}`
