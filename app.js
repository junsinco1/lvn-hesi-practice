// Nurse Review WebApp — Banks v1 (No Service Worker)
// Features: bank/system/topic dropdowns, timer, scoring, badges, readiness gauge, leaderboard.
// Data: banks_manifest.json + banks/*.json. Each question should include bank/system/topic/qtype/choices...

const $ = (s)=>document.querySelector(s);

const el = {
  loadStatus: $("#loadStatus"),
  countStatus: $("#countStatus"),
  reloadBtn: $("#reloadBtn"),
  bankSel: $("#bankSel"),
  systemSel: $("#systemSel"),
  topicSel: $("#topicSel"),
  typeSel: $("#typeSel"),
  examCount: $("#examCount"),
  timerSel: $("#timerSel"),
  themeSel: $("#themeSel"),
  accentSel: $("#accentSel"),
  nextBtn: $("#nextBtn"),
  startExamBtn: $("#startExamBtn"),
  resetBtn: $("#resetBtn"),
  modeLbl: $("#modeLbl"),
  scoreLbl: $("#scoreLbl"),
  timerLbl: $("#timerLbl"),
  xpLbl: $("#xpLbl"),
  streakLbl: $("#streakLbl"),
  rankLbl: $("#rankLbl"),
  badgeRow: $("#badgeRow"),
  readyPct: $("#readyPct"),
  gaugeFill: $("#gaugeFill"),
  caseTabs: $("#caseTabs"),
  caseBody: $("#caseBody"),
  answerArea: $("#answerArea"),
  qBankChip: $("#qBankChip"),
  qSystemChip: $("#qSystemChip"),
  qTopicChip: $("#qTopicChip"),
  qTypeChip: $("#qTypeChip"),
  qModeChip: $("#qModeChip"),
  qCountChip: $("#qCountChip"),
  qTimerChip: $("#qTimerChip"),
  qProgressFill: $("#qProgressFill"),
  qStem: $("#qStem"),
  qChoices: $("#qChoices"),
  bowtieArea: $("#bowtieArea"),
  submitBtn: $("#submitBtn"),
  showAnswerBtn: $("#showAnswerBtn"),
  initialsInp: $("#initialsInp"),
  openLbBtn: $("#openLbBtn"),
  clearLbBtn: $("#clearLbBtn"),
  lbArea: $("#lbArea"),
  validateBtn: $("#validateBtn"),
  validatorModal: $("#validatorModal"),
  validatorOut: $("#validatorOut"),
  validatorCloseBtn: $("#validatorCloseBtn"),
  runValidateBtn: $("#runValidateBtn"),
  downloadValidateBtn: $("#downloadValidateBtn"),
};

// ---------- Theme presets ----------
const THEME_PRESETS = [
  {name:"Midnight Glass", vars:{bg:"#0b1020", bg2:"#070b18", card:"rgba(18,26,51,.82)", card2:"rgba(15,23,48,.62)", text:"#e7ecff", muted:"#9aa6d1", border:"#24305b"}},
  {name:"Slate", vars:{bg:"#0f172a", bg2:"#0b1222", card:"rgba(23,33,62,.82)", card2:"rgba(12,18,38,.62)", text:"#eef2ff", muted:"#a5b4fc", border:"#2a3a73"}},
  {name:"Warm Ink", vars:{bg:"#141016", bg2:"#0d0a10", card:"rgba(35,24,44,.82)", card2:"rgba(20,14,28,.62)", text:"#fff1f2", muted:"#fbcfe8", border:"#4a2a5c"}},
  {name:"Clinical Light", vars:{bg:"#0d1326", bg2:"#070b18", card:"rgba(255,255,255,.07)", card2:"rgba(255,255,255,.05)", text:"#f8fafc", muted:"#cbd5e1", border:"#334155"}},
];

const ACCENTS = [
  {name:"Blue", value:"#6aa3ff"},
  {name:"Mint", value:"#3ddc97"},
  {name:"Violet", value:"#b68cff"},
  {name:"Amber", value:"#ffcc66"},
  {name:"Rose", value:"#ff5b6b"},
  {name:"Cyan", value:"#38bdf8"},
];

function setCssVars(vars){
  const r = document.documentElement;
  for(const [k,v] of Object.entries(vars)) r.style.setProperty(`--${k}`, v);
}

function applyThemeFromStorage(){
  const themeName = localStorage.getItem("nr_theme") || THEME_PRESETS[0].name;
  const accent = localStorage.getItem("nr_accent") || ACCENTS[0].value;
  const preset = THEME_PRESETS.find(t=>t.name===themeName) || THEME_PRESETS[0];
  setCssVars(preset.vars);
  document.documentElement.style.setProperty("--accent", accent);
  el.themeSel.value = preset.name;
  el.accentSel.value = accent;
}

function initThemeUI(){
  el.themeSel.innerHTML = THEME_PRESETS.map(t=>`<option value="${t.name}">${t.name}</option>`).join("");
  el.accentSel.innerHTML = ACCENTS.map(a=>`<option value="${a.value}">${a.name}</option>`).join("");
  el.themeSel.addEventListener("change", ()=>{
    localStorage.setItem("nr_theme", el.themeSel.value);
    applyThemeFromStorage();
  });
  el.accentSel.addEventListener("change", ()=>{
    localStorage.setItem("nr_accent", el.accentSel.value);
    applyThemeFromStorage();
  });
  applyThemeFromStorage();
}

// ---------- State ----------
let manifest = null;
let bankCache = new Map(); // bankName -> {items, bankMeta}
let items = [];            // current bank items
let singles = [];
let clusters = [];         // arrays (cluster questions)
let mode = "practice";
let examQueue = [];
let examIndex = 0;
let current = null;

// scoring + gamification
let scoreCorrect = 0;
let scoreTotal = 0;
let xp = 0;
let streak = 0;

// timer
let timerSeconds = 0;
let timerLeft = 0;
let timerHandle = null;

// mastery stats per bank/system/topic
function getStatsKey(){
  return "nr_stats_v1";
}
function loadStats(){
  try{
    return JSON.parse(localStorage.getItem(getStatsKey()) || "{}") || {};
  }catch{ return {}; }
}
function saveStats(stats){
  localStorage.setItem(getStatsKey(), JSON.stringify(stats));
}
function bumpStats(q, wasCorrect){
  const stats = loadStats();
  const b = q.bank || "Unknown";
  stats[b] = stats[b] || {correct:0,total:0,bySystem:{},byTopic:{},byType:{}};
  const s = stats[b];

  s.total++; if(wasCorrect) s.correct++;

  const sys = q.system || "ANY";
  s.bySystem[sys] = s.bySystem[sys] || {correct:0,total:0};
  s.bySystem[sys].total++; if(wasCorrect) s.bySystem[sys].correct++;

  const topic = q.topic || "ANY";
  s.byTopic[topic] = s.byTopic[topic] || {correct:0,total:0};
  s.byTopic[topic].total++; if(wasCorrect) s.byTopic[topic].correct++;

  const type = q.qtype || "single";
  s.byType[type] = s.byType[type] || {correct:0,total:0};
  s.byType[type].total++; if(wasCorrect) s.byType[type].correct++;

  saveStats(stats);
  updateReadinessGauge();
}

// readiness gauge (simple but useful)
function updateReadinessGauge(){
  const stats = loadStats();
  // Blend performance across all banks
  let correct = 0, total = 0;
  for(const b of Object.values(stats)){
    correct += (b.correct||0);
    total += (b.total||0);
  }
  const acc = total ? (correct/total) : 0;
  // Difficulty and streak boost: rough estimate (stored in session only)
  const streakBoost = Math.min(streak/20, 1) * 0.08; // up to +8%
  const xpBoost = Math.min(xp/1000, 1) * 0.04;       // up to +4%
  let readiness = Math.max(0, Math.min(1, acc + streakBoost + xpBoost));
  const pct = Math.round(readiness*100);
  el.readyPct.textContent = `${pct}%`;
  el.gaugeFill.style.width = `${pct}%`;
}


function setStatusCounts(){
  const clusterCount = clusters.length;
  const qCount = singles.length + clusterCount; // rough session count (singles + clusters)
  el.countStatus.textContent = `Loaded: ${items.length} questions • ${clusterCount} clusters`;
}


function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

// ---------- Data loading ----------
function cacheBust(url){
  return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
}

async function fetchJson(url){
  const res = await fetch(cacheBust(url), { cache:"no-store" });
  if(!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return await res.json();
}


// ---------- Answer/choice normalization helpers ----------
function normLetter(x){
  if(x==null) return "";
  const s = String(x).trim().toUpperCase();
  const m = s.match(/[A-E]/);
  return m ? m[0] : "";
}
// Detect "A. text" / "A) text" etc at start
function leadingChoiceKey(x){
  if(x==null) return "";
  const s = String(x).trim().toUpperCase();
  const m = s.match(/^([A-E])\s*[\).\:\-]\s+/);
  return m ? m[1] : "";
}
function isLetterToken(x){
  const n = normLetter(x);
  return n && String(x).trim().toUpperCase() === n;
}
function toChoiceArray(choices){
  // Accept either array of strings or object {A:"..",B:".."}.
  if(Array.isArray(choices)) return choices;
  if(choices && typeof choices === "object"){
    const keys = ["A","B","C","D","E"].filter(k => choices[k]!=null && String(choices[k]).trim()!=="");
    return keys.map(k => `${k}. ${String(choices[k])}`);
  }
  return [];
}
function findChoiceTextByKey(q, key){
  if(!key) return null;
  const arr = Array.isArray(q.choices) ? q.choices : [];
  const target = String(key).toUpperCase();
  for(const c of arr){
    const k = leadingChoiceKey(c) || (isLetterToken(c) ? c.toUpperCase() : "");
    if(k === target) return c;
  }
  return null;
}

function normalizeQuestion(q, bankName){
  const nq = {...q};
  nq.bank = nq.bank || bankName || "Unknown";
  nq.system = nq.system || "ANY";
  nq.topic = nq.topic || "ANY";
  nq.qtype = nq.qtype || (Array.isArray(nq.answer) ? "sata" : "single");
  if(nq.qtype === "standard") nq.qtype = "single";
  nq.difficulty = Number.isFinite(+nq.difficulty) ? +nq.difficulty : 3;

  // Normalize choices: allow either ["A. ...", ...] or {A:"...",B:"..."}.
  if(nq.qtype==="single" || nq.qtype==="sata"){
    nq.choices = toChoiceArray(nq.choices);
  }

  // Normalize answers:
  // - If bank stores "E." or "Answer: E", keep only the letter when it looks like a letter key.
  if(nq.qtype==="single" && typeof nq.answer === "string"){
    const a = normLetter(nq.answer);
    if(a && String(nq.answer).trim().length <= 12) nq.answer = a;
  }
  if(nq.qtype==="sata" && Array.isArray(nq.answer)){
    const looksLikeLetters = nq.answer.every(x => normLetter(x));
    if(looksLikeLetters){
      nq.answer = nq.answer.map(x => normLetter(x));
    }
  }

  if(!nq.choice_rationales || typeof nq.choice_rationales !== "object") nq.choice_rationales = {};
  // normalize case tabs
  if(nq.case && !nq.case.tabs && nq.tabs) nq.case = {tabs:nq.tabs};
  return nq;
}

function buildClustersAndSingles(all){
  singles = [];
  clusters = [];
  const by = new Map();
  for(const raw of all){
    const q = normalizeQuestion(raw, el.bankSel.value);
    const id = q.case_group?.id || q.case_group_id || null;
    if(id){
      if(!by.has(id)) by.set(id, []);
      by.get(id).push(q);
    }else{
      singles.push(q);
    }
  }
  for(const [id, arr] of by.entries()){
    arr.sort((a,b)=>(a.case_group?.sequence ?? 9999) - (b.case_group?.sequence ?? 9999));
    clusters.push(arr);
  }
}

async function loadManifest(){
  manifest = await fetchJson("banks_manifest.json");
  if(!manifest || !Array.isArray(manifest.banks)) throw new Error("banks_manifest.json invalid");
  el.bankSel.innerHTML = manifest.banks.map(b=>`<option value="${b.name}">${b.name}</option>`).join("");
}

function setSystemAndTopicOptions(bankName){
  const meta = manifest.banks.find(b=>b.name===bankName);
  const sysList = meta?.systems || ["ANY"];
  el.systemSel.innerHTML = sysList.map(s=>`<option value="${s}">${s}</option>`).join("");
  const topics = meta?.topics || ["ANY"];
  const base = ["ANY", ...topics.filter(t=>t!=="ANY")];
  // de-dupe
  const uniq = [...new Set(base)];
  el.topicSel.innerHTML = uniq.map(t=>`<option value="${t}">${t}</option>`).join("");

function refreshDynamicTopics(bankName){
  // For banks with topics=["ANY"] (like Anatomy), derive topics from loaded question data.
  // Also supports narrowing topics by selected Body System.
  const meta = manifest.banks.find(b=>b.name===bankName);
  const wantsDynamic = (meta?.topics || ["ANY"]).length === 1 && (meta?.topics || ["ANY"])[0] === "ANY";
  if(!wantsDynamic) return;

  const sys = el.systemSel.value || "ANY";
  const pool = buildEligiblePool(); // already respects current filters except topic; we temporarily ignore topic
  const topics = new Set(["ANY"]);
  // collect topics from singles/clusters directly to avoid topic filter restriction
  const collect = (q)=>{
    if(sys !== "ANY" && (q.system||"ANY") !== sys) return;
    if(q.topic) topics.add(q.topic);
  };
  for(const q of singles) collect(q);
  for(const cl of clusters) for(const q of cl) collect(q);

  const list = [...topics];
  el.topicSel.innerHTML = list.map(t=>`<option value="${t}">${t}</option>`).join("");
  // Keep current selection if still present
  if(!list.includes(el.topicSel.value)) el.topicSel.value = "ANY";
}
}

async function loadBank(bankName){
  const meta = manifest.banks.find(b=>b.name===bankName);
  if(!meta) throw new Error("Bank not found in manifest");
  if(bankCache.has(bankName)){
    const cached = bankCache.get(bankName);
    items = cached.items;
    buildClustersAndSingles(items);
    setStatusCounts();
    return;
  }
  const data = await fetchJson(meta.file);
  if(!Array.isArray(data)) throw new Error(`${meta.file} is not an array`);
  items = data.map(q=>normalizeQuestion(q, bankName));
  bankCache.set(bankName, {items, meta});
  buildClustersAndSingles(items);
  setStatusCounts();
}

// ---------- Filtering & picking ----------
function matchesFilters(q){
  const sys = el.systemSel.value || "ANY";
  const topic = el.topicSel.value || "ANY";
  const type = el.typeSel.value || "ANY";

  if(sys !== "ANY" && (q.system||"ANY") !== sys) return false;
  if(topic !== "ANY" && (q.topic||"ANY") !== topic) return false;
  if(type !== "ANY" && (q.qtype||"single") !== type) return false;
  return true;
}

function pickFrom(arr){
  if(!arr.length) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}

function pickNext(){
  // Mix clusters + singles
  const eligibleSingles = singles.filter(matchesFilters);
  const eligibleClusters = clusters
    .map(c=>c.filter(matchesFilters))
    .filter(c=>c.length); // keep non-empty clusters

  const clusterChance = eligibleClusters.length ? 0.50 : 0.0;
  const useCluster = Math.random() < clusterChance;

  if(useCluster){
    const cl = pickFrom(eligibleClusters);
    return pickFrom(cl);
  }
  return pickFrom(eligibleSingles) || (eligibleClusters.length ? pickFrom(pickFrom(eligibleClusters)) : null);
}

// ---------- UI render ----------
function setCaseTabs(q){
  el.caseTabs.innerHTML = "";
  el.caseBody.textContent = "Load a case-based question to view tabs.";
  if(!q?.case?.tabs) return;

  const tabs = q.case.tabs;
  const keys = ["case_study","vitals","labs","nursing_actions","md_orders"].filter(k => tabs[k] != null && String(tabs[k]).trim() !== "");
  if(!keys.length) return;

  const labels = {case_study:"Case", vitals:"Vitals", labs:"Labs", nursing_actions:"Nurse Did", md_orders:"MD Orders"};

  const renderTab = (k)=>{
    [...el.caseTabs.children].forEach(ch=>ch.classList.remove("active"));
    const btn = [...el.caseTabs.children].find(b=>b.dataset.key===k);
    if(btn) btn.classList.add("active");
    el.caseBody.textContent = String(tabs[k] ?? "");
  };

  for(const k of keys){
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = labels[k] || k;
    b.dataset.key = k;
    b.addEventListener("click", ()=>renderTab(k));
    el.caseTabs.appendChild(b);
  }
  renderTab(keys[0]);
}

function clearQuestionUI(){
  el.qStem.textContent = "—";
  el.qChoices.innerHTML = "";
  el.bowtieArea.style.display = "none";
  el.bowtieArea.innerHTML = "";
  el.answerArea.textContent = "Select an answer to see feedback.";
  el.submitBtn.disabled = true;
  el.showAnswerBtn.disabled = true;
}

function renderSingleOrSata(q){
  el.qChoices.innerHTML = "";
  const isSata = q.qtype === "sata";
  const inputType = isSata ? "checkbox" : "radio";

  if(!Array.isArray(q.choices) || !q.choices.length){
    el.qChoices.innerHTML = `<div class="muted">This question has no choices (data issue).</div>`;
    el.submitBtn.disabled = true;
    el.showAnswerBtn.disabled = false;
    return;
  }

  for(const choice of q.choices){
    const row = document.createElement("label");
    row.className = "choice";
    const inp = document.createElement("input");
    inp.type = inputType;
    inp.name = "choice";
    inp.value = choice;

    const txt = document.createElement("div");
    txt.textContent = choice;

    row.appendChild(inp);
    row.appendChild(txt);
    el.qChoices.appendChild(row);
  }
  el.submitBtn.disabled = false;
  el.showAnswerBtn.disabled = false;
}

function renderBowtie(q){
  el.qChoices.innerHTML = "";
  el.bowtieArea.style.display = "block";
  el.bowtieArea.innerHTML = "";

  const bt = q.bowtie;
  if(!bt || !Array.isArray(bt.left_options) || !Array.isArray(bt.middle_options) || !Array.isArray(bt.right_options)){
    el.bowtieArea.innerHTML = `<div class="muted">This bowtie is missing required fields (data issue).</div>`;
    el.submitBtn.disabled = true;
    el.showAnswerBtn.disabled = false;
    return;
  }

  const makeCol = (title, opts, groupName)=>{
    const col = document.createElement("div");
    col.className = "btCol";
    col.innerHTML = `<div class="btColTitle">${title}</div>`;
    for(const opt of opts){
      const r = document.createElement("label");
      r.className = "btOpt";
      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = groupName;
      inp.value = opt;
      const t = document.createElement("div");
      t.textContent = opt;
      r.appendChild(inp);
      r.appendChild(t);
      col.appendChild(r);
    }
    return col;
  };

  const grid = document.createElement("div");
  grid.className = "btGrid";
  grid.appendChild(makeCol(bt.left_label || "Most likely concern", bt.left_options, "bt_left"));
  grid.appendChild(makeCol(bt.middle_label || "Best action now", bt.middle_options, "bt_mid"));
  grid.appendChild(makeCol(bt.right_label || "Expected improvement", bt.right_options, "bt_right"));
  el.bowtieArea.appendChild(grid);

  el.submitBtn.disabled = false;
  el.showAnswerBtn.disabled = false;
}


function updateQuestionCounter(){
  const isExam = mode === "exam";
  const total = isExam ? (examQueue?.length || 0) : 0;
  const num = isExam ? (examIndex + 1) : 0;

  if(el.qCountChip){
    el.qCountChip.textContent = isExam ? (`${num}/${total}`) : "—";
  }
  if(el.qProgressFill){
    const pct = isExam && total ? Math.round((num/total)*100) : 0;
    el.qProgressFill.style.width = pct + "%";
  }
}

function render(q){
  clearQuestionUI();
  current = q;

  // Header chips
  if(el.qBankChip) el.qBankChip.textContent = (el.bankSel?.value || "—");
  if(el.qSystemChip) el.qSystemChip.textContent = (q.system || el.systemSel?.value || "—");
  if(el.qTopicChip) el.qTopicChip.textContent = (q.topic || "—");
  if(el.qTypeChip) el.qTypeChip.textContent = (q.qtype || "—");
  if(el.qModeChip) el.qModeChip.textContent = (mode === "exam" ? "Exam" : "Practice");
  updateQuestionCounter();
  el.qStem.textContent = q.stem || "—";

  setCaseTabs(q);

  if(q.qtype === "bowtie") renderBowtie(q);
  else renderSingleOrSata(q);

  startTimerForQuestion();
}

// ---------- Answering & feedback ----------
function getSelected(q){
  if(q.qtype === "sata"){
    return [...el.qChoices.querySelectorAll("input[type=checkbox]:checked")].map(x=>x.value);
  }
  if(q.qtype === "single"){
    return el.qChoices.querySelector("input[type=radio]:checked")?.value ?? null;
  }
  if(q.qtype === "bowtie"){
    const left = document.querySelector("input[name=bt_left]:checked")?.value ?? null;
    const mid = document.querySelector("input[name=bt_mid]:checked")?.value ?? null;
    const right = document.querySelector("input[name=bt_right]:checked")?.value ?? null;
    return {left, middle: mid, right};
  }
  return null;
}

function isCorrect(q, sel){
  if(!q) return false;

  if(q.qtype === "single"){
    if(sel==null || q.answer==null) return false;
    // If answer is stored as a letter key (A-E), compare by key.
    const aKey = isLetterToken(q.answer) ? q.answer : normLetter(q.answer);
    if(aKey && String(q.answer).trim().length <= 2){
      return normLetter(sel) === aKey;
    }
    // Otherwise compare full string.
    return String(sel) === String(q.answer);
  }

  if(q.qtype === "sata"){
    if(!Array.isArray(sel) || !Array.isArray(q.answer)) return false;
    // If answer looks like letters, compare by letter keys.
    const ansLooksLikeLetters = q.answer.every(x => String(x).trim().length<=2 && normLetter(x));
    if(ansLooksLikeLetters){
      const a = new Set(q.answer.map(x=>normLetter(x)));
      const s = new Set(sel.map(x=>normLetter(x)));
      if(a.size !== s.size) return false;
      for(const x of a) if(!s.has(x)) return false;
      return true;
    }
    // Else compare full strings.
    const a = new Set(q.answer.map(String));
    const s = new Set(sel.map(String));
    if(a.size !== s.size) return false;
    for(const x of a) if(!s.has(x)) return false;
    return true;
  }

  if(q.qtype === "bowtie"){
    if(!sel || typeof sel !== "object") return false;
    const ans = q.answer || {};
    return sel.left === ans.left && sel.middle === ans.middle && sel.right === ans.right;
  }

  return false;
}


function lockAndMarkChoices(q, sel){
  // Mark choices visually and disable further changes.
  if(!q) return;

  if(q.qtype === "single" || q.qtype === "sata"){
    const ansArr = Array.isArray(q.answer) ? q.answer : [q.answer];
    const ansLooksLikeLetters = ansArr.every(x => String(x??"").trim().length<=2 && normLetter(x));
    const correctSet = new Set(ansLooksLikeLetters ? ansArr.map(x=>normLetter(x)) : ansArr.map(x=>String(x)));

    const labels = Array.from(el.qChoices.querySelectorAll("label.choice"));
    for(const lab of labels){
      const inp = lab.querySelector("input");
      if(!inp) continue;
      const val = inp.value;

      const selected = Array.isArray(sel) ? sel.includes(val) : (sel === val);

      const choiceKey = normLetter(val); // works for "A. ..." too
      const isCorrectChoice = ansLooksLikeLetters ? correctSet.has(choiceKey) : correctSet.has(String(val));

      lab.classList.toggle("selected", !!selected);
      lab.classList.toggle("correct", !!isCorrectChoice);
      lab.classList.toggle("wrong", !!selected && !isCorrectChoice);
      lab.classList.add("disabled");
      inp.disabled = true;
    }
  }

  if(q.qtype === "bowtie"){
    const ans = q.answer || {};
    const groups = [
      {name:"btLeft", correct: ans.left},
      {name:"btMiddle", correct: ans.middle},
      {name:"btRight", correct: ans.right},
    ];
    for(const g of groups){
      const opts = Array.from(el.bowtieArea.querySelectorAll(`input[name="${g.name}"]`));
      for(const inp of opts){
        const lab = inp.closest("label.btOpt");
        const selected = inp.checked;
        const isCorrectChoice = (inp.value === g.correct);
        if(lab){
          lab.classList.toggle("correct", isCorrectChoice);
          lab.classList.toggle("wrong", selected && !isCorrectChoice);
        }
        inp.disabled = true;
      }
    }
  }
}

function sataScore(q, sel){
  const ansArr = q.answer || [];
  const ansLooksLikeLetters = ansArr.every(x => String(x??"").trim().length<=2 && normLetter(x));
  const correct = new Set(ansLooksLikeLetters ? ansArr.map(x=>normLetter(x)) : ansArr.map(String));
  const pickedArr = sel || [];
  const picked = new Set(ansLooksLikeLetters ? pickedArr.map(x=>normLetter(x)) : pickedArr.map(String));

  let hit = 0;
  for(const c of correct) if(picked.has(c)) hit++;
  const falsePos = Array.from(picked).filter(x=>!correct.has(x)).length;
  return {hit, total: correct.size, falsePos};
}

function prettyCorrect(q){
  if(!q) return "—";

  if(q.qtype === "single"){
    if(!q.answer) return "—";
    const a = String(q.answer).trim().toUpperCase();
    if(a.length<=2 && normLetter(a)){
      const ct = findChoiceTextByKey(q, a);
      return ct ? ct : a;
    }
    return String(q.answer);
  }

  if(q.qtype === "sata"){
    const ans = q.answer || [];
    if(!ans.length) return "—";
    const looksLikeLetters = ans.every(x => String(x).trim().length<=2 && normLetter(x));
    if(looksLikeLetters){
      return ans.map(k=>{
        const ct = findChoiceTextByKey(q, k);
        return `• ${ct ? ct : k}`;
      }).join("
");
    }
    return ans.map(a=>`• ${a}`).join("
");
  }

  if(q.qtype === "bowtie"){
    const a = q.answer || {};
    return `Left: ${a.left ?? "—"}
Middle: ${a.middle ?? "—"}
Right: ${a.right ?? "—"}`;
  }

  return "—";
}

function showFeedback(q, sel){
  const correct = isCorrect(q, sel);

  // scoring
  scoreTotal++;
  if(correct) scoreCorrect++;
  el.scoreLbl.textContent = `${scoreCorrect}/${scoreTotal}`;

  // xp & streak
  if(correct){
    streak++;
    xp += 10 + Math.max(0, (q.difficulty||3) - 3) * 6;
  }else{
    streak = 0;
    xp += 3;
  }
  el.xpLbl.textContent = String(xp);
  el.streakLbl.textContent = String(streak);
  el.rankLbl.textContent = rankFromXp(xp);

  // stats + readiness
  bumpStats(q, correct);

  // badges
  updateBadges();

  // feedback body
  lockAndMarkChoices(q, sel);

  let html = `<div><b>${correct ? "Correct ✅" : "Incorrect ❌"}</b></div>`;

  if(q.qtype === "single"){
    html += `<div class="muted">Correct answer:</div><div style="margin:4px 0 10px 0"><b>${escapeHtml(String(q.answer ?? "—"))}</b></div>`;
    html += choiceRationaleBlock(q);
  } else if(q.qtype === "sata"){
    const ss = sataScore(q, sel);
    html += `<div class="muted">Correct selections:</div><div style="margin:4px 0 10px 0;white-space:pre-wrap"><b>${escapeHtml(prettyCorrect(q))}</b></div>`;
    html += `<div class="muted">Your result:</div><div style="margin:4px 0 10px 0"><b>${ss.hit}/${ss.total}</b> correct${ss.falsePos ? ` • <span style="color:var(--danger)">${ss.falsePos}</span> incorrect selection${ss.falsePos>1?"s":""}` : ""}</div>`;
    html += choiceRationaleBlock(q);
  } else if(q.qtype === "bowtie"){
    html += `<div class="muted">Correct bowtie:</div><div style="margin:4px 0 10px 0;white-space:pre-wrap"><b>${escapeHtml(prettyCorrect(q))}</b></div>`;
  }

  if(q.rationale){
    html += `<details style="margin-top:10px" open>
      <summary style="cursor:pointer;font-weight:800">Rationale</summary>
      <div class="muted" style="margin-top:6px">${q.rationale}</div>
    </details>`;
  }

  el.answerArea.innerHTML = html;

  stopTimer();
}

function choiceRationaleBlock(q){
  if(!q.choice_rationales || !q.choices || !q.choices.length) return "";
  let out = `<div style="margin-top:8px">`;
  for(const ch of q.choices){
    const cr = q.choice_rationales[ch];
    if(cr) out += `<div><b>${ch}</b><div class="muted">${cr}</div></div><div style="height:6px"></div>`;
  }
  out += `</div>`;
  return out;
}

// ---------- Timer ----------
function stopTimer(){
  if(el.qTimerChip) el.qTimerChip.textContent = (timerSeconds>0 ? `Timer: ${timerLeft || 0}s` : "Timer: Off");
  if(timerHandle){ clearInterval(timerHandle); timerHandle = null; }
  timerLeft = 0;
  el.timerLbl.textContent = "—";
}
function startTimerForQuestion(){
  stopTimer();
  timerSeconds = parseInt(el.timerSel.value || "0", 10) || 0;
  if(timerSeconds <= 0){ el.timerLbl.textContent = "Off"; if(el.qTimerChip) el.qTimerChip.textContent = "Timer: Off"; return; }
  timerLeft = timerSeconds;
  el.timerLbl.textContent = `${timerLeft}s`;
  if(el.qTimerChip) el.qTimerChip.textContent = `Timer: ${timerLeft}s`;
  timerHandle = setInterval(()=>{
    timerLeft--;
    el.timerLbl.textContent = `${timerLeft}s`;
    if(el.qTimerChip) el.qTimerChip.textContent = `Timer: ${timerLeft}s`;
    if(timerLeft <= 0){
      stopTimer();
      // Auto-submit as incorrect if no selection made
      if(current){
        const sel = getSelected(current);
        showFeedback(current, sel);
      }
    }
  }, 1000);
}

// ---------- Badges & rank ----------
const BADGES = [
  {id:"first_correct", label:"First Blood", test:()=>scoreCorrect>=1},
  {id:"streak5", label:"Streak x5", test:()=>streak>=5},
  {id:"streak10", label:"Streak x10", test:()=>streak>=10},
  {id:"xp250", label:"XP 250", test:()=>xp>=250},
  {id:"xp500", label:"XP 500", test:()=>xp>=500},
  {id:"exam_finish", label:"Exam Finisher", test:()=>loadExamCount()>=1},
  {id:"accuracy80", label:"80% Club", test:()=> (scoreTotal>=20) && (scoreCorrect/scoreTotal)>=0.80},
];

function updateBadges(){
  el.badgeRow.innerHTML = "";
  for(const b of BADGES){
    const on = b.test();
    const chip = document.createElement("div");
    chip.className = "badge" + (on ? " on" : "");
    chip.textContent = b.label;
    el.badgeRow.appendChild(chip);
  }
}

function rankFromXp(x){
  if(x>=2000) return "Legend";
  if(x>=1200) return "Expert";
  if(x>=700) return "Advanced";
  if(x>=350) return "Intermediate";
  return "Novice";
}

// ---------- Leaderboard (exam only) ----------
function lbKey(){ return "nr_leaderboard_v1"; }
function loadLb(){
  try{ return JSON.parse(localStorage.getItem(lbKey())||"[]") || []; }catch{ return []; }
}
function saveLb(arr){ localStorage.setItem(lbKey(), JSON.stringify(arr)); }
function loadExamCount(){
  const lb = loadLb();
  return lb.length;
}
function renderLb(){
  const lb = loadLb().slice().sort((a,b)=>b.scorePct - a.scorePct).slice(0,20);
  if(!lb.length){ el.lbArea.textContent = "Finish an exam to post a score."; return; }
  el.lbArea.textContent = lb.map((x,i)=>{
    const date = new Date(x.ts).toLocaleDateString();
    return `${String(i+1).padStart(2,"0")}. ${x.initials}  ${x.scorePct}%  (${x.correct}/${x.total})  ${x.bank}  ${date}`;
  }).join("\n");
}

// ---------- Exam flow ----------
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function buildEligiblePool(){
  const flat = [];
  for(const q of singles) if(matchesFilters(q)) flat.push(q);
  for(const cl of clusters){
    for(const q of cl) if(matchesFilters(q)) flat.push(q);
  }
  return flat;
}
function startExam(){
  mode = "exam";
  examQueue = [];
  examIndex = 0;
  scoreCorrect = 0; scoreTotal = 0;
  el.modeLbl.textContent = "Exam";
  el.scoreLbl.textContent = "0/0";

  // numeric exam length (student-selected)
  let n = parseInt(el.examCount?.value || "0", 10);
  if(!Number.isFinite(n) || n < 1) n = 1;

  const pool = buildEligiblePool();
  if(!pool.length){
    el.loadStatus.textContent = "No questions match filters";
    return;
  }
  shuffle(pool);

  // Prefer unique questions first
  examQueue = pool.slice(0, Math.min(n, pool.length));
  // If user requests more than available, fill remaining with repeats
  while(examQueue.length < n){
    examQueue.push(pool[Math.floor(Math.random()*pool.length)]);
  }

  render(examQueue[0]);
  el.loadStatus.textContent = `Exam 1/${examQueue.length}`;
}

function next(){
  if(mode === "exam"){
    if(examIndex < examQueue.length-1){
      examIndex++;
      el.loadStatus.textContent = `Exam ${examIndex+1}/${examQueue.length}`;
      render(examQueue[examIndex]);
      return;
    }
    // finish exam
    const pct = scoreTotal ? Math.round((scoreCorrect/scoreTotal)*100) : 0;
    const initials = (el.initialsInp.value || "AAA").toUpperCase().replace(/[^A-Z]/g,"").slice(0,3) || "AAA";
    const entry = {initials, correct:scoreCorrect, total:scoreTotal, scorePct:pct, bank: el.bankSel.value, ts: Date.now()};
    const lb = loadLb();
    lb.push(entry);
    saveLb(lb);
    renderLb();
    updateBadges();
    mode = "practice";
    el.modeLbl.textContent = "Practice";
    el.loadStatus.textContent = "Exam saved ✅";
    return;
  }

  const q = pickNext();
  if(!q){
    el.loadStatus.textContent = "No questions match filters";
    return;
  }
  el.loadStatus.textContent = "Practice";
  render(q);
}

function reset(){
  mode = "practice";
  scoreCorrect = 0; scoreTotal = 0;
  xp = 0; streak = 0;
  el.modeLbl.textContent = "Practice";
  el.scoreLbl.textContent = "0/0";
  el.xpLbl.textContent = "0";
  el.streakLbl.textContent = "0";
  el.rankLbl.textContent = "Novice";
  updateBadges();
  updateReadinessGauge();
  clearQuestionUI();
  el.loadStatus.textContent = "Ready";
  stopTimer();
}

// ---------- Controls ----------
async function reloadAll(){
  el.loadStatus.textContent = "Loading…";
  try{
    if(!manifest) await loadManifest();
    // fill system/topic based on bank
    const bankName = el.bankSel.value || manifest.banks[0].name;
    setSystemAndTopicOptions(bankName);
    await loadBank(bankName);
    el.loadStatus.textContent = "Loaded";
    updateBadges();
    updateReadinessGauge();
    renderLb();
    // show an initial question if available
    const q = pickNext();
    if(q) render(q);
  }catch(err){
    el.loadStatus.textContent = "Load failed";
    el.answerArea.innerHTML = `<div><b>Error</b></div><div class="muted">${String(err.message||err)}</div>`;
  }
}

function initDropdownBehavior(){
  el.bankSel.addEventListener("change", async ()=>{
    const bankName = el.bankSel.value;
    setSystemAndTopicOptions(bankName);
    await loadBank(bankName);
    refreshDynamicTopics(bankName);
    // show a question
    const q = pickNext();
    if(q) render(q);
  });
  // when filters change, just pick a new question
  for(const s of [el.systemSel, el.topicSel, el.typeSel]){
    s.addEventListener("change", ()=>{
      const bankName = el.bankSel.value;
      if(s === el.systemSel) refreshDynamicTopics(bankName);
      const q = pickNext();
      if(q) render(q);
    });
  }
  el.timerSel.addEventListener("change", ()=>{
    // restart timer for current question
    if(current) startTimerForQuestion();
  });
}


// ---------- Bank Validator ----------
let lastValidateReport = null;

function openValidator(){
  el.validatorModal.classList.remove("hidden");
  el.validatorOut.textContent = "Click “Run validation”.";
  el.downloadValidateBtn.disabled = true;
  lastValidateReport = null;
}

function closeValidator(){
  el.validatorModal.classList.add("hidden");
}

async function runBankValidation(){
  const issues = [];
  const bankSummaries = [];
  const globalIds = new Map(); // id -> {bank, idx}

  const allowedTypes = new Set(["single","sata","bowtie"]);
  const letterInStem = /(^|\n)\s*[A-E][\.|\)]\s+/m;

  for(const b of (manifest?.banks || [])){
    let data;
    try{
      data = await fetchJson(b.file);
    }catch(err){
      issues.push({bank:b.name, id:null, issue:`Failed to load ${b.file}: ${String(err?.message||err)}`});
      continue;
    }
    if(!Array.isArray(data)){
      issues.push({bank:b.name, id:null, issue:`${b.file} is not an array`});
      continue;
    }

    let count = 0;
    let localIds = new Set();
    for(let i=0;i<data.length;i++){
      const raw = data[i] || {};
      const q = normalizeQuestion(raw, b.name);
      count++;

      const qid = q.id ?? `(index:${i})`;
      if(q.id){
        if(localIds.has(q.id)) issues.push({bank:b.name, id:qid, issue:"Duplicate question id within bank"});
        localIds.add(q.id);

        if(globalIds.has(q.id)){
          const prev = globalIds.get(q.id);
          issues.push({bank:b.name, id:qid, issue:`Duplicate id across banks (also in ${prev.bank})`});
        }else{
          globalIds.set(q.id, {bank:b.name, idx:i});
        }
      }else{
        issues.push({bank:b.name, id:qid, issue:"Missing id"});
      }

      if(!q.stem || typeof q.stem !== "string") issues.push({bank:b.name, id:qid, issue:"Missing/invalid stem"});
      if(q.stem && letterInStem.test(q.stem)) issues.push({bank:b.name, id:qid, issue:"Detected lettered choice fragment inside stem (e.g., 'E.')"});
      if(!allowedTypes.has(q.qtype)) issues.push({bank:b.name, id:qid, issue:`Invalid qtype: ${String(q.qtype)}`});

      if(q.qtype === "single"){
        if(!Array.isArray(q.choices) || q.choices.length < 2) issues.push({bank:b.name, id:qid, issue:"Single question missing choices"});
        if(typeof q.answer !== "string" || !q.answer.trim()) issues.push({bank:b.name, id:qid, issue:"Single question missing correct answer"});
        if(Array.isArray(q.choices) && typeof q.answer === "string" && q.choices.length && !q.choices.includes(q.answer)){
          issues.push({bank:b.name, id:qid, issue:"Correct answer not found in choices (text mismatch)"});
        }
      }

      if(q.qtype === "sata"){
        if(!Array.isArray(q.choices) || q.choices.length < 3) issues.push({bank:b.name, id:qid, issue:"SATA missing choices"});
        if(!Array.isArray(q.answer) || q.answer.length < 2) issues.push({bank:b.name, id:qid, issue:"SATA missing/invalid correct selections"});
        if(Array.isArray(q.answer) && Array.isArray(q.choices)){
          for(const a of q.answer){
            if(!q.choices.includes(a)) issues.push({bank:b.name, id:qid, issue:"One or more SATA answers not found in choices (text mismatch)"});
          }
        }
      }

      if(q.qtype === "bowtie"){
        const bt = q.bowtie;
        if(!bt || !Array.isArray(bt.left_options) || !Array.isArray(bt.middle_options) || !Array.isArray(bt.right_options)){
          issues.push({bank:b.name, id:qid, issue:"Bowtie missing bowtie option arrays"});
        }
        const ans = q.answer || {};
        if(!ans || typeof ans !== "object") issues.push({bank:b.name, id:qid, issue:"Bowtie missing answer object"});
        if(bt && ans){
          if(ans.left && !bt.left_options.includes(ans.left)) issues.push({bank:b.name, id:qid, issue:"Bowtie left answer not in left options"});
          if(ans.middle && !bt.middle_options.includes(ans.middle)) issues.push({bank:b.name, id:qid, issue:"Bowtie middle answer not in middle options"});
          if(ans.right && !bt.right_options.includes(ans.right)) issues.push({bank:b.name, id:qid, issue:"Bowtie right answer not in right options"});
        }
      }
    }

    bankSummaries.push({bank:b.name, file:b.file, questions:count});
  }

  // Summary
  const report = {
    generatedAt: new Date().toISOString(),
    banks: bankSummaries,
    issueCount: issues.length,
    issues
  };
  return report;
}

function formatValidationReport(report){
  const lines = [];
  lines.push(`Bank Validator Report`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Banks: ${report.banks.length}`);
  const totalQ = report.banks.reduce((a,b)=>a+(b.questions||0),0);
  lines.push(`Total questions: ${totalQ}`);
  lines.push(`Issues: ${report.issueCount}`);
  lines.push(``);
  for(const b of report.banks){
    lines.push(`- ${b.bank}: ${b.questions} (${b.file})`);
  }
  if(report.issueCount){
    lines.push(``);
    lines.push(`Top issues (first 50):`);
    report.issues.slice(0,50).forEach((it, idx)=>{
      lines.push(`${idx+1}. [${it.bank}] ${it.id ?? ""} — ${it.issue}`);
    });
    if(report.issueCount > 50) lines.push(`…and ${report.issueCount-50} more`);
  }else{
    lines.push(``);
    lines.push(`✅ No issues found.`);
  }
  return lines.join("\n");
}

function downloadJsonReport(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function bindButtons(){
  el.reloadBtn.addEventListener("click", reloadAll);
  if(el.validateBtn){
    el.validateBtn.addEventListener("click", openValidator);
    el.validatorCloseBtn?.addEventListener("click", closeValidator);
    el.validatorModal?.addEventListener("click", (e)=>{ if(e.target === el.validatorModal) closeValidator(); });
    el.runValidateBtn?.addEventListener("click", async ()=>{
      el.runValidateBtn.disabled = true;
      el.validatorOut.textContent = "Running validation…";
      try{
        const rep = await runBankValidation();
        lastValidateReport = rep;
        el.validatorOut.textContent = formatValidationReport(rep);
        el.downloadValidateBtn.disabled = false;
      }catch(err){
        el.validatorOut.textContent = `Validation failed: ${String(err?.message||err)}`;
      }finally{
        el.runValidateBtn.disabled = false;
      }
    });
    el.downloadValidateBtn?.addEventListener("click", ()=>{
      if(!lastValidateReport) return;
      downloadJsonReport(lastValidateReport, `bank_validation_${new Date().toISOString().slice(0,10)}.json`);
    });
  }
  el.nextBtn.addEventListener("click", next);
  el.startExamBtn.addEventListener("click", startExam);
  el.resetBtn.addEventListener("click", reset);
  el.submitBtn.addEventListener("click", ()=>{
    if(!current) return;
    const sel = getSelected(current);
    showFeedback(current, sel);
  });
  el.showAnswerBtn.addEventListener("click", ()=>{
    if(!current) return;
    const sel = getSelected(current);
    showFeedback(current, sel);
  });
  el.openLbBtn.addEventListener("click", renderLb);
  el.clearLbBtn.addEventListener("click", ()=>{
    localStorage.removeItem(lbKey());
    renderLb();
    updateBadges();
  });
}

window.addEventListener("DOMContentLoaded", async ()=>{
  initThemeUI();
  await loadManifest();
  // default bank: Anatomy
  el.bankSel.value = "Anatomy";
  setSystemAndTopicOptions("Anatomy");
  initDropdownBehavior();
  bindButtons();
  updateBadges();
  updateReadinessGauge();
  renderLb();
  await reloadAll();
});