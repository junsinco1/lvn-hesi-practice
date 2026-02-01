// Recovery v3: disable SW + clear caches
try{
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
  }
  if("caches" in window){
    caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))).catch(()=>{});
  }
}catch(e){}

async function fetchJsonNoCache(url){
  const u=url + (url.includes("?")?"&":"?") + "v=" + Date.now();
  const res = await fetch(u, { cache: "no-store" });
  if(!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return await res.json();
}

async function loadQuestionsUnified(){
  const errors=[];
  try{
    const man = await fetchJsonNoCache("questions_manifest.json");
    if(man && Array.isArray(man.parts) && man.parts.length){
      const all=[];
      for(const p of man.parts){
        try{
          const part = await fetchJsonNoCache(p);
          if(Array.isArray(part)) all.push(...part);
          else errors.push(`${p} -> not an array`);
        }catch(e){ errors.push(String(e.message||e)); }
      }
      if(all.length) return {questions: all, errors};
      errors.push("Manifest loaded but no questions were assembled.");
    }else{
      errors.push("questions_manifest.json missing 'parts' array.");
    }
  }catch(e){ errors.push(String(e.message||e)); }

  // optional fallback
  try{
    const q = await fetchJsonNoCache("questions.json");
    if(Array.isArray(q) && q.length) return {questions: q, errors};
    errors.push("questions.json loaded but empty or not an array.");
  }catch(e){ errors.push(String(e.message||e)); }

  return {questions: [], errors};
}



(() => {
  const $ = (id) => document.getElementById(id);
  const LS = { xp:"lvn_xp_v1", streak:"lvn_streak_v1", mastery:"lvn_mastery_v1", leaderboard:"lvn_leaderboard_v1", settings:"lvn_settings_v2" };
  const state = { QUESTIONS:[], pool:[], current:null, mode:"Practice", sel:null, answered:false,
    score:{correct:0,total:0}, exam:{active:false, idx:0, items:[], startedAt:0}, timer:{sec:0,left:0,handle:null}, xp:0, streak:0, mastery:{} };

  function banner(msg){ const el=$("err"); el.textContent=msg||""; el.classList.toggle("show",!!msg); }
  function safeJsonParse(s,fallback){ try{ return JSON.parse(s);}catch(e){ return fallback; } }

  function loadLocal(){
    state.xp=Number(localStorage.getItem(LS.xp)||0);
    state.streak=Number(localStorage.getItem(LS.streak)||0);
    state.mastery=safeJsonParse(localStorage.getItem(LS.mastery)||"{}",{});
    const settings=safeJsonParse(localStorage.getItem(LS.settings)||"{}",{});
    if(settings.theme) $("theme").value=settings.theme;
    if(settings.accent) $("accent").value=settings.accent;
    if(settings.timer!=null) $("timerSel").value=String(settings.timer);
  }
  function saveLocal(){
    localStorage.setItem(LS.xp,String(state.xp));
    localStorage.setItem(LS.streak,String(state.streak));
    localStorage.setItem(LS.mastery,JSON.stringify(state.mastery||{}));
    localStorage.setItem(LS.settings,JSON.stringify({theme:$("theme").value,accent:$("accent").value,timer:Number($("timerSel").value||0)}));
  }

  function rankFromXP(xp){
    const tiers=[[0,"Novice"],[250,"Apprentice"],[650,"Competent"],[1300,"Proficient"],[2400,"Advanced"],[3800,"Expert"],[5600,"Clinical Ace"]];
    let r=tiers[0][1]; for(const [min,name] of tiers){ if(xp>=min) r=name; } return r;
  }
  function updateHUD(){
    $("mode").textContent = state.mode + (state.exam.active ? ` (${state.exam.idx+1}/${state.exam.items.length})` : "");
    $("score").textContent = `${state.score.correct}/${state.score.total}`;
    $("xp").textContent=String(state.xp);
    $("streak").textContent=String(state.streak);
    $("rank").textContent=rankFromXP(state.xp);
    const acc=state.score.total?Math.round((state.score.correct/state.score.total)*100):null;
    $("acc").textContent=acc==null?"--":(acc+"%");
    $("progress").style.width=state.exam.active?`${Math.round(((state.exam.idx)/Math.max(1,state.exam.items.length))*100)}%`:"0%";
  }

  async function fetchJson(url){
    const resp=await fetch(url,{cache:"no-store"});
    if(!resp.ok){ const txt=await resp.text(); throw new Error(`Fetch failed ${resp.status} for ${url}. First: ${txt.slice(0,120)}`); }
    return await resp.json();
  }
  async function loadQuestions(){
    const base=new URL("./",window.location.href);
    const man=await fetchJson(new URL("questions_manifest.json",base).toString());
    const arr=[];
    for(const p of man.parts){
      const data=await fetchJson(new URL(p,base).toString());
      if(Array.isArray(data)) arr.push(...data);
      else if(data && Array.isArray(data.questions)) arr.push(...data.questions);
    }
    return arr;
  }
  function normTopic(t){ return (t && String(t).trim()) ? String(t).trim() : "General"; }
  function rebuildTopicList(){
    const topics=Array.from(new Set(state.QUESTIONS.map(q=>normTopic(q.topic)))).sort();
    const sel=$("topic"); sel.innerHTML=""; sel.appendChild(new Option("Any","any"));
    topics.forEach(t=>sel.appendChild(new Option(t,t)));
  }
  function applyTheme(){ document.body.dataset.theme=$("theme").value; document.body.dataset.accent=$("accent").value; saveLocal(); }
  function buildPool(){
    const t=$("topic").value, qt=$("qtype").value, lvl=$("level").value;
    state.pool=state.QUESTIONS.filter(q=>{
      const okT=(t==="any"||normTopic(q.topic)===t);
      const okTy=(qt==="any"||(q.qtype||q.type)===qt);
      const okL=(lvl==="any"||(q.level||"LVN")===lvl);
      return okT&&okTy&&okL;
    });
    banner(state.pool.length?"":"No questions match this filter. Try Any.");
  }
  function pickOne(){ return state.pool.length?state.pool[Math.floor(Math.random()*state.pool.length)]:null; }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function setTabs(q){
    const tabs=$("tabs"); tabs.innerHTML="";
    const hasCase=q && q.case;
    const items=hasCase ? [
      ["Case", q.case.case || q.case.summary || "—"],
      ["Vitals", JSON.stringify(q.case.vitals||[], null, 2)],
      ["Labs", JSON.stringify(q.case.labs||{}, null, 2)],
      ["Nurse Did", (q.case.nurse||[]).join("
")||"—"],
      ["Provider Orders", (q.case.orders||[]).join("
")||"—"],
      ["Rationale", q.rationale||"—"]
    ] : [["Info","No case tabs for this question."]];
    items.forEach(([name,body],idx)=>{
      const b=document.createElement("div"); b.className="tab"+(idx===0?" active":""); b.textContent=name;
      b.onclick=()=>{ [...tabs.children].forEach(x=>x.classList.remove("active")); b.classList.add("active"); $("tabBody").innerHTML=`<pre>${escapeHtml(String(body))}</pre>`; };
      tabs.appendChild(b); if(idx===0) $("tabBody").innerHTML=`<pre>${escapeHtml(String(body))}</pre>`;
    });
  }

  // Timer
  function stopTimer(){ if(state.timer.handle){ clearInterval(state.timer.handle); state.timer.handle=null; } }
  function setTimerDisplay(){
    $("timer").textContent = state.timer.sec ? `${state.timer.left}s` : "--";
    $("timer").style.color = (state.timer.sec && state.timer.left<=10) ? "var(--warn)" : "";
  }
  function startTimer(){
    stopTimer();
    state.timer.sec=Number($("timerSel").value||0);
    state.timer.left=state.timer.sec;
    saveLocal();
    setTimerDisplay();
    if(!state.timer.sec) return;
    state.timer.handle=setInterval(()=>{
      if(state.answered){ stopTimer(); setTimerDisplay(); return; }
      state.timer.left -= 1; setTimerDisplay();
      if(state.timer.left<=0){
        stopTimer();
        if(!state.answered){ banner("Time's up! Auto-submitted."); gradeCurrent(true); }
      }
    },1000);
  }

  function awardXP(q, wasCorrect){
    const lvl=(q.level||"LVN");
    const base=(lvl==="RN-very-hard")?20:12;
    const streakBonus=(wasCorrect && state.streak>=3)?Math.min(10,state.streak):0;
    state.xp += wasCorrect ? (base+streakBonus) : 2;
  }
  function updateMastery(q, wasCorrect){
    const t=normTopic(q.topic);
    const m=state.mastery||{};
    const cur=m[t]||{seen:0,correct:0};
    cur.seen+=1; if(wasCorrect) cur.correct+=1;
    m[t]=cur; state.mastery=m;
  }
  function markScore(wasCorrect){ state.score.total+=1; if(wasCorrect) state.score.correct+=1; }

  function paintSingle(ans, sel){
    [...document.querySelectorAll(".choice")].forEach(n=>{
      const t=n.textContent;
      if(t===ans) n.classList.add("correct");
      if(sel && t===sel && sel!==ans) n.classList.add("wrong");
    });
  }
  function paintSATA(sel, correct){
    [...document.querySelectorAll(".choice")].forEach(n=>{
      const t=n.textContent;
      if(correct.includes(t)) n.classList.add("correct");
      if(sel.includes(t) && !correct.includes(t)) n.classList.add("wrong");
    });
  }
  function showRationale(q, extra){
    const el=$("rat");
    el.innerHTML=`<pre>${escapeHtml(q.rationale||"—")}${extra?("\n\n"+escapeHtml(extra)):""}</pre>`;
  }

  function gradeCurrent(timedOut=false){
    const q=state.current;
    if(!q || state.answered) return;
    const qtype=q.qtype||q.type||"single";
    const ans=q.answer;
    let wasCorrect=false;
    let extra="";
    if(qtype==="sata"){
      const sel=Array.isArray(state.sel)?state.sel:[];
      const correct=Array.isArray(ans)?ans:[];
      const right=sel.filter(x=>correct.includes(x)).length;
      const wrong=sel.filter(x=>!correct.includes(x)).length;
      const denom=Math.max(correct.length,1);
      const score=Math.max(0,Math.min(1,(right-wrong*0.5)/denom));
      wasCorrect=score>=0.80;
      state.answered=true;
      paintSATA(sel,correct);
      extra=`NGN SATA Score: ${(score*100).toFixed(0)}% (>=80% counts correct)`;
    }else if(qtype==="bowtie" && q.bowtie){
      const b=q.bowtie;
      const left=$("bow_left").value, mid=$("bow_middle").value, right=$("bow_right").value;
      if(!left||!mid||!right){ banner("Select an option in all three bowtie columns before submitting."); return; }
      wasCorrect=(left===b.left_answer && mid===b.middle_answer && right===b.right_answer);
      state.answered=true;
      extra=`Correct: ${b.left_answer} | ${b.middle_answer} | ${b.right_answer}`;
    }else{
      wasCorrect=(state.sel===ans);
      state.answered=true;
      paintSingle(ans,state.sel);
    }

    if(wasCorrect) state.streak += 1; else state.streak = 0;
    awardXP(q,wasCorrect);
    updateMastery(q,wasCorrect);
    markScore(wasCorrect);
    saveLocal();
    stopTimer();
    updateHUD();
    showRationale(q, (timedOut?("Timed out. "):"") + extra);
    renderAfterSubmitControls();
  }

  function renderAfterSubmitControls(){
    const actions=$("afterActions");
    if(!actions) return;
    actions.innerHTML="";
    if(state.exam.active){
      const btn=document.createElement("button");
      btn.textContent=(state.exam.idx<state.exam.items.length-1)?"Next Question":"Finish Exam";
      btn.onclick=()=>advanceExam();
      actions.appendChild(btn);
    }else{
      const btn=document.createElement("button");
      btn.textContent="Next Practice";
      btn.onclick=()=>nextPractice();
      actions.appendChild(btn);
    }
    const btn2=document.createElement("button");
    btn2.textContent="Leaderboard";
    btn2.className="secondary";
    btn2.onclick=()=>showLeaderboard();
    actions.appendChild(btn2);
  }

  function renderBowCol(side,label,options){
    return `<div style="flex:1; min-width:190px;">
      <label>${escapeHtml(label||side)}</label>
      <select id="bow_${side}" style="width:100%;">
        <option value="">-- select --</option>
        ${(options||[]).map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
      </select>
    </div>`;
  }

  function renderQuestion(q){
    state.current=q; state.answered=false; state.sel=null; banner("");
    const area=$("qArea");
    if(!q){ area.innerHTML=`<p class="muted">No question available.</p>`; return; }

    const qtype=q.qtype||q.type||"single";
    const stem=q.stem||q.question||"—";
    const caseObj = q.case || null;
    const choices=q.choices||q.options||[];
    const polarity=q.polarity||"positive";
    const lvl=q.level||"LVN";

    let html=`<div class="metaLine">
      <span class="tag">${escapeHtml(normTopic(q.topic))}</span>
      <span class="tag">${escapeHtml(qtype.toUpperCase())}</span>
      <span class="tag">${escapeHtml(lvl)}</span>
      <span class="tag">${escapeHtml(polarity)}</span>
    </div>
    <div id="caseBanner" class="small" style="margin:6px 0 10px; padding:10px; border:1px solid var(--border); border-radius:14px; background: rgba(0,0,0,0.10);"></div><div class="qstem">${escapeHtml(stem)}</div>`;

    if(qtype==="bowtie" && q.bowtie){
      const b=q.bowtie;
      html+=`<div class="small">Bowtie: pick one in each column.</div>
      <div class="row" style="align-items:flex-start; gap:10px; margin-top:10px;">
        ${renderBowCol("left",b.left_label,b.left_options)}
        ${renderBowCol("middle",b.middle_label,b.middle_options)}
        ${renderBowCol("right",b.right_label,b.right_options)}
      </div>
      <div class="row" style="margin-top:10px;">
        <button id="btnSubmit">Submit</button>
        <button class="secondary" id="btnShowRat">Rationale</button>
      </div>
      <div id="rat" style="margin-top:10px;"></div>
      <div class="row" id="afterActions" style="margin-top:10px;"></div>`;
      area.innerHTML=html;
      // Case banner
      try{
        const cb=document.getElementById("caseBanner");
        if(cb){
          if(caseObj){
            const s=(caseObj.setting?("Setting: "+caseObj.setting+". "):"")+(caseObj.history?caseObj.history+" ":"");
            cb.textContent=s.trim() || "Case details available in tabs.";
          }else{
            cb.textContent="";
          }
        }
      }catch(e){}
      $("btnSubmit").onclick=()=>gradeCurrent(false);
      $("btnShowRat").onclick=()=>showRationale(q);
      setTabs(q); updateHUD(); startTimer(); renderAfterSubmitControls();
      return;
    }

    html+=`<div class="choices" id="choices"></div>
    <div class="row" style="margin-top:10px;">
      <button id="btnSubmit">Submit</button>
      <button class="secondary" id="btnShowRat">Rationale</button>
    </div>
    <div id="rat" style="margin-top:10px;"></div>
    <div class="row" id="afterActions" style="margin-top:10px;"></div>`;
    area.innerHTML=html;
    // Case banner
    try{
      const cb=document.getElementById("caseBanner");
      if(cb){
        if(caseObj){
          const s=(caseObj.setting?("Setting: "+caseObj.setting+". "):"")+(caseObj.history?caseObj.history+" ":"");
          cb.textContent=s.trim() || "Case details available in tabs.";
        }else{
          cb.textContent="";
        }
      }
    }catch(e){}
    const c=$("choices");
    choices.forEach((ch)=>{
      const d=document.createElement("div");
      d.className="choice";
      d.textContent=ch;
      d.onclick=()=>{
        if(state.answered) return;
        if(qtype==="sata"){
          if(!Array.isArray(state.sel)) state.sel=[];
          if(state.sel.includes(ch)) state.sel=state.sel.filter(x=>x!==ch);
          else state.sel=[...state.sel,ch];
          d.classList.toggle("sel");
        }else{
          [...c.children].forEach(x=>x.classList.remove("sel"));
          state.sel=ch; d.classList.add("sel");
        }
      };
      c.appendChild(d);
    });
    $("btnSubmit").onclick=()=>gradeCurrent(false);
    $("btnShowRat").onclick=()=>showRationale(q);
    setTabs(q); updateHUD(); startTimer(); renderAfterSubmitControls();
  }

  function nextPractice(){
    state.exam.active=false; state.mode="Practice"; $("progress").style.width="0%";
    buildPool(); renderQuestion(pickOne());
  }

  function startExam(){
    state.mode="Exam"; state.score={correct:0,total:0};
    state.exam.active=true; state.exam.idx=0; state.exam.startedAt=Date.now();
    buildPool();
    const pool=[...state.pool];
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    state.exam.items=pool.slice(0,75);
    renderQuestion(state.exam.items[0]||null);
  }

  function advanceExam(){
    if(!state.exam.active) return;
    if(!state.answered){ banner("Submit the question first."); return; }
    if(state.exam.idx>=state.exam.items.length-1){ finishExam(); return; }
    state.exam.idx += 1; renderQuestion(state.exam.items[state.exam.idx]);
  }

  function finishExam(){
    stopTimer();
    const elapsed=Math.max(1,Math.round((Date.now()-state.exam.startedAt)/1000));
    const pct=Math.round((state.score.correct/Math.max(1,state.score.total))*100);
    const area=$("qArea");
    state.exam.active=false; state.mode="Exam Finished"; updateHUD();
    area.innerHTML=`
      <div class="metaLine">
        <span class="tag">Exam Complete</span>
        <span class="tag">${pct}%</span>
        <span class="tag">${state.score.correct}/${state.score.total}</span>
        <span class="tag">${elapsed}s</span>
      </div>
      <div class="qstem">Save your score to the leaderboard</div>
      <div class="row">
        <div><label>Initials (2–4)</label><input id="initials" maxlength="4" placeholder="PI" style="min-width:120px;"></div>
        <div class="btns" style="margin-left:0;">
          <button id="btnSave">Save</button>
          <button class="secondary" id="btnViewLB">View Leaderboard</button>
          <button class="secondary" id="btnNewExam">New 75Q Exam</button>
        </div>
      </div>
      <div id="rat" style="margin-top:10px;"></div>`;
    $("btnSave").onclick=()=>saveLeaderboard(elapsed,pct);
    $("btnViewLB").onclick=()=>showLeaderboard();
    $("btnNewExam").onclick=()=>startExam();
    showRationale({rationale:`Exam summary: ${pct}% (${state.score.correct}/${state.score.total}) in ${elapsed}s.\nXP continues to accumulate across sessions.`});
  }

  function getLeaderboard(){ return safeJsonParse(localStorage.getItem(LS.leaderboard)||"[]",[]); }
  function setLeaderboard(list){ localStorage.setItem(LS.leaderboard,JSON.stringify(list)); }
  function saveLeaderboard(elapsed,pct){
    const raw=(document.getElementById("initials")?.value||"").trim().toUpperCase();
    const initials=raw.replace(/[^A-Z0-9]/g,"").slice(0,4);
    if(initials.length<2){ banner("Enter 2–4 initials to save."); return; }
    const entry={initials,pct,correct:state.score.correct,total:state.score.total,seconds:elapsed,when:new Date().toISOString()};
    const lb=getLeaderboard(); lb.push(entry);
    lb.sort((a,b)=>(b.pct-a.pct)||(a.seconds-b.seconds));
    setLeaderboard(lb.slice(0,50));
    banner("Saved to leaderboard.");
    showLeaderboard();
  }

  function showLeaderboard(){
    const panel=$("panel");
    const lb=getLeaderboard();
    if(!lb.length){ panel.innerHTML=`<div class="small">No scores yet. Finish a 75Q exam and save with initials.</div>`; return; }
    const rows=lb.slice(0,15).map((e,idx)=>{
      const d=new Date(e.when); const date=isNaN(d.getTime())?"":d.toLocaleDateString();
      return `<tr><td>${idx+1}</td><td><b>${escapeHtml(e.initials)}</b></td><td>${e.pct}%</td><td>${e.correct}/${e.total}</td><td>${e.seconds}s</td><td class="small">${escapeHtml(date)}</td></tr>`;
    }).join("");
    panel.innerHTML=`<div class="metaLine"><span class="tag">Leaderboard</span><span class="tag">Top 15</span></div>
      <table class="table"><thead><tr><th>#</th><th>Initials</th><th>%</th><th>Score</th><th>Time</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="row" style="margin-top:10px;"><button class="secondary" id="btnClearLB">Clear Leaderboard</button></div>`;
    document.getElementById("btnClearLB").onclick=()=>{ if(confirm("Clear leaderboard?")){ setLeaderboard([]); showLeaderboard(); } };
  }

  function resetAll(){
    stopTimer();
    state.score={correct:0,total:0};
    state.exam={active:false,idx:0,items:[],startedAt:0};
    state.mode="Practice";
    banner("");
    $("qArea").innerHTML=`<p class="muted">Reset complete. Click Next Practice.</p>`;
    $("tabBody").textContent="—"; $("tabs").innerHTML="";
    updateHUD();
  }

  function wireUI(){
    loadLocal();
    $("theme").onchange=applyTheme;
    $("accent").onchange=applyTheme;
    $("timerSel").onchange=()=>{ saveLocal(); if(state.current) startTimer(); };
    ["topic","qtype","level"].forEach(id=>$(id).onchange=()=>buildPool());
    $("btnNext").onclick=nextPractice;
    $("btnExam").onclick=startExam;
    $("btnReset").onclick=resetAll;
    $("btnLeaderboard").onclick=showLeaderboard;
    applyTheme();
    updateHUD();
  }

  (async function boot(){
    try{
      wireUI();
      const qs=await loadQuestions();
      state.QUESTIONS=qs.map((q,idx)=>({...q,id:q.id||`q_${idx}`,topic:normTopic(q.topic),qtype:q.qtype||q.type||"single",choices:q.choices||q.options||[],level:q.level||"LVN"}));
      $("count").textContent=state.QUESTIONS.length;
      rebuildTopicList();
      buildPool();
      $("qArea").innerHTML=`<p class="muted">Loaded ${state.QUESTIONS.length} questions. Click Next Practice or Start 75Q Exam.</p>`;
      showLeaderboard();
    }catch(e){
      console.error(e);
      banner("Load failed: "+e.message);
      $("qArea").innerHTML=`<p class="muted">Could not load questions. Verify questions_manifest.json exists in the same folder.</p>`;
    }
  })();
})();
