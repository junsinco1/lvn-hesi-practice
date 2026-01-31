LVN HESI Practice – Web App (v1)

This is a STATIC web app that runs on iOS/Android/Mac/Windows in a browser.

IMPORTANT
- You must open it via http(s). If you double-click index.html (file://),
  the browser may block loading questions.json.

RUN LOCALLY (Mac)
1) Unzip folder
2) Terminal:
   cd /path/to/folder
   python3 -m http.server 8000
3) Open:
   http://localhost:8000

RUN LOCALLY (Windows)
1) Unzip folder
2) PowerShell:
   cd C:\path\to\folder
   py -m http.server 8000
3) Open:
   http://localhost:8000

INSTALL-LIKE ON iPhone/iPad
- Open the hosted URL in Safari
- Share → Add to Home Screen

FEATURES
- Practice: no repeats until filtered pool exhausted (then new cycle)
- 75Q Exam: mix of standalone + progressive case groups; no duplicate IDs
- Case tabs: Case Study / Vitals / Nurse Actions / Provider Orders
- Question types: Single, SATA (strict), Bowtie
- Negative wording warning
- Timer per question
- Leaderboard saved to this device (localStorage)
