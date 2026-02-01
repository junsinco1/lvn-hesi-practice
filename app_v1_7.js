// STABLE v1: bulletproof loader + no service worker + on-screen errors
(function(){
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS = {
    mastery: 'lvn_mastery_v1',
    settings:'lvn_settings_v1',
    leaderboard:'lvn_leaderboard_v1',
    initials:'lvn_initials_v1'
  };

  const State = {
    all: [],
    filtered: [],
    current: null,
    mode: 'practice',
    exam: null, // {qids:[], idx, correct}
    timerSec: 0,
    timerHandle: null,
    score: {correct:0, total:0},
    xp: 0,
    streak: 0,
    mastery: {},
    settings: {theme:'midnight', accent:'indigo', topic:'any', type:'any', level:'any', timer:0},
    leaderboard: []
  };

  const THEMES = {
    midnight: {bg:'#0b1020', panel:'#0f1730', text:'#e7eaf3', muted:'#aab2c9'},
    clinical:  {bg:'#071318', panel:'#0b1d22', text:'#e9fbff', muted:'#a5c3cc'},
    sand:      {bg:'#14110b', panel:'#1c170e', text:'#fff2df', muted:'#d7c6ab'},
    plum:      {bg:'#120a18', panel:'#1b1024', text:'#f4eaff', muted:'#cdb7e0'},
    slate:     {bg:'#0d1116', panel:'#121926', text:'#eaf0ff', muted:'#a9b5cc'}
  };

  const ACCENTS = {
    indigo: {a:'#6d83ff', a2:'#3f57ff'},
    teal: {a:'#24c7b7', a2:'#10a3a0'},
    emerald: {a:'#2bd38a', a2:'#13b86f'},
    rose: {a:'#ff5c7a', a2:'#ff3d6c'},
    amber: {a:'#ffb020', a2:'#ff8a00'},
    sky: {a:'#4ab3ff', a2:'#268cff'},
    purple: {a:'#b07cff', a2:'#8b5bff'}
  };

  function showBanner(msg, kind='ok'){
    const el = $('#banner');
    el.style.display = 'block';
    el.textContent = msg;
    el.style.borderColor = kind==='ok' ? 'rgba(32,201,151,.35)' : kind==='warn' ? 'rgba(255,176,32,.35)' : 'rgba(255,77,109,.35)';
    el.style.background = kind==='ok' ? 'rgba(32,201,151,.10)' : kind==='warn' ? 'rgba(255,176,32,.10)' : 'rgba(255,77,109,.10)';
  }
  function clearBanner(){ $('#banner').style.display='none'; $('#banner').textContent=''; }

  function showErrors(lines){
    const el = $('#errors');
    el.style.display = 'block';
    el.textContent = Array.isArray(lines) ? lines.join('\n') : String(lines||'');
  }
  function clearErrors(){ $('#errors').style.display='none'; $('#errors').textContent=''; }

  function setPill(id, text){ const el=$(id); if(el) el.textContent=text; }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  }

  function loadLocal(){
    State.mastery = safeJsonParse(localStorage.getItem(LS.mastery), {}) || {};
    State.settings = safeJsonParse(localStorage.getItem(LS.settings), State.settings) || State.settings;
    State.leaderboard = safeJsonParse(localStorage.getItem(LS.leaderboard), []) || [];
    const initials = localStorage.getItem(LS.initials) || '';
    const ii = $('#initialsInput'); if(ii) ii.value = initials;
  }

  function saveLocal(){
    localStorage.setItem(LS.mastery, JSON.stringify(State.mastery||{}));
    localStorage.setItem(LS.settings, JSON.stringify(State.settings||{}));
    localStorage.setItem(LS.leaderboard, JSON.stringify(State.leaderboard||[]));
  }

  function applyTheme(){
    const t = THEMES[State.settings.theme] || THEMES.midnight;
    const a = ACCENTS[State.settings.accent] || ACCENTS.indigo;
    const r = document.documentElement;
    r.style.setProperty('--bg', t.bg);
    r.style.setProperty('--panel', t.panel);
    r.style.setProperty('--text', t.text);
    r.style.setProperty('--muted', t.muted);
    r.style.setProperty('--accent', a.a);
    r.style.setProperty('--accent2', a.a2);
  }

  async function fetchJsonNoCache(url){
    const u = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const res = await fetch(u, {cache:'no-store'});
    if(!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
    return await res.json();
  }

  async function loadQuestionsUnified(){
    const errors=[];
    // 1) Try manifest+parts
    try{
      const man = await fetchJsonNoCache('questions_manifest.json');
      if(man && Array.isArray(man.parts) && man.parts.length){
        const all=[];
        for(const p of man.parts){
          try{
            const part = await fetchJsonNoCache(p);
            if(Array.isArray(part)) all.push(...part);
            else errors.push(`${p} -> not an array`);
          }catch(e){
            errors.push(String(e.message||e));
          }
        }
        if(all.length) return {questions: all, errors};
        errors.push('Manifest loaded but no questions were assembled.');
      }else{
        errors.push('questions_manifest.json missing "parts" array.');
      }
    }catch(e){
      errors.push(String(e.message||e));
    }

    // 2) Fallback: questions.json
    try{
      const q = await fetchJsonNoCache('questions.json');
      if(Array.isArray(q) && q.length) return {questions:q, errors};
      errors.push('questions.json loaded but empty or not an array.');
    }catch(e){
      errors.push(String(e.message||e));
    }

    return {questions:[], errors};
  }

  function normalizeQ(q, idx){
    const nq = Object.assign({}, q);
    if(!nq.id) nq.id = `Q-${idx+1}`;
    if(!nq.topic) nq.topic = 'General';
    if(!nq.qtype) nq.qtype = 'regular';
    if(!nq.level) nq.level = nq.topic.toLowerCase().includes('rn') ? 'RN' : 'LVN';
    if(!nq.difficulty) nq.difficulty = 3;
    if(!nq.polarity) nq.polarity = 'positive';
    // Support older schema: qtype "single" -> regular
    if(nq.qtype === 'single') nq.qtype = 'regular';
    // Ensure case container exists if any tab data exists
    const hasCase = nq.case || nq.vitals || nq.nurse || nq.orders || nq.labs || nq.case_tabs;
    if(hasCase && !nq.case_tabs){
      nq.case_tabs = {
        case: nq.case || nq.stem_case || '',
        vitals: nq.vitals || '',
        nurse: nq.nurse || '',
        orders: nq.orders || '',
        labs: nq.labs || ''
      };
    }
    return nq;
  }

  function buildTopicOptions(){
    const sel = $('#topicSelect');
    const topics = Array.from(new Set(State.all.map(q=>q.topic))).sort((a,b)=>a.localeCompare(b));
    sel.innerHTML = '';
    const optAny = document.createElement('option');
    optAny.value = 'any'; optAny.textContent = 'Any';
    sel.appendChild(optAny);
    for(const t of topics){
      const o=document.createElement('option');
      o.value=t; o.textContent=t;
      sel.appendChild(o);
    }
    sel.value = State.settings.topic || 'any';
  }

  function filterPool(){
    const topic = $('#topicSelect').value;
    const type = $('#typeSelect').value;
    const level = $('#levelSelect').value;

    State.settings.topic = topic;
    State.settings.type = type;
    State.settings.level = level;
    State.settings.timer = parseInt($('#timerSelect').value||'0',10) || 0;
    State.settings.theme = $('#themeSelect').value;
    State.settings.accent = $('#accentSelect').value;

    applyTheme();
    saveLocal();

    State.filtered = State.all.filter(q=>{
      if(topic !== 'any' && q.topic !== topic) return false;
      if(type !== 'any' && q.qtype !== type) return false;
      if(level !== 'any' && q.level !== level) return false;
      return true;
    });

    setPill('#pillLoaded', `${State.filtered.length} loaded`);
    if(State.filtered.length === 0){
      $('#qStem').textContent = 'No questions match the current filters. Change Topic/Type/Level.';
      $('#choices').innerHTML = '';
      $('#qCase').style.display='none';
    }
  }

  function pickPracticeQuestion(){
    if(!State.filtered.length) return null;
    // Avoid repeats: prefer unanswered in mastery
    const unseen = State.filtered.filter(q => !State.mastery[q.id]);
    const pool = unseen.length ? unseen : State.filtered;
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function startTimer(){
    stopTimer();
    State.timerSec = State.settings.timer || 0;
    if(!State.timerSec){
      setPill('#pillTimer', 'Timer: --');
      return;
    }
    let left = State.timerSec;
    setPill('#pillTimer', `Timer: ${left}s`);
    State.timerHandle = setInterval(()=>{
      left -= 1;
      setPill('#pillTimer', `Timer: ${left}s`);
      if(left <= 0){
        clearInterval(State.timerHandle);
        State.timerHandle = null;
        // Auto-submit as incorrect if not answered
        autoTimeOut();
      }
    }, 1000);
  }
  function stopTimer(){
    if(State.timerHandle){
      clearInterval(State.timerHandle);
      State.timerHandle = null;
    }
  }

  function renderTabs(q){
    const tabs = q.case_tabs || {};
    const panes = {
      question: $('#tab_question'),
      case: $('#tab_case'),
      vitals: $('#tab_vitals'),
      nurse: $('#tab_nurse'),
      orders: $('#tab_orders'),
      labs: $('#tab_labs')
    };
    panes.case.textContent = tabs.case || 'No case text for this question.';
    panes.vitals.textContent = formatVitals(tabs.vitals);
    panes.nurse.textContent = tabs.nurse || '—';
    panes.orders.textContent = tabs.orders || '—';
    panes.labs.textContent = formatLabs(tabs.labs);

    // default active: vitals first (more realistic)
$$('.tabBtn').forEach(b=>b.classList.remove('active'));
const preferred = $$('.tabBtn').find(b=>b.dataset && b.dataset.tab==='question') || $$('.tabBtn')[0];
if(preferred){ preferred.classList.add('active'); }
const showKey = preferred ? preferred.dataset.tab : 'question';
Object.entries(panes).forEach(([k,el])=>{ el.style.display = (k===showKey) ? 'block' : 'none'; });
}

  function formatVitals(v){
    if(!v) return '—';
    if(typeof v === 'string') return v;
    if(Array.isArray(v)){
      return v.map((row,i)=>`T${i+1}: ${Object.entries(row).map(([k,val])=>`${k}: ${val}`).join(' | ')}`).join('\n');
    }
    if(typeof v === 'object'){
      return Object.entries(v).map(([k,val])=>`${k}: ${val}`).join('\n');
    }
    return String(v);
  }

  function formatLabs(l){
    if(!l) return '—';
    if(typeof l === 'string') return l;
    if(Array.isArray(l)){
      return l.map(x=>{
        if(typeof x === 'string') return x;
        if(typeof x === 'object') return `${x.name||x.test||'Lab'}: ${x.value||''} ${x.unit||''} ${x.flag||''}`.trim();
        return String(x);
      }).join('\n');
    }
    if(typeof l === 'object'){
      return Object.entries(l).map(([k,val])=>`${k}: ${val}`).join('\n');
    }
    return String(l);
  }

  function renderQuestion(q){
    State.current = q;
    clearBanner(); clearErrors();
    $('#feedbackLeft').style.display='none';
    $('#feedbackLeft').textContent='';

    $('#qTopic').textContent = `Topic: ${q.topic}`;
    $('#qType').textContent = `Type: ${q.qtype.toUpperCase()}`;
    $('#qDifficulty').textContent = `Difficulty: ${q.difficulty}`;

    // Case display box (quick preview)
    const caseText = (q.case_tabs && q.case_tabs.case) ? q.case_tabs.case : '';
    const qCaseEl = $('#qCase');
    if(qCaseEl){
      if(caseText){ qCaseEl.style.display='block'; qCaseEl.textContent = caseText; }
      else{ qCaseEl.style.display='none'; qCaseEl.textContent=''; }
    }

    $('#qStem').textContent = q.stem || '(missing stem)';

    // render choices / inputs by type
    const choicesEl = $('#choices');
    choicesEl.innerHTML = '';

    if(q.qtype === 'bowtie' && q.bowtie){
      renderBowtie(q, choicesEl);
    }else{
      const isSata = q.qtype === 'sata';
      const name = 'ans';
      (q.choices||[]).forEach((c, i)=>{
        const row = document.createElement('label');
        row.className = 'choice';
        const input = document.createElement('input');
        input.type = isSata ? 'checkbox' : 'radio';
        input.name = name;
        input.value = c;
        const span = document.createElement('div');
        span.textContent = c;
        row.appendChild(input);
        row.appendChild(span);
        choicesEl.appendChild(row);
      });
    }

    renderTabs(q);
    startTimer();
    updateSide();
  }

  function renderBowtie(q, mount){
    const bt = q.bowtie;
    const wrap = document.createElement('div');
    wrap.className='bowtieWrap';

    function col(label, options, group){
      const col = document.createElement('div');
      col.className='btCol';
      const h = document.createElement('div');
      h.className='btLabel';
      h.textContent = label;
      col.appendChild(h);
      options.forEach((opt, idx)=>{
        const row=document.createElement('label');
        row.className='choice';
        const input=document.createElement('input');
        input.type='radio';
        input.name=group;
        input.value=opt;
        const span=document.createElement('div');
        span.textContent=opt;
        row.appendChild(input);
        row.appendChild(span);
        col.appendChild(row);
      });
      return col;
    }

    // Shuffle each side so correct isn't always on top
    const left = shuffle(Array.from(bt.left_options||[]));
    const mid = shuffle(Array.from(bt.middle_options||[]));
    const right = shuffle(Array.from(bt.right_options||[]));

    wrap.appendChild(col(bt.left_label||'Left', left, 'bt_left'));
    wrap.appendChild(col(bt.middle_label||'Middle', mid, 'bt_mid'));
    wrap.appendChild(col(bt.right_label||'Right', right, 'bt_right'));

    mount.appendChild(wrap);
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function getUserAnswer(){
    const q = State.current;
    if(!q) return null;

    if(q.qtype === 'bowtie' && q.bowtie){
      const left = $('input[name="bt_left"]:checked')?.value || null;
      const mid  = $('input[name="bt_mid"]:checked')?.value || null;
      const right= $('input[name="bt_right"]:checked')?.value || null;
      return {left, mid, right};
    }

    if(q.qtype === 'sata'){
      return $$('input[name="ans"]:checked').map(x=>x.value);
    }

    const one = $('input[name="ans"]:checked');
    return one ? one.value : null;
  }

  function isCorrect(q, userAns){
    if(q.qtype === 'bowtie' && q.bowtie){
      if(!userAns) return false;
      return userAns.left === q.bowtie.left_answer &&
             userAns.mid === q.bowtie.middle_answer &&
             userAns.right === q.bowtie.right_answer;
    }

    if(q.qtype === 'sata'){
      const correct = Array.isArray(q.answer) ? q.answer : [];
      const a = Array.isArray(userAns) ? userAns : [];
      const setA = new Set(a);
      const setC = new Set(correct);
      if(setA.size !== setC.size) return false;
      for(const x of setC) if(!setA.has(x)) return false;
      return true;
    }

    return userAns === q.answer;
  }

  function rationaleBlock(q){
    const lines = [];
    if(q.rationale) lines.push(`Rationale: ${q.rationale}`);
    if(q.choice_rationales && typeof q.choice_rationales === 'object'){
      lines.push('');
      lines.push('Choice rationales:');
      for(const c of (q.choices||[])){
        const r = q.choice_rationales[c];
        if(r) lines.push(`- ${c}: ${r}`);
      }
    }
    return lines.join('\n');
  }

  function submitCurrent(auto=false){
    const q = State.current;
    if(!q) return;

    stopTimer();

    const userAns = getUserAnswer();
    if(!auto){
      // require selection
      if(q.qtype === 'bowtie'){
        if(!userAns || !userAns.left || !userAns.mid || !userAns.right){
          showBanner('Select one option in EACH bowtie column before submitting.', 'warn');
          startTimer();
          return;
        }
      }else if(q.qtype === 'sata'){
        if(!Array.isArray(userAns) || userAns.length === 0){
          showBanner('Select at least one option for SATA.', 'warn');
          startTimer();
          return;
        }
      }else{
        if(!userAns){
          showBanner('Select an answer first.', 'warn');
          startTimer();
          return;
        }
      }
    }

    const correct = isCorrect(q, userAns);
    State.score.total += 1;
    if(correct){
      State.score.correct += 1;
      State.streak += 1;
      State.xp += 10 + Math.min(10, q.difficulty||3);
      showBanner('Correct ✅', 'ok');
    }else{
      State.streak = 0;
      State.xp += 2;
      showBanner('Incorrect ❌', 'bad');
    }

    // mastery store
    State.mastery[q.id] = State.mastery[q.id] || {seen:0, correct:0};
    State.mastery[q.id].seen += 1;
    if(correct) State.mastery[q.id].correct += 1;
    saveLocal();

    // feedback
    const fb = $('#feedbackLeft');
    fb.style.display='block';

    let ansLine = '';
    if(q.qtype === 'sata'){
      const corr = Array.isArray(q.answer) ? q.answer : [];
      ansLine = `Correct answers: ${corr.join(', ') || '—'}`;
    }else if(q.qtype === 'bowtie'){
      ansLine = `Correct bowtie: [${q.bowtie.left_answer}] / [${q.bowtie.middle_answer}] / [${q.bowtie.right_answer}]`;
    }else{
      ansLine = `Correct answer: ${q.answer}`;
    }
    fb.textContent = `${ansLine}\n\n${rationaleBlock(q)}`;

    // Exam flow
    if(State.mode === 'exam' && State.exam){
      State.exam.idx += 1;
      if(correct) State.exam.correct += 1;

      if(State.exam.idx >= State.exam.qids.length){
        finishExam();
        return;
      }
    }

    // Enable next
    updatePills();
  }

  function autoTimeOut(){
    // Auto submit incorrect if user hasn't answered (or incomplete bowtie)
    submitCurrent(true);
    showBanner('Time expired ⏱️ (counted as incorrect if not fully answered)', 'warn');
  }

  function updatePills(){
    setPill('#pillMode', `Mode: ${State.mode==='exam'?'Exam':'Practice'}`);
    setPill('#pillScore', `Score: ${State.score.correct}/${State.score.total}`);
    setPill('#pillXP', `XP: ${State.xp}`);
  }

  function updateSide(){
    $('#streakLabel').textContent = String(State.streak||0);
    const acc = (State.score.total>0) ? Math.round((State.score.correct/State.score.total)*100) : null;
    $('#accLabel').textContent = (acc===null) ? '--' : (acc+'%');
    $('#rankLabel').textContent = rankFromXP(State.xp);
    updatePills();
  }

  function rankFromXP(xp){
    if(xp >= 2000) return 'Vigilant';
    if(xp >= 1200) return 'Adept';
    if(xp >= 700) return 'Rising';
    if(xp >= 300) return 'Competent';
    return 'Novice';
  }

  function nextPractice(){
    State.mode='practice';
    State.exam=null;
    const q = pickPracticeQuestion();
    if(!q){
      $('#qStem').textContent = 'No questions available in this filter.';
      return;
    }
    renderQuestion(q);
  }

  function startExam(){
    if(State.filtered.length < 75){
      showBanner(`Not enough questions for a 75Q exam in this filter pool (${State.filtered.length} available). Change filters or set Topic=Any.`, 'warn');
      return;
    }
    State.mode='exam';
    State.score = {correct:0,total:0};
    State.streak = 0;

    // build exam without duplicates
    const shuffled = shuffle(State.filtered.slice());
    const qids = shuffled.slice(0,75).map(q=>q.id);
    State.exam = {qids, idx:0, correct:0};

    const first = State.filtered.find(q=>q.id === qids[0]);
    renderQuestion(first);
  }

  function finishExam(){
    const correct = State.exam ? State.exam.correct : State.score.correct;
    const total = 75;
    const pct = Math.round((correct/total)*100);
    showBanner(`Exam finished: ${correct}/${total} (${pct}%). Saved to leaderboard.`, 'ok');

    // save leaderboard
    const ii = $('#initialsInput'); if(ii) ii.value = initials;
    if(initials) localStorage.setItem(LS.initials, initials);

    State.leaderboard.push({
      initials: initials || '----',
      score: correct,
      total,
      pct,
      ts: new Date().toISOString()
    });
    // Keep top 25 by pct then score
    State.leaderboard.sort((a,b)=> (b.pct-a.pct) || (b.score-a.score) || (a.ts<b.ts?1:-1));
    State.leaderboard = State.leaderboard.slice(0,25);
    saveLocal();

    State.mode='practice';
    State.exam=null;
    renderLeaderboard();
  }

  function renderLeaderboard(){
    const dlg = $('#dlgLeaderboard');
    const box = $('#leaderboardTable');
    const rows = State.leaderboard || [];
    if(!rows.length){
      box.innerHTML = '<div class="muted">No exam scores yet.</div>';
      return;
    }
    const html = [
      '<table style="width:100%;border-collapse:collapse">',
      '<thead><tr><th style="text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.12)">Rank</th>',
      '<th style="text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.12)">Initials</th>',
      '<th style="text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.12)">Score</th>',
      '<th style="text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.12)">%</th>',
      '<th style="text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.12)">Date</th></tr></thead>',
      '<tbody>'
    ];
    rows.forEach((r,i)=>{
      const d = new Date(r.ts);
      html.push(`<tr>
        <td style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)">${i+1}</td>
        <td style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)"><b>${escapeHtml(r.initials||'----')}</b></td>
        <td style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)">${r.score}/${r.total}</td>
        <td style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)">${r.pct}%</td>
        <td style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)">${d.toLocaleString()}</td>
      </tr>`);
    });
    html.push('</tbody></table>');
    box.innerHTML = html.join('');
    dlg.showModal();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function diagnostics(){
    const out = $('#diagOut');
    const lines=[];
    lines.push(`Base: ${location.href}`);
    lines.push(`UserAgent: ${navigator.userAgent}`);
    lines.push(`Time: ${new Date().toISOString()}`);
    lines.push('');
    const urls = ['questions_manifest.json','questions_part01.json','questions.json','app.js','styles.css'];
    lines.push('Fetch checks:');
    out.textContent = 'Running…';
    const run = async ()=>{
      for(const u of urls){
        try{
          const res = await fetch(u + '?v=' + Date.now(), {cache:'no-store'});
          lines.push(`${u}: ${res.status} ${res.statusText}`);
        }catch(e){
          lines.push(`${u}: ERROR ${String(e.message||e)}`);
        }
      }
      lines.push('');
      lines.push(`Questions loaded in memory: ${State.all.length}`);
      lines.push(`Filtered pool: ${State.filtered.length}`);
      out.textContent = lines.join('\n');
      $('#dlgDiag').showModal();
    };
    run();
  }

  function wireUI(){
    // selects
    $('#typeSelect').addEventListener('change', ()=>{ filterPool(); nextPractice(); });
    $('#levelSelect').addEventListener('change', ()=>{ filterPool(); nextPractice(); });
    $('#topicSelect').addEventListener('change', ()=>{ filterPool(); nextPractice(); });
    $('#timerSelect').addEventListener('change', ()=>{ filterPool(); });
    $('#themeSelect').addEventListener('change', ()=>{ filterPool(); });
    $('#accentSelect').addEventListener('change', ()=>{ filterPool(); });

    // buttons
    $('#btnNext').addEventListener('click', nextPractice);
    $('#btnExam').addEventListener('click', startExam);
    $('#btnLeaderboard').addEventListener('click', ()=>{ renderLeaderboard(); $('#dlgLeaderboard').showModal(); });
    $('#btnDiagnostics').addEventListener('click', diagnostics);

    $('#btnSubmit').addEventListener('click', ()=> submitCurrent(false));
    $('#btnShowRationale').addEventListener('click', ()=>{
      if(!State.current) return;
      $('#feedbackLeft').style.display='block';
      $('#feedbackLeft').textContent = rationaleBlock(State.current) || 'No rationale provided.';
    });

    $('#btnReset').addEventListener('click', ()=>{
      if(!confirm('Reset progress (mastery/xp/leaderboard) on this device?')) return;
      localStorage.removeItem(LS.mastery);
      localStorage.removeItem(LS.settings);
      localStorage.removeItem(LS.leaderboard);
      State.score={correct:0,total:0};
      State.xp=0; State.streak=0; State.mastery={}; State.leaderboard=[];
      loadLocal();
      applyTheme();
      filterPool();
      nextPractice();
    });

    $('#btnClearLB').addEventListener('click', ()=>{
      if(!confirm('Clear leaderboard?')) return;
      State.leaderboard=[];
      saveLocal();
      renderLeaderboard();
    });

    const ii2 = $('#initialsInput'); if(ii2) ii2.addEventListener('input', (e)=>{
      const v = (e.target.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
      e.target.value = v;
      localStorage.setItem(LS.initials, v);
    });

    // tabs
    $$('.tabBtn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        $$('.tabBtn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const which = btn.dataset.tab;
        ['question','case','vitals','nurse','orders','labs'].forEach(k=>{
          $('#tab_'+k).style.display = (k===which) ? 'block' : 'none';
        });
      });
    });
  }

  async function init(){
    try{
      loadLocal();
      applyTheme();

      // preload selects to saved settings
      $('#themeSelect').value = State.settings.theme || 'midnight';
      $('#accentSelect').value = State.settings.accent || 'indigo';
      $('#typeSelect').value = State.settings.type || 'any';
      $('#levelSelect').value = State.settings.level || 'any';
      $('#timerSelect').value = String(State.settings.timer||0);

      wireUI();

      const loaded = await loadQuestionsUnified();
      if(loaded.errors && loaded.errors.length){
        // show only if failing
        // We'll still display them if questions empty
        if(!loaded.questions.length) showErrors(loaded.errors);
      }

      State.all = (loaded.questions||[]).map(normalizeQ);

      if(!State.all.length){
        $('#qStem').textContent = 'Could not load any questions. Click Diagnostics for details.';
        setPill('#pillLoaded', '0 loaded');
        return;
      }

      buildTopicOptions();
      // set saved topic (after options built)
      $('#topicSelect').value = State.settings.topic || 'any';

      filterPool();
      nextPractice();
      showBanner('Loaded. Ready.', 'ok');
    }catch(e){
      $('#qStem').textContent = 'Fatal error during initialization.';
      showErrors([String(e.stack||e)]);
    }
  }

  window.addEventListener('error', (ev)=>{
    showErrors([`Uncaught: ${ev.message}`, String(ev.error?.stack||'')]);
  });
  window.addEventListener('unhandledrejection', (ev)=>{
    showErrors([`Unhandled promise rejection: ${String(ev.reason?.message||ev.reason||ev)}`]);
  });

  document.addEventListener('DOMContentLoaded', init);
})();