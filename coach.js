/* BioKinetIQ - invito coach, semaforo allievi, drill assegnati, quota su registro. Nessun pagamento. */
"use strict";

let COACH_HOME = null;
let COACH_DRILLS = null;
let COACH_LINK = null;
let coachPushTimer = 0;
let coachDrillBusy = false;

function coachEuro(cents) {
  if (typeof bqEuro === "function") return bqEuro(cents);
  const n = Number(cents) / 100;
  return Number.isFinite(n) ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "";
}
function coachPushStatus() {
  if (typeof bqToken !== "function" || !bqToken()) return;
  if (typeof S === "undefined" || S.mode === "coach") return;
  clearTimeout(coachPushTimer);
  coachPushTimer = setTimeout(async () => {
    try {
      const info = analyze(S.sessions, S.draftPains || {});
      const pains = Object.entries(info.active).map(([zone, p]) => ({
        zone, label: (ZONES[zone] && ZONES[zone].label) || zone, sev: p.sev, type: p.type
      }));
      await bqApi("/coach/status", {
        sport: S.sport, pains, loadZone: info.zone,
        persistent: (info.persistent || []).length > 0, ratio: info.ratio
      });
    } catch (e) { }
  }, 400);
}
function coachSuggest(sport, pains) {
  const risky = new Set();
  for (const p of pains || []) {
    if (Number(p.sev) >= 3 && ZONES[p.zone]) risky.add(ZONES[p.zone].group);
  }
  const all = DRILLS.filter(d => d.sport === (sport || "tennis"));
  const safe = all.filter(d => !d.zones.some(z => risky.has(z)));
  const pool = safe.length >= 2 ? safe : all;
  return pool.slice(0, Math.min(3, pool.length));
}
function coachMount(v) {
  const host = document.createElement("div");
  host.id = "coach-linked";
  v.prepend(host);
  coachPaintHome(host);
}
async function coachPaintHome(host) {
  if (!bqToken()) {
    host.innerHTML = `<div class="card"><h2>Allievi collegati</h2>
      <p class="small">Per il coach o il terapista. Accedi con il piano Coach: da qui inviti un allievo e vedi il semaforo.</p>
      <button type="button" class="btn pri block" id="invita-login">Accedi</button></div>`;
    const b = document.getElementById("invita-login");
    if (b) b.onclick = () => bqShowAuth("login");
    return;
  }
  if (typeof bqPlanOk === "function" && BQ_BILLING_READY && !bqPlanOk("coach")) {
    host.innerHTML = `<div class="card"><h2>Allievi collegati</h2>
      <p class="small">L'invito e il semaforo sono nel piano BioKinetIQ Coach.</p>
      <button type="button" class="btn pri block" id="invita-plan">Apri i piani</button></div>`;
    document.getElementById("invita-plan").onclick = () => bqShowPricing("coach");
    return;
  }
  host.innerHTML = `<div class="card"><div class="row between"><h2>Allievi collegati</h2><button type="button" class="btn sm pri" id="invita">Invita allievo</button></div>
    <p class="small mut">Per il coach o il terapista. Semaforo da Salute e dal carico: verde nessun fastidio, giallo fastidio lieve, rosso sovraccarico da verificare prima della lezione.</p>
    <div id="coach-share"></div>
    <div id="coach-rows"><p class="small mut">Carico l'elenco…</p></div></div>`;
  document.getElementById("invita").onclick = () => coachInviteSheet(false);
  try {
    COACH_HOME = await bqApi("/coach/home");
    coachPaintShare();
    coachPaintRows();
  } catch (e) {
    const box = document.getElementById("coach-rows");
    if (box) box.innerHTML = `<p class="small">${esc((e.data && e.data.message) || "Elenco non disponibile. Serve il piano Coach attivo o in prova.")}</p>`;
  }
}
function coachPaintShare() {
  const el = document.getElementById("coach-share");
  if (!el || !COACH_HOME || !COACH_HOME.share || !COACH_HOME.share.enabled) {
    if (el) el.innerHTML = "";
    return;
  }
  const s = COACH_HOME.share;
  el.innerHTML = `<div class="card tight ${s.covered ? "share-ok" : ""}" style="margin-top:12px">
    <h3>Quota allievi</h3>
    <div class="kpis">
      <div class="kpi"><b>${s.activePaying}</b><span>Paganti</span></div>
      <div class="kpi"><b>${esc(coachEuro(s.earningsCents))}</b><span>Questo mese</span></div>
      <div class="kpi"><b>${esc(coachEuro(s.centsEach))}</b><span>A testa</span></div>
    </div>
    <p class="small">${s.covered ? "Il tuo abbonamento Coach è coperto da questo mese." : "Abbonamento Coach " + esc(coachEuro(s.coachMonthCents)) + ": mancano " + esc(coachEuro(s.gapCents)) + (s.athletesToCover ? " (ancora " + s.athletesToCover + " allievi paganti)." : ".")}</p>
    <p class="small mut">${esc(s.note)} Periodo ${esc(s.period)}. La prova gratuita non entra nel conteggio.</p>
  </div>`;
}
function coachPaintRows() {
  const el = document.getElementById("coach-rows");
  if (!el || !COACH_HOME) return;
  const rows = COACH_HOME.athletes || [];
  if (!rows.length) {
    el.innerHTML = `<div class="empty">Nessun allievo collegato. Il primo passo è Invita allievo.</div>`;
    return;
  }
  el.innerHTML = rows.map(a => {
    const pains = (a.pains || []).map(p => `${esc(p.label || p.zone)} ${p.sev}/10`).join(", ");
    const sport = a.sport && SPORTS[a.sport] ? sportIcon(a.sport, 16) + " " + esc(SPORTS[a.sport]) : "In attesa dello sport";
    const pay = a.paying ? `<span class="pill green">Pagante</span>` : (a.subscription && a.subscription.status === "trialing" ? `<span class="pill acc">Prova</span>` : "");
    const pill = a.light === "green" || a.light === "yellow" || a.light === "red" ? a.light : "grey";
    return `<button type="button" class="athlete" data-linked="${esc(a.id)}">
      <span class="light ${esc(pill === "grey" ? "wait" : a.light)}" aria-hidden="true"></span>
      <span class="grow" style="flex:1;min-width:0"><span class="t" style="display:block;font-weight:700">${esc(a.name)} ${pay}</span>
      <span class="s small mut">${sport}${pains ? " · " + pains : ""}${a.detail ? " · " + esc(a.detail) : ""}</span>
      <span class="pill ${pill}" style="margin-top:6px">${esc(a.label)}</span></span></button>`;
  }).join("");
  el.querySelectorAll("[data-linked]").forEach(b => { b.onclick = () => coachAssignSheet(b.dataset.linked); });
}
async function coachInviteSheet(rotate) {
  let data;
  try { data = await bqApi("/coach/invite", { rotate: !!rotate }); }
  catch (e) { toast((e.data && e.data.message) || "Invito non creato"); return; }
  const price = coachEuro(data.priceCents);
  openSheet(`<h2>Invita allievo</h2>
    <p class="small">Chi si registra con questo link resta collegato a te e riceve la prova di BioKinetIQ Athlete: ${data.trialDays} giorni, poi ${esc(price)} al mese. Nessun addebito in questa versione.</p>
    <div class="qr-box" id="inv-qr"></div>
    <input class="field" id="inv-url" readonly value="${esc(data.url)}">
    <div class="btns" style="margin-top:10px">
      <button type="button" class="btn sm pri" id="inv-copy">Copia</button>
      <button type="button" class="btn sm" id="inv-share">Condividi</button>
      <button type="button" class="btn sm ghost" id="inv-new">Nuovo link</button>
    </div>
    <p class="small mut">Un link già mandato resta valido anche se ne generi un altro.</p>`, r => {
    const svg = String(data.svg || "");
    const box = $("#inv-qr", r);
    if (box && svg.includes("<svg") && !svg.toLowerCase().includes("<script")) box.innerHTML = svg.replace(/<\?xml[^>]*>/, "");
    $("#inv-copy", r).onclick = () => copyText(data.url);
    $("#inv-share", r).onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ title: "BioKinetIQ", text: "Invito BioKinetIQ Athlete", url: data.url }); return; }
        catch (err) { if (err && err.name === "AbortError") return; }
      }
      copyText(data.url);
    };
    $("#inv-new", r).onclick = () => { closeSheet(); coachInviteSheet(true); };
  });
}
function coachAssignSheet(id) {
  const a = (COACH_HOME.athletes || []).find(x => x.id === id);
  if (!a) return;
  const picks = coachSuggest(a.sport || "tennis", a.pains);
  const prev = (a.assignments && a.assignments[0] && a.assignments[0].drills) || [];
  const pill = a.light === "green" || a.light === "yellow" || a.light === "red" ? a.light : "grey";
  openSheet(`<div class="row between"><h2>${esc(a.name)}</h2><span class="pill ${pill}">${esc(a.label)}</span></div>
    <p class="small mut">${a.detail ? esc(a.detail) + ". " : ""}Primo tocco: la scheda. Secondo tocco: assegni questi drill. Li trova nella sezione Drill, con la dicitura assegnato dal coach.</p>
    ${picks.length >= 2 ? `<ul class="list">${picks.map(d => `<li><span class="dot" style="background:var(--acc)"></span><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">${esc(SPORTS[d.sport] || "")} · ${esc(d.cat)} · ${esc(d.time)}</div></div></li>`).join("")}</ul>
      <button type="button" class="btn pri block" id="as-go">Assegna questi ${picks.length} drill</button>` : `<p class="small">Per questo sport non ci sono abbastanza drill da assegnare.</p>`}
    ${prev.length ? `<p class="small mut" style="margin-top:10px">Già assegnati: ${prev.map(d => esc(d.title)).join(", ")}.</p>` : ""}
    ${COACH_HOME.testTools && !a.paying ? `<button type="button" class="btn sm ghost block" id="as-pay" style="margin-top:8px">Segna pagante (solo test, nessun addebito)</button>` : ""}`, r => {
    const go = $("#as-go", r);
    if (go) go.onclick = async () => {
      go.disabled = true;
      try {
        await bqApi("/coach/assign", { athleteId: id, drills: picks.map(d => ({ id: d.id, title: d.title, sport: d.sport })) });
        toast("Drill assegnati");
        closeSheet();
        const host = document.getElementById("coach-linked");
        if (host) coachPaintHome(host);
      } catch (e) {
        go.disabled = false;
        toast((e.data && e.data.message) || "Assegnazione non riuscita");
      }
    };
    const pay = $("#as-pay", r);
    if (pay) pay.onclick = async () => {
      try {
        await bqApi("/coach/test-pay", { athleteId: id });
        toast("Segnato come pagante, senza addebito");
        closeSheet();
        const host = document.getElementById("coach-linked");
        if (host) coachPaintHome(host);
      } catch (e) { toast("Operazione di test non disponibile"); }
    };
  });
}
function coachDrillIds() {
  const ids = new Set();
  for (const a of COACH_DRILLS || []) for (const d of a.drills || []) ids.add(d.id);
  return ids;
}
function coachDrillMark(id) {
  if (!coachDrillIds().has(id)) return "";
  const who = (COACH_DRILLS || []).find(a => (a.drills || []).some(d => d.id === id));
  return `<span class="pill acc">Assegnato dal coach${who && who.coach ? " " + esc(who.coach) : ""}</span>`;
}
function coachDrillSlot() {
  if (typeof bqToken !== "function" || !bqToken() || (typeof S !== "undefined" && S.mode === "coach")) return "";
  coachRefreshDrills();
  if (COACH_DRILLS === null) return `<div class="card tight"><p class="small mut">Controllo i drill assegnati dal coach…</p></div>`;
  if (!COACH_DRILLS.length) return "";
  const a = COACH_DRILLS[0];
  return `<div class="card"><h2>Dal coach</h2>
    <p class="small">Assegnati da <b>${esc(a.coach || "coach")}</b>. Li trovi anche nella libreria, con il contrassegno.</p>
    <ul class="list">${(a.drills || []).map(d => `<li><span class="dot" style="background:var(--acc)"></span><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">${esc((SPORTS[d.sport] || d.sport || ""))}</div></div><span class="pill acc">Assegnato dal coach</span></li>`).join("")}</ul></div>`;
}
function coachRefreshDrills() {
  if (coachDrillBusy || !bqToken()) return;
  coachDrillBusy = true;
  bqApi("/me/drills").then(data => {
    const first = COACH_DRILLS === null;
    const prev = JSON.stringify(COACH_DRILLS || []);
    const next = JSON.stringify(data.assignments || []);
    COACH_DRILLS = data.assignments || [];
    coachDrillBusy = false;
    if ((first || next !== prev) && typeof TAB !== "undefined" && TAB === "drill" && typeof renderDrills === "function") renderDrills();
  }).catch(() => { if (COACH_DRILLS === null) COACH_DRILLS = []; coachDrillBusy = false; });
}
async function coachMountTrial() {
  const slot = document.getElementById("athlete-trial");
  if (!slot || !bqToken() || typeof S === "undefined" || S.mode === "coach") return;
  if (!BQ_SUB || BQ_SUB.plan !== "athlete" || BQ_SUB.status !== "trialing") { slot.innerHTML = ""; return; }
  if (COACH_LINK === null) {
    try { const data = await bqApi("/me/coach"); COACH_LINK = data.coach || ""; }
    catch (e) { COACH_LINK = ""; }
  }
  const node = document.getElementById("athlete-trial");
  if (!node) return;
  const when = BQ_SUB.trialEnds ? new Date(BQ_SUB.trialEnds).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
  const price = coachEuro(BQ_SUB.priceCents || (BQ_BILL.plans && BQ_BILL.plans.athlete && BQ_BILL.plans.athlete.month) || 799);
  node.innerHTML = `<div class="card tight"><h3>Prova BioKinetIQ Athlete</h3>
    <p class="small">${COACH_LINK ? "Collegato a <b>" + esc(COACH_LINK) + "</b>. " : ""}Fino al ${esc(when)}, poi ${esc(price)} al mese. In questa versione non c'è alcun addebito.</p></div>`;
}
if (typeof S !== "undefined" && S.mode === "coach" && typeof renderCoach === "function") renderCoach();

function coachOnSession() {
  COACH_HOME = null;
  COACH_DRILLS = null;
  COACH_LINK = null;
  coachDrillBusy = false;
  if (typeof setMode === "function" && typeof S !== "undefined") setMode(S.mode);
  else if (typeof render === "function") render();
  coachPushStatus();
}
