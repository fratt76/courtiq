/* KinetIQ - ergonomia mobile: bottom sheet con maniglia, modalità Focus (schermo intero) per le lavagne,
   segni a mano sulle lavagne, schede dei drill a scorrimento e fasi Prima | Tecnica | Dopo.
   Solo contenuti già presenti in data.js e prevenzione-data.js: nessun esercizio nuovo. */
"use strict";

const KQM = { fit: null, phase: "tecnica", focus: null };
const kqIsMobile = () => !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
const SVGNS = "http://www.w3.org/2000/svg";

/* ================= layout: header sticky, bottom sheet, stage fissato in alto ================= */
function kqHeadH() {
  const h = document.body.classList.contains("stage-on") ? $(".top") : $(".stickyhead"), px = h ? h.offsetHeight : 0;
  document.documentElement.style.setProperty("--headh", px + "px");
  return px;
}
/* Porta lo stage alla misura che entra nello schermo sopra il dock: prima il rapporto preferito (es. 4:5), poi il successivo (1:1),
   e se nemmeno quello entra riduce la misura mantenendo il primo rapporto. */
/* Con uno stage fisso solo la riga del logo resta in alto: sport e sezioni scorrono via e lasciano spazio alla lavagna. */
function kqStageOff() {
  KQM.fit = null; document.body.classList.remove("stage-on");
  const v = $(".view.active"); if (v) v.style.paddingBottom = "";
}
function kqFitBox(box, dock, ratios, pad = { x: 0, y: 0 }) {
  if (!box || !box.parentElement || box.hidden || box.parentElement.hidden) return;
  if (!box.getClientRects().length) return;
  const fresh = !document.body.classList.contains("stage-on"); document.body.classList.add("stage-on");
  const w = (box.parentElement.clientWidth || 300) - pad.x;
  const head = kqHeadH(), tabs = ($(".tabs") || {}).offsetHeight || 0, dockH = dock && !dock.hidden ? dock.offsetHeight : 0;
  const avail = Math.max(150, window.innerHeight - head - tabs - dockH - 14 - pad.y);
  let bw = 0, bh = 0;
  for (const r of ratios) if (w / r <= avail) { bw = w; bh = w / r; break; }
  if (!bw) { bh = avail; bw = Math.min(w, avail * ratios[0]); }
  box.style.width = Math.round(bw) + "px"; box.style.height = Math.round(bh) + "px";
  const view = box.closest(".view");
  if (view && dock) {
    view.style.paddingBottom = (dockH + 14) + "px";
    const top = box.parentElement.getBoundingClientRect().top + window.scrollY, need = top - head - 6 + window.innerHeight, have = document.documentElement.scrollHeight;
    if (have < need) view.style.paddingBottom = (dockH + 14 + Math.ceil(need - have)) + "px";
  }
  if (fresh) requestAnimationFrame(() => {
    if (window.scrollY >= 5) return;
    const el = box.parentElement, top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - kqHeadH() - 6));
  });
}
function kqDockHTML(id, mainHTML, bodyHTML) {
  return `<div class="dock" id="${id}"><button type="button" class="dock-h" aria-label="Apri o chiudi i controlli" aria-expanded="false"><span class="dock-bar"></span></button>
    <div class="dock-main">${mainHTML}</div><div class="dock-body">${bodyHTML}</div></div>`;
}
/* Due altezze: chiuso (solo riga principale) e aperto. Si apre con un tocco o trascinando la maniglia verso l'alto. */
function kqDockBind(dock, onChange) {
  const h = $(".dock-h", dock); let y0 = null;
  const set = open => { dock.classList.toggle("open", open); h.setAttribute("aria-expanded", String(open)); onChange && onChange(open); };
  h.addEventListener("pointerdown", e => { y0 = e.clientY; try { h.setPointerCapture(e.pointerId); } catch (_) { } });
  const end = e => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) < 14) set(!dock.classList.contains("open")); else set(dy < 0);
  };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", () => { y0 = null; });
  if (window.ResizeObserver && onChange) new ResizeObserver(() => onChange()).observe(dock);
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(!dock.classList.contains("open")); } });
  return set;
}
window.addEventListener("resize", () => { if (typeof $ !== "function") return; kqHeadH(); KQM.fit && KQM.fit(); });
window.addEventListener("orientationchange", () => setTimeout(() => KQM.fit && KQM.fit(), 250));
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("#board,#st-svg,#vd-draw,.kb-cv,.ink-cap")) e.preventDefault(); });

/* ================= segni a mano sulle lavagne + modalità Focus ================= */
const INK_COL = { red: "Rosso", green: "Verde" };
function kqInkItemHTML(s) {
  const c = s.c === "green" ? "green" : "red";
  if (s.t === "arrow" && s.p.length >= 2) {
    const [x1, y1] = s.p[0], [x2, y2] = s.p[s.p.length - 1], h = arrowHead(x1, y1, x2, y2);
    return `<g><line class="ink ink-${c}" x1="${x1}" y1="${y1}" x2="${h.bx}" y2="${h.by}"/><polygon class="inkh inkh-${c}" points="${h.pts}"/></g>`;
  }
  return `<path class="ink ink-${c}" d="${s.p.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}"/>`;
}
function kqInkSync(svg, b) {
  let g = svg.querySelector("#ink");
  if (!g) { g = document.createElementNS(SVGNS, "g"); g.setAttribute("id", "ink"); svg.appendChild(g); }
  g.innerHTML = (b.ink || []).map(kqInkItemHTML).join("");
}
function kqSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}
const FOCUS_ICO = {
  pen: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/>',
  arrow: '<path d="M4 20 18 6M9 6h9v9"/>',
  eraser: '<path d="M7 20h11M5 15l8-9 6 6-6 6H9z"/>',
  exit: '<path d="M6 6l12 12M18 6 6 18"/>'
};
function kqFocusBarHTML(st) {
  const ico = k => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${FOCUS_ICO[k]}</svg>`;
  const dot = c => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="8" class="fdot fdot-${c}"/></svg>`;
  const B = (id, label, inner, on) => `<button type="button" class="fb ${on ? "on" : ""}" data-f="${id}" aria-label="${label}" aria-pressed="${!!on}">${inner}<span>${label}</span></button>`;
  return B("pen", "Penna", ico("pen"), st.tool === "pen") + B("arrow", "Freccia", ico("arrow"), st.tool === "arrow") + B("eraser", "Gomma", ico("eraser"), st.tool === "eraser")
    + B("red", "Rosso", dot("red"), st.color === "red") + B("green", "Verde", dot("green"), st.color === "green")
    + `<button type="button" class="fb fb-exit" data-f="exit" aria-label="Esci dalla modalità Focus">${ico("exit")}<span>Esci</span></button>`;
}
function kqFocusEnter(wrap, svg, b) {
  if (KQM.focus) return;
  const st = { wrap, svg, b, tool: "pen", color: "red", drag: null, onFs: null };
  KQM.focus = st;
  wrap.classList.add("focus"); document.body.classList.add("focus-on"); document.body.style.overflow = "hidden";
  const cap = document.createElement("div"); cap.className = "ink-cap"; cap.setAttribute("aria-hidden", "true");
  const bar = document.createElement("div"); bar.className = "fbar"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Strumenti Focus");
  bar.innerHTML = kqFocusBarHTML(st);
  wrap.appendChild(cap); wrap.appendChild(bar); st.cap = cap; st.bar = bar;
  b.ink = b.ink || [];
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]; };
  const refresh = () => kqInkSync(svg, b);
  const erase = p => {
    const keep = b.ink.filter(s => !s.p.some((q, i) => (i ? kqSegDist(p[0], p[1], s.p[i - 1][0], s.p[i - 1][1], q[0], q[1]) : Math.hypot(p[0] - q[0], p[1] - q[1])) < 7));
    if (keep.length !== b.ink.length) { b.ink = keep; refresh(); }
  };
  cap.addEventListener("pointerdown", e => {
    e.preventDefault(); try { cap.setPointerCapture(e.pointerId); } catch (_) { }
    const p = pt(e);
    if (st.tool === "eraser") { st.drag = { erase: true }; erase(p); return; }
    st.drag = { item: { t: st.tool, c: st.color, p: st.tool === "arrow" ? [p, p] : [p] } };
    b.ink.push(st.drag.item); refresh();
  });
  cap.addEventListener("pointermove", e => {
    if (!st.drag) return; const p = pt(e);
    if (st.drag.erase) { erase(p); return; }
    const it = st.drag.item;
    if (it.t === "arrow") it.p[1] = p; else { const l = it.p[it.p.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.2) it.p.push(p); }
    refresh();
  });
  const end = () => {
    if (!st.drag) return;
    const it = st.drag.item;
    if (it && (it.t === "arrow" ? Math.hypot(it.p[1][0] - it.p[0][0], it.p[1][1] - it.p[0][1]) < 4 : it.p.length < 2)) b.ink = b.ink.filter(s => s !== it);
    st.drag = null; refresh(); save();
  };
  cap.addEventListener("pointerup", end); cap.addEventListener("pointercancel", end);
  bar.addEventListener("click", e => {
    const t = e.target.closest("[data-f]"); if (!t) return; const f = t.dataset.f;
    if (f === "exit") { kqFocusExit(); return; }
    if (f === "red" || f === "green") { st.color = f; if (st.tool === "eraser") st.tool = "pen"; } else st.tool = f;
    bar.innerHTML = kqFocusBarHTML(st);
  });
  st.onFs = () => { if (!document.fullscreenElement && KQM.focus === st) kqFocusExit(true); };
  document.addEventListener("fullscreenchange", st.onFs);
  try { const r = wrap.requestFullscreen && wrap.requestFullscreen({ navigationUI: "hide" }); if (r && r.catch) r.catch(() => { }); } catch (_) { }
}
function kqFocusExit(fromFs) {
  const st = KQM.focus; if (!st) return; KQM.focus = null;
  document.removeEventListener("fullscreenchange", st.onFs);
  if (!fromFs && document.fullscreenElement) { try { const r = document.exitFullscreen(); if (r && r.catch) r.catch(() => { }); } catch (_) { } }
  st.cap.remove(); st.bar.remove();
  st.wrap.classList.remove("focus"); document.body.classList.remove("focus-on"); document.body.style.overflow = "";
  kqInkSync(st.svg, st.b); save();
  const view = st.wrap.closest(".view"); if (view) kqBoardExtras(view, st.b);
}
/* Aggiunge a ogni lavagna il pulsante Focus e il livello dei segni. */
function kqBoardExtras(v, b) {
  const wrap = $(".boardwrap", v), svg = wrap && $("#board", wrap); if (!svg) return;
  b.ink = b.ink || [];
  kqInkSync(svg, b);
  const card = $(".card.tight", v); if (!card) return;
  const old = $(".focusrow", card); if (old) old.remove();
  card.insertAdjacentHTML("beforeend", `<div class="toolbar focusrow"><button type="button" class="btn sm" id="b-focus" aria-label="Modalità Focus a schermo intero">⛶ Focus</button>
    ${b.ink.length ? `<button type="button" class="chip" id="b-inkclr">Cancella segni</button>` : ""}<span class="small mut">Schermo intero con penna, freccia e gomma.</span></div>`);
  $("#b-focus", card).onclick = () => kqFocusEnter(wrap, svg, b);
  const c = $("#b-inkclr", card); if (c) c.onclick = () => { b.ink = []; save(); kqBoardExtras(v, b); };
}

/* ================= fasi Prima | Tecnica | Dopo ================= */
/* Prima = mobilizzazione ("mob"), Dopo = rilassamento ("ril") di prevenzione-data.js.
   Per aggiungere in futuro esercizi dedicati a una fase basta inserire in PV_EX voci con ph: "prima" o "dopo":
   compariranno qui in automatico, senza altre modifiche. */
const KQ_PHASES = [
  { id: "prima", label: "Prima", block: "mob", title: "Prima · mobilizzazione", intro: "Esercizi di mobilizzazione già presenti in Prevenzione, scelti per le zone più sollecitate dallo sport." },
  { id: "tecnica", label: "Tecnica" },
  { id: "dopo", label: "Dopo", block: "ril", title: "Dopo · rilassamento", intro: "Esercizi di rilassamento già presenti in Prevenzione, per le zone dello sport e la respirazione." }
];
const KQ_ZONE_BADGE = { spalla: "Spalla", gomito: "Gomito", polso: "Polso", lombare: "Lombare", anca: "Anca", ginocchio: "Ginocchio", tibia: "Tibia", achille: "Achille", caviglia: "Caviglia" };
function kqPhaseExercises(ph, sport) {
  const zones = new Set(((SPORT_BIO[sport] || {}).zones) || []);
  const W = PV_SPORT_W[sport] || {};
  const score = e => Math.max(0, ...e.z.map(z => W[z] ?? 0));
  const pool = PV_EX.filter(e => (e.ph ? e.ph === ph.id : e.b === ph.block) && (e.z.some(z => zones.has(z)) || (ph.id === "dopo" && e.z.includes("core"))));
  return pool.sort((a, b) => score(b) - score(a) || a.lv - b.lv || a.id.localeCompare(b.id));
}
function kqPhaseTabs() {
  return `<div class="seg full phase-tabs" role="tablist" aria-label="Fase della seduta">${KQ_PHASES.map(p =>
    `<button type="button" role="tab" aria-selected="${KQM.phase === p.id}" class="${KQM.phase === p.id ? "on" : ""}" data-phase="${p.id}">${p.label}</button>`).join("")}</div>`;
}
const PH_SHOWN = 8;
function kqPhaseHTML(ph, sport) {
  const all = kqPhaseExercises(ph, sport), shown = all.slice(0, PH_SHOWN), more = all.slice(PH_SHOWN);
  const zones = (((SPORT_BIO[sport] || {}).zones) || []).map(z => KQ_ZONE_BADGE[z] || z).join(", ");
  const row = e => { const d = pvDose(e, 0);
    return `<li><details><summary><span class="grow"><span class="t">${esc(e.n)}</span><span class="s">${esc(pvDoseTxt(d))}${e.eq !== "none" ? " · " + esc(PV_EQ[e.eq].toLowerCase()) : ""} · ${esc(PV_LEVELS[e.lv - 1] || "")}</span></span></summary>
      <p class="small" style="margin:6px 0">${esc(e.d)}</p><p class="small mut" style="margin:0 0 6px"><b>Punto chiave:</b> ${esc(e.k)}</p></details></li>`; };
  const long = ph.id === "dopo" && (LONGEVITY[sport] || []).length ? kqLongevityBlock(sport) : "";
  return `<div class="card" id="ph-card"><div class="row between"><h3 class="h-ic">${sportIcon(sport, 22)}${esc(ph.title)}</h3><span class="pill acc">${all.length} esercizi</span></div>
    <p class="small mut">${esc(ph.intro)} Sport: <b>${esc(SPORTS[sport])}</b>${zones ? ` · zone: ${esc(zones)}` : ""}. Dosi del livello Base.</p>
    ${all.length ? `<ol class="list pvlist">${shown.map(row).join("")}</ol>
      ${more.length ? `<details class="data"><summary>Mostra altri ${more.length}</summary><ol class="list pvlist">${more.map(row).join("")}</ol></details>` : ""}
      <button type="button" class="btn pri block" id="ph-go" style="margin-top:12px">▶ Avvia con il timer (${shown.length} esercizi)</button>`
      : `<div class="empty">Nessun esercizio per questa fase e questo sport.</div>`}</div>${long}`;
}
function kqPhaseBind(v, ph, sport) {
  const all = kqPhaseExercises(ph, sport), shown = all.slice(0, PH_SHOWN);
  const go1 = $("#ph-go", v);
  if (go1) go1.onclick = () => {
    const items = shown.map(e => ({ ...pvDose(e, 0), b: e.b }));
    ptBuild(items, "prev", `${ph.title} · ${SPORTS[sport]}`, { sport, level: 0 });
    PV.tab = "sessione"; go("prevenzione"); ptPlay();
  };
  if (ph.id === "dopo") kqBindLongevity(v);
}

/* ================= drill: schede a scorrimento orizzontale ================= */
const KB_DRILL_ANIM = { kb1: "swing", kb2: "press" };
function kqDrillDone(id) { const t = today(); return (S.drillLog || []).filter(x => x.id === id && x.date === t).length; }
function kqDrillCardsHTML(list, info) {
  const risky = d => d.zones.filter(z => info.riskyGroups.includes(z));
  if (!list.length) return `<div class="empty">Nessun drill disponibile con i filtri attuali.</div>`;
  return `<div class="dcards-wrap"><div class="dcards" id="dcards" role="list" aria-label="Drill, scorri di lato">${list.map(d => {
    const r = risky(d), n = kqDrillDone(d.id);
    const media = KB_DRILL_ANIM[d.id] ? `<canvas class="kb-cv dc-cv" data-ex="${KB_DRILL_ANIM[d.id]}" width="480" height="300" aria-label="Schema animato del gesto"></canvas>`
      : `<div class="dc-ic" aria-hidden="true">${sportIcon(d.sport, 44)}</div>`;
    return `<article class="dcard ${r.length ? "warn" : ""}" role="listitem" tabindex="0" data-id="${d.id}" aria-label="${esc(d.title)}, tocca per i dettagli">
      ${media}<h3>${esc(d.title)}</h3>
      <div class="meta"><span class="pill">${esc(SPORTS[d.sport])}</span><span class="pill">${esc(d.time)}</span><span class="pill">${esc(d.level)}</span></div>
      <div class="meta">${d.zones.map(z => `<span class="pill ${info.riskyGroups.includes(z) ? "red" : "acc"}">${esc(KQ_ZONE_BADGE[z] || GROUP_LABELS[z] || z)}</span>`).join("")}</div>
      ${r.length ? `<p class="small z-red" style="margin:6px 0 0">Sollecita una zona con fastidio.</p>` : ""}
      <p class="small mut dc-hint">Tocca la scheda per obiettivo e passi</p>
      <button type="button" class="btn block dc-done ${n ? "done" : "pri"}" data-done="${d.id}" aria-pressed="${n ? "true" : "false"}">${n ? "✓ Completato oggi" : "Completa"}</button>
    </article>`; }).join("")}</div>
    <div class="dc-pos" aria-live="polite"><span id="dc-n">1 / ${list.length}</span><div class="dc-bar"><div id="dc-fill" style="width:${100 / list.length}%"></div></div></div></div>`;
}
function kqDrillCardsBind(v, list, openDetail) {
  const sc = $("#dcards", v); if (!sc) return;
  const upd = () => {
    const w = sc.clientWidth || 1, i = Math.max(0, Math.min(list.length - 1, Math.round(sc.scrollLeft / w)));
    $("#dc-n", v).textContent = `${i + 1} / ${list.length}`; $("#dc-fill", v).style.width = ((i + 1) / list.length * 100) + "%";
  };
  sc.addEventListener("scroll", upd, { passive: true });
  $$(".dcard", sc).forEach(card => {
    const open = () => openDetail(card.dataset.id);
    card.addEventListener("click", e => { if (!e.target.closest("[data-done]")) open(); });
    card.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); open(); } });
  });
  $$("[data-done]", sc).forEach(btn => btn.onclick = e => {
    e.stopPropagation();
    const id = btn.dataset.done, d = DRILLS.find(x => x.id === id), t = today();
    S.drillLog = S.drillLog || [];
    const done = kqDrillDone(id) > 0;
    if (done) { const k = S.drillLog.map(x => x.id === id && x.date === t).lastIndexOf(true); if (k >= 0) S.drillLog.splice(k, 1); }
    else { S.drillLog.push({ id, sport: d.sport, date: t, ts: Date.now() }); kqVibe(40); }
    save();
    btn.classList.toggle("done", !done); btn.classList.toggle("pri", done);
    btn.setAttribute("aria-pressed", String(!done)); btn.textContent = done ? "Completa" : "✓ Completato oggi";
    if (!done) { btn.closest(".dcard").classList.add("flash"); setTimeout(() => btn.closest(".dcard").classList.remove("flash"), 700); }
    toast(done ? "Completamento annullato" : "Drill segnato come fatto oggi");
  });
}
