// LVN HESI WebApp DisplayFix v1
// Goal: prevent "q.choices.forEach" crashes and correctly render singles/SATA/bowtie + case tabs.
// Drop-in: keep questions.json in same folder.

const $ = (sel)=>document.querySelector(sel);
const el = {
  loadStatus: $("#loadStatus"),
  countStatus: $("#countStatus"),
  topicLbl: $("#topicLbl"),
  typeLbl: $("#typeLbl"),
  diffLbl: $("#diffLbl"),
  qStem: $("#qStem"),
  qChoices: $("#qChoices"),
  bowtieArea: $("#bowtieArea"),
  caseTabs: $("#caseTabs"),
  caseBody: $("#caseBody"),
  answerArea: $("#answerArea"),
  submitBtn: $("#submitBtn"),
  showAnswerBtn: $("#showAnswerBtn"),
  nextBtn: $("#nextBtn"),
  startExamBtn: $("#startExamBtn"),
  resetBtn: $("#resetBtn"),
  reloadBtn: $("#reloadBtn"),
};

let bank = [];           // all questions (singles/sata/bowtie), flattened
let clusters = [];       // arrays of questions grouped by case_group.id if present
let mode = "practice";   // "practice" or "exam"
let examQueue = [];
let examIndex = 0;
let current = null;
let selected = null;

function cacheBust(url){
  return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
}

async function fetchJson(url){
  const res = await fetch(cacheBust(url), { cache: "no-store" });
  if(!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return await res.json();
}

function normalizeQuestion(q){
  // Ensure required keys exist, avoid undefined crashes.
  const nq = {...q};
  nq.qtype = nq.qtype || (Array.isArray(nq.answer) ? "sata" : "single");
  nq.topic = nq.topic || "Uncategorized";
  nq.difficulty = Number.isFinite(+nq.difficulty) ? +nq.difficulty : 3;

  // Normalize case tabs
  if(nq.case && !nq.case.tabs && nq.tabs){
    // handle legacy shape
    nq.case = { tabs: nq.tabs };
  }
  if(nq.case && !nq.case.tabs && nq.case.case_study){
    // sometimes case directly has fields
    nq.case = { tabs: {
      case_study: nq.case.case_study,
      vitals: nq.case.vitals,
      labs: nq.case.labs,
      nursing_actions: nq.case.nursing_actions,
      md_orders: nq.case.md_orders
    }};
  }

  // Ensure choices exist for single/sata
  if((nq.qtype === "single" || nq.qtype === "sata") && !Array.isArray(nq.choices)){
    nq.choices = [];
  }
  // Ensure choice_rationales
  if(!nq.choice_rationales || typeof nq.choice_rationales !== "object"){
    nq.choice_rationales = {};
  }
  return nq;
}

function buildClusters(items){
  // Group by case_group.id if present; otherwise no clusters.
  const by = new Map();
  for(const raw of items){
    const q = normalizeQuestion(raw);
    const cg = q.case_group || (q.case && q.case.case_group) || null;
    const id = cg?.id || q.case_group_id || null;
    if(id){
      if(!by.has(id)) by.set(id, []);
      by.get(id).push(q);
    }else{
      bank.push(q);
    }
  }
  // Sort within cluster by sequence if present
  for(const [id, arr] of by.entries()){
    arr.sort((a,b)=>{
      const sa = a.case_group?.sequence ?? 9999;
      const sb = b.case_group?.sequence ?? 9999;
      return sa - sb;
    });
    clusters.push(arr);
  }
}

function setCounts(){
  el.countStatus.textContent = `Questions: ${bank.length} • Clusters: ${clusters.length}`;
}

function setCaseTabs(q){
  el.caseTabs.innerHTML = "";
  el.caseBody.textContent = "Load a case-based question to view tabs.";
  if(!q?.case?.tabs) return;

  const tabs = q.case.tabs;
  const keys = ["case_study","vitals","labs","nursing_actions","md_orders"].filter(k => tabs[k] != null && String(tabs[k]).trim() !== "");
  if(keys.length === 0) return;

  const labels = {
    case_study: "Case",
    vitals: "Vitals",
    labs: "Labs",
    nursing_actions: "Nurse Did",
    md_orders: "MD Orders"
  };

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

function clearUI(){
  el.qStem.textContent = "—";
  el.qChoices.innerHTML = "";
  el.bowtieArea.style.display = "none";
  el.bowtieArea.innerHTML = "";
  el.topicLbl.textContent = "—";
  el.typeLbl.textContent = "—";
  el.diffLbl.textContent = "—";
  el.answerArea.textContent = "Select an answer to see feedback.";
  el.submitBtn.disabled = true;
  el.showAnswerBtn.disabled = true;
  selected = null;
}

function renderSingleOrSata(q){
  el.qChoices.innerHTML = "";
  const isSata = q.qtype === "sata";
  const inputType = isSata ? "checkbox" : "radio";

  if(!q.choices.length){
    // fail-safe so UI doesn't go blank
    const warn = document.createElement("div");
    warn.className = "muted";
    warn.textContent = "This question has no choices (data issue).";
    el.qChoices.appendChild(warn);
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
  grid.appendChild(makeCol(bt.left_label || "Left", bt.left_options, "bt_left"));
  grid.appendChild(makeCol(bt.middle_label || "Middle", bt.middle_options, "bt_mid"));
  grid.appendChild(makeCol(bt.right_label || "Right", bt.right_options, "bt_right"));
  el.bowtieArea.appendChild(grid);

  el.submitBtn.disabled = false;
  el.showAnswerBtn.disabled = false;
}

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
  if(q.qtype === "single"){
    return sel && q.answer && sel === q.answer;
  }
  if(q.qtype === "sata"){
    if(!Array.isArray(sel) || !Array.isArray(q.answer)) return false;
    const a = new Set(q.answer);
    const s = new Set(sel);
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

function showFeedback(q, sel, forceShowAnswer=false){
  const correct = isCorrect(q, sel);
  let html = "";
  if(q.qtype === "single"){
    html += `<div><b>${correct ? "Correct ✅" : "Incorrect ❌"}</b></div>`;
    html += `<div class="muted">Correct answer: <b>${q.answer ?? "—"}</b></div>`;
    if(q.choice_rationales && q.choices){
      html += `<div style="margin-top:8px">`;
      for(const ch of q.choices){
        const cr = q.choice_rationales[ch];
        if(cr) html += `<div><b>${ch}</b><div class="muted">${cr}</div></div><div style="height:6px"></div>`;
      }
      html += `</div>`;
    }
  } else if(q.qtype === "sata"){
    html += `<div><b>${correct ? "Correct ✅" : "Incorrect ❌"}</b></div>`;
    html += `<div class="muted">Correct selections:</div><ul>${(q.answer||[]).map(a=>`<li>${a}</li>`).join("")}</ul>`;
    if(q.choice_rationales){
      html += `<div style="margin-top:8px">`;
      for(const ch of q.choices || []){
        const cr = q.choice_rationales[ch];
        if(cr) html += `<div><b>${ch}</b><div class="muted">${cr}</div></div><div style="height:6px"></div>`;
      }
      html += `</div>`;
    }
  } else if(q.qtype === "bowtie"){
    const ans = q.answer || {};
    html += `<div><b>${correct ? "Correct ✅" : "Incorrect ❌"}</b></div>`;
    html += `<div class="muted">Correct bowtie:</div>
      <ul>
        <li><b>${ans.left ?? "—"}</b></li>
        <li><b>${ans.middle ?? "—"}</b></li>
        <li><b>${ans.right ?? "—"}</b></li>
      </ul>`;
  }
  if(q.rationale){
    html += `<hr style="border:0;border-top:1px solid var(--border);margin:10px 0" />`;
    html += `<div><b>Rationale</b></div><div class="muted">${q.rationale}</div>`;
  }
  el.answerArea.innerHTML = html || `<div class="muted">No rationale available.</div>`;
}

function render(q){
  clearUI();
  current = q;
  el.loadStatus.textContent = (mode==="exam") ? `Exam ${examIndex+1}/${examQueue.length}` : "Practice";
  el.topicLbl.textContent = q.topic || "—";
  el.typeLbl.textContent = q.qtype || "—";
  el.diffLbl.textContent = String(q.difficulty ?? "—");
  el.qStem.textContent = q.stem || "—";
  setCaseTabs(q);

  if(q.qtype === "bowtie") renderBowtie(q);
  else renderSingleOrSata(q);
}

function pickNextPractice(){
  // Mix: randomly choose either a cluster question or a single question.
  const pickCluster = clusters.length && Math.random() < 0.55;
  if(pickCluster){
    const cl = clusters[Math.floor(Math.random()*clusters.length)];
    const q = cl[Math.floor(Math.random()*cl.length)];
    return q;
  }
  if(bank.length){
    return bank[Math.floor(Math.random()*bank.length)];
  }
  return null;
}

function startExam(){
  mode = "exam";
  examQueue = [];
  examIndex = 0;
  // Build a 75Q mix
  for(let i=0;i<75;i++){
    const q = pickNextPractice();
    if(q) examQueue.push(q);
  }
  if(!examQueue.length){
    el.loadStatus.textContent = "No questions available";
    return;
  }
  render(examQueue[0]);
}

function next(){
  if(mode === "exam"){
    examIndex = Math.min(examIndex+1, examQueue.length-1);
    render(examQueue[examIndex]);
  }else{
    const q = pickNextPractice();
    if(!q){
      el.loadStatus.textContent = "No questions available";
      return;
    }
    render(q);
  }
}

function reset(){
  mode = "practice";
  examQueue = [];
  examIndex = 0;
  clearUI();
  el.loadStatus.textContent = "Ready";
}

async function loadAll(){
  el.loadStatus.textContent = "Loading…";
  bank = []; clusters = [];
  clearUI();

  try{
    // Try manifest-part loading first (if present), otherwise questions.json
    let items = null;
    try{
      const man = await fetchJson("questions_manifest.json");
      if(man && Array.isArray(man.parts) && man.parts.length){
        items = [];
        for(const p of man.parts){
          try{
            const part = await fetchJson(p);
            if(Array.isArray(part)) items.push(...part);
          }catch(e){ /* ignore part errors */ }
        }
      }
    }catch(e){ /* manifest not present */ }

    if(!items){
      items = await fetchJson("questions.json");
    }
    if(!Array.isArray(items)) throw new Error("questions payload is not an array");

    buildClusters(items);
    setCounts();

    el.loadStatus.textContent = "Loaded";
    // Render first question automatically
    const first = pickNextPractice();
    if(first) render(first);
    else el.loadStatus.textContent = "Loaded (no usable questions)";
  }catch(err){
    el.loadStatus.textContent = "Load failed";
    el.answerArea.innerHTML = `<div><b>Error</b></div><div class="muted">${String(err.message||err)}</div>`;
    setCounts();
  }
}

el.submitBtn.addEventListener("click", ()=>{
  if(!current) return;
  const sel = getSelected(current);
  showFeedback(current, sel);
});

el.showAnswerBtn.addEventListener("click", ()=>{
  if(!current) return;
  showFeedback(current, getSelected(current), true);
});

el.nextBtn.addEventListener("click", next);
el.startExamBtn.addEventListener("click", startExam);
el.resetBtn.addEventListener("click", reset);
el.reloadBtn.addEventListener("click", loadAll);

window.addEventListener("DOMContentLoaded", loadAll);
