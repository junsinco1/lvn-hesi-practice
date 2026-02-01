// LVN HESI Practice WebApp v4.1 (fixed buttons + full logic)
"use strict";

// Visible error overlay for debugging (shows JS errors on screen)
(function(){
  function ensure(){
    let d=document.getElementById("errOverlay");
    if(!d){
      d=document.createElement("div");
      d.id="errOverlay";
      d.style.position="fixed";
      d.style.left="12px";
      d.style.right="12px";
      d.style.bottom="12px";
      d.style.zIndex="99999";
      d.style.padding="10px 12px";
      d.style.borderRadius="14px";
      d.style.border="1px solid rgba(255,0,0,.45)";
      d.style.background="rgba(0,0,0,.78)";
      d.style.color="#fff";
      d.style.fontSize="12px";
      d.style.whiteSpace="pre-wrap";
      d.style.display="none";
      document.body.appendChild(d);
    }
    return d;
  }
  window.addEventListener("error", (e)=>{
    const d=ensure();
    d.style.display="block";
    d.textContent = "JS Error:\n" + (e.message||e.error||"unknown") + "\n" + (e.filename||"") + ":" + (e.lineno||"");
  });
  window.addEventListener("unhandledrejection", (e)=>{
    const d=ensure();
    d.style.display="block";
    d.textContent = "Promise Rejection:\n" + (e.reason && e.reason.message ? e.reason.message : String(e.reason));
  });
})();

// ---------- Storage keys ----------
const LS_THEME   = "lvn_theme_v4";
const LS_FONT    = "lvn_font_v4";
const LS_HC      = "lvn_hicontrast_v4";
const LS_SCORING = "lvn_scoring_v4";
const LS_TIMER   = "lvn_timer_v4";
const LS_SCORES  = "lvn_scores_v4";
const LS_MASTERY = "lvn_mastery_v4";
const LS_BADGES  = "lvn_badges_v4";
const LS_EXAMCODE= "lvn_exam_code_v4";
const LS_INSTR   = "lvn_instructor_unlocked_v4";
const LS_INSTR_CODE = "lvn_instructor_code_v4";

// ---------- Themes ----------
const THEMES = {
  dark:   { bg:"#0b1020", card:"#121a33", muted:"#9fb0d0", text:"#e8eefc", accent:"#66d9ff", danger:"#ff6b6b" },
  purple: { bg:"#120b20", card:"#1a1233", muted:"#b6a9d0", text:"#f0ebff", accent:"#b88cff", danger:"#ff7a7a" },
  green:  { bg:"#0b1a14", card:"#0f2a1f", muted:"#8fd1b5", text:"#eafff6", accent:"#6dffb3", danger:"#ff6b6b" },
  light:  { bg:"#f5f7fb", card:"#ffffff", muted:"#5f6c85", text:"#1a1f2e", accent:"#2f7cff", danger:"#d92d20" }
};

// ---------- Deterministic RNG helpers (for exam codes) ----------
function hashStringToSeed(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleInPlace(arr, rand=Math.random){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rand() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- DOM ----------
const el = (id)=>document.getElementById(id);
const ui = {
  topicSelect: el("topicSelect"),
  diffSelect: el("diffSelect"),
  typeSelect: el("typeSelect"),
  themeSelect: el("themeSelect"),
  fontSelect: el("fontSelect"),
  hiContrast: el("hiContrast"),
  scoringSelect: el("scoringSelect"),
  timerSelect: el("timerSelect"),

  btnPractice: el("btnPractice"),
  btnStartExam: el("btnStartExam"),
  btnExamCode: el("btnExamCode"),
  btnFocusWeak: el("btnFocusWeak"),
  btnLeaderboard: el("btnLeaderboard"),
  btnExport: el("btnExport"),
  btnReset: el("btnReset"),
  btnDiag: el("btnDiag"),

  qTag: el("qTag"),
  qTopic: el("qTopic"),
  qWarn: el("qWarn"),
  qStem: el("qStem"),

  bowtieWrap: el("bowtieWrap"),
  bowLeft: el("bowLeft"),
  bowMid: el("bowMid"),
  bowRight: el("bowRight"),

  optionsWrap: el("optionsWrap"),
  btnSubmit: el("btnSubmit"),
  btnShowRationale: el("btnShowRationale"),
  scoreLine: el("scoreLine"),

  pane_case: el("pane_case"),
  pane_vitals: el("pane_vitals"),
  pane_nurse: el("pane_nurse"),
  pane_orders: el("pane_orders"),
  pane_rationale: el("pane_rationale"),

  masteryLine: el("masteryLine"),
  streakLine: el("streakLine"),
  badgesLine: el("badgesLine"),
  modeLine: el("modeLine"),
  timerLine: el("timerLine"),

  dlg: el("dlg"),
  dlgTitle: el("dlgTitle"),
  dlgBody: el("dlgBody"),

  dlgExamCode: el("dlgExamCode"),
  examCodeInput: el("examCodeInput"),

  dlgInstructor: el("dlgInstructor"),
  instrCodeInput: el("instrCodeInput"),
};

const tabs = Array.from(document.querySelectorAll(".tab"));
tabs.forEach(t=>t.addEventListener("click", ()=>setTab(t.dataset.tab)));

function setTab(name){
  tabs.forEach(t=>t.classList.toggle("active", t.dataset.tab===name));
  ["case","vitals","nurse","orders","rationale"].forEach(k=>{
    el("pane_"+k).classList.toggle("hidden", k!==name);
  });
}

// ---------- App state ----------
let QUESTIONS = [];
let mode = "practice";            // practice | exam
let examQueue = [];
let current = null;               // question object
let currentAnswer = null;         // user's selected answer in normalized form
let timerSeconds = 0;
let timerRemaining = 0;
let timerHandle = null;

let scorePoints = 0;              // points achieved
let scoreMax = 0;                 // max points possible
let missedIds = new Set();        // across session

let focusWeak = false;
let examCode = "";
let scoringMode = "strict";       // strict|partial

let mastery = {};                 // {topic:{attempts,correct}}
let badges = { earned:{} };
let streak = 0;

// ---------- Utilities ----------
function safeJsonParse(raw, fallback){
  try{
    const v = JSON.parse(raw);
    return (v===null || v===undefined) ? fallback : v;
  }catch{
    return fallback;
  }
}
function showDialog(title, body){
  ui.dlgTitle.textContent = title;
  ui.dlgBody.textContent = body;
  ui.dlg.showModal();
}
function normalizeTopic(t){ return (t || "Untitled").trim() || "Untitled"; }
function isNegativeStem(stem){
  const s = (stem||"").toLowerCase();
  return s.includes("not ") || s.includes("except") || s.includes("avoid") || s.includes("contraindicated") || s.includes("least appropriate");
}
function formatBlock(x){
  if(!x) return "—";
  if(typeof x === "string") return x.trim() || "—";
  if(Array.isArray(x)) return x.map(v=>String(v)).join("\n");
  if(typeof x === "object"){
    return Object.entries(x).map(([k,v])=>`${k}: ${v}`).join("\n");
  }
  return String(x);
}
function formatVitals(v){
  if(!v) return "—";
  if(Array.isArray(v)){
    const blocks = v.map(item=>{
      const t = item.time ? `Time: ${item.time}\n` : "";
      const vit = item.vitals && typeof item.vitals==="object"
        ? Object.entries(item.vitals).map(([k,val])=>`${k}: ${val}`).join("\n")
        : "";
      return (t+vit).trim();
    }).filter(Boolean);
    return blocks.length ? blocks.join("\n\n---\n\n") : "—";
  }
  return formatBlock(v);
}

// ---------- Persistence ----------
function loadScores(){
  const raw = localStorage.getItem(LS_SCORES);
  return safeJsonParse(raw, []);
}
function saveScores(scores){
  localStorage.setItem(LS_SCORES, JSON.stringify(scores));
}
function loadMastery(){
  return safeJsonParse(localStorage.getItem(LS_MASTERY), {});
}
function saveMastery(m){
  localStorage.setItem(LS_MASTERY, JSON.stringify(m));
}
function loadBadges(){
  return safeJsonParse(localStorage.getItem(LS_BADGES), { earned:{} });
}
function saveBadges(b){
  localStorage.setItem(LS_BADGES, JSON.stringify(b));
}

// ---------- Theming / accessibility ----------
function applyTheme(name){
  const t = THEMES[name] || THEMES.dark;
  const r = document.documentElement.style;
  r.setProperty("--bg", t.bg);
  r.setProperty("--card", t.card);
  r.setProperty("--muted", t.muted);
  r.setProperty("--text", t.text);
  r.setProperty("--accent", t.accent);
  r.setProperty("--danger", t.danger);
  localStorage.setItem(LS_THEME, name);
}
function applyFont(scale){
  document.documentElement.style.setProperty("--fontScale", scale);
  localStorage.setItem(LS_FONT, scale);
}
function applyHighContrast(on){
  document.body.classList.toggle("hicontrast", !!on);
  localStorage.setItem(LS_HC, on ? "1" : "0");
}
function applyScoring(mode){
  scoringMode = (mode==="partial") ? "partial" : "strict";
  localStorage.setItem(LS_SCORING, scoringMode);
}

// ---------- Mastery + dashboard ----------
function masteryLabel(pct){
  if(pct === null) return "—";
  if(pct < 60) return "Red";
  if(pct < 80) return "Yellow";
  return "Green";
}
function topicPct(topic){
  const m = mastery[topic];
  if(!m || !m.attempts) return null;
  return (m.correct||0) / Math.max(1,m.attempts) * 100;
}
function computeMasterySummary(){
  if(!mastery || typeof mastery !== "object") return { pct:null, red:0, yellow:0, green:0 };
  const topics = Object.keys(mastery);
  if(!topics.length) return { pct:null, red:0, yellow:0, green:0 };
  let totalAttempts=0, totalCorrect=0, red=0,yellow=0,green=0;
  for(const t of topics){
    const m = mastery[t];
    if(!m || !m.attempts) continue;
    totalAttempts += m.attempts;
    totalCorrect += (m.correct||0);
    const pct = (m.correct||0)/Math.max(1,m.attempts)*100;
    const lab = masteryLabel(pct);
    if(lab==="Red") red++;
    else if(lab==="Yellow") yellow++;
    else if(lab==="Green") green++;
  }
  const pct = totalCorrect / Math.max(1,totalAttempts) * 100;
  return { pct, red, yellow, green };
}
function updateDashboard(){
  const s = computeMasterySummary();
  ui.masteryLine.textContent = (s.pct===null) ? "—" : `${Math.round(s.pct)}% • Red ${s.red} • Yellow ${s.yellow} • Green ${s.green}`;
  ui.streakLine.textContent = String(streak);
  const earned = Object.keys((badges && badges.earned) ? badges.earned : {});
  ui.badgesLine.textContent = earned.length ? earned.slice(0,5).join(", ") + (earned.length>5?"…":"") : "—";
  ui.modeLine.textContent = (mode==="exam") ? "Exam" : (focusWeak ? "Practice (Focus Weak)" : "Practice");
  ui.timerLine.textContent = timerSeconds ? `${timerSeconds}s` : "Off";
}

// ---------- Question selection / filtering ----------
function filteredPool(){
  const topic = ui.topicSelect.value || "All";
  const diff = ui.diffSelect.value || "any";
  const qtype = ui.typeSelect.value || "any";

  return QUESTIONS.filter(q=>{
    if(topic !== "All" && normalizeTopic(q.topic) !== topic) return false;
    if(diff !== "any" && (q.difficulty||"any") !== diff) return false;
    if(qtype !== "any" && (q.qtype||"single") !== qtype) return false;
    return true;
  });
}
function weightForQuestion(q){
  let w = 1.0;
  const topic = normalizeTopic(q.topic);
  const pct = topicPct(topic);
  if(pct === null) w *= 1.2;
  else if(pct < 60) w *= 2.4;
  else if(pct < 80) w *= 1.6;

  if(missedIds.has(q.id)) w *= 1.8;
  return w;
}
function weightedPick(arr, rand=Math.random){
  const weights = arr.map(weightForQuestion);
  const sum = weights.reduce((a,b)=>a+b,0);
  let r = rand()*sum;
  for(let i=0;i<arr.length;i++){
    r -= weights[i];
    if(r<=0) return arr[i];
  }
  return arr[arr.length-1];
}
function pickPracticeQuestion(){
  const pool = filteredPool();
  if(!pool.length) return null;

  // avoid repeats until pool exhausted for current filter
  const unseen = pool.filter(q=>!q._seen);
  const pickFrom = unseen.length ? unseen : pool;
  const q = focusWeak ? weightedPick(pickFrom) : pickFrom[Math.floor(Math.random()*pickFrom.length)];

  // mark seen for current filter/session
  q._seen = true;
  return q;
}
function buildExamQueue(pool, seedCode=""){
  const unique = [];
  const seen = new Set();
  for(const q of pool){
    const id = q.id || (q.stem ? (normalizeTopic(q.topic)+"|"+q.stem).slice(0,120) : Math.random().toString(36).slice(2));
    q.id = id;
    if(!seen.has(id)){
      seen.add(id);
      unique.push(q);
    }
  }
  // deterministic shuffle if seedCode
  let rand = Math.random;
  if(seedCode){
    const seed = hashStringToSeed(seedCode);
    rand = mulberry32(seed);
  }
  const shuffled = shuffleInPlace(unique.slice(), rand);
  return shuffled.slice(0,75);
}

// ---------- Render question ----------
function clearAnswerUI(){
  ui.optionsWrap.innerHTML = "";
  ui.bowtieWrap.classList.add("hidden");
  ui.btnSubmit.disabled = true;
  ui.btnShowRationale.disabled = true;
  ui.pane_rationale.textContent = "—";
  currentAnswer = null;
}
function renderTabs(q){
  const c = q.case || q.case_study || {};
  ui.pane_case.textContent   = formatBlock(c.case || c.text || q.case_text || "—");
  ui.pane_vitals.textContent = formatVitals(c.vitals || q.vitals || "—");
  ui.pane_nurse.textContent  = formatBlock(c.nurse || c.nurse_actions || q.nurse_actions || "—");
  ui.pane_orders.textContent = formatBlock(c.orders || c.provider_orders || q.provider_orders || "—");
}
function renderQuestion(q){
  current = q;
  clearAnswerUI();

  const topic = normalizeTopic(q.topic);
  ui.qTopic.textContent = topic;
  ui.qTag.textContent = (mode==="exam" ? "EXAM" : "PRACTICE") + ` • ${(q.qtype||"single").toUpperCase()} • ${(q.difficulty||"any").replace("_"," ")}`;
  ui.qStem.textContent = q.stem || "—";

  ui.qWarn.textContent = isNegativeStem(q.stem) ? "NEGATIVE WORDING — read carefully" : "";

  renderTabs(q);
  setTab("case");

  if((q.qtype||"single")==="bowtie"){
    renderBowtie(q);
  }else{
    renderOptions(q);
  }

  startTimer();
  updateScoreLine();
  updateDashboard();
}
function renderOptions(q){
  const isSATA = (q.qtype||"single")==="sata";
  const name = "opt";
  (q.options||[]).forEach((opt, idx)=>{
    const id = `opt_${idx}`;
    const row = document.createElement("label");
    row.className = "opt";
    const input = document.createElement("input");
    input.type = isSATA ? "checkbox" : "radio";
    input.name = name;
    input.value = opt;
    input.id = id;
    input.addEventListener("change", collectAnswer);
    const txt = document.createElement("div");
    txt.className = "txt";
    txt.textContent = opt;
    row.appendChild(input);
    row.appendChild(txt);
    ui.optionsWrap.appendChild(row);
  });
}
function renderBowtie(q){
  ui.bowtieWrap.classList.remove("hidden");
  ui.optionsWrap.innerHTML = "";
  const b = q.bowtie || {};
  const left = b.left_options || [];
  const mid  = b.middle_options || [];
  const right= b.right_options || [];
  fillSelect(ui.bowLeft, left);
  fillSelect(ui.bowMid, mid);
  fillSelect(ui.bowRight, right);

  ui.bowLeft.addEventListener("change", collectAnswer);
  ui.bowMid.addEventListener("change", collectAnswer);
  ui.bowRight.addEventListener("change", collectAnswer);
}
function fillSelect(sel, options){
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select —";
  sel.appendChild(ph);
  options.forEach(o=>{
    const op = document.createElement("option");
    op.value = o;
    op.textContent = o;
    sel.appendChild(op);
  });
}

// ---------- Answering / scoring ----------
function collectAnswer(){
  if(!current) return;
  const qt = current.qtype || "single";
  if(qt==="bowtie"){
    currentAnswer = {
      left: ui.bowLeft.value || "",
      middle: ui.bowMid.value || "",
      right: ui.bowRight.value || ""
    };
    ui.btnSubmit.disabled = !(currentAnswer.left && currentAnswer.middle && currentAnswer.right);
    return;
  }
  if(qt==="sata"){
    const vals = Array.from(ui.optionsWrap.querySelectorAll("input[type=checkbox]:checked")).map(i=>i.value);
    currentAnswer = vals;
    ui.btnSubmit.disabled = vals.length===0;
    return;
  }
  // single
  const pick = ui.optionsWrap.querySelector("input[type=radio]:checked");
  currentAnswer = pick ? pick.value : null;
  ui.btnSubmit.disabled = !currentAnswer;
}
function scoreCurrent(){
  // returns {points,max,correct}
  const qt = current.qtype || "single";
  if(scoringMode==="strict"){
    const ok = isCorrectStrict();
    return { points: ok?1:0, max:1, correct: ok };
  }
  // partial
  if(qt==="single"){
    const ok = (currentAnswer === current.answer);
    return { points: ok?1:0, max:1, correct: ok };
  }
  if(qt==="sata"){
    const correctSet = new Set(Array.isArray(current.answer)?current.answer:[]);
    const userSet = new Set(Array.isArray(currentAnswer)?currentAnswer:[]);
    let tp=0, fp=0;
    for(const v of userSet){ if(correctSet.has(v)) tp++; else fp++; }
    const raw = tp - fp;
    const max = Math.max(1, correctSet.size);
    const points = Math.max(0, Math.min(max, raw));
    const ok = (points===max);
    return { points, max, correct: ok };
  }
  if(qt==="bowtie"){
    const b = current.bowtie || {};
    const max = 3;
    let points = 0;
    if(currentAnswer.left===b.left_answer) points++;
    if(currentAnswer.middle===b.middle_answer) points++;
    if(currentAnswer.right===b.right_answer) points++;
    return { points, max, correct: points===max };
  }
  const ok = isCorrectStrict();
  return { points: ok?1:0, max:1, correct: ok };
}
function isCorrectStrict(){
  const qt = current.qtype || "single";
  if(qt==="single"){
    return currentAnswer === current.answer;
  }
  if(qt==="sata"){
    const a = Array.isArray(current.answer)?current.answer:[];
    const u = Array.isArray(currentAnswer)?currentAnswer:[];
    if(u.length !== a.length) return false;
    const setA = new Set(a);
    for(const v of u) if(!setA.has(v)) return false;
    return true;
  }
  if(qt==="bowtie"){
    const b = current.bowtie || {};
    return currentAnswer.left===b.left_answer
        && currentAnswer.middle===b.middle_answer
        && currentAnswer.right===b.right_answer;
  }
  return false;
}
function buildRationale(){
  const lines = [];
  const qt = current.qtype || "single";
  if(qt==="single"){
    lines.push(`Correct answer: ${current.answer}`);
  }else if(qt==="sata"){
    lines.push(scoringMode==="partial" ? "Correct answers (partial credit enabled):" : "Correct answers (must match exactly):");
    (current.answer||[]).forEach(a=>lines.push(`- ${a}`));
  }else if(qt==="bowtie"){
    const b=current.bowtie||{};
    lines.push("Bowtie correct selections:");
    lines.push(`- Client problem: ${b.left_answer||"—"}`);
    lines.push(`- Priority action: ${b.middle_answer||"—"}`);
    lines.push(`- Expected outcome: ${b.right_answer||"—"}`);
  }
  lines.push("");
  lines.push(current.rationale || "No rationale provided.");
  return lines.join("\n");
}
function awardBadges(sc){
  const earn = (name)=>{
    if(!badges.earned) badges.earned = {};
    if(!badges.earned[name]){
      badges.earned[name] = new Date().toISOString().slice(0,10);
      saveBadges(badges);
    }
  };
  if(streak>=5) earn("Streak5");
  if(streak>=10) earn("Streak10");
  if((current.qtype||"") === "sata" && sc.correct) earn("SATA");
  if((current.qtype||"") === "bowtie" && sc.correct) earn("Bowtie");
}
function teachBack(){
  if(mode==="exam") return;
  const prompts = [
    "In 1 sentence: what cue made this the priority?",
    "What assessment would you re-check first after the intervention?",
    "Which finding would require immediate provider notification?",
    "What safety risk was the distractor trying to trick you with?"
  ];
  const p = prompts[Math.floor(Math.random()*prompts.length)];
  try{ window.prompt("Teach-back (not graded):\n\n"+p, ""); }catch{}
}
function submitAnswer(){
  if(!current) return;

  stopTimer();
  const sc = scoreCurrent();
  scorePoints += sc.points;
  scoreMax += sc.max;

  if(sc.correct){
    streak += 1;
  }else{
    streak = 0;
    if(current.id) missedIds.add(current.id);
  }

  const topic = normalizeTopic(current.topic);
  if(!mastery[topic]) mastery[topic] = { attempts:0, correct:0 };
  mastery[topic].attempts += 1;
  mastery[topic].correct += (sc.correct ? 1 : 0);
  saveMastery(mastery);

  awardBadges(sc);

  ui.pane_rationale.textContent = buildRationale();
  setTab("rationale");
  ui.btnShowRationale.disabled = false;
  ui.btnSubmit.disabled = true;

  updateScoreLine();
  updateDashboard();

  setTimeout(teachBack, 50);

  if(mode==="exam"){
    if(examQueue.length){
      // next question button prompt
      showDialog("Saved", "Answer recorded. Click OK for next question.");
      ui.dlg.addEventListener("close", ()=>{ nextFromQueue(); }, { once:true });
    }else{
      finishExam();
    }
  }
}
function showRationale(){
  if(!current) return;
  ui.pane_rationale.textContent = buildRationale();
  setTab("rationale");
}
function updateScoreLine(){
  ui.scoreLine.textContent = `Score: ${scorePoints}/${scoreMax} • Missed: ${missedIds.size} • Scoring: ${scoringMode}${focusWeak ? " • FocusWeak" : ""}`;
}

// ---------- Timer ----------
function startTimer(){
  stopTimer();
  timerRemaining = timerSeconds;
  ui.timerLine.textContent = timerSeconds ? `${timerSeconds}s` : "Off";
  if(!timerSeconds) return;
  tickTimer();
  timerHandle = setInterval(tickTimer, 1000);
}
function tickTimer(){
  if(!timerSeconds) return;
  ui.timerLine.textContent = `${timerRemaining}s`;
  if(timerRemaining <= 0){
    clearInterval(timerHandle);
    timerHandle = null;
    handleTimeout();
    return;
  }
  timerRemaining -= 1;
}
function stopTimer(){
  if(timerHandle){
    clearInterval(timerHandle);
    timerHandle = null;
  }
}
function handleTimeout(){
  // mark incorrect
  streak = 0;
  scoreMax += 1;
  if(current && current.id) missedIds.add(current.id);
  const topic = normalizeTopic(current.topic);
  if(!mastery[topic]) mastery[topic] = { attempts:0, correct:0 };
  mastery[topic].attempts += 1;
  saveMastery(mastery);

  ui.pane_rationale.textContent = `⏱ Time expired. Marked incorrect.\n\n${current ? (current.rationale||"") : ""}`;
  setTab("rationale");
  updateScoreLine();
  updateDashboard();

  if(mode==="exam"){
    if(examQueue.length){
      showDialog("Time expired", "Click OK for next question.");
      ui.dlg.addEventListener("close", ()=>{ nextFromQueue(); }, { once:true });
    }else{
      finishExam();
    }
  }
}

// ---------- Exam / leaderboard / export ----------
function startExam(){
  const pool = filteredPool();
  if(pool.length < 75){
    showDialog("Not enough questions", `Your current filters only include ${pool.length} questions. Choose “All” topic / Any difficulty / Any type to reach 75.`);
    return;
  }
  mode = "exam";
  scorePoints = 0;
  scoreMax = 0;
  missedIds = new Set();
  streak = 0;

  examCode = (localStorage.getItem(LS_EXAMCODE) || "").trim();
  const codeSeed = examCode ? `${examCode}|${ui.topicSelect.value}|${ui.diffSelect.value}|${ui.typeSelect.value}` : "";
  examQueue = buildExamQueue(pool, codeSeed);

  nextFromQueue();
}
function nextFromQueue(){
  if(!examQueue.length){
    finishExam();
    return;
  }
  const q = examQueue.shift();
  renderQuestion(q);
}
function finishExam(){
  mode = "practice";
  stopTimer();
  const pct = scoreMax ? Math.round((scorePoints/scoreMax)*100) : 0;

  let initials = (window.prompt("Enter your initials (2–4 letters):", "") || "").trim();
  initials = initials.replace(/[^A-Za-z]/g,"").toUpperCase().slice(0,4);
  if(initials.length < 2) initials = "NA";
  let section = (window.prompt("Optional: enter section/cohort (e.g., AM, PM, LVN1):", "") || "").trim().slice(0,12);

  const entry = {
    name: initials,
    section,
    pct,
    score: scorePoints,
    total: scoreMax,
    date: new Date().toISOString().slice(0,16).replace("T"," ")
  };
  const scores = loadScores();
  scores.unshift(entry);
  scores.sort((a,b)=> (b.pct-a.pct) || (b.score-a.score));
  saveScores(scores.slice(0,200));

  showDialog("Exam complete", `Score: ${pct}% (${scorePoints}/${scoreMax})\nSaved to leaderboard.`);
  ui.dlg.addEventListener("close", ()=>{ updateDashboard(); }, { once:true });
}
function showLeaderboard(){
  const scores = loadScores();
  if(!scores.length){
    showDialog("Leaderboard", "No saved scores yet.");
    return;
  }
  const section = (window.prompt("Filter by section? Leave blank for all:", "") || "").trim();
  const show = section ? scores.filter(s => (s.section||"").toLowerCase() === section.toLowerCase()) : scores;

  const lines = [];
  lines.push("Leaderboard (Top 50 on this device) — Initials");
  if(section) lines.push(`Section filter: ${section}`);
  lines.push("");
  (show.length ? show : scores).slice(0,50).forEach((s,i)=>{
    lines.push(`${String(i+1).padStart(2," ")}. ${s.name}${s.section?` (${s.section})`:''} — ${s.pct}% (${s.score}/${s.total}) — ${s.date}`);
  });
  showDialog("Leaderboard", lines.join("\n"));
}
function exportCSV(filename, rows){
  const csv = rows.map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 800);
}
function exportTools(){
  const unlocked = localStorage.getItem(LS_INSTR)==="1";
  if(!unlocked){
    ui.instrCodeInput.value = "";
    ui.dlgInstructor.showModal();
    ui.dlgInstructor.addEventListener("close", ()=>{
      if(ui.dlgInstructor.returnValue!=="ok") return;
      const entered = (ui.instrCodeInput.value||"").trim();
      let code = localStorage.getItem(LS_INSTR_CODE) || "";
      if(!code){
        localStorage.setItem(LS_INSTR_CODE, entered);
        code = entered;
      }
      if(entered && entered === code){
        localStorage.setItem(LS_INSTR,"1");
        showDialog("Instructor unlocked","Exports enabled on this device.");
      }else{
        showDialog("Incorrect code","Instructor code did not match.");
      }
    }, { once:true });
    return;
  }

  const scores = loadScores();
  const m = loadMastery();
  const rows1 = [["initials","section","pct","score","total","date"]];
  scores.forEach(s=>rows1.push([s.name,s.section||"",s.pct,s.score,s.total,s.date]));
  exportCSV("lvn_scores.csv", rows1);

  const rows2 = [["topic","attempts","correct","pct"]];
  Object.entries(m).forEach(([t,v])=>{
    const pct = v.attempts ? Math.round((v.correct||0)/v.attempts*100) : "";
    rows2.push([t, v.attempts||0, v.correct||0, pct]);
  });
  exportCSV("lvn_mastery.csv", rows2);

  showDialog("Export complete","Downloaded lvn_scores.csv and lvn_mastery.csv");
}

// ---------- Exam code dialog ----------
function setExamCode(){
  ui.examCodeInput.value = localStorage.getItem(LS_EXAMCODE) || "";
  ui.dlgExamCode.showModal();
  ui.dlgExamCode.addEventListener("close", ()=>{
    if(ui.dlgExamCode.returnValue!=="ok") return;
    const code = (ui.examCodeInput.value||"").trim();
    localStorage.setItem(LS_EXAMCODE, code);
    examCode = code;
    showDialog("Exam code set", code ? `Using code: ${code}` : "Cleared. Exams will be random.");
  }, { once:true });
}

// ---------- Reset ----------
function resetAll(){
  if(!confirm("Reset progress, mastery, badges, and seen questions on this device?")) return;
  localStorage.removeItem(LS_SCORES);
  localStorage.removeItem(LS_MASTERY);
  localStorage.removeItem(LS_BADGES);
  missedIds = new Set();
  mastery = {};
  badges = { earned:{} };
  streak = 0;
  QUESTIONS.forEach(q=>{ delete q._seen; });
  scorePoints = 0;
  scoreMax = 0;
  updateScoreLine();
  updateDashboard();
  showDialog("Reset complete","Device-local progress cleared.");
}

// ---------- Data load ----------
function buildTopicList(){
  const topics = Array.from(new Set(QUESTIONS.map(q=>normalizeTopic(q.topic)))).sort((a,b)=>a.localeCompare(b));
  ui.topicSelect.innerHTML = "";
  const all = document.createElement("option");
  all.value = "All";
  all.textContent = "All";
  ui.topicSelect.appendChild(all);
  topics.forEach(t=>{
    const op = document.createElement("option");
    op.value = t;
    op.textContent = t;
    ui.topicSelect.appendChild(op);
  });
}
async function loadQuestions(){
  const resp = await fetch("questions.json", { cache: "no-store" });
  const data = await resp.json();
  // Normalize schema minimally
  const arr = Array.isArray(data) ? data : (data.questions || []);
  QUESTIONS = arr.map((q,idx)=>{
    const qq = {...q};
    qq.id = qq.id || `q_${idx}_${Math.random().toString(36).slice(2,7)}`;
    qq.qtype = qq.qtype || qq.type || "single";
    qq.options = qq.options || qq.choices || [];
    qq.answer = qq.answer ?? qq.correct;
    qq.topic = normalizeTopic(qq.topic);
    return qq;
  });
}

// ---------- Practice flow ----------
function nextPractice(){
  mode = "practice";
  const q = pickPracticeQuestion();
  if(!q){
    showDialog("No questions", "No questions match your current filters.");
    return;
  }
  renderQuestion(q);
}

// ---------- Init ----------
function initSettings(){
  const theme = localStorage.getItem(LS_THEME) || "dark";
  ui.themeSelect.value = theme;
  applyTheme(theme);

  const font = localStorage.getItem(LS_FONT) || "1.0";
  ui.fontSelect.value = font;
  applyFont(font);

  const hc = localStorage.getItem(LS_HC) === "1";
  ui.hiContrast.checked = hc;
  applyHighContrast(hc);

  const sc = localStorage.getItem(LS_SCORING) || "strict";
  ui.scoringSelect.value = sc;
  applyScoring(sc);

  const ts = localStorage.getItem(LS_TIMER) || "0";
  ui.timerSelect.value = ts;
  timerSeconds = Number(ts||0);

  mastery = loadMastery();
  if(!mastery || typeof mastery !== "object" || Array.isArray(mastery)) mastery = {};
  badges = loadBadges();
  if(!badges || typeof badges !== "object") badges = { earned:{} };
  if(!badges.earned || typeof badges.earned !== "object") badges.earned = {};

  updateDashboard();
  updateScoreLine();
}

function runDiagnostics(){
  const base = new URL("./", window.location.href).toString();
  const urls = {
    base,
    appJs: new URL("app.js", base).toString(),
    appJsV: new URL("app.js?v=42", base).toString(),
    questions: new URL("questions.json", base).toString(),
    sw: new URL("service-worker.js", base).toString(),
  };
  const lines = [];
  lines.push("Diagnostics");
  lines.push("");
  for(const [k,v] of Object.entries(urls)){
    lines.push(`${k}: ${v}`);
  }
  lines.push("");
  lines.push("If questions fail to load, open the questions URL above directly.");
  showDialog("Diagnostics", lines.join("\n"));
}

function wireEvents(){
  ui.btnPractice.addEventListener("click", nextPractice);
  ui.btnStartExam.addEventListener("click", startExam);
  ui.btnExamCode.addEventListener("click", setExamCode);
  ui.btnFocusWeak.addEventListener("click", ()=>{
    focusWeak = !focusWeak;
    showDialog("Focus Weak", focusWeak ? "ON: more weak topics + missed questions." : "OFF: normal random practice.");
    updateDashboard();
  });
  ui.btnLeaderboard.addEventListener("click", showLeaderboard);
  ui.btnExport.addEventListener("click", exportTools);
  ui.btnReset.addEventListener("click", resetAll);
  if(ui.btnDiag) ui.btnDiag.addEventListener("click", runDiagnostics);

  ui.btnSubmit.addEventListener("click", submitAnswer);
  ui.btnShowRationale.addEventListener("click", showRationale);

  ui.themeSelect.addEventListener("change", ()=>applyTheme(ui.themeSelect.value));
  ui.fontSelect.addEventListener("change", ()=>applyFont(ui.fontSelect.value));
  ui.hiContrast.addEventListener("change", ()=>applyHighContrast(ui.hiContrast.checked));
  ui.scoringSelect.addEventListener("change", ()=>{ applyScoring(ui.scoringSelect.value); showDialog("Scoring", scoringMode==="strict" ? "Strict (all-or-nothing)." : "NGN partial credit enabled."); updateScoreLine(); });
  ui.timerSelect.addEventListener("change", ()=>{
    timerSeconds = Number(ui.timerSelect.value||0);
    localStorage.setItem(LS_TIMER, String(timerSeconds));
    showDialog("Timer", timerSeconds ? `Timer set to ${timerSeconds}s per question.` : "Timer off.");
    updateDashboard();
  });

  // Filter change resets seen flags for that filter session (so students can rotate per filter)
  [ui.topicSelect, ui.diffSelect, ui.typeSelect].forEach(sel=>{
    sel.addEventListener("change", ()=>{
      // clear seen state only for current view to avoid confusion
      QUESTIONS.forEach(q=>{ delete q._seen; });
    });
  });
}

async function boot(){
  try{
    // PWA offline
    // service worker disabled in v4.3-debug to prevent caching issues

    initSettings();
    wireEvents();
    await loadQuestions();
    buildTopicList();
    updateDashboard();
    showDialog("Ready", `Loaded ${QUESTIONS.length} questions.\n\nClick “Next Practice” to start.`);
  }catch(err){
    console.error(err);
    showDialog("Error", "App failed to start.\n\nDetails:\n" + (err && err.message ? err.message : String(err)) + "\n\nFix: hard refresh / clear site data. If it mentions questions.json, confirm it is in the same GitHub Pages folder as index.html.");
  }
}

boot();
