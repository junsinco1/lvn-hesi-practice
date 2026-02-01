# LVN HESI WebApp — Display Fix v1

## What this fixes
- Prevents crashes like: `undefined is not an object (evaluating 'q.choices.forEach')`
- Renders **Single**, **SATA**, and **NGN Bowtie** questions correctly.
- Shows **Case Tabs** when a question includes `case.tabs` (case study, vitals, labs, nurse did, MD orders).
- Counts what loaded: **Questions** and **Clusters** (grouped by `case_group.id` if present).

## Files included
- `index.html` (main page)
- `app.js` (robust loader + renderer)
- `styles.css` (clean theme)
- (You must provide) `questions.json` in the same folder

## Data requirements
Each question should be an object with:
- `id` (string)
- `topic` (string)
- `difficulty` (number)
- `qtype` = `single` | `sata` | `bowtie`
- `stem` (string)
- For single/sata: `choices` (array)
- For bowtie: `bowtie` object with left/middle/right options and answers
- Optional: `case.tabs` with keys: `case_study`, `vitals`, `labs`, `nursing_actions`, `md_orders`
- Optional clustering: `case_group: { id, sequence, total, title }`

## Deploy to GitHub Pages
Upload these files to the published folder (root), along with your `questions.json`.
No service worker is used in this build, so caching issues are minimized.

Version: v1
