// LVN HESI Practice – Web App (static)
//
// Run by hosting this folder and opening index.html via http(s).
// (Local file:// may block fetch of questions.json.)

const BANK_URL = "questions.json";
const LS_SCORES = "lvn_hesi_scores_web_v1";

const el = (id) => document.getElementById(id);

const ui = {
  difficulty: el("difficulty"),
  topic: el("topic"),
  reviewMissed: el("reviewMissed"),
  timerSelect: el("timerSelect"),
  scoreLine: el("scoreLine"),
  timerLine: el("timerLine"),
  answers: el("answers"),
  panes: {
    case: el("pane-case"),
    vitals: el("pane-vitals"),
    nurse: el("pane-nurse"),
    orders: el("pane-orders"),
    question: el("pane-question"),
    rationale: el("pane-rationale"),
  },
  dlg: el("dlg"),
  dlgTitle: el("dlgTitle"),
  dlgBody: el("dlgBody"),
  btnNext: el("btnNext"),
  btnSubmit: el("btnSubmit"),
  btnShowRationale: el("btnShowRationale"),
  btnStartExam: el("btnStartExam"),
  btnLeaderboard: el("btnLeaderboard"),
  btnReset: el("btnReset"),
};

let bank = [];
let pool = [];
let unseenPool = [];
let seenIds = new Set();
let missedIds = new Set();

let mode = "practice"; // practice | exam
let examQueue = [];
let examIndex = 0;

let current = null;
let score = 0;
let total = 0;

let timerSeconds = 0;
let timerRemaining = 0;
let timerHandle = null;

// ---------- Helpers ----------
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}
function setEq(a,b){
  if(a.size!==b.size) return false;
  for(const v of a) if(!b.has(v)) return false;
  return true;
}
function showDialog(title, body){
  ui.dlgTitle.textContent = title;
  ui.dlgBody.textContent = body;
  ui.dlg.showModal();
}
function setTab(tab){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.tab===tab);
  });
  Object.entries(ui.panes).forEach(([k,el])=>{
    el.classList.toggle("active", k===tab);
  });
}

// Tabs click
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
});

function loadScores(){
  try{
    const raw = localStorage.getItem(LS_SCORES);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  }catch{ return []; }
}
function saveScores(scores){
  try{ localStorage.setItem(LS_SCORES, JSON.stringify(scores)); }catch{}
}

function updateStatus(){
  const modeTxt = mode==="exam" ? "Exam" : "Practice";
  ui.scoreLine.textContent = `Score: ${score}/${total} • Missed: ${missedIds.size} • Mode: ${modeTxt}`;
}
function updateTimer(){
  if(timerSeconds<=0) ui.timerLine.textContent = "⏱ Off";
  else ui.timerLine.textContent = `⏱ ${timerRemaining}s`;
}

function cancelTimer(){
  if(timerHandle){ clearInterval(timerHandle); timerHandle=null; }
}
function startTimer(){
  cancelTimer();
  timerSeconds = Number(ui.timerSelect.value || 0);
  timerRemaining = timerSeconds;
  updateTimer();
  if(timerSeconds<=0) return;
  timerHandle = setInterval(()=>{
    timerRemaining -= 1;
    updateTimer();
    if(timerRemaining<=0){
      cancelTimer();
      autoTimeout();
    }
  }, 1000);
}

function clearUI(){
  Object.values(ui.panes).forEach(p=> p.textContent="");
  ui.answers.innerHTML = "";
}

function buildTopicList(){
  const topics = Array.from(new Set(bank.map(q=>q.topic || "Untitled"))).sort((a,b)=>a.localeCompare(b));
  ui.topic.innerHTML = '<option value="__ALL__">All Topics</option>' + topics.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
}

function applyFilters(resetCycle=true){
  const minDiff = Number(ui.difficulty.value || 1);
  const topic = ui.topic.value;

  pool = bank.filter(q => Number(q.difficulty || 1) >= minDiff);
  if(topic && topic !== "__ALL__"){
    pool = pool.filter(q => (q.topic || "") === topic);
  }
  if(ui.reviewMissed.checked){
    pool = pool.filter(q => missedIds.has(q.id));
  }

  if(resetCycle){
    seenIds = new Set();
    unseenPool = pool.filter(q => q.id);
  }
}

function pickPracticeQuestion(){
  if(!unseenPool.length){
    unseenPool = pool.filter(q => q.id && !seenIds.has(q.id));
    if(!unseenPool.length){
      seenIds = new Set();
      unseenPool = pool.filter(q => q.id);
    }
  }
  if(!unseenPool.length) return null;
  const idx = Math.floor(Math.random()*unseenPool.length);
  const q = unseenPool[idx];
  if(q?.id){
    seenIds.add(q.id);
    unseenPool = unseenPool.filter(x=>x.id !== q.id);
  }
  return q;
}

// Exam: mix progressive groups + standalone, enforce unique IDs
function buildExamQueue(examPool){
  const groups = new Map();
  const standalone = [];

  for(const q of examPool){
    const cg = q.case_group;
    if(cg && typeof cg==="object" && cg.id){
      if(!groups.has(cg.id)) groups.set(cg.id, []);
      groups.get(cg.id).push(q);
    }else{
      standalone.push(q);
    }
  }

  const normalized = [];
  for(const [gid, arr] of groups.entries()){
    const sorted = arr.slice().sort((a,b)=> Number(a.case_group?.sequence||999) - Number(b.case_group?.sequence||999));
    const total = Number(sorted[0]?.case_group?.total || sorted.length);
    const slice = sorted.slice(0,total);
    if(slice.length >= 3) normalized.push(slice);
  }

  shuffle(normalized);
  shuffle(standalone);

  const exam = [];
  const targetGroups = 4;
  let picked=0;

  for(const grp of normalized){
    if(picked>=targetGroups) break;
    if(exam.length + grp.length > 75) continue;
    exam.push(...grp);
    picked += 1;
  }

  const used = new Set(exam.map(q=>q.id).filter(Boolean));
  for(const q of standalone){
    if(exam.length>=75) break;
    if(q.id && !used.has(q.id)){
      exam.push(q); used.add(q.id);
    }
  }

  if(exam.length<75){
    const remaining = examPool.filter(q=>q.id && !used.has(q.id));
    shuffle(remaining);
    exam.push(...remaining.slice(0, 75-exam.length));
  }

  // enforce unique IDs
  const uniq=[];
  const used2=new Set();
  for(const q of exam){
    if(q.id && !used2.has(q.id)){
      uniq.push(q); used2.add(q.id);
    }
  }
  if(uniq.length<75){
    const remaining = examPool.filter(q=>q.id && !used2.has(q.id));
    shuffle(remaining);
    uniq.push(...remaining.slice(0, 75-uniq.length));
  }
  return uniq.slice(0,75);
}

function formatVitals(v){
  if(!v || typeof v!=="object") return "No vitals provided.";
  const lines = Object.entries(v).map(([k,val])=>`${k}: ${val}`);
  return lines.length ? lines.join("\n") : "No vitals provided.";
}

function renderQuestion(q){
  cancelTimer();
  clearUI();
  current = q;

  if(!q){
    showDialog("No questions", "No questions match the current filters. Lower difficulty, choose All Topics, or uncheck Review missed.");
    return;
  }

  const cs = q.case || {};
  ui.panes.case.textContent = cs.case_study || "No case information for this question.";
  ui.panes.vitals.textContent = formatVitals(cs.vitals);
  ui.panes.nurse.textContent = (cs.nurse_actions && cs.nurse_actions.length) ? cs.nurse_actions.join("\n") : "No nursing actions listed.";
  ui.panes.orders.textContent = (cs.provider_orders && cs.provider_orders.length) ? cs.provider_orders.join("\n") : "No provider orders listed.";

  let prefix = "";
  if(mode==="exam") prefix += `EXAM QUESTION ${examIndex}/75\n\n`;
  if(q.case_group?.id){
    prefix += `[${q.case_group.title || "Progressive Case"} — ${q.case_group.id} | Q${q.case_group.sequence}/${q.case_group.total}]\n\n`;
  }
  const neg = q.polarity==="negative" ? "⚠️ NEGATIVE WORDING: look for NOT/EXCEPT.\n\n" : "";
  ui.panes.question.textContent = prefix + neg + (q.stem || "");
  ui.panes.rationale.textContent = "";

  // Header badge
  const flag = document.createElement("div");
  flag.className = "flag";
  flag.textContent = `Type: ${q.qtype || "single"} • Topic: ${q.topic || ""} • Diff: ${q.difficulty || ""}`;
  ui.answers.appendChild(flag);

  if(q.qtype==="single"){
    (q.choices||[]).forEach((c, i)=> ui.answers.appendChild(makeRadio(c, i)));
  }else if(q.qtype==="sata"){
    (q.choices||[]).forEach((c, i)=> ui.answers.appendChild(makeCheck(c, i)));
  }else if(q.qtype==="bowtie"){
    ui.answers.appendChild(makeBowtie(q.bowtie || {}));
  }else{
    const p=document.createElement("div");
    p.textContent = `Unknown question type: ${q.qtype}`;
    ui.answers.appendChild(p);
  }

  setTab("question");
  startTimer();
}

function makeRadio(choice, idx){
  const wrap = document.createElement("div");
  wrap.className = "answer";
  wrap.innerHTML = `
    <label>
      <input type="radio" name="single" value="${escapeHtml(choice)}">
      <span>${escapeHtml(choice)}</span>
    </label>`;
  return wrap;
}
function makeCheck(choice, idx){
  const wrap = document.createElement("div");
  wrap.className = "answer";
  wrap.innerHTML = `
    <label>
      <input type="checkbox" value="${escapeHtml(choice)}">
      <span>${escapeHtml(choice)}</span>
    </label>`;
  return wrap;
}
function makeBowtie(b){
  const wrap = document.createElement("div");
  wrap.className = "answer";
  const grid = document.createElement("div");
  grid.style.display="grid";
  grid.style.gridTemplateColumns="1fr 1fr 1fr";
  grid.style.gap="10px";

  grid.appendChild(makeBowtieCol("left", b.left_label || "Left", b.left_options || []));
  grid.appendChild(makeBowtieCol("middle", b.middle_label || "Middle", b.middle_options || []));
  grid.appendChild(makeBowtieCol("right", b.right_label || "Right", b.right_options || []));

  wrap.appendChild(grid);
  return wrap;
}
function makeBowtieCol(key, label, options){
  const col=document.createElement("div");
  col.className="answer";
  col.innerHTML = `<div class="flag">${escapeHtml(label)}</div>`;
  const group = `bow_${key}`;
  options.forEach(opt=>{
    const row=document.createElement("label");
    row.style.display="flex";
    row.style.gap="10px";
    row.style.alignItems="flex-start";
    row.style.marginTop="8px";
    row.innerHTML = `
      <input type="radio" name="${group}" value="${escapeHtml(opt)}">
      <span>${escapeHtml(opt)}</span>`;
    col.appendChild(row);
  });
  return col;
}

function getUserAnswer(){
  if(!current) return {answered:false};
  if(current.qtype==="single"){
    const sel=document.querySelector('input[type="radio"][name="single"]:checked');
    return {answered:!!sel, value: sel?sel.value:""};
  }
  if(current.qtype==="sata"){
    const sel=Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value);
    return {answered: sel.length>0, value: sel};
  }
  if(current.qtype==="bowtie"){
    const left=document.querySelector('input[type="radio"][name="bow_left"]:checked')?.value || "";
    const mid=document.querySelector('input[type="radio"][name="bow_middle"]:checked')?.value || "";
    const right=document.querySelector('input[type="radio"][name="bow_right"]:checked')?.value || "";
    return {answered: !!(left && mid && right), value:{left, middle:mid, right}};
  }
  return {answered:false};
}

function isCorrect(ans){
  if(!current) return false;
  if(current.qtype==="single") return ans.value === current.answer;
  if(current.qtype==="sata"){
    const a=new Set(Array.isArray(current.answer)?current.answer:[]);
    const u=new Set(Array.isArray(ans.value)?ans.value:[]);
    return setEq(a,u);
  }
  if(current.qtype==="bowtie"){
    const b=current.bowtie || {};
    return ans.value.left===b.left_answer && ans.value.middle===b.middle_answer && ans.value.right===b.right_answer;
  }
  return false;
}

function buildRationale(){
  const q=current;
  if(!q) return "";
  const lines=[];
  lines.push(`ID: ${q.id || ""}   |   Topic: ${q.topic || ""}   |   Difficulty: ${q.difficulty || ""}`);
  lines.push("");
  if(q.qtype==="single"){
    lines.push("Correct Answer:");
    lines.push(`- ${q.answer || ""}`);
    lines.push("");
    lines.push("Rationale:");
    lines.push(q.rationale || "");
    const cr=q.choice_rationales || {};
    if(cr && Object.keys(cr).length){
      lines.push("");
      lines.push("Option-by-option breakdown:");
      for(const c of (q.choices||[])){
        lines.push(`- ${c}: ${cr[c] || ""}`);
      }
    }
  }else if(q.qtype==="sata"){
    lines.push("Correct Answers (must match exactly):");
    for(const a of (q.answer||[])) lines.push(`- ${a}`);
    lines.push("");
    lines.push("Rationale:");
    lines.push(q.rationale || "");
    const cr=q.choice_rationales || {};
    if(cr && Object.keys(cr).length){
      lines.push("");
      lines.push("Option-by-option breakdown:");
      for(const c of (q.choices||[])){
        lines.push(`- ${c}: ${cr[c] || ""}`);
      }
    }
  }else if(q.qtype==="bowtie"){
    const b=q.bowtie || {};
    lines.push("Correct Bowtie:");
    lines.push(`- ${b.left_label || "Left"}: ${b.left_answer || ""}`);
    lines.push(`- ${b.middle_label || "Middle"}: ${b.middle_answer || ""}`);
    lines.push(`- ${b.right_label || "Right"}: ${b.right_answer || ""}`);
    lines.push("");
    lines.push("Rationale:");
    lines.push(q.rationale || "");
  }
  return lines.join("\n");
}

function showRationale(){
  ui.panes.rationale.textContent = buildRationale();
  setTab("rationale");
}

function submit(){
  cancelTimer();
  if(!current) return;

  const ans=getUserAnswer();
  if(!ans.answered){
    showDialog("Answer required", "Select an answer before submitting.");
    startTimer();
    return;
  }

  total += 1;
  const correct=isCorrect(ans);
  if(correct) score += 1;
  else if(current.id) missedIds.add(current.id);

  updateStatus();
  showRationale();

  if(mode==="exam"){
    setTimeout(loadExamQuestion, 200);
  }else{
    ui.timerLine.textContent = "⏱ Done";
  }
}

function autoTimeout(){
  if(!current) return;
  const ans=getUserAnswer();
  if(ans.answered){
    submit();
    return;
  }
  total += 1;
  if(current.id) missedIds.add(current.id);
  updateStatus();
  ui.panes.rationale.textContent = `⏱ Time expired. Marked incorrect.\n\n${current.rationale || ""}`;
  setTab("rationale");
  if(mode==="exam"){
    setTimeout(loadExamQuestion, 200);
  }
}

function startExam(){
  const minDiff = Number(ui.difficulty.value || 1);
  const topic = ui.topic.value;
  let examPool = bank.filter(q => Number(q.difficulty || 1) >= minDiff);
  if(topic && topic !== "__ALL__"){
    examPool = examPool.filter(q => (q.topic || "") === topic);
  }
  if(examPool.length < 75){
    showDialog("Not enough questions", `Only ${examPool.length} questions match filters. Choose All Topics or lower difficulty.`);
    return;
  }
  mode="exam";
  score=0; total=0;
  missedIds = new Set();
  examQueue = buildExamQueue(examPool);
  examIndex = 0;
  updateStatus();
  showDialog("Exam started", "75-question exam started.\n\nIncludes standalone questions + progressive case groups.\n\nSubmit advances automatically.");
  loadExamQuestion();
}

function finishExam(){
  cancelTimer();
  const pct = Math.round((score / Math.max(1,total))*1000)/10;
  const ok = window.confirm(`Exam complete!\n\nScore: ${score}/${total} (${pct}%)\nMissed: ${missedIds.size}\n\nAdd to leaderboard?`);
  if(ok){
    const name = (window.prompt("Enter name for leaderboard:", "Anonymous") || "Anonymous").slice(0,24);
    const entry = { name, score, total, pct, date: new Date().toISOString().slice(0,16).replace("T"," ") };
    const scores = loadScores();
    scores.push(entry);
    scores.sort((a,b)=> (b.pct-a.pct) || (b.score-a.score));
    saveScores(scores.slice(0,50));
    showLeaderboard();
  }
  mode="practice";
  examQueue=[];
  examIndex=0;
  updateStatus();
  nextPractice();
}

function loadExamQuestion(){
  if(examIndex >= examQueue.length){
    finishExam();
    return;
  }
  const q = examQueue[examIndex];
  examIndex += 1;
  renderQuestion(q);
}

function nextPractice(){
  mode="practice";
  applyFilters(false);
  if(!pool.length){
    clearUI();
    showDialog("No questions", "No questions match filters.");
    return;
  }
  const q = pickPracticeQuestion();
  renderQuestion(q);
}

function resetAll(){
  cancelTimer();
  mode="practice";
  examQueue=[]; examIndex=0;
  score=0; total=0;
  missedIds = new Set();

  ui.reviewMissed.checked=false;
  ui.difficulty.value="5";
  ui.topic.value="__ALL__";

  seenIds=new Set();
  applyFilters(true);
  updateStatus();
  nextPractice();
}

function showLeaderboard(){
  const scores = loadScores();
  if(!scores.length){
    showDialog("Leaderboard", "No scores saved on this device yet. Finish an exam and save your score.");
    return;
  }
  const lines = ["Leaderboard (Top 50 on this device)\n"];
  scores.slice(0,50).forEach((s,i)=>{
    lines.push(`${String(i+1).padStart(2," ")}. ${s.name} — ${s.pct}% (${s.score}/${s.total}) — ${s.date}`);
  });
  showDialog("Leaderboard", lines.join("\n"));
}

// UI wiring
ui.btnNext.addEventListener("click", ()=>{
  if(mode==="exam"){ showDialog("Exam mode", "Use Submit to move forward in Exam Mode."); return; }
  nextPractice();
});
ui.btnSubmit.addEventListener("click", submit);
ui.btnShowRationale.addEventListener("click", showRationale);
ui.btnStartExam.addEventListener("click", startExam);
ui.btnLeaderboard.addEventListener("click", showLeaderboard);
ui.btnReset.addEventListener("click", resetAll);

ui.difficulty.addEventListener("change", ()=>{ applyFilters(true); updateStatus(); nextPractice(); });
ui.topic.addEventListener("change", ()=>{ applyFilters(true); updateStatus(); nextPractice(); });
ui.reviewMissed.addEventListener("change", ()=>{ applyFilters(true); updateStatus(); nextPractice(); });
ui.timerSelect.addEventListener("change", ()=>{ timerSeconds=Number(ui.timerSelect.value||0); timerRemaining=timerSeconds; updateTimer(); });

// ---------- Init ----------
(async function init(){
  try{
    const res = await fetch(BANK_URL, { cache: "no-store" });
    if(!res.ok) throw new Error(`Failed to load ${BANK_URL}. If you opened via file://, use a local server.`);
    bank = await res.json();
    if(!Array.isArray(bank) || !bank.length) throw new Error("questions.json is empty or invalid.");

    buildTopicList();
    applyFilters(true);
    updateStatus();
    nextPractice();
  }catch(err){
    console.error(err);
    showDialog("Startup error", String(err));
  }
})();
