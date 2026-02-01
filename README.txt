LVN HESI Practice Web App
Version: STABLE v1.9
Build: Fix "Fatal error during initialization" + Initials field restored

WHAT WAS WRONG
- app_v1_7.js expects an element with id="initialsInput".
- In v1.8 layout rebuild, that input was accidentally removed, causing init() to crash.

WHAT THIS FIX DOES
- Adds back the Initials input (left column) so leaderboard initials work.
- Adds safe guards in JS so missing initialsInput will NOT crash again.

DEPLOY
1) Upload ALL files in this ZIP to your repo root (replace old).
2) Open:
   https://junsinco1.github.io/lvn-hesi-practice/index.html?v=999
