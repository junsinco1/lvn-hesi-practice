# Nurse Review Practice WebApp — Banks v1.1

## What you asked for (implemented)
- **Multiple banks** ready for future content:
  - Compass A (1,000 questions)
  - NCLEX Review (1,000 questions)
  - Anatomy (blank)
  - Physiology (blank)
  - Labs (blank)
  - Pharmacology (blank)
  - MedSurg (blank)
- **Body systems dropdown** (or ANY)
- **Topic dropdown**
  - Compass A uses your **exact topic list**
  - Other banks default to ANY until those banks are populated
- **Timer per question** (Off / 30 / 45 / 60 / 90 / 120 seconds)
  - Auto-submits when time expires (counts as attempt)
- **Correct/Incorrect tracking**
  - Stored in localStorage (local to device/browser)
- **Badge system**
  - First Blood, streaks, XP milestones, exam finisher, 80% club
- **Exam flow**
  - Start 75Q exam, then automatically saves score to leaderboard on completion
- **Leaderboard**
  - Initials + score saved locally (top 20 shown)
- **NCLEX readiness gauge**
  - Accuracy + streak + XP boost (local estimate)
- **Theme customization**
  - Presets + accent colors
  - Saved to localStorage

## Folder contents
- `index.html`
- `styles.css`
- `app.js`
- `banks_manifest.json`
- `banks/compass_a.json` (present)
- `banks/nclex_review.json` (present)
- `banks/anatomy.json` (empty)
- `banks/physiology.json` (empty)
- `banks/labs.json` (empty)
- `banks/pharmacology.json` (empty)
- `banks/medsurg.json` (empty)

## Version
Banks v1.1


## v1.1 (Blueprint Exams)
- Compass A: 75Q exams are **weighted by your Compass A topic blueprint** when Bank=Compass A and Topic=ANY.
- Exam builder de-dupes questions and mixes clusters + singles.
