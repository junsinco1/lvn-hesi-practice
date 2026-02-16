# LVN HESI Practice — Med-Surg (925+)

A lightweight, offline-friendly web app for LVN/HESI-style practice and exams using **extremely hard** question banks.

This build includes the **Med‑Surg** bank updated from your system documents and contains **all available questions (currently ~925)** — **no 500-question cap**.

---

## What’s included

- **Question types**
  - **Standard** (single best answer)
  - **SATA** (select all that apply)
  - **BOWTIE** (NGN-style bowtie decision)

- **Filters**
  - **Bank**
  - **Body System**
  - **Topic**
  - **Question Type**

- **Modes**
  - **Practice**: Next Practice loads a new question from the filtered pool.
  - **Exam**: Student selects a **numeric question count** and the app generates an exam from the filtered pool.
    - If the requested exam length is **greater than the available filtered pool**, the exam will include **all unique questions first**, then **repeat** questions to reach the requested count.

- **Timer**
  - Timer selection stays available and works in both modes.

- **Leaderboard / scoring**
  - Exam results save locally (browser storage) with initials and percent.

---

## Quick start (local)

### Option A — simplest (no install)
1. Unzip the project.
2. Open `index.html` in your browser.

> Some browsers restrict local file loading. If the banks don’t load, use Option B.

### Option B — run a tiny local server (recommended)
From the unzipped folder:

**Python**
```bash
python -m http.server 8000
```

Then open:
- `http://localhost:8000`

---

## Folder structure

- `index.html` — UI
- `styles.css` — styling
- `app.js` — logic (filters, timer, practice/exam modes)
- `banks_manifest.json` — list of available banks
- `banks/` — bank JSON files (question data)
- `ANATOMY_QUESTION_RULES.md` — question-writing rules baseline (still included)

---

## Question data format (bank JSON)

Each bank file in `banks/` contains an array of question objects.

Common fields used by the app:
- `bank` (string) — bank name (e.g., `"MedSurg"`)
- `system` (string) — body system (e.g., `"Cardiovascular"`)
- `topic` (string) — topic tag (e.g., `"ACS vs Dissection vs PE"`)
- `qtype` (string) — `"standard" | "sata" | "bowtie"`
- `stem` (string) — the question
- `choices` (array) — answer choices (for standard/SATA)
- `answer` (varies) — correct answer(s) (app expects the bank’s schema consistently)

> If you add or modify banks, keep the schema consistent within each bank file.

---

## Updating / adding questions

1. Add or edit a bank JSON file inside `banks/`.
2. Update `banks_manifest.json` to include the bank (if it’s new).
3. Refresh the page.

**Hardness rule:** This app assumes a single difficulty level — **Extremely Hard** — and does not use a difficulty filter.

---

## Removed / not included

- **Compass A**
- **Compass B**
- **NCLEX**
- **Old fixed 75‑question exam button** (replaced by numeric exam count)

---

## Notes

- This app stores settings and leaderboard locally in the browser (no server, no database).
- Works best in Chrome/Edge; Safari may require running via a local server.



## Physiology Bank

- New **system-based** Physiology bank (Extremely Hard).
- Filters: **Body System** + **Topic**.
- Current build includes the first Cardiovascular physiology set; additional systems will be added in the same format.
- Rules: see `PHYSIOLOGY_QUESTION_RULES.md`.

## Physiology Bank (Work in Progress)

- Current physiology bank included in this build: **25 questions** (starter set).
- Next batches will be appended using the same rules (system-based, extremely hard, Standard/SATA/Bowtie).

