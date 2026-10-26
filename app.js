/* CourtIQ - logica dell'app (Giocatore + Coach). Nessun server: i dati restano sul dispositivo. */
"use strict";

/* ================= utilità ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const DAY = 86400000;
const pad2 = n => String(n).padStart(2, "0");
const isoDay = d => { const x = new Date(d); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
const today = () => isoDay(Date.now());
const dayNum = s => { const [y, m, d] = s.split("-").map(Number); return Math.round(new Date(y, m - 1, d).getTime() / DAY); };
const fmtDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }); };
const fmtTime = s => `${Math.floor(s / 60)}:${pad2(Math.max(0, Math.ceil(s)) % 60)}`;
const SPORT_IDS = Object.keys(SPORTS);              // tennis, pickleball, padel
const SPORT_ICON = { tennis: "🎾", pickleball: "🏓", padel: "🥎" };
const LEVELS = ["Base", "Intermedio"];
const RPE_LABELS = ["", "Molto leggero", "Leggero", "Moderato", "Abbastanza impegnativo", "Impegnativo", "Impegnativo +", "Molto impegnativo", "Molto impegnativo +", "Quasi massimale", "Massimale"];

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
function setRangeFill(inp) { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty("--p", p + "%"); }

/* ================= stato persistente ================= */
const KEY = "courtiq.v1";
const DEFAULT = () => ({
  mode: "player", sport: "tennis", sessions: [], draftPains: {}, boards: {},
  hideRisky: true, drillSport: "all", athletes: null, lastRoutine: null
});
let S = load();
function load() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o === "object") return Object.assign(DEFAULT(), o); } catch (e) { }
  return DEFAULT();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Spazio di archiviazione pieno"); } }

/* ================= motore carichi e dolori ================= */
const MIN_HISTORY_DAYS = 14, MIN_SESSIONS = 3;
const INSUFF_TXT = "Dati insufficienti: registra ancora qualche sessione";
function analyze(sessions, draft = {}) {
  const t = dayNum(today());
  const byDay = new Map();
  for (const s of sessions) { const k = dayNum(s.date); byDay.set(k, (byDay.get(k) || 0) + s.dur * s.rpe); }
  let acute = 0, chronic28 = 0;
  const daily = [];
  for (let i = 27; i >= 0; i--) { const v = byDay.get(t - i) || 0; daily.push(v); chronic28 += v; if (i < 7) acute += v; }
  const chronic = chronic28 / 4;
  const first = sessions.length ? Math.min(...sessions.map(s => dayNum(s.date))) : t;
  const historyDays = t - first + 1;
  // con meno di 14 giorni di storico o meno di 3 sessioni il rapporto non è affidabile: nessuna zona né allarme
  const insufficient = sessions.length < MIN_SESSIONS || historyDays < MIN_HISTORY_DAYS;
  const rawRatio = chronic > 0 ? acute / chronic : null;
  const ratio = insufficient ? null : rawRatio;
  let zone = "none";
  if (ratio != null) zone = ratio > 1.5 ? "red" : ratio > 1.3 ? "yellow" : ratio >= 0.8 ? "green" : "low";

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
  const last = sorted[0];
  const active = {};   // zona -> {sev,type,src}
  if (last && t - dayNum(last.date) <= 7) for (const p of last.pains || []) active[p.zone] = { sev: p.sev, type: p.type, src: "session" };
  for (const [z, p] of Object.entries(draft)) if (!active[z] || p.sev > active[z].sev) active[z] = { sev: p.sev, type: p.type, src: "draft" };

  // fastidio persistente: presente in ciascuna delle ultime 3 sessioni
  const persistent = [];
  if (sorted.length >= 3) {
    const l3 = sorted.slice(0, 3).map(s => new Set((s.pains || []).map(p => p.zone)));
    for (const z of l3[0]) if (l3[1].has(z) && l3[2].has(z)) persistent.push(z);
  }
  const groups = {};   // gruppo -> severità max
  for (const [z, p] of Object.entries(active)) { const g = ZONES[z]?.group; if (g) groups[g] = Math.max(groups[g] || 0, p.sev); }
  const riskyGroups = Object.keys(groups).filter(g => groups[g] >= 3);
  const alerts = [];
  if (zone === "red") alerts.push({ lv: "red", t: "Attenzione: rischio sovraccarico elevato", d: `Il carico degli ultimi 7 giorni è ${ratio.toFixed(2)} volte la media del mese. Riduci intensità o durata nei prossimi giorni.` });
  else if (zone === "yellow") alerts.push({ lv: "yellow", t: "Carico in aumento", d: `Rapporto ${ratio.toFixed(2)}: sei sopra la zona ideale (0,8-1,3). Evita di aggiungere sessioni intense.` });
  if (persistent.length) alerts.push({ lv: "red", t: "Fastidio che persiste da 3 sessioni", d: `${persistent.map(z => ZONES[z].label).join(", ")}: ti consigliamo di ridurre i carichi, seguire la routine di scarico e sentire un professionista sanitario.` });
  const strong = Object.entries(active).filter(([, p]) => p.sev >= 7 || p.type === "Fitta");
  if (strong.length) alerts.push({ lv: "red", t: "Dolore forte o a fitta", d: `${strong.map(([z]) => ZONES[z].label).join(", ")}: fermati e consulta un medico o un fisioterapista prima di riprendere.` });
  if (riskyGroups.length && !strong.length) alerts.push({ lv: "yellow", t: "Drill filtrati", d: `I drill che sollecitano ${riskyGroups.map(g => GROUP_LABELS[g].toLowerCase()).join(", ")} sono segnalati o nascosti finché il fastidio non scende sotto 3/10.` });
  return { acute, chronic, ratio, rawRatio, insufficient, zone, daily, historyDays, active, groups, riskyGroups, persistent, alerts, last, sorted };
}
const ZONE_TXT = { green: ["Zona ideale", "green"], yellow: ["Attenzione", "yellow"], red: ["Sovraccarico", "red"], low: ["Carico basso", "grey"], none: ["Dati insufficienti", "grey"] };

/* Generatore di routine di compensazione (5-10 minuti) */
function buildRoutine(info) {
  const groups = Object.entries(info.groups).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  let picks = [];
  for (const g of groups) { const r = ROUTINES.find(r => r.zones.includes(g)); if (r && !picks.includes(r)) picks.push(r); if (picks.length >= 2) break; }
  let title, why;
  if (picks.length) {
    title = "Scarico: " + picks.map(r => r.title.split(",")[0]).join(" + ");
    why = "Generata dai fastidi segnalati: " + groups.map(g => `${GROUP_LABELS[g]} ${info.groups[g]}/10`).join(", ") + ".";
  } else if (info.zone === "red" || info.zone === "yellow") {
    picks = [ROUTINES.find(r => r.id === "r7"), ROUTINES.find(r => r.id === "r4")];
    title = "Scarico dopo carico elevato"; why = "Il carico settimanale è alto: sessione di scarico leggera.";
  } else {
    picks = [ROUTINES.find(r => r.id === "r1")];
    title = "Riscaldamento pre-partita"; why = "Nessun fastidio segnalato: preparati al meglio per la prossima sessione.";
  }
  let steps = [];
  if (picks.length === 1) steps = picks[0].steps.slice();
  else { const a = picks[0].steps, b = picks[1].steps; steps = a.slice(0, 5).concat(b.slice(0, 4)); }
  // limita a 10 minuti
  let tot = 0; steps = steps.filter(s => (tot += s.s) <= 600);
  return { id: "gen", title, why, steps, gen: true };
}

/* ================= navigazione ================= */
let TAB = "oggi";
function go(tab) {
  TAB = tab;
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + tab));
  render(tab); window.scrollTo(0, 0);
}
function render(tab = TAB) {
  ({ oggi: S.mode === "coach" ? renderCoach : renderToday, corpo: renderBody, drill: renderDrills, lavagna: renderBoard, recupero: renderRecovery })[tab]();
}
function setMode(m) {
  S.mode = m; save();
  $$(".mode button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  $("#tab-oggi-label").textContent = m === "coach" ? "Atleti" : "Oggi";
  document.body.dataset.mode = m;
  render();
}

/* ================= sheet ================= */
function openSheet(html, onMount) {
  $("#sheet-body").innerHTML = html; $("#sheet").hidden = false; document.body.style.overflow = "hidden";
  onMount && onMount($("#sheet-body"));
}
function closeSheet() { $("#sheet").hidden = true; $("#sheet-body").innerHTML = ""; document.body.style.overflow = ""; }

/* ================= componenti comuni ================= */
function sportChips(sel, name = "sport", withAll = false) {
  const items = (withAll ? [["all", "Tutti"]] : []).concat(SPORT_IDS.map(id => [id, SPORTS[id]]));
  return `<div class="chips" data-group="${name}">${items.map(([id, l]) =>
    `<button type="button" class="chip ${sel === id ? "on" : ""}" data-val="${id}">${id !== "all" ? SPORT_ICON[id] + " " : ""}${l}</button>`).join("")}</div>`;
}
function bindChips(root, name, cb) {
  $$(`[data-group="${name}"] .chip`, root).forEach(b => b.onclick = () => {
    $$(`[data-group="${name}"] .chip`, root).forEach(x => x.classList.toggle("on", x === b)); cb(b.dataset.val);
  });
}
function gaugeSVG(ratio, zone) {
  const v = ratio == null ? 0 : Math.min(ratio, 2) / 2;
  const a = Math.PI * (1 - v), x = 60 + 48 * Math.cos(a), y = 60 - 48 * Math.sin(a);
  const col = { green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)", low: "var(--blue)", none: "var(--mut)" }[zone];
  const arc = (f, t, c) => { const a1 = Math.PI * (1 - f), a2 = Math.PI * (1 - t);
    return `<path d="M${60 + 48 * Math.cos(a1)} ${60 - 48 * Math.sin(a1)} A48 48 0 0 1 ${60 + 48 * Math.cos(a2)} ${60 - 48 * Math.sin(a2)}" stroke="${c}" stroke-width="10" fill="none" opacity=".35"/>`; };
  return `<svg viewBox="0 0 120 70" class="gsvg">${arc(0, .4, "var(--blue)")}${arc(.4, .65, "var(--green)")}${arc(.65, .75, "var(--yellow)")}${arc(.75, 1, "var(--red)")}
    ${ratio != null ? `<line x1="60" y1="60" x2="${x}" y2="${y}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>` : ""}<circle cx="60" cy="60" r="5" fill="${col}"/></svg>`;
}
function acwrCard(info, title = "Carico di allenamento (ACWR)") {
  const [zl, zc] = ZONE_TXT[info.zone];
  const bars = info.daily.map((v, i) => { const mx = Math.max(...info.daily, 1);
    return `<div class="${i === 27 ? "today" : i >= 21 ? "wk" : ""}" style="height:${Math.max(3, v / mx * 100)}%" title="${v}"></div>`; }).join("");
  return `<div class="card"><div class="row between"><h3>${title}</h3><span class="pill ${zc}">${zl}</span></div>
    <div class="acwr"><div class="gauge">${gaugeSVG(info.ratio, info.zone)}<div class="val">${info.ratio == null ? "–" : info.ratio.toFixed(2)}</div></div>
    <p class="small mut">${info.insufficient ? `<b class="z-none insuff">${INSUFF_TXT}</b><br>` : ""}Rapporto tra il carico degli ultimi 7 giorni e la media settimanale dell'ultimo mese. Zona ideale: 0,8-1,3. Sopra 1,5 il rischio di sovraccarico aumenta.
    ${!info.insufficient && info.historyDays < 21 ? "<br><b>Servono almeno 3-4 settimane di dati per un valore affidabile.</b>" : ""}</p></div>
    <div class="kpis"><div class="kpi"><b>${info.acute}</b><span>Carico 7 gg</span></div><div class="kpi"><b>${Math.round(info.chronic)}</b><span>Media sett. 28 gg</span></div>
    <div class="kpi"><b>${Object.keys(info.active).length}</b><span>Fastidi attivi</span></div></div>
    <div class="bars">${bars}</div><div class="legend"><span>28 giorni fa</span><span>ultimi 7 gg</span><span>oggi</span></div></div>`;
}
function alertsHTML(info) {
  return info.alerts.map(a => `<div class="alert ${a.lv}"><span>${a.lv === "red" ? "⚠️" : "ℹ️"}</span><div><b>${esc(a.t)}</b><br>${esc(a.d)}</div></div>`).join("");
}
const DISCLAIMER = `<div class="disclaimer"><span>⚕️</span><span>CourtIQ dà indicazioni generali di allenamento, non è un dispositivo medico. In caso di dolore forte, persistente o dopo un trauma, rivolgiti a un medico o a un fisioterapista.</span></div>`;

/* ================= OGGI (giocatore) ================= */
let CK = { sport: null, dur: 60, rpe: 6, date: null, notes: "" };
function renderToday() {
  const v = $("#view-oggi"); const info = analyze(S.sessions, S.draftPains);
  CK.sport = CK.sport || S.sport; CK.date = CK.date || today();
  const draft = Object.entries(S.draftPains);
  const recent = info.sorted.slice(0, 8);
  v.innerHTML = `
    ${alertsHTML(info)}
    <div class="card" id="checkin"><div class="row between"><h2>Check-in post sessione</h2><span class="pill acc">20 sec</span></div>
      ${sportChips(CK.sport, "ck-sport")}
      <label class="lbl">Durata <b id="ck-dur-v">${CK.dur} min</b></label>
      <input type="range" id="ck-dur" min="15" max="180" step="5" value="${CK.dur}"><div class="ticks"><span>15</span><span>60</span><span>120</span><span>180</span></div>
      <label class="lbl">Sforzo percepito (RPE) <b id="ck-rpe-v">${CK.rpe}</b></label>
      <input type="range" id="ck-rpe" min="1" max="10" step="1" value="${CK.rpe}"><div class="ticks"><span>1 leggero</span><span id="ck-rpe-l">${RPE_LABELS[CK.rpe]}</span><span>10 massimo</span></div>
      <div class="loadbox"><div><div class="small mut">Carico della sessione</div><b id="ck-load">${CK.dur * CK.rpe}</b> <span class="small mut">UA</span></div>
        <div class="small mut" style="text-align:right" id="ck-proj"></div></div>
      <div class="row between"><b>Fastidi</b><button type="button" class="btn sm ghost" id="ck-body">Segna sulla mappa →</button></div>
      <div class="chips" style="margin:8px 0 4px">${draft.length ? draft.map(([z, p]) => `<span class="pill ${p.sev >= 7 ? "red" : p.sev >= 3 ? "yellow" : "grey"}">${esc(ZONES[z].label)} ${p.sev}/10</span>`).join("") : `<span class="small mut">Nessun fastidio segnalato</span>`}</div>
      <details class="data"><summary>Data e note</summary>
        <input type="date" class="field" id="ck-date" value="${CK.date}" max="${today()}" style="margin-bottom:8px">
        <textarea class="field" id="ck-notes" placeholder="Note (facoltative)">${esc(CK.notes)}</textarea></details>
      <button type="button" class="btn pri block" id="ck-save" style="margin-top:12px">Salva sessione</button>
    </div>
    ${acwrCard(info)}
    <div class="card"><h3>Ultime sessioni</h3>
      ${recent.length ? `<ul class="list">${recent.map(s => `<li><span class="dot" style="background:var(--acc2)"></span><div class="grow"><div class="t">${SPORT_ICON[s.sport] || ""} ${esc(SPORTS[s.sport] || s.sport)} · ${s.dur} min · RPE ${s.rpe}</div>
        <div class="s">${fmtDate(s.date)} · carico ${s.dur * s.rpe}${(s.pains || []).length ? " · " + s.pains.map(p => `${esc(ZONES[p.zone]?.label)} ${p.sev}/10`).join(", ") : ""}</div></div>
        <button type="button" class="icon-btn" data-del="${s.id}" aria-label="Elimina">✕</button></li>`).join("")}</ul>`
        : `<div class="empty">Nessuna sessione ancora. Registra la prima qui sopra oppure <button type="button" class="btn sm ghost" id="demo">carica dati di esempio</button></div>`}
    </div>
    ${DISCLAIMER}
    <details class="data card tight"><summary>Gestione dati</summary>
      <p class="small mut">I dati sono salvati solo su questo dispositivo.</p>
      <div class="btns"><button type="button" class="btn sm" id="exp">Esporta (JSON)</button><label class="btn sm">Importa<input type="file" id="imp" accept="application/json" hidden></label>
      <button type="button" class="btn sm" id="demo2">Dati di esempio</button><button type="button" class="btn sm danger" id="wipe">Cancella tutto</button></div></details>`;

  const dur = $("#ck-dur"), rpe = $("#ck-rpe");
  const upd = () => {
    CK.dur = +dur.value; CK.rpe = +rpe.value; setRangeFill(dur); setRangeFill(rpe);
    $("#ck-dur-v").textContent = CK.dur + " min"; $("#ck-rpe-v").textContent = CK.rpe; $("#ck-rpe-l").textContent = RPE_LABELS[CK.rpe];
    $("#ck-load").textContent = CK.dur * CK.rpe;
    const p = analyze(S.sessions.concat([{ date: $("#ck-date")?.value || today(), dur: CK.dur, rpe: CK.rpe, pains: [] }]));
    $("#ck-proj").innerHTML = p.insufficient ? `<span class="z-none insuff">${INSUFF_TXT}</span>` : p.ratio == null ? "" : `ACWR dopo il salvataggio<br><b class="z-${p.zone}">${p.ratio.toFixed(2)}</b> · ${ZONE_TXT[p.zone][0]}`;
  };
  dur.oninput = upd; rpe.oninput = upd; upd();
  bindChips(v, "ck-sport", val => { CK.sport = val; S.sport = val; save(); });
  $("#ck-body").onclick = () => go("corpo");
  $("#ck-date").onchange = e => { CK.date = e.target.value; upd(); };
  $("#ck-notes").oninput = e => CK.notes = e.target.value;
  $("#ck-save").onclick = () => {
    const pains = Object.entries(S.draftPains).map(([zone, p]) => ({ zone, sev: p.sev, type: p.type }));
    S.sessions.push({ id: uid(), ts: Date.now(), date: CK.date || today(), sport: CK.sport, dur: CK.dur, rpe: CK.rpe, notes: CK.notes.trim(), pains });
    S.draftPains = {}; CK.notes = ""; CK.date = today(); save();
    const hi = pains.some(p => p.sev >= 3);
    toast(hi ? "Sessione salvata · routine di scarico pronta" : "Sessione salvata");
    hi ? go("recupero") : renderToday();
  };
  $$("[data-del]", v).forEach(b => b.onclick = () => { if (confirm("Eliminare questa sessione?")) { S.sessions = S.sessions.filter(s => s.id !== b.dataset.del); save(); renderToday(); } });
  [$("#demo"), $("#demo2")].forEach(b => b && (b.onclick = () => { if (!S.sessions.length || confirm("Sostituire le tue sessioni con dati di esempio?")) { S.sessions = demoSessions(1); save(); renderToday(); toast("Dati di esempio caricati"); } }));
  $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" })); a.download = `courtiq-${today()}.json`; a.click(); };
  $("#imp").onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const o = JSON.parse(t); if (!Array.isArray(o.sessions)) throw 0; S = Object.assign(DEFAULT(), o); save(); setMode(S.mode); toast("Dati importati"); } catch (_) { toast("File non valido"); } }); };
  $("#wipe").onclick = () => { if (confirm("Cancellare tutti i dati di CourtIQ su questo dispositivo?")) { S = DEFAULT(); save(); setMode("player"); toast("Dati cancellati"); } };
}

/* dati di esempio deterministici */
function demoSessions(seed, opts = {}) {
  let x = seed * 9301 + 49297; const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const out = [], t = dayNum(today()), sports = opts.sports || SPORT_IDS;
  for (let i = 34; i >= 1; i--) {
    if (rnd() < (i < 8 && opts.spike ? 0.75 : 0.42)) {
      const d = new Date((t - i) * DAY + 12 * 3600000);
      const pains = [];
      if (opts.pain && i < 10) pains.push({ zone: opts.pain, sev: Math.min(8, 2 + Math.round((10 - i) / 2)), type: "Indolenzimento" });
      out.push({ id: uid(), ts: d.getTime(), date: isoDay(d), sport: sports[Math.floor(rnd() * sports.length)], dur: 45 + Math.round(rnd() * 9) * 10, rpe: 4 + Math.round(rnd() * (opts.spike && i < 8 ? 5 : 3)), pains, notes: "" });
    }
  }
  return out;
}

/* ================= COACH: roster ================= */
function demoAthletes() {
  return [
    { id: uid(), name: "Giulia R.", sport: "tennis", demo: true, sessions: demoSessions(3, { sports: ["tennis"], spike: true }), assigned: [] },
    { id: uid(), name: "Marco B.", sport: "pickleball", demo: true, sessions: demoSessions(5, { sports: ["pickleball"], pain: "gomito_dx" }), assigned: [] },
    { id: uid(), name: "Sara L.", sport: "padel", demo: true, sessions: demoSessions(7, { sports: ["padel"], pain: "spalla_dx" }), assigned: [] },
    { id: uid(), name: "Luca P.", sport: "tennis", demo: true, sessions: demoSessions(11, { sports: ["tennis", "padel"] }), assigned: [] }
  ];
}
function renderCoach() {
  if (!S.athletes) { S.athletes = demoAthletes(); save(); }
  const v = $("#view-oggi");
  const rows = S.athletes.map(a => ({ a, i: analyze(a.sessions) }));
  const rank = { red: 0, yellow: 1, green: 3, low: 2, none: 4 };
  rows.sort((p, q) => (rank[p.i.zone] - rank[q.i.zone]) || (Object.keys(q.i.active).length - Object.keys(p.i.active).length));
  const over = rows.filter(r => r.i.zone === "red").length, hurt = rows.filter(r => r.i.riskyGroups.length).length;
  v.innerHTML = `
    <div class="card"><div class="row between"><h2>I tuoi atleti</h2><button type="button" class="btn sm pri" id="add-ath">+ Atleta</button></div>
      <div class="kpis"><div class="kpi"><b>${rows.length}</b><span>Atleti</span></div><div class="kpi"><b class="z-red">${over}</b><span>Sovraccarico</span></div><div class="kpi"><b class="z-yellow">${hurt}</b><span>Con fastidi</span></div></div>
      ${S.athletes.some(a => a.demo) ? `<p class="small mut" style="margin-top:10px">Gli atleti segnati "esempio" sono dati dimostrativi: puoi eliminarli dalla loro scheda.</p>` : ""}
      <div>${rows.map(({ a, i }) => { const [zl, zc] = ZONE_TXT[i.zone]; const pains = Object.entries(i.active);
        return `<button type="button" class="athlete" data-ath="${a.id}"><span class="avatar">${esc(a.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>
          <span class="grow" style="flex:1;min-width:0"><span class="t" style="display:block;font-weight:700">${esc(a.name)} ${a.demo ? '<span class="pill grey">esempio</span>' : ""}</span>
          <span class="s small mut">${SPORT_ICON[a.sport] || ""} ${esc(SPORTS[a.sport] || "")} · ${i.insufficient ? `<span class="insuff">${INSUFF_TXT}</span>` : "ACWR " + (i.ratio == null ? "–" : i.ratio.toFixed(2))}${pains.length ? " · " + pains.map(([z, p]) => `${esc(ZONES[z].label)} ${p.sev}/10`).join(", ") : ""}</span></span>
          <span class="pill ${zc}">${zl}</span></button>`; }).join("") || `<div class="empty">Nessun atleta.</div>`}</div></div>
    ${DISCLAIMER}`;
  $("#add-ath").onclick = () => athleteForm();
  $$("[data-ath]", v).forEach(b => b.onclick = () => athleteSheet(b.dataset.ath));
}
function athleteForm() {
  let sp = "tennis";
  openSheet(`<h2>Nuovo atleta</h2><input class="field" id="an" placeholder="Nome e iniziale del cognome" maxlength="40">
    <label class="lbl">Sport principale</label>${sportChips(sp, "an-sport")}
    <button type="button" class="btn pri block" id="an-ok" style="margin-top:16px">Aggiungi</button>`, r => {
    bindChips(r, "an-sport", x => sp = x); $("#an", r).focus();
    $("#an-ok", r).onclick = () => { const n = $("#an", r).value.trim(); if (!n) return toast("Inserisci un nome");
      S.athletes.push({ id: uid(), name: n, sport: sp, sessions: [], assigned: [] }); save(); closeSheet(); renderCoach(); };
  });
}
function athleteSheet(id) {
  const a = S.athletes.find(x => x.id === id); if (!a) return;
  const i = analyze(a.sessions); const rt = buildRoutine(i);
  const okDrills = DRILLS.filter(d => d.sport === a.sport && !d.zones.some(z => i.riskyGroups.includes(z)));
  openSheet(`<div class="row between"><h2>${esc(a.name)}</h2><span class="pill">${SPORT_ICON[a.sport]} ${esc(SPORTS[a.sport])}</span></div>
    ${alertsHTML(i)}${acwrCard(i, "Carico")}
    <div class="card tight"><h3>Assegnazioni</h3>
      ${a.assigned.length ? `<ul class="list">${a.assigned.map((x, k) => `<li><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.kind)} · ${fmtDate(x.date)}</div></div><button type="button" class="icon-btn" data-unas="${k}">✕</button></li>`).join("")}</ul>` : `<p class="small mut">Nessuna assegnazione.</p>`}
      <label class="lbl">Assegna protocollo di scarico</label>
      <select class="field" id="as-r"><option value="gen">Consigliato: ${esc(rt.title)}</option>${ROUTINES.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join("")}</select>
      <label class="lbl">Assegna drill (${esc(SPORTS[a.sport])}, esclusi quelli a rischio)</label>
      <select class="field" id="as-d"><option value="">-</option>${okDrills.map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join("")}</select>
      <div class="btns" style="margin-top:10px"><button type="button" class="btn sm pri" id="as-ok">Assegna</button><button type="button" class="btn sm" id="as-copy">Copia scheda per l'atleta</button></div></div>
    <div class="card tight"><h3>Registra una sessione</h3>
      <div class="grid2"><input class="field" type="number" id="ls-dur" min="10" max="240" value="60" aria-label="Durata minuti"><input class="field" type="number" id="ls-rpe" min="1" max="10" value="6" aria-label="RPE"></div>
      <div class="ticks"><span>durata (min)</span><span>RPE 1-10</span></div>
      <div class="grid2" style="margin-top:8px"><select class="field" id="ls-z"><option value="">Nessun fastidio</option>${Object.entries(ZONES).map(([k, z]) => `<option value="${k}">${esc(z.label)}</option>`).join("")}</select>
        <input class="field" type="number" id="ls-sev" min="1" max="10" value="3" aria-label="Fastidio 1-10"></div>
      <button type="button" class="btn sm block" id="ls-ok" style="margin-top:8px">Salva sessione</button></div>
    <div class="card tight"><h3>Storico</h3><ul class="list">${i.sorted.slice(0, 6).map(s => `<li><div class="grow"><div class="t">${fmtDate(s.date)} · ${s.dur} min · RPE ${s.rpe}</div><div class="s">${esc(SPORTS[s.sport] || "")}${(s.pains || []).map(p => ` · ${esc(ZONES[p.zone]?.label)} ${p.sev}/10`).join("")}</div></div></li>`).join("") || `<li class="empty">Nessuna sessione</li>`}</ul></div>
    <button type="button" class="btn danger block" id="ath-del">Elimina atleta</button>`, r => {
    $("#as-ok", r).onclick = () => {
      const rid = $("#as-r", r).value, did = $("#as-d", r).value;
      const rr = rid === "gen" ? rt : ROUTINES.find(x => x.id === rid);
      a.assigned.push({ kind: "Routine", title: rr.title, ref: rid, steps: rr.steps, date: today() });
      if (did) a.assigned.push({ kind: "Drill", title: DRILLS.find(d => d.id === did).title, ref: did, date: today() });
      save(); toast("Assegnato"); athleteSheet(id);
    };
    $("#as-copy", r).onclick = () => copyText(athleteText(a, i));
    $$("[data-unas]", r).forEach(b => b.onclick = () => { a.assigned.splice(+b.dataset.unas, 1); save(); athleteSheet(id); });
    $("#ls-ok", r).onclick = () => {
      const dur = Math.max(10, Math.min(240, +$("#ls-dur", r).value || 60)), rpe = Math.max(1, Math.min(10, +$("#ls-rpe", r).value || 6));
      const z = $("#ls-z", r).value, sev = Math.max(1, Math.min(10, +$("#ls-sev", r).value || 3));
      a.sessions.push({ id: uid(), ts: Date.now(), date: today(), sport: a.sport, dur, rpe, notes: "", pains: z ? [{ zone: z, sev, type: "Indolenzimento" }] : [] });
      save(); toast("Sessione registrata"); athleteSheet(id); renderCoach();
    };
    $("#ath-del", r).onclick = () => { if (confirm(`Eliminare ${a.name}?`)) { S.athletes = S.athletes.filter(x => x.id !== id); save(); closeSheet(); renderCoach(); } };
  });
}
function athleteText(a, i) {
  const L = [`CourtIQ · scheda per ${a.name}`, `Sport: ${SPORTS[a.sport]}`, `ACWR: ${i.ratio == null ? "dati insufficienti" : i.ratio.toFixed(2) + " (" + ZONE_TXT[i.zone][0] + ")"}`];
  if (Object.keys(i.active).length) L.push("Fastidi: " + Object.entries(i.active).map(([z, p]) => `${ZONES[z].label} ${p.sev}/10`).join(", "));
  for (const x of a.assigned) {
    L.push("", `${x.kind}: ${x.title}`);
    if (x.steps) x.steps.forEach((s, k) => L.push(`${k + 1}. ${s.n} (${s.s}s) - ${s.d}`));
    if (x.kind === "Drill") { const d = DRILLS.find(d => d.id === x.ref); if (d) { L.push(d.tactic.goal); d.tactic.steps.forEach((s, k) => L.push(`${k + 1}. ${s}`)); } }
  }
  L.push("", "Indicazioni generali, non sostituiscono il parere di un medico o fisioterapista.");
  return L.join("\n");
}
function copyText(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Copiato negli appunti"), () => {
    openSheet(`<h3>Copia il testo</h3><textarea class="field" style="min-height:260px" readonly>${esc(t)}</textarea>`, r => $("textarea", r).select());
  });
}

/* ================= CORPO: mappa del dolore ================= */
const HOT = {
  spalla_dx: [64, 94], spalla_sx: [136, 94], gomito_dx: [50, 150], gomito_sx: [150, 150], polso_dx: [40, 200], polso_sx: [160, 200],
  lombare: [100, 182], ginocchio_dx: [84, 284], ginocchio_sx: [116, 284], achille_dx: [86, 344], achille_sx: [114, 344], caviglia_dx: [82, 370], caviglia_sx: [118, 370]
};
function bodySVG(pains) {
  const sil = `<g class="sil">
    <circle cx="100" cy="40" r="20"/><rect x="92" y="58" width="16" height="14" rx="4"/>
    <path d="M68 78 Q100 70 132 78 Q142 82 140 100 L132 150 Q128 175 124 205 L76 205 Q72 175 68 150 L60 100 Q58 82 68 78Z"/>
    <path class="limb" d="M64 92 L52 150 L42 202"/><path class="limb" d="M136 92 L148 150 L158 202"/>
    <path class="limb thick" d="M86 210 L84 284 L84 368"/><path class="limb thick" d="M114 210 L116 284 L116 368"/>
    <ellipse cx="80" cy="380" rx="12" ry="6"/><ellipse cx="120" cy="380" rx="12" ry="6"/></g>`;
  const hots = Object.entries(HOT).map(([z, [x, y]]) => { const p = pains[z]; const c = p ? (p.sev >= 7 ? "pain" : p.sev >= 3 ? "mid" : "low") : "";
    return `<g class="hot ${c} ${p && p.sev >= 7 ? "pulse" : ""}" data-zone="${z}" role="button" tabindex="0" aria-label="${esc(ZONES[z].label)}${p ? ", fastidio " + p.sev : ""}">
      <circle class="ring" cx="${x}" cy="${y}" r="13"/><circle class="core" cx="${x}" cy="${y}" r="${p ? 8 : 4}"/>${p ? `<text x="${x}" y="${y + 3}">${p.sev}</text>` : ""}</g>`; }).join("");
  return `<svg id="bodysvg" viewBox="0 0 200 400" aria-label="Mappa del corpo">${sil}<text class="side" x="24" y="20">DX</text><text class="side" x="176" y="20">SX</text>${hots}</svg>`;
}
function renderBody() {
  const v = $("#view-corpo"); const info = analyze(S.sessions, S.draftPains);
  const draft = Object.entries(S.draftPains);
  // conteggio storico per zona (ultimi 30 giorni)
  const t = dayNum(today()), hist = {};
  for (const s of S.sessions) if (t - dayNum(s.date) <= 30) for (const p of s.pains || []) hist[p.zone] = (hist[p.zone] || 0) + 1;
  v.innerHTML = `
    <div class="card"><h2>Dove senti fastidio?</h2><p class="small mut">Tocca un punto sulla silhouette (vista frontale) e indica l'intensità. I fastidi verranno salvati con il prossimo check-in.</p>
      <div class="bodywrap">${bodySVG(S.draftPains)}</div>
      <div class="chips" style="margin-top:8px">${draft.map(([z, p]) => `<button type="button" class="chip on" data-zone="${z}">${esc(ZONES[z].label)} · ${p.sev}/10 · ${esc(p.type)}</button>`).join("") || `<span class="small mut">Nessun fastidio selezionato.</span>`}</div>
      <div class="btns" style="margin-top:12px"><button type="button" class="btn pri" id="to-ck">Vai al check-in</button>${draft.length ? `<button type="button" class="btn ghost" id="clr-p">Azzera</button>` : ""}</div></div>
    ${info.persistent.length ? `<div class="alert red"><span>⚠️</span><div><b>Fastidi persistenti</b><br>${info.persistent.map(z => esc(ZONES[z].label)).join(", ")} segnalati nelle ultime 3 sessioni.</div></div>` : ""}
    <div class="card"><h3>Ultimi 30 giorni</h3>${Object.keys(hist).length ? `<ul class="list">${Object.entries(hist).sort((a, b) => b[1] - a[1]).map(([z, n]) => `<li><span class="dot" style="background:var(--yellow)"></span><div class="grow"><div class="t">${esc(ZONES[z].label)}</div><div class="s">segnalato in ${n} session${n === 1 ? "e" : "i"}</div></div></li>`).join("")}</ul>` : `<div class="empty">Nessun fastidio registrato.</div>`}</div>
    ${DISCLAIMER}`;
  $$("[data-zone]", v).forEach(g => { g.onclick = () => painSheet(g.dataset.zone); g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); painSheet(g.dataset.zone); } }; });
  $("#to-ck").onclick = () => go("oggi");
  $("#clr-p") && ($("#clr-p").onclick = () => { S.draftPains = {}; save(); renderBody(); });
}
function painSheet(z) {
  const cur = S.draftPains[z] || { sev: 3, type: PAIN_TYPES[0] }; let type = cur.type;
  openSheet(`<h2>${esc(ZONES[z].label)}</h2>
    <label class="lbl">Intensità del fastidio <b id="ps-v">${cur.sev}/10</b></label>
    <input type="range" id="ps" min="1" max="10" value="${cur.sev}"><div class="ticks"><span>1 lieve</span><span>5</span><span>10 forte</span></div>
    <label class="lbl">Tipo di sensazione</label>
    <div class="chips" data-group="ptype">${PAIN_TYPES.map(p => `<button type="button" class="chip ${p === type ? "on" : ""}" data-val="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <div id="ps-warn"></div>
    <div class="btns" style="margin-top:16px"><button type="button" class="btn pri" id="ps-ok" style="flex:1">Salva</button>${S.draftPains[z] ? `<button type="button" class="btn danger" id="ps-rm">Rimuovi</button>` : ""}</div>`, r => {
    const inp = $("#ps", r);
    const upd = () => { setRangeFill(inp); $("#ps-v", r).textContent = inp.value + "/10";
      $("#ps-warn", r).innerHTML = (+inp.value >= 7 || type === "Fitta") ? `<div class="alert red" style="margin-top:12px"><span>⚠️</span><div>Con un dolore forte o a fitta è meglio fermarsi e sentire un professionista sanitario.</div></div>` : ""; };
    inp.oninput = upd; bindChips(r, "ptype", x => { type = x; upd(); }); upd();
    $("#ps-ok", r).onclick = () => { S.draftPains[z] = { sev: +inp.value, type }; save(); closeSheet(); renderBody(); };
    $("#ps-rm", r) && ($("#ps-rm", r).onclick = () => { delete S.draftPains[z]; save(); closeSheet(); renderBody(); });
  });
}

/* ================= DRILL ================= */
function renderDrills() {
  const v = $("#view-drill"); const info = analyze(S.sessions, S.draftPains);
  const risky = d => d.zones.filter(z => info.riskyGroups.includes(z));
  let list = DRILLS.filter(d => S.drillSport === "all" || d.sport === S.drillSport);
  const hidden = S.hideRisky ? list.filter(d => risky(d).length).length : 0;
  if (S.hideRisky) list = list.filter(d => !risky(d).length);
  v.innerHTML = `
    ${S.mode === "coach" ? plannerCard() : ""}
    <div class="card tight"><h2>Libreria drill</h2>${sportChips(S.drillSport, "dr-sport", true)}
      ${info.riskyGroups.length ? `<label class="switch"><input type="checkbox" id="hide" ${S.hideRisky ? "checked" : ""}> Nascondi drill che sollecitano zone con fastidio (${info.riskyGroups.map(g => esc(GROUP_LABELS[g])).join(", ")})</label>` : ""}
      ${hidden ? `<p class="small mut">${hidden} drill nascost${hidden === 1 ? "o" : "i"} per proteggere le zone con fastidio.</p>` : ""}</div>
    ${list.map(d => { const r = risky(d);
      return `<div class="card drill ${r.length ? "warn" : ""}" data-id="${d.id}"><button type="button" class="hd"><span class="ic">${SPORT_ICON[d.sport]}</span>
        <span style="flex:1;min-width:0"><span class="t" style="display:block">${esc(d.title)}</span><span class="meta"><span class="pill">${esc(SPORTS[d.sport])}</span><span class="pill">${esc(d.cat)}</span><span class="pill">${esc(d.level)}</span><span class="pill">${esc(d.time)}</span>${r.length ? `<span class="pill red">Sollecita ${r.map(g => esc(GROUP_LABELS[g].toLowerCase())).join(", ")}</span>` : ""}</span></span>
        <span class="chev">▾</span></button>
        <div class="bd">${r.length ? `<div class="alert red"><span>⚠️</span><div>Questo drill sollecita una zona in cui hai segnalato fastidio. Meglio rimandarlo e fare la routine di scarico.</div></div>` : ""}
          <div class="seg full layers" role="group"><button type="button" class="on" data-l="tac">Tattica e bersagli</button><button type="button" data-l="tec">Biomeccanica</button></div>
          <div class="layer" data-layer="tac"><h4>Obiettivo</h4><p>${esc(d.tactic.goal)}</p><h4>Bersaglio</h4><p>${esc(d.tactic.target)}</p><h4>Esecuzione</h4><ol>${d.tactic.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
            <div class="mini">${courtSVG(d.sport, d.board ? boardFromDrill(d) : null, true)}</div></div>
          <div class="layer" data-layer="tec" hidden><h4>Catena cinetica</h4><ul>${d.tech.chain.map(s => `<li>${esc(s)}</li>`).join("")}</ul><h4>Errori che sovraccaricano</h4><ul>${d.tech.faults.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
            <h4>Zone sollecitate</h4><div class="chips">${d.zones.map(z => `<span class="pill ${info.riskyGroups.includes(z) ? "red" : ""}">${esc(GROUP_LABELS[z])}</span>`).join("")}</div></div>
          <div class="btns" style="margin-top:12px"><button type="button" class="btn sm" data-board="${d.id}">Apri in lavagna</button></div></div></div>`; }).join("") || `<div class="empty">Nessun drill disponibile con i filtri attuali.</div>`}`;
  bindChips(v, "dr-sport", x => { S.drillSport = x; save(); renderDrills(); });
  $("#hide") && ($("#hide").onchange = e => { S.hideRisky = e.target.checked; save(); renderDrills(); });
  $$(".drill", v).forEach(c => {
    $(".hd", c).onclick = () => c.classList.toggle("open");
    $$(".layers button", c).forEach(b => b.onclick = () => { $$(".layers button", c).forEach(x => x.classList.toggle("on", x === b)); $$("[data-layer]", c).forEach(l => l.hidden = l.dataset.layer !== b.dataset.l); });
  });
  $$("[data-board]", v).forEach(b => b.onclick = () => { const d = DRILLS.find(x => x.id === b.dataset.board); S.boards[d.sport] = boardFromDrill(d); S.boardSport = d.sport; save(); go("lavagna"); toast("Schema caricato in lavagna"); });
  if (S.mode === "coach") bindPlanner(v);
}

/* Session planner (coach): lezione da 60 minuti in 3 clic */
let PL = { sport: null, level: "Base", focus: "" };
function plannerCard() {
  PL.sport = PL.sport || S.sport;
  const cats = [...new Set(DRILLS.filter(d => d.sport === PL.sport).map(d => d.cat))];
  if (!cats.includes(PL.focus)) PL.focus = "";
  return `<div class="card"><h2>Piano lezione (60 min)</h2>${sportChips(PL.sport, "pl-sport")}
    <label class="lbl">Livello</label><div class="seg full" id="pl-lv">${LEVELS.map(l => `<button type="button" class="${PL.level === l ? "on" : ""}" data-v="${l}">${l}</button>`).join("")}</div>
    <label class="lbl">Obiettivo</label><select class="field" id="pl-f"><option value="">Misto</option>${cats.map(c => `<option ${c === PL.focus ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <button type="button" class="btn pri block" id="pl-go" style="margin-top:12px">Genera piano</button><div id="pl-out"></div></div>`;
}
function bindPlanner(v) {
  bindChips(v, "pl-sport", x => { PL.sport = x; renderDrills(); });
  $$("#pl-lv button", v).forEach(b => b.onclick = () => { PL.level = b.dataset.v; $$("#pl-lv button", v).forEach(x => x.classList.toggle("on", x === b)); });
  $("#pl-f", v).onchange = e => PL.focus = e.target.value;
  $("#pl-go", v).onclick = () => {
    const pool = DRILLS.filter(d => d.sport === PL.sport && LEVELS.indexOf(d.level) <= LEVELS.indexOf(PL.level));
    const pick = pool.filter(d => d.cat === PL.focus).concat(pool.filter(d => d.cat !== PL.focus)).slice(0, 3);
    pick.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
    const plan = [["10 min", "Riscaldamento", ROUTINES[0].title], ...pick.map(d => ["10 min", "Drill", d.title]), ["15 min", "Gioco guidato", "Punti a tema sull'obiettivo della lezione"], ["5 min", "Defaticamento", ROUTINES.find(r => r.id === "r7").title]];
    $("#pl-out", v).innerHTML = `<ol class="list steps" style="margin-top:12px">${plan.map((p, k) => `<li><span class="num">${k + 1}</span><div class="grow"><div class="t">${esc(p[2])}</div><div class="s">${p[1]} · ${p[0]}</div></div></li>`).join("")}</ol>
      <button type="button" class="btn sm block" id="pl-copy">Copia piano</button>`;
    $("#pl-copy", v).onclick = () => copyText([`CourtIQ · Piano lezione ${SPORTS[PL.sport]} · ${PL.level}${PL.focus ? " · " + PL.focus : ""}`, ...plan.map((p, k) => `${k + 1}. ${p[1]} (${p[0]}): ${p[2]}`)].join("\n"));
  };
}

/* ================= LAVAGNA ================= */
/* Geometria in metri. Il campo è verticale: avversari in alto (y=0), tu in basso (y=1). */
const COURTS = {
  tennis: { W: 10.97, L: 23.77, mx: 2.2, my: 3.2, surface: "court-tennis" },
  pickleball: { W: 6.10, L: 13.41, mx: 1.4, my: 1.9, surface: "court-pickle" },
  padel: { W: 10, L: 20, mx: 0.9, my: 0.9, surface: "court-padel" }
};
const VB_H = 420;   // altezza del viewBox in unità SVG
function courtGeom(sport) {
  const c = COURTS[sport]; const k = VB_H / (c.L + 2 * c.my);
  return { ...c, k, vw: (c.W + 2 * c.mx) * k, vh: VB_H, ox: c.mx * k, oy: c.my * k, cw: c.W * k, ch: c.L * k };
}
function courtLines(sport, g) {
  const X = m => g.ox + m * g.k, Y = m => g.oy + m * g.k, L = g.L, W = g.W;
  const ln = (x1, y1, x2, y2, cls = "cl") => `<line class="${cls}" x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}"/>`;
  let s = `<rect class="${g.surface}" x="${g.ox}" y="${g.oy}" width="${g.cw}" height="${g.ch}"/>`;
  if (sport === "tennis") {
    const sg = 1.37, sv = L / 2 - 6.40, sv2 = L / 2 + 6.40;
    s += `<rect class="cl" x="${X(0)}" y="${Y(0)}" width="${g.cw}" height="${g.ch}" fill="none"/>` + ln(sg, 0, sg, L) + ln(W - sg, 0, W - sg, L) + ln(sg, sv, W - sg, sv) + ln(sg, sv2, W - sg, sv2) + ln(W / 2, sv, W / 2, sv2) + ln(W / 2, 0, W / 2, 0.3) + ln(W / 2, L - 0.3, W / 2, L);
  } else if (sport === "pickleball") {
    const k1 = L / 2 - 2.13, k2 = L / 2 + 2.13;
    s += `<rect class="kitchen" x="${X(0)}" y="${Y(k1)}" width="${g.cw}" height="${4.26 * g.k}"/>`
      + `<rect class="cl" x="${X(0)}" y="${Y(0)}" width="${g.cw}" height="${g.ch}" fill="none"/>` + ln(0, k1, W, k1) + ln(0, k2, W, k2) + ln(W / 2, 0, W / 2, k1) + ln(W / 2, k2, W / 2, L)
      + `<text class="court-txt" x="${X(W / 2)}" y="${Y(k1 + 1.1)}">KITCHEN</text><text class="court-txt" x="${X(W / 2)}" y="${Y(k2 - 0.8)}">KITCHEN</text>`;
  } else if (sport === "padel") {
    const sv = L / 2 - 6.95, sv2 = L / 2 + 6.95;
    s += ln(0, sv, W, sv) + ln(0, sv2, W, sv2) + ln(W / 2, sv, W / 2, sv2) + ln(W / 2, 0, W / 2, 0.2) + ln(W / 2, L - 0.2, W / 2, L);
    // pareti: vetro sul fondo e sui primi 4 m laterali, rete metallica al centro dei lati
    const t = 0.25;
    const wall = (x, y, w, h, cls) => `<rect class="${cls}" x="${X(x)}" y="${Y(y)}" width="${w * g.k}" height="${h * g.k}"/>`;
    s += wall(-t, -t, W + 2 * t, t, "glass") + wall(-t, L, W + 2 * t, t, "glass")
      + wall(-t, 0, t, 4, "glass") + wall(W, 0, t, 4, "glass") + wall(-t, L - 4, t, 4, "glass") + wall(W, L - 4, t, 4, "glass")
      + wall(-t, 4, t, L - 8, "mesh") + wall(W, 4, t, L - 8, "mesh")
      + `<text class="court-txt wall-txt" x="${X(W / 2)}" y="${Y(-t) - 3}">VETRO</text><text class="court-txt wall-txt" x="${X(W / 2)}" y="${Y(L + t) + 9}">VETRO</text>`
      + `<text class="court-txt wall-txt" x="${X(-t) - 4}" y="${Y(L / 2)}" transform="rotate(-90 ${X(-t) - 4} ${Y(L / 2)})">RETE METALLICA</text>`;
  }
  s += `<line class="net" x1="${X(sport === "padel" ? 0 : -0.5)}" y1="${Y(L / 2)}" x2="${X(sport === "padel" ? W : W + 0.5)}" y2="${Y(L / 2)}"/>`;
  return s;
}
function boardFromDrill(d) {
  const toks = []; let n = 1, m = 1;
  (d.board.p || []).forEach(([x, y]) => toks.push({ id: uid(), k: "p", x, y, l: String(n++) }));
  (d.board.o || []).forEach(([x, y]) => toks.push({ id: uid(), k: "o", x, y, l: "A" + m++ }));
  (d.board.b || []).forEach(([x, y]) => toks.push({ id: uid(), k: "b", x, y, l: "" }));
  return { toks, arrows: (d.board.a || []).map(a => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[3], t: a[4] })), from: d.title };
}
function defaultBoard(sport) {
  const dbl = { toks: [{ k: "p", x: 0.3, y: 0.9, l: "1" }, { k: "p", x: 0.7, y: 0.9, l: "2" }, { k: "o", x: 0.3, y: 0.1, l: "A1" }, { k: "o", x: 0.7, y: 0.1, l: "A2" }, { k: "b", x: 0.5, y: 0.75, l: "" }], arrows: [] };
  dbl.toks.forEach(t => t.id = uid()); return dbl;
}
// punta di freccia disegnata come poligono (niente <marker>: gli id duplicati tra mini-campi e lavagna la rendevano invisibile).
// Lunghezza ~5 volte lo spessore della linea, mai oltre il 45% della freccia; la linea si ferma alla base della punta.
const AH_LEN = 14, AH_HALF = 7.5;
function arrowHead(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const len = Math.min(AH_LEN, d * 0.45), half = len * AH_HALF / AH_LEN;
  const bx = x2 - ux * len, by = y2 - uy * len, f = n => n.toFixed(1);
  return { bx: f(bx), by: f(by), pts: `${f(x2)},${f(y2)} ${f(bx - uy * half)},${f(by + ux * half)} ${f(bx + uy * half)},${f(by - ux * half)}` };
}
function courtSVG(sport, board, mini = false) {
  const g = courtGeom(sport);
  const P = (x, y) => [g.ox + x * g.cw, g.oy + y * g.ch];
  const arrows = (board?.arrows || []).map((a, i) => { const [x1, y1] = P(a.x1, a.y1), [x2, y2] = P(a.x2, a.y2); const h = arrowHead(x1, y1, x2, y2);
    return `<g class="arw-g" data-i="${i}"><line class="arw ${a.t}" x1="${x1}" y1="${y1}" x2="${h.bx}" y2="${h.by}"/><polygon class="ah ${a.t}" points="${h.pts}"/></g>`; }).join("");
  const toks = (board?.toks || []).map(t => { const [x, y] = P(t.x, t.y);
    return `<g class="tok ${t.k}" data-tok="${t.id}" transform="translate(${x} ${y})"><circle r="${t.k === "b" ? 6 : 11}"/>${t.l ? `<text>${esc(t.l)}</text>` : ""}</g>`; }).join("");
  return `<svg ${mini ? 'class="minicourt"' : 'id="board"'} viewBox="0 0 ${g.vw} ${g.vh}" preserveAspectRatio="xMidYMid meet">
    <rect class="court-bg" width="${g.vw}" height="${g.vh}"/>${courtLines(sport, g)}<g class="arrows">${arrows}</g><line class="arw draft" id="draft" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/><polygon class="ah draft" id="draft-h" points="" visibility="hidden"/><g class="toks">${toks}</g></svg>`;
}
let TOOL = "move", UNDO = [];
function renderBoard() {
  const v = $("#view-lavagna");
  const sport = S.boardSport || S.sport;
  if (!S.boards[sport]) S.boards[sport] = defaultBoard(sport);
  const b = S.boards[sport];
  const tools = [["move", "✋ Sposta"], ["ball", "➶ Traiettoria palla"], ["move-arrow", "➜ Spostamento"], ["del", "🗑 Elimina"]];
  v.innerHTML = `
    <div class="card tight"><div class="seg full" id="bs">${SPORT_IDS.map(id => `<button type="button" class="${id === sport ? "on" : ""}" data-s="${id}">${SPORTS[id]}</button>`).join("")}</div>
      ${b.from ? `<p class="small mut" style="margin:8px 0 0">Schema: <b>${esc(b.from)}</b></p>` : ""}
      <div class="toolbar">${tools.map(([id, l]) => `<button type="button" class="chip ${TOOL === id ? "on" : ""}" data-tool="${id}">${l}</button>`).join("")}</div>
      <div class="toolbar"><button type="button" class="chip" data-add="p">+ Giocatore</button><button type="button" class="chip" data-add="o">+ Avversario</button><button type="button" class="chip" data-add="b">+ Palla</button><span class="sp"></span>
        <button type="button" class="chip" id="b-undo" ${UNDO.length ? "" : "disabled"}>↶</button><button type="button" class="chip" id="b-clr">Pulisci frecce</button><button type="button" class="chip" id="b-rst">Reset</button></div></div>
    <div class="boardwrap">${courtSVG(sport, b)}</div>
    <p class="small mut" style="margin-top:8px">${sport === "padel" ? "Il campo da padel mostra le pareti: vetro sul fondo e nei primi 4 m dei lati, rete metallica al centro." : sport === "pickleball" ? "La zona evidenziata vicino alla rete è la Kitchen (NVZ): non si colpisce al volo con i piedi al suo interno." : "Campo da doppio con corridoi e rettangoli del servizio."} Trascina le pedine; con gli strumenti freccia disegna trascinando sul campo.</p>
    <div class="legendrow small mut"><span><i class="lg p"></i>Tu / compagno</span><span><i class="lg o"></i>Avversari</span><span><i class="lg b"></i>Palla</span><span><i class="lg ball"></i>Palla</span><span><i class="lg move"></i>Movimento</span></div>`;
  $$("#bs button", v).forEach(x => x.onclick = () => { S.boardSport = x.dataset.s; UNDO = []; save(); renderBoard(); });
  $$("[data-tool]", v).forEach(x => x.onclick = () => { TOOL = x.dataset.tool; renderBoard(); });
  const snap = () => { UNDO.push(JSON.stringify(b)); if (UNDO.length > 40) UNDO.shift(); };
  $$("[data-add]", v).forEach(x => x.onclick = () => { snap(); const k = x.dataset.add, n = b.toks.filter(t => t.k === k).length + 1;
    b.toks.push({ id: uid(), k, x: 0.5 + (Math.random() - .5) * .2, y: k === "o" ? 0.25 : k === "p" ? 0.75 : 0.5, l: k === "p" ? String(n) : k === "o" ? "A" + n : "" }); save(); renderBoard(); });
  $("#b-undo").onclick = () => { if (!UNDO.length) return; S.boards[sport] = JSON.parse(UNDO.pop()); save(); renderBoard(); };
  $("#b-clr").onclick = () => { snap(); b.arrows = []; save(); renderBoard(); };
  $("#b-rst").onclick = () => { snap(); S.boards[sport] = defaultBoard(sport); save(); renderBoard(); };
  bindBoard($("#board"), sport, b, snap);
}
function bindBoard(svg, sport, b, snap) {
  const g = courtGeom(sport);
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.max(-g.ox / g.cw, Math.min(1 + g.ox / g.cw, (q.x - g.ox) / g.cw)), y: Math.max(-g.oy / g.ch, Math.min(1 + g.oy / g.ch, (q.y - g.oy) / g.ch)) }; };
  let drag = null;
  svg.addEventListener("pointerdown", e => {
    const tg = e.target.closest("[data-tok]");
    if (TOOL === "del") { if (tg) { snap(); b.toks = b.toks.filter(t => t.id !== tg.dataset.tok); save(); renderBoard(); }
      else { const a = e.target.closest(".arrows .arw-g"); if (a) { snap(); b.arrows.splice(+a.dataset.i, 1); save(); renderBoard(); } } return; }
    if (TOOL === "move") { if (!tg) return; snap(); drag = { t: b.toks.find(t => t.id === tg.dataset.tok), el: tg }; }
    else { const p = pt(e); drag = { arrow: { x1: p.x, y1: p.y, x2: p.x, y2: p.y, t: TOOL === "ball" ? "ball" : "move" } }; }
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return; const p = pt(e);
    if (drag.t) { drag.t.x = p.x; drag.t.y = p.y; drag.el.setAttribute("transform", `translate(${g.ox + p.x * g.cw} ${g.oy + p.y * g.ch})`); }
    else { drag.arrow.x2 = p.x; drag.arrow.y2 = p.y; const d = $("#draft", svg), dh = $("#draft-h", svg);
      const x1 = g.ox + drag.arrow.x1 * g.cw, y1 = g.oy + drag.arrow.y1 * g.ch, x2 = g.ox + p.x * g.cw, y2 = g.oy + p.y * g.ch, h = arrowHead(x1, y1, x2, y2);
      d.setAttribute("x1", x1); d.setAttribute("y1", y1); d.setAttribute("x2", h.bx); d.setAttribute("y2", h.by);
      d.setAttribute("class", "arw draft " + drag.arrow.t); d.setAttribute("visibility", "visible");
      dh.setAttribute("points", h.pts); dh.setAttribute("class", "ah draft " + drag.arrow.t); dh.setAttribute("visibility", "visible"); }
  });
  const end = () => {
    if (!drag) return;
    if (drag.arrow) { const a = drag.arrow; if (Math.hypot((a.x2 - a.x1) * g.cw, (a.y2 - a.y1) * g.ch) > 12) { snap(); b.arrows.push(a); } }
    drag = null; save(); renderBoard();
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
}

/* ================= RECUPERO: routine + timer ================= */
let TM = { r: null, i: 0, rem: 0, run: false, last: 0, h: null };
function renderRecovery() {
  const v = $("#view-recupero"); const info = analyze(S.sessions, S.draftPains);
  const gen = buildRoutine(info);
  if (!TM.r) loadRoutine(gen, false);
  const r = TM.r, tot = r.steps.reduce((a, s) => a + s.s, 0);
  v.innerHTML = `
    <div class="card"><div class="row between"><h2>${esc(r.title)}</h2><span class="pill acc">${Math.round(tot / 60)} min</span></div>
      ${r.why ? `<p class="small mut">${esc(r.why)}</p>` : ""}
      <div class="timer"><div class="ringwrap"><svg viewBox="0 0 220 220"><circle class="bgc" cx="110" cy="110" r="96"/><circle class="fgc" id="fgc" cx="110" cy="110" r="96" stroke-dasharray="${2 * Math.PI * 96}" stroke-dashoffset="0"/></svg>
        <div class="center"><b id="tm-t">${fmtTime(TM.rem)}</b><span id="tm-n">${esc(r.steps[TM.i]?.n || "Fatto!")}</span></div></div>
        <p class="small" id="tm-d" style="text-align:center;min-height:2.6em">${esc(r.steps[TM.i]?.d || "Routine completata. Ottimo lavoro!")}</p>
        <div class="tctrl"><button type="button" class="btn" id="tm-prev" aria-label="Precedente">⏮</button><button type="button" class="btn pri play" id="tm-play">${TM.run ? "Pausa" : "Avvia"}</button><button type="button" class="btn" id="tm-next" aria-label="Successivo">⏭</button><button type="button" class="btn" id="tm-rst" aria-label="Ricomincia">↺</button></div></div>
      <ol class="list steps" style="margin-top:12px">${r.steps.map((s, k) => `<li class="${k === TM.i ? "cur" : k < TM.i ? "done" : ""}" data-step="${k}"><span class="num">${k + 1}</span><div class="grow"><div class="t">${esc(s.n)}</div><div class="s">${esc(s.d)}</div></div><span class="small mut">${s.s}s</span></li>`).join("")}</ol></div>
    <div class="card"><h3>Altre routine</h3><ul class="list">
      ${[gen].concat(ROUTINES).map(x => `<li><div class="grow"><div class="t">${esc(x.title)}${x.gen ? ' <span class="pill acc">consigliata</span>' : ""}</div><div class="s">${esc(x.kind || "Su misura")} · ${Math.round(x.steps.reduce((a, s) => a + s.s, 0) / 60)} min${x.zones?.length ? " · " + x.zones.map(z => esc(GROUP_LABELS[z])).join(", ") : ""}</div></div>
        <button type="button" class="btn sm" data-rt="${x.id}">${TM.r.id === x.id && TM.r.title === x.title ? "In corso" : "Scegli"}</button></li>`).join("")}</ul></div>
    ${DISCLAIMER}`;
  $("#tm-play").onclick = () => { TM.run ? pause() : play(); };
  $("#tm-next").onclick = () => step(1); $("#tm-prev").onclick = () => step(-1);
  $("#tm-rst").onclick = () => { pause(); loadRoutine(TM.r, true); };
  $$("[data-step]", v).forEach(li => li.onclick = () => { TM.i = +li.dataset.step; TM.rem = TM.r.steps[TM.i].s; renderRecovery(); });
  $$("[data-rt]", v).forEach(b => b.onclick = () => { pause(); loadRoutine(b.dataset.rt === "gen" ? gen : ROUTINES.find(x => x.id === b.dataset.rt), true); window.scrollTo(0, 0); });
  paintTimer();
}
function loadRoutine(r, rerender) { TM.r = r; TM.i = 0; TM.rem = r.steps[0].s; if (rerender) renderRecovery(); }
function paintTimer() {
  const st = TM.r.steps[TM.i]; const f = $("#fgc"); if (!f) return;
  const C = 2 * Math.PI * 96; f.setAttribute("stroke-dashoffset", st ? C * (1 - TM.rem / st.s) : 0);
  $("#tm-t").textContent = st ? fmtTime(TM.rem) : "0:00";
}
function play() {
  if (TM.i >= TM.r.steps.length) loadRoutine(TM.r, false);
  TM.run = true; TM.last = performance.now(); beep(660);
  wakeLock(true);
  TM.h = setInterval(() => {
    const now = performance.now(); TM.rem -= (now - TM.last) / 1000; TM.last = now;
    if (TM.rem <= 0) { TM.i++; beep(880); navigator.vibrate && navigator.vibrate(150);
      if (TM.i >= TM.r.steps.length) { pause(); toast("Routine completata"); if (TAB === "recupero") renderRecovery(); return; }
      TM.rem = TM.r.steps[TM.i].s; if (TAB === "recupero") renderRecovery(); }
    if (TAB === "recupero") paintTimer();
  }, 250);
  if (TAB === "recupero") $("#tm-play").textContent = "Pausa";
}
function pause() { TM.run = false; clearInterval(TM.h); wakeLock(false); const b = $("#tm-play"); if (b) b.textContent = "Avvia"; }
function step(d) { TM.i = Math.max(0, Math.min(TM.r.steps.length - 1, TM.i + d)); TM.rem = TM.r.steps[TM.i].s; renderRecovery(); }
let AC = null;
function beep(f) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.value = f; g.gain.setValueAtTime(.15, AC.currentTime); g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + .25); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + .26); } catch (e) { } }
let WL = null;
function wakeLock(on) { try { if (on && navigator.wakeLock && !WL) navigator.wakeLock.request("screen").then(l => WL = l).catch(() => { }); else if (!on && WL) { WL.release(); WL = null; } } catch (e) { } }

/* ================= avvio ================= */
$$(".tabs button").forEach(b => b.onclick = () => go(b.dataset.tab));
$$(".mode button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
$("#sheet").addEventListener("click", e => { if (e.target.matches("[data-close]")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
setMode(S.mode);
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => { });
