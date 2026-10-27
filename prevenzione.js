/* CourtIQ - Prevenzione (sessioni lunghe), Recovery autonomo e richiesta al terapista.
   Tutto resta sul dispositivo: nessun invio automatico, nessun server. */
"use strict";

/* ---------- parametri ---------- */
const PV_DURS = [20, 30, 45, 60];
const PV_MIX = {
  eq:  { label: "Equilibrata", s: { mob: .30, pot: .45, ril: .25 } },
  pot: { label: "Più forza", s: { mob: .25, pot: .55, ril: .20 } },
  mob: { label: "Più mobilità", s: { mob: .45, pot: .30, ril: .25 } },
  ril: { label: "Più relax", s: { mob: .25, pot: .30, ril: .45 } }
};
/* esercizi chiave per sport (se compatibili con i filtri, entrano per primi nel blocco forza) */
const PV_SPORT_KEY = {
  tennis:     ["p01", "p03", "p17", "p20", "p47", "p48", "p06", "p14"],
  padel:      ["p20", "p30", "p01", "p17", "p63", "p47", "p06", "p14"],
  pickleball: ["p20", "p30", "pb3", "p63", "p88", "pa2", "p25", "p01"],
  running:    ["pa2", "pa4", "pa3", "p46", "p88", "p60", "pa6", "p66"],
  atletica:   ["p80", "p82", "p45", "p40", "p44", "pa1", "p93", "p11"],
  golf:       ["m03", "m05", "m06", "p40", "p45", "p20", "m14", "p41"],
  sci:        ["p80", "p60", "m21", "pa2", "p46", "p45", "m16", "p82"],
  kettlebell: ["p66", "p45", "p40", "m06", "p06", "p41", "m28", "p60"]
};
/* varianti dello stesso esercizio: al massimo una per sessione */
const PV_FAM = {
  p60: "conch", p61: "conch", pa1: "calf", pa2: "calf", pa4: "calf", pa5: "calf", pb7: "calf", pa3: "calf2",
  p45: "ponte", p46: "ponte", p55: "ponte", p64: "ponte", p80: "squat", p81: "squat", p85: "bulg", p86: "bulg",
  p65: "stacco", p66: "stacco1", p67: "stacco1", m07: "pass", m08: "pass", p06: "ytw", p07: "ytw",
  p40: "plank", p52: "plank", p41: "side", p42: "side", r12: "polp", r13: "polp", pb1: "eq1", pb2: "eq1",
  p20: "estp", p24: "estp", p30: "estp", p01: "re", p08: "re", p17: "re", p27: "curl", p28: "curl",
  r09: "femo", r28: "femo", m06: "cat", r30: "cat", p10: "push", p11: "push", m30: "cobra",
  p82: "aff", p84: "aff", m19: "osc", m20: "osc2", pa7: "dors", pa6: "dors"
};
const PV_REC_RULES = [
  "Muoviti solo nell'ampiezza che non provoca dolore: niente forzature.",
  "Se il dolore aumenta durante un esercizio, fermati e salta quell'esercizio.",
  "Se il giorno dopo il fastidio è peggiorato, non ripetere la sessione e prenota un terapista.",
  "Se dopo alcuni giorni non noti miglioramenti, fatti vedere da un professionista."
];
const PV_SLOTS = ["Mattina", "Pomeriggio", "Sera", "Indifferente"];
const PV_STATUS = ["Da inviare", "Inviata", "Confermata"];
const PV_BYID = Object.fromEntries(PV_EX.map(e => [e.id, e]));

/* stato della vista (non persistente) */
let PV = { tab: "sessione", recZone: null, flags: {}, thZone: null };
/* player guidato */
let PT = { list: null, i: 0, rem: 0, run: false, last: 0, h: null, kind: "", title: "", half: false, meta: null, done: false };

function pvCfg() {
  const d = { sport: S.sport || "tennis", dur: 30, level: 0, eq: [], focus: "all", mix: "eq", avoid: true };
  S.prev = Object.assign(d, S.prev || {});
  if (!Array.isArray(S.prevLog)) S.prevLog = [];
  if (!Array.isArray(S.recLog)) S.recLog = [];
  if (!Array.isArray(S.therapy)) S.therapy = [];
  return S.prev;
}

/* ---------- dosi ---------- */
function pvDose(ex, L, mode = "prev") {
  const f = [1, 1.2, 1.4][L] || 1;
  let sets = 1, rest = 0, val = ex.q;
  if (mode === "rec") {
    if (ex.b === "pot") { sets = 2; rest = 30; }
    if (ex.b === "mob" && ex.t === "r") val = Math.min(ex.q, 10);
  } else if (ex.b === "pot") {
    sets = [2, 3, 3][L]; rest = [30, 40, 45][L];
    val = ex.t === "r" ? Math.round(ex.q * f) : Math.round(ex.q * f / 5) * 5;
  } else if (ex.b === "mob" && ex.t === "r") val = Math.round(ex.q * (1 + (f - 1) / 2));
  else if (ex.b === "ril" && ex.br) val = ex.q + L * 30;
  const work = (ex.t === "r" ? val * (ex.tp || 3) : val) * (ex.u ? 2 : 1) + (ex.u ? 5 : 0);
  return { id: ex.id, sets, rest, val, work, tot: 8 + sets * work + (sets - 1) * rest };
}
function pvDoseTxt(it) {
  const ex = PV_BYID[it.id];
  const q = ex.t === "r" ? `${it.val} ripetizioni` : `${it.val} s`;
  return (it.sets > 1 ? `${it.sets} serie × ` : "") + q + (ex.u ? " per lato" : "") + (it.sets > 1 ? ` · recupero ${it.rest} s` : "");
}

/* ---------- generatore ---------- */
function pvRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pvEligible(c, risky) {
  const eq = new Set(["none"].concat(c.eq || []));
  return PV_EX.filter(e => e.lv <= c.level + 1 && eq.has(e.eq) && !(c.avoid && !e.br && e.z.some(z => risky.includes(z))));
}
function pvWeight(e, c) {
  const W = PV_SPORT_W[c.sport] || PV_SPORT_W.atletica;
  let w = Math.max(.2, ...e.z.map(z => W[z] ?? 1));
  if (e.eq !== "none") w *= 2;            // se scegli un attrezzo, usalo davvero
  return w;
}
function pvGenerate(c, seed, risky = []) {
  const rnd = pvRng(seed), all = pvEligible(c, risky);
  const area = PV_AREAS[c.focus]?.g || [];
  const inArea = e => !area.length || e.z.some(z => area.includes(z));
  const used = new Set(), fams = new Set();
  const free = e => !used.has(e.id) && !(PV_FAM[e.id] && fams.has(PV_FAM[e.id]));
  const take = (e, out) => { used.add(e.id); PV_FAM[e.id] && fams.add(PV_FAM[e.id]); out.push(pvDose(e, c.level)); return out[out.length - 1].tot; };
  const pick = pool => { const tot = pool.reduce((a, e) => a + pvWeight(e, c), 0); let r = rnd() * tot; for (const e of pool) { r -= pvWeight(e, c); if (r <= 0) return e; } return pool[pool.length - 1]; };
  const blocks = { mob: [], pot: [], ril: [] }; let filler = false;
  const share = PV_MIX[c.mix]?.s || PV_MIX.eq.s;
  for (const b of ["mob", "pot", "ril"]) {
    let budget = c.dur * 60 * share[b], t = 0; const out = blocks[b];
    if (b === "ril") {   // l'ultimo blocco compensa le differenze dei primi due (con un limite)
      const usedT = pvTotal(blocks.mob) + pvTotal(blocks.pot);
      budget = Math.max(budget * .6, Math.min(budget * 1.6, c.dur * 60 - usedT));
    }
    if (b === "ril") {   // la sessione si chiude sempre con un esercizio di respirazione o rilassamento
      const br = all.filter(e => e.b === "ril" && e.br && free(e)); const e = pick(br); used.add(e.id);
      const d = pvDose(e, c.level); budget -= d.tot; blocks._end = d;
    }
    if (b === "pot") for (const q of (c.eq || []).filter(q => q !== "none")) {   // se scegli un attrezzo, almeno un esercizio lo usa
      const pq = all.filter(e => e.b === "pot" && e.eq === q && free(e)), pa = pq.filter(inArea);
      const fit = l => l.filter(e => t + pvDose(e, c.level).tot <= budget + 90);
      const pool = fit(pa).length ? fit(pa) : fit(pq); if (pool.length) t += take(pick(pool), out);
    }
    if (b === "pot") for (const id of PV_SPORT_KEY[c.sport] || []) {
      if (out.length >= 3 || t > budget * .5) break;
      const e = PV_BYID[id]; if (e && all.includes(e) && inArea(e) && free(e) && rnd() < .75 && t + pvDose(e, c.level).tot <= budget + 20) t += take(e, out);
    }
    for (const stage of [0, 1]) {
      let pool = all.filter(e => e.b === b && !e.br && free(e) && (stage === 1 || inArea(e)));
      while (t < budget - 25 && pool.length) {
        const e = pick(pool); pool = pool.filter(x => x !== e);
        if (!free(e)) continue;
        const d = pvDose(e, c.level);
        if (t + d.tot > budget + 20 && t > 0) continue;
        if (stage === 1 && area.length && !inArea(e)) filler = true;
        used.add(e.id); PV_FAM[e.id] && fams.add(PV_FAM[e.id]); out.push(d); t += d.tot;
        pool = pool.filter(free);
      }
    }
  }
  blocks.ril.push(blocks._end); delete blocks._end;
  return { seed, cfg: { ...c, eq: [...(c.eq || [])] }, blocks, filler, risky: [...risky], ts: Date.now() };
}
function pvItems(sess) { return ["mob", "pot", "ril"].flatMap(b => sess.blocks[b].map(it => ({ ...it, b }))); }
function pvTotal(items) { return items.reduce((a, it) => a + it.tot, 0); }
function pvReplace(sess, b, k) {
  const c = sess.cfg, it = sess.blocks[b][k], old = PV_BYID[it.id];
  const usedIds = new Set(pvItems(sess).map(x => x.id));
  const fams = new Set(pvItems(sess).filter(x => x.id !== it.id).map(x => PV_FAM[x.id]).filter(Boolean));
  const area = PV_AREAS[c.focus]?.g || [];
  let pool = pvEligible(c, sess.risky).filter(e => e.b === b && !!e.br === !!old.br && !usedIds.has(e.id) && !(PV_FAM[e.id] && fams.has(PV_FAM[e.id])));
  const near = pool.filter(e => e.z.some(z => old.z.includes(z)) && (!area.length || e.z.some(z => area.includes(z))));
  if (near.length) pool = near;
  if (!pool.length) return false;
  sess.blocks[b][k] = pvDose(pool[Math.floor(Math.random() * pool.length)], c.level);
  return true;
}

/* ---------- triage dei fastidi ---------- */
function pvTriage(z, p, info) {
  if (p.sev >= 7 || p.type === "Fitta") return { lv: "stop", pill: "red", tag: "Professionista", t: "Dolore forte o a fitta: niente esercizi sulla zona. Rivolgiti a un medico o a un fisioterapista prima di riprendere." };
  if (info.persistent.includes(z)) return { lv: "pro", pill: "red", tag: "Terapista consigliato", t: "Il fastidio ritorna da 3 sessioni: è consigliato farsi vedere da un terapista. Il recovery leggero va fatto solo se non aumenta il dolore." };
  if (p.sev >= 4) return { lv: "care", pill: "yellow", tag: "Con prudenza", t: "Fastidio moderato: recovery leggero con prudenza. Se non migliora, prenota un terapista." };
  return { lv: "ok", pill: "green", tag: "Recovery adatto", t: "Fastidio lieve: il recovery autonomo è adatto, restando nell'ampiezza senza dolore." };
}

/* ---------- player guidato ---------- */
function ptBuild(items, kind, title, meta) {
  const list = [];
  items.forEach((it, k) => {
    const ex = PV_BYID[it.id];
    list.push({ k, ph: "prep", s: 8, id: it.id, it });
    for (let s = 1; s <= it.sets; s++) {
      list.push({ k, ph: "work", s: it.work, id: it.id, it, set: s, u: !!ex.u });
      if (s < it.sets) list.push({ k, ph: "rest", s: it.rest, id: it.id, it, set: s });
    }
  });
  ptPause();
  Object.assign(PT, { list, i: 0, rem: list[0].s, kind, title, meta, half: false, done: false, nEx: items.length });
}
function ptPlay() {
  if (!PT.list) return;
  if (typeof TM !== "undefined" && TM.run) pause();
  if (PT.done) { PT.i = 0; PT.rem = PT.list[0].s; PT.done = false; }
  PT.run = true; PT.last = performance.now(); beep(660); wakeLock(true);
  clearInterval(PT.h);
  PT.h = setInterval(ptTick, 250);
  const b = $("#pt-play"); if (b) b.textContent = "Pausa";
}
function ptTick() {
  const now = performance.now(); PT.rem -= (now - PT.last) / 1000; PT.last = now;
  const st = PT.list[PT.i];
  if (st.u && st.ph === "work" && !PT.half && PT.rem <= st.s / 2) { PT.half = true; beep(740); navigator.vibrate && navigator.vibrate(80); const n = $("#pt-side"); if (n) n.textContent = "Cambia lato"; }
  if (PT.rem <= 0) { ptGo(PT.i + 1, true); return; }
  ptPaint();
}
function ptPause() { PT.run = false; clearInterval(PT.h); PT.h = null; wakeLock(false); const b = $("#pt-play"); if (b) b.textContent = "Avvia"; }
function ptGo(i, auto) {
  if (i >= PT.list.length) { ptFinish(); return; }
  PT.i = Math.max(0, i); PT.rem = PT.list[PT.i].s; PT.half = false;
  if (auto) { const ph = PT.list[PT.i].ph; beep(ph === "work" ? 880 : 520); navigator.vibrate && navigator.vibrate(ph === "work" ? 150 : 60); }
  if (TAB === "prevenzione") renderPrevention();
}
function ptJumpEx(d) {   // esercizio precedente / successivo
  const k = PT.list[PT.i].k + d;
  const j = PT.list.findIndex(s => s.k === k);
  if (j < 0) { if (d > 0) ptFinish(); return; }
  ptGo(j);
}
function ptFinish() {
  ptPause(); PT.done = true; PT.i = PT.list.length - 1; PT.rem = 0;
  const mins = Math.round(pvTotal(PT.list.filter(s => s.ph === "prep").map(s => s.it)) / 60);
  if (PT.kind === "prev") {
    S.prevLog.push({ date: today(), ts: Date.now(), sport: PT.meta.sport, min: mins, level: PT.meta.level });
    save(); toast("Sessione di prevenzione completata");
    if (TAB === "prevenzione") renderPrevention();
  } else {
    if (TAB === "prevenzione") renderPrevention();
    pvRecFeedback(PT.meta);
  }
}
function ptPaint() {
  const st = PT.list && PT.list[PT.i]; const f = $("#pt-fgc"); if (!f || !st) return;
  const C = 2 * Math.PI * 96; f.setAttribute("stroke-dashoffset", PT.done ? 0 : C * (1 - Math.max(0, PT.rem) / st.s));
  $("#pt-t").textContent = PT.done ? "0:00" : fmtTime(PT.rem);
}
function ptCard() {
  if (!PT.list) return "";
  const st = PT.list[PT.i], ex = PV_BYID[st.id], it = st.it, B = PV_BLOCKS[ex.b];
  const nextEx = PT.list.find((s, j) => j > PT.i && s.k !== st.k);
  const ph = PT.done ? "Completata" : st.ph === "prep" ? "Preparati" : st.ph === "rest" ? "Recupero" : (ex.t === "r" ? "Esegui" : "Tieni");
  const doseLine = ex.t === "r" ? `${it.val} ripetizioni${ex.u ? " per lato" : ""}` : `${it.val} s${ex.u ? " per lato" : ""}`;
  const C = 2 * Math.PI * 96;
  return `<div class="card pt" id="pt"><div class="row between"><span class="pill" style="color:${B.color};border-color:${B.color}">${B.label}</span><span class="small mut">Esercizio ${st.k + 1}/${PT.nEx}</span></div>
    <div class="ptbar"><div style="width:${Math.round((PT.done ? 1 : PT.i / PT.list.length) * 100)}%"></div></div>
    <h3 style="margin:10px 0 2px">${esc(PT.done ? (PT.kind === "prev" ? "Sessione completata!" : "Recovery completato") : ex.n)}</h3>
    ${PT.done ? `<p class="small mut">${esc(PT.title)}. Ottimo lavoro!</p>` : `<p class="small mut" style="margin:0">${it.sets > 1 ? `Serie ${st.set || 1}/${it.sets} · ` : ""}${doseLine}</p>`}
    <div class="timer"><div class="ringwrap"><svg viewBox="0 0 220 220"><circle class="bgc" cx="110" cy="110" r="96"/><circle class="fgc ${st.ph}" id="pt-fgc" cx="110" cy="110" r="96" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div class="center"><b id="pt-t">${PT.done ? "0:00" : fmtTime(PT.rem)}</b><span id="pt-side">${ph}${st.u && st.ph === "work" && !PT.done ? (PT.half ? " · cambia lato" : " · primo lato") : ""}</span></div></div>
      ${PT.done ? "" : `<div class="ptdesc"><p class="small" style="margin:0">${esc(ex.d)}</p><p class="small" style="margin:6px 0 0"><b>Punto chiave:</b> ${esc(ex.k)}</p>
        ${st.ph === "rest" || st.ph === "prep" ? "" : ex.t === "r" ? `<p class="small mut" style="margin:6px 0 0">Il tempo è indicativo: se finisci prima premi «Fatto».</p>` : ""}</div>`}
      <div class="tctrl"><button type="button" class="btn" id="pt-prev" aria-label="Esercizio precedente">⏮</button><button type="button" class="btn pri play" id="pt-play">${PT.run ? "Pausa" : PT.done ? "Ripeti" : "Avvia"}</button>
        <button type="button" class="btn" id="pt-next" aria-label="Avanti">${st.ph === "work" ? "Fatto ✓" : "⏭"}</button><button type="button" class="btn" id="pt-rst" aria-label="Ricomincia">↺</button></div>
      ${nextEx && !PT.done ? `<p class="small mut" style="margin:0">Dopo: ${esc(PV_BYID[nextEx.id].n)}</p>` : ""}
      <div class="btns" style="justify-content:center">${PT.done ? "" : `<button type="button" class="btn sm danger" id="pt-pain">Sento dolore</button>`}<button type="button" class="btn sm ghost" id="pt-close">Chiudi</button></div></div></div>`;
}
function ptBind(v) {
  if (!PT.list) return;
  $("#pt-play", v).onclick = () => PT.run ? ptPause() : ptPlay();
  $("#pt-next", v).onclick = () => { const st = PT.list[PT.i]; st.ph === "prep" ? ptGo(PT.i + 1) : ptGo(PT.i + 1); };
  $("#pt-prev", v).onclick = () => { const st = PT.list[PT.i]; const first = PT.list.findIndex(s => s.k === st.k); PT.i > first ? ptGo(first) : ptJumpEx(-1); };
  $("#pt-rst", v).onclick = () => { ptPause(); PT.done = false; ptGo(0); };
  $("#pt-close", v).onclick = () => { ptPause(); PT.list = null; renderPrevention(); };
  $("#pt-pain", v) && ($("#pt-pain", v).onclick = () => {
    ptPause();
    const ex = PV_BYID[PT.list[PT.i].id];
    openSheet(`<h2>Senti dolore?</h2><div class="alert red"><span>⚠️</span><div><b>Fermati.</b> Non continuare un esercizio che provoca dolore o lo fa aumentare.</div></div>
      <p class="small mut">Esercizio: ${esc(ex.n)}</p>
      <div class="btns" style="flex-direction:column"><button type="button" class="btn block" id="pp-skip">Salta questo esercizio e continua</button>
      <button type="button" class="btn block" id="pp-mark">Termina e segna il fastidio sulla mappa</button>
      <button type="button" class="btn pri block" id="pp-th">Termina e prenota un terapista</button></div>${DISCLAIMER}`, r => {
      $("#pp-skip", r).onclick = () => { closeSheet(); ptJumpEx(1); };
      $("#pp-mark", r).onclick = () => { closeSheet(); PT.list = null; go("corpo"); };
      $("#pp-th", r).onclick = () => { closeSheet(); const z = PT.meta?.zone || null; PT.list = null; pvOpenTherapist(z); };
    });
  });
  ptPaint();
}

/* ---------- vista principale ---------- */
function pvOpenRecovery(z) { if (PT.done) PT.list = null; PV.tab = "recovery"; PV.recZone = z; PV.flags = {}; go("prevenzione"); }
function pvOpenTherapist(z) { if (PT.done) PT.list = null; PV.tab = "terapista"; PV.thZone = z || null; go("prevenzione"); }
function renderPrevention() {
  pvCfg();
  const v = $("#view-prevenzione"); const info = analyze(S.sessions, S.draftPains);
  const body = { sessione: pvSessionHTML, recovery: pvRecoveryHTML, terapista: pvTherapistHTML }[PV.tab](info);
  v.innerHTML = `${ptCard()}
    <div class="seg full" role="group" aria-label="Sezioni prevenzione" style="margin-bottom:14px">
      ${[["sessione", "Sessione"], ["recovery", "Recovery"], ["terapista", "Terapista"]].map(([k, l]) => `<button type="button" data-pvtab="${k}" class="${PV.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    ${body}${DISCLAIMER}`;
  $$("[data-pvtab]", v).forEach(b => b.onclick = () => { PV.tab = b.dataset.pvtab; renderPrevention(); });
  ptBind(v);
  ({ sessione: pvSessionBind, recovery: pvRecoveryBind, terapista: pvTherapistBind })[PV.tab](v, info);
}

/* ---------- Sessione ---------- */
function pvWeekCount() { const t = dayNum(today()); return S.prevLog.filter(x => t - dayNum(x.date) < 7).length; }
function pvSessionHTML(info) {
  const c = pvCfg(); const sess = S.prevSess;
  const eqSet = new Set(c.eq);
  const riskTxt = info.riskyGroups.map(g => GROUP_LABELS[g].toLowerCase()).join(", ");
  let out = `${typeof kqLongevityBlock === "function" ? kqLongevityBlock(c.sport) : ""}<div class="card"><div class="row between"><h2>Prevenzione</h2><span class="pill acc">${PV_EX.length} esercizi</span></div>
    <p class="small mut">Le schede da 15-30 minuti qui sopra sono i protocolli dello sport selezionato. Sotto restano le sessioni lunghe da 20 a 60 minuti.</p>
    <p class="small mut">Sessioni da 20 a 60 minuti con tre blocchi: <b>mobilizzazione</b>, <b>potenziamento</b> e <b>rilassamento</b>. Scegli le opzioni e genera la tua sessione: ogni volta puoi ottenere una variante diversa.</p>
    <label class="lbl">Sport</label>${sportChips(c.sport, "pv-sport")}
    <label class="lbl">Durata</label><div class="seg full" data-pvseg="dur">${PV_DURS.map(d => `<button type="button" class="${c.dur === d ? "on" : ""}" data-val="${d}">${d} min</button>`).join("")}</div>
    <label class="lbl">Livello</label><div class="seg full" data-pvseg="level">${PV_LEVELS.map((l, i) => `<button type="button" class="${c.level === i ? "on" : ""}" data-val="${i}">${l}</button>`).join("")}</div>
    <label class="lbl">Attrezzatura</label><div class="chips" id="pv-eq">${Object.entries(PV_EQ).map(([k, l]) => `<button type="button" class="chip ${k === "none" || eqSet.has(k) ? "on" : ""}" data-eq="${k}" ${k === "none" ? "disabled" : ""}>${l}</button>`).join("")}</div>
    <label class="lbl">Zona su cui insistere</label><select class="field" id="pv-focus">${Object.entries(PV_AREAS).map(([k, a]) => `<option value="${k}" ${c.focus === k ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select>
    <label class="lbl">Equilibrio dei blocchi</label><div class="seg full small-seg" data-pvseg="mix">${Object.entries(PV_MIX).map(([k, m]) => `<button type="button" class="${c.mix === k ? "on" : ""}" data-val="${k}">${m.label}</button>`).join("")}</div>
    <label class="check"><input type="checkbox" id="pv-avoid" ${c.avoid ? "checked" : ""}> Escludi gli esercizi che caricano le zone con fastidio${riskTxt ? ` <span class="pill yellow">${esc(riskTxt)}</span>` : ""}</label>
    <button type="button" class="btn pri block" id="pv-gen" style="margin-top:12px">${sess ? "Genera nuova sessione" : "Genera sessione"}</button></div>`;
  if (sess) {
    const items = pvItems(sess), tot = pvTotal(items);
    const ar = PV_AREAS[sess.cfg.focus];
    out += `<div class="card" id="pv-sess"><div class="row between"><h3>${SPORT_ICON[sess.cfg.sport] || ""} ${esc(SPORTS[sess.cfg.sport])} · ${PV_LEVELS[sess.cfg.level]}</h3><span class="pill acc" id="pv-min">${Math.round(tot / 60)} min</span></div>
      <p class="small mut">${esc(ar.label)} · ${sess.cfg.eq.length ? "attrezzi: " + sess.cfg.eq.map(e => PV_EQ[e].toLowerCase()).join(", ") : "senza attrezzi"} · ${esc(PV_MIX[sess.cfg.mix].label.toLowerCase())}</p>
      ${sess.filler ? `<div class="alert yellow"><span>ℹ️</span><div>Per questa zona e attrezzatura ci sono pochi esercizi: la sessione è completata con esercizi per tutto il corpo.</div></div>` : ""}
      ${sess.risky.length && sess.cfg.avoid ? `<div class="alert yellow"><span>ℹ️</span><div>Esclusi gli esercizi che caricano: ${esc(sess.risky.map(g => GROUP_LABELS[g].toLowerCase()).join(", "))}. Per la zona con fastidio usa il <b>Recovery</b>.</div></div>` : ""}
      <div class="kpis"><div class="kpi"><b>${items.length}</b><span>esercizi</span></div><div class="kpi"><b>${Math.round(tot / 60)}'</b><span>durata stimata</span></div><div class="kpi"><b>${pvWeekCount()}</b><span>sessioni in 7 gg</span></div></div>
      <button type="button" class="btn pri block" id="pv-start" style="margin-top:12px">▶ Avvia sessione guidata</button>
      <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" id="pv-var">↻ Nuova variante</button><button type="button" class="btn sm ghost" id="pv-copy">Copia sessione</button></div>
      ${["mob", "pot", "ril"].map(b => { const L = sess.blocks[b]; if (!L.length) return "";
        return `<div class="pvblock"><div class="row between"><h4 style="color:${PV_BLOCKS[b].color}">${PV_BLOCKS[b].label}</h4><span class="small mut">${Math.round(pvTotal(L) / 60)} min</span></div>
        <ol class="list pvlist">${L.map((it, k) => { const ex = PV_BYID[it.id]; return `<li><details><summary><span class="grow"><span class="t">${esc(ex.n)}</span><span class="s">${esc(pvDoseTxt(it))}${ex.eq !== "none" ? " · " + PV_EQ[ex.eq].toLowerCase() : ""}</span></span></summary>
          <p class="small" style="margin:6px 0">${esc(ex.d)}</p><p class="small mut" style="margin:0 0 6px"><b>Punto chiave:</b> ${esc(ex.k)}</p></details>
          <button type="button" class="icon-btn" data-swap="${b}:${k}" aria-label="Sostituisci ${esc(ex.n)}" title="Sostituisci">⇄</button></li>`; }).join("")}</ol></div>`; }).join("")}
      <p class="small mut" style="margin-top:10px">Tocca un esercizio per leggere come si fa, ⇄ per sostituirlo. Ideale ripeterla 2-3 volte a settimana, nei giorni più leggeri.</p></div>`;
  } else out += `<div class="empty card">Nessuna sessione generata. Scegli le opzioni e premi «Genera sessione».</div>`;
  return out;
}
function pvSessionBind(v, info) {
  const c = pvCfg();
  bindChips(v, "pv-sport", x => { c.sport = x; S.sport = x; save(); if (typeof kqRenderSportBar === "function") kqRenderSportBar(); renderPrevention(); });
  $$("[data-pvseg]", v).forEach(g => $$("button", g).forEach(b => b.onclick = () => {
    $$("button", g).forEach(x => x.classList.toggle("on", x === b));
    const k = g.dataset.pvseg; c[k] = k === "mix" ? b.dataset.val : +b.dataset.val; save();
  }));
  $$("#pv-eq [data-eq]", v).forEach(b => b.onclick = () => {
    const k = b.dataset.eq; if (k === "none") return;
    c.eq = c.eq.includes(k) ? c.eq.filter(x => x !== k) : c.eq.filter(x => x !== "none").concat(k);
    b.classList.toggle("on", c.eq.includes(k)); save();
  });
  $("#pv-focus", v).onchange = e => { c.focus = e.target.value; save(); };
  $("#pv-avoid", v).onchange = e => { c.avoid = e.target.checked; save(); };
  const gen = () => { c.eq = c.eq.filter(x => x !== "none"); S.prevSess = pvGenerate(c, (Math.random() * 2 ** 31) | 0, info.riskyGroups); save(); renderPrevention(); $("#pv-sess")?.scrollIntoView({ block: "start" }); };
  $("#pv-gen", v).onclick = gen;
  if (typeof kqBindLongevity === "function") kqBindLongevity(v);
  const sess = S.prevSess; if (!sess) return;
  $("#pv-var", v).onclick = () => { const cc = { ...sess.cfg }; S.prevSess = pvGenerate(cc, (Math.random() * 2 ** 31) | 0, info.riskyGroups); save(); renderPrevention(); toast("Nuova variante pronta"); };
  $("#pv-start", v).onclick = () => { ptBuild(pvItems(sess), "prev", `Prevenzione ${SPORTS[sess.cfg.sport]}`, { sport: sess.cfg.sport, level: sess.cfg.level }); renderPrevention(); window.scrollTo(0, 0); ptPlay(); };
  $("#pv-copy", v).onclick = () => copyText(pvSessionText(sess));
  $$("[data-swap]", v).forEach(b => b.onclick = () => { const [bl, k] = b.dataset.swap.split(":"); if (pvReplace(sess, bl, +k)) { save(); renderPrevention(); toast("Esercizio sostituito"); } else toast("Nessuna alternativa disponibile"); });
}
function pvSessionText(sess) {
  const L = [`KinetIQ · Prevenzione ${SPORTS[sess.cfg.sport]} · ${PV_LEVELS[sess.cfg.level]} · circa ${Math.round(pvTotal(pvItems(sess)) / 60)} min`];
  for (const b of ["mob", "pot", "ril"]) { if (!sess.blocks[b].length) continue; L.push("", PV_BLOCKS[b].label.toUpperCase());
    sess.blocks[b].forEach((it, k) => { const ex = PV_BYID[it.id]; L.push(`${k + 1}. ${ex.n}: ${pvDoseTxt(it)}`, `   ${ex.d}`); }); }
  L.push("", "Indicazioni generali di allenamento: fermati se compare dolore.");
  return L.join("\n");
}

/* ---------- Recovery autonomo ---------- */
function pvRecZones(info) { return Object.entries(info.active).sort((a, b) => b[1].sev - a[1].sev); }
function pvRecoveryHTML(info) {
  const act = pvRecZones(info);
  if (!PV.recZone && act.length) PV.recZone = act[0][0];
  const z = PV.recZone, p = z ? (info.active[z] || null) : null;
  let out = `<div class="card"><h2>Recovery autonomo</h2><p class="small mut">Una sessione dolce di 12-15 minuti per la zona con fastidio: mobilità leggera, attivazione senza carico e rilassamento. Prima rispondi alle domande di sicurezza.</p>
    ${act.length ? `<label class="lbl">Fastidi segnalati</label><div class="chips">${act.map(([k, a]) => { const tr = pvTriage(k, a, info);
      return `<button type="button" class="chip ${k === z ? "on" : ""}" data-rz="${k}">${esc(ZONES[k].label)} · ${a.sev}/10 <span class="dotm ${tr.pill}"></span></button>`; }).join("")}</div>` : `<div class="empty">Nessun fastidio segnalato. Puoi segnarlo nella sezione Corpo oppure scegliere qui la zona.</div>`}
    <label class="lbl">Oppure scegli la zona</label><select class="field" id="rz-sel"><option value="">-</option>${Object.entries(ZONES).map(([k, zz]) => `<option value="${k}" ${k === z ? "selected" : ""}>${esc(zz.label)}</option>`).join("")}</select></div>`;
  if (!z) return out;
  const tr = p ? pvTriage(z, p, info) : null;
  const flagged = Object.values(PV.flags).some(Boolean);
  const blocked = (tr && tr.lv === "stop") || flagged;
  const items = PV_RECOVERY[ZONES[z].group].map(id => pvDose(PV_BYID[id], 0, "rec"));
  out += `<div class="card" id="rec-card"><div class="row between"><h3>${esc(ZONES[z].label)}</h3>${tr ? `<span class="pill ${tr.pill}">${esc(tr.tag)}</span>` : `<span class="pill grey">nessun dato</span>`}</div>
    ${tr ? `<div class="alert ${tr.lv === "stop" || tr.lv === "pro" ? "red" : tr.lv === "care" ? "yellow" : "green"}"><span>${tr.lv === "ok" ? "✅" : "⚠️"}</span><div>${p ? `<b>${p.sev}/10 · ${esc(p.type)}</b><br>` : ""}${esc(tr.t)}</div></div>` : `<p class="small mut">Questa zona non ha un fastidio segnato oggi: il recovery è comunque disponibile come sessione dolce.</p>`}
    ${tr && tr.lv === "stop" ? `<button type="button" class="btn pri block" id="rec-th">Prenota un terapista</button>` : `
    <h4>Prima di iniziare: qualcuna di queste è vera?</h4>
    <ul class="list flags">${PV_REDFLAGS.map((q, i) => `<li><label class="check"><input type="checkbox" data-flag="${i}" ${PV.flags[i] ? "checked" : ""}> ${esc(q)}</label></li>`).join("")}</ul>
    ${flagged ? `<div class="alert red"><span>⚠️</span><div><b>Meglio non fare da soli.</b> Con questi segnali il recovery autonomo non è indicato: rivolgiti a un medico o a un fisioterapista.</div></div>
      <button type="button" class="btn pri block" id="rec-th">Prenota un terapista</button>` : `
    <h4>Regole del recovery</h4><ul class="rules">${PV_REC_RULES.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    <div class="row between" style="margin:8px 0"><b>${items.length} esercizi · circa ${Math.round(pvTotal(items) / 60)} min</b></div>
    <ol class="list pvlist">${items.map(it => { const ex = PV_BYID[it.id]; return `<li><details><summary><span class="grow"><span class="t">${esc(ex.n)}</span><span class="s">${PV_BLOCKS[ex.b].short} · ${esc(pvDoseTxt(it))}</span></span></summary><p class="small" style="margin:6px 0">${esc(ex.d)}</p><p class="small mut" style="margin:0 0 6px"><b>Punto chiave:</b> ${esc(ex.k)}</p></details></li>`; }).join("")}</ol>
    <button type="button" class="btn pri block" id="rec-start" ${blocked ? "disabled" : ""}>▶ Avvia recovery guidato</button>
    <button type="button" class="btn ghost block" id="rec-th" style="margin-top:8px">Preferisco prenotare un terapista</button>`}`}
  </div>`;
  const log = S.recLog.filter(r => ZONES[r.zone]?.group === ZONES[z].group).slice(-5).reverse();
  if (log.length) out += `<div class="card tight"><h3>Recovery fatti per questa zona</h3><ul class="list">${log.map(r => `<li><div class="grow"><div class="t">${fmtDate(r.date)} · ${esc(ZONES[r.zone].label)}</div><div class="s">prima ${r.sev ?? "-"}/10 · dopo: ${esc(r.res)}</div></div></li>`).join("")}</ul></div>`;
  return out;
}
function pvRecoveryBind(v, info) {
  $$("[data-rz]", v).forEach(b => b.onclick = () => { PV.recZone = b.dataset.rz; PV.flags = {}; renderPrevention(); });
  $("#rz-sel", v).onchange = e => { PV.recZone = e.target.value || null; PV.flags = {}; renderPrevention(); };
  $$("[data-flag]", v).forEach(cb => cb.onchange = () => { PV.flags[cb.dataset.flag] = cb.checked; renderPrevention(); $("#rec-card")?.scrollIntoView({ block: "start" }); });
  $("#rec-th", v) && ($("#rec-th", v).onclick = () => pvOpenTherapist(PV.recZone));
  $("#rec-start", v) && ($("#rec-start", v).onclick = () => {
    const z = PV.recZone, items = PV_RECOVERY[ZONES[z].group].map(id => pvDose(PV_BYID[id], 0, "rec"));
    ptBuild(items, "rec", `Recovery ${ZONES[z].label}`, { zone: z, sev: info.active[z]?.sev ?? null });
    renderPrevention(); window.scrollTo(0, 0); ptPlay();
  });
}
function pvRecFeedback(meta) {
  openSheet(`<h2>Come va adesso?</h2><p class="small mut">${esc(ZONES[meta.zone].label)}: confronta con prima di iniziare.</p>
    <div class="btns" style="flex-direction:column"><button type="button" class="btn block" data-res="Meglio">🙂 Meglio</button><button type="button" class="btn block" data-res="Uguale">😐 Uguale</button><button type="button" class="btn block danger" data-res="Peggio">🙁 Peggio</button></div>`, r => {
    $$("[data-res]", r).forEach(b => b.onclick = () => {
      const res = b.dataset.res; S.recLog.push({ date: today(), ts: Date.now(), zone: meta.zone, sev: meta.sev, res }); save();
      if (res === "Peggio") {
        $("#sheet-body").innerHTML = `<h2>Il fastidio è aumentato</h2><div class="alert red"><span>⚠️</span><div>Non ripetere il recovery. Ti consigliamo di farti vedere da un terapista o da un medico.</div></div>
          <button type="button" class="btn pri block" id="fb-th">Prenota un terapista</button><button type="button" class="btn ghost block" data-close style="margin-top:8px">Chiudi</button>`;
        $("#fb-th").onclick = () => { closeSheet(); PT.list = null; pvOpenTherapist(meta.zone); };
      } else { closeSheet(); toast(res === "Meglio" ? "Bene! Annotato" : "Annotato: se non migliora, senti un terapista"); renderPrevention(); }
    });
  });
}

/* ---------- Terapista ---------- */
function pvHistory(z) {
  const t = dayNum(today()), g = z ? ZONES[z]?.group : null, L = [];
  const okZ = k => !g || ZONES[k]?.group === g;
  for (const [k, p] of Object.entries(S.draftPains)) if (okZ(k)) L.push({ d: today(), txt: `oggi (non ancora salvato): ${ZONES[k].label} ${p.sev}/10, ${p.type}` });
  for (const s of S.sessions) if (t - dayNum(s.date) <= 60) for (const p of s.pains || []) if (okZ(p.zone))
    L.push({ d: s.date, txt: `${fmtDate(s.date)} · ${SPORTS[s.sport] || s.sport} ${s.dur} min (RPE ${s.rpe}): ${ZONES[p.zone]?.label || p.zone} ${p.sev}/10, ${p.type}` });
  for (const r of S.recLog || []) if (t - dayNum(r.date) <= 60 && okZ(r.zone)) L.push({ d: r.date, txt: `${fmtDate(r.date)} · recovery autonomo ${ZONES[r.zone].label}: ${r.res.toLowerCase()}` });
  return L.sort((a, b) => b.d.localeCompare(a.d)).map(x => x.txt);
}
function pvTherapyText(q) {
  const L = [`Buongiorno${q.name ? " " + q.name : ""},`, "vorrei prenotare una seduta.", "",
    `Zona: ${q.zone ? ZONES[q.zone]?.label : "da valutare"}`, `Intensità attuale del fastidio: ${q.sev}/10`,
    `Preferenza: ${q.date ? fmtDate(q.date) : "data da concordare"}${q.slot && q.slot !== "Indifferente" ? ", " + q.slot.toLowerCase() : ""}`];
  if (q.notes) L.push(`Note: ${q.notes}`);
  if (q.hist) { L.push("", "Storico fastidi (ultimi 60 giorni, da KinetIQ):"); const h = q.histLines || []; h.length ? h.forEach(x => L.push("- " + x)) : L.push("- nessun fastidio registrato"); }
  L.push("", "Grazie.");
  return L.join("\n");
}
function pvWaLink(q) {
  let d = String(q.phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("3")) d = "39" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(pvTherapyText(q))}`;
}
function pvMailLink(q) {
  const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email || "") ? q.email.trim() : "";
  return `mailto:${to}?subject=${encodeURIComponent("Richiesta appuntamento" + (q.zone ? " - " + ZONES[q.zone].label : ""))}&body=${encodeURIComponent(pvTherapyText(q))}`;
}
function pvTherapistHTML(info) {
  pvCfg();
  const z = PV.thZone || Object.keys(info.active).sort((a, b) => info.active[b].sev - info.active[a].sev)[0] || "";
  const sev = z && info.active[z] ? info.active[z].sev : 3;
  const last = S.therapy[0];
  const strong = Object.entries(info.active).filter(([, p]) => p.sev >= 7 || p.type === "Fitta");
  return `${strong.length ? `<div class="alert red"><span>⚠️</span><div><b>Dolore forte o a fitta</b><br>${esc(strong.map(([k]) => ZONES[k].label).join(", "))}: meglio farsi vedere presto da un medico o da un fisioterapista.</div></div>` : ""}
  <div class="card" id="th-form"><h2>Prenota un terapista</h2>
    <p class="small mut">Prepara la richiesta: resta salvata su questo telefono. Poi la invii tu con WhatsApp o email; l'app non manda nulla da sola.</p>
    <label class="lbl" for="th-name">Terapista o centro</label><input class="field" id="th-name" placeholder="es. Studio di fisioterapia" value="${esc(last?.name || "")}">
    <div class="grid2"><div><label class="lbl" for="th-phone">Telefono (facoltativo)</label><input class="field" id="th-phone" type="tel" inputmode="tel" placeholder="es. 333 1234567" value="${esc(last?.phone || "")}"></div>
      <div><label class="lbl" for="th-email">Email (facoltativa)</label><input class="field" id="th-email" type="email" inputmode="email" placeholder="nome@esempio.it" value="${esc(last?.email || "")}"></div></div>
    <label class="lbl" for="th-date">Giorno preferito</label><input class="field" id="th-date" type="date" min="${today()}" value="">
    <label class="lbl">Fascia oraria</label><div class="seg full small-seg" id="th-slot">${PV_SLOTS.map((s, i) => `<button type="button" class="${i === 3 ? "on" : ""}" data-val="${s}">${s}</button>`).join("")}</div>
    <label class="lbl" for="th-zone">Zona</label><select class="field" id="th-zone"><option value="">Da valutare / più zone</option>${Object.entries(ZONES).map(([k, zz]) => `<option value="${k}" ${k === z ? "selected" : ""}>${esc(zz.label)}</option>`).join("")}</select>
    <label class="lbl">Intensità attuale <b id="th-sev-v">${sev}/10</b></label><input type="range" id="th-sev" min="0" max="10" value="${sev}">
    <label class="lbl" for="th-notes">Note</label><textarea class="field" id="th-notes" placeholder="es. quando è iniziato, in quali gesti fa male"></textarea>
    <label class="check"><input type="checkbox" id="th-hist" checked> Allega lo storico dei fastidi (ultimi 60 giorni)</label>
    <details class="data"><summary>Anteprima storico</summary><ul class="small" id="th-hist-prev"></ul></details>
    <button type="button" class="btn pri block" id="th-save" style="margin-top:12px">Salva richiesta</button></div>
  <div class="card" id="th-list"><h3>Le tue richieste</h3>${S.therapy.length ? S.therapy.map(q => `<div class="threq" data-q="${q.id}">
      <div class="row between"><b>${esc(q.name || "Terapista")}</b><span class="pill ${q.status === "Confermata" ? "green" : q.status === "Inviata" ? "acc" : "yellow"}">${esc(q.status)}</span></div>
      <div class="small mut">${q.zone ? esc(ZONES[q.zone].label) + " · " : ""}${q.sev}/10 · ${q.date ? fmtDate(q.date) : "data da concordare"}${q.slot !== "Indifferente" ? " · " + esc(q.slot.toLowerCase()) : ""}</div>
      <div class="btns" style="margin-top:8px"><a class="btn sm" href="${esc(pvWaLink(q))}" target="_blank" rel="noopener" data-act="wa">WhatsApp</a><a class="btn sm" href="${esc(pvMailLink(q))}" data-act="mail">Email</a>
        ${navigator.share ? `<button type="button" class="btn sm" data-act="share">Condividi</button>` : ""}<button type="button" class="btn sm ghost" data-act="copy">Copia</button></div>
      <div class="btns" style="margin-top:6px"><select class="field sm" data-act="status" aria-label="Stato">${PV_STATUS.map(s => `<option ${s === q.status ? "selected" : ""}>${s}</option>`).join("")}</select><button type="button" class="btn sm danger" data-act="del">Elimina</button></div></div>`).join("")
    : `<div class="empty">Nessuna richiesta salvata.</div>`}
    <p class="small mut">WhatsApp ed Email aprono l'app del telefono con il messaggio già scritto: controllalo e invialo tu.</p></div>`;
}
function pvTherapistBind(v) {
  const sevI = $("#th-sev", v); let slot = "Indifferente";
  const prev = () => { const h = pvHistory($("#th-zone", v).value); $("#th-hist-prev", v).innerHTML = h.length ? h.map(x => `<li>${esc(x)}</li>`).join("") : "<li>Nessun fastidio registrato negli ultimi 60 giorni.</li>"; };
  const upd = () => { setRangeFill(sevI); $("#th-sev-v", v).textContent = sevI.value + "/10"; };
  sevI.oninput = upd; upd(); prev();
  $("#th-zone", v).onchange = () => { const z = $("#th-zone", v).value; const a = analyze(S.sessions, S.draftPains).active[z]; if (a) { sevI.value = a.sev; upd(); } prev(); };
  $$("#th-slot button", v).forEach(b => b.onclick = () => { slot = b.dataset.val; $$("#th-slot button", v).forEach(x => x.classList.toggle("on", x === b)); });
  $("#th-save", v).onclick = () => {
    const z = $("#th-zone", v).value, hist = $("#th-hist", v).checked;
    const q = { id: uid(), ts: Date.now(), created: today(), name: $("#th-name", v).value.trim(), phone: $("#th-phone", v).value.trim(), email: $("#th-email", v).value.trim(),
      date: $("#th-date", v).value, slot, zone: z, sev: +sevI.value, notes: $("#th-notes", v).value.trim(), hist, histLines: hist ? pvHistory(z) : [], status: "Da inviare" };
    S.therapy.unshift(q); save(); PV.thZone = null; toast("Richiesta salvata: ora inviala con WhatsApp o email"); renderPrevention(); $("#th-list")?.scrollIntoView({ block: "start" });
  };
  $$("[data-q]", v).forEach(card => {
    const q = S.therapy.find(x => x.id === card.dataset.q); if (!q) return;
    $$("[data-act]", card).forEach(el => {
      const a = el.dataset.act;
      if (a === "status") el.onchange = () => { q.status = el.value; save(); renderPrevention(); };
      else if (a === "copy") el.onclick = () => copyText(pvTherapyText(q));
      else if (a === "share") el.onclick = () => navigator.share({ title: "Richiesta appuntamento", text: pvTherapyText(q) }).catch(() => { });
      else if (a === "del") el.onclick = () => { if (confirm("Eliminare questa richiesta?")) { S.therapy = S.therapy.filter(x => x.id !== q.id); save(); renderPrevention(); } };
    });
  });
}

/* ---------- card da usare nelle altre sezioni ---------- */
function pvNeedsSpec(z, p, info) {
  return !!(p && (p.sev > 5 || p.type === "Fitta" || info.persistent.includes(z) || (info.persistentDays || []).includes(z)));
}
function pvPainActionsCard(info, compact) {
  const act = pvRecZones(info);
  if (!act.length) return "";
  return `<div class="card" id="pv-pains"><div class="row between"><h3>Fastidi: cosa fare</h3><span class="pill acc">Recovery</span></div>
    <ul class="list">${act.slice(0, compact ? 3 : 9).map(([z, p]) => { const tr = pvTriage(z, p, info); const spec = pvNeedsSpec(z, p, info);
      return `<li><div class="grow"><div class="t">${esc(ZONES[z].label)} · ${p.sev}/10</div><div class="s"><span class="pill ${tr.pill}">${esc(tr.tag)}</span>${spec ? ` <span class="pill red">Consigliato controllo specialistico</span>` : ""}</div></div>
        <div class="btns pvact">${tr.lv === "stop" ? "" : `<button type="button" class="btn sm" data-pvrec="${z}">Recovery</button>`}<button type="button" class="btn sm ${tr.lv === "stop" || tr.lv === "pro" || spec ? "pri" : "ghost"}" data-pvth="${z}">Terapista</button>${spec ? `<button type="button" class="btn sm" data-pvwa="${z}">WhatsApp</button>` : ""}</div></li>`; }).join("")}</ul>
    <p class="small mut">Il recovery e la richiesta al terapista restano disponibili. Il tasto WhatsApp prepara un riepilogo per uno specialista della tua rete: l'app non invia nulla da sola.</p></div>`;
}
function pvBindPainActions(root) {
  $$("[data-pvrec]", root).forEach(b => b.onclick = () => pvOpenRecovery(b.dataset.pvrec));
  $$("[data-pvth]", root).forEach(b => b.onclick = () => pvOpenTherapist(b.dataset.pvth));
  $$("[data-pvwa]", root).forEach(b => b.onclick = () => kqContactSpec(b.dataset.pvwa));
}
