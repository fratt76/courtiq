/* BioKinetIQ - accesso. I dati locali (courtiq.v1) restano sul telefono e, se l'utente è loggato, si copiano anche sull'account. */
"use strict";

const BQ_TOKEN = "biokinetiq.token";
const BQ_USER = "biokinetiq.user";
function bqApiBase() {
  const m = document.querySelector('meta[name="bq-api"]');
  return (m && m.content) || "";
}
function bqToken() { try { return localStorage.getItem(BQ_TOKEN) || ""; } catch (e) { return ""; } }
function bqUser() { try { return JSON.parse(localStorage.getItem(BQ_USER) || "null"); } catch (e) { return null; } }
function bqSetSession(token, user) {
  try {
    if (token) localStorage.setItem(BQ_TOKEN, token); else localStorage.removeItem(BQ_TOKEN);
    if (user) localStorage.setItem(BQ_USER, JSON.stringify(user)); else localStorage.removeItem(BQ_USER);
  } catch (e) { }
  bqPaintAccount();
}
async function bqApi(path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = bqToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(bqApiBase() + "/api" + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || "api"); err.data = data; err.status = res.status; throw err; }
  return data;
}
function bqPaintAccount() {
  const b = document.getElementById("btn-account");
  const u = bqUser();
  if (b) b.textContent = u ? (t("auth.hello") + " " + (u.nome || "")) : t("auth.account");
}
async function bqSyncLocal() {
  if (!bqToken()) return;
  let local = null;
  try { local = JSON.parse(localStorage.getItem("courtiq.v1") || "null"); } catch (e) { }
  const localHas = local && Array.isArray(local.sessions) && local.sessions.length;
  try {
    if (localHas) await bqApi("/me/data", { blob: local });
    else {
      const remote = await bqApi("/me");
      if (remote && remote.blob && Array.isArray(remote.blob.sessions) && remote.blob.sessions.length) {
        localStorage.setItem("courtiq.v1", JSON.stringify(remote.blob));
        if (typeof load === "function") { S = load(); if (typeof setMode === "function") setMode(S.mode); }
      }
    }
  } catch (e) { }
}
function bqCountrySelect(selected) {
  const opts = BQ_EU.map(c => `<option value="${c}" ${c === selected ? "selected" : ""}>${esc(bqRegionName(c))}</option>`).join("");
  return `<label class="lbl" for="au-paese">${esc(t("auth.paese"))}</label><select class="field" id="au-paese" required>${opts}</select>`;
}
function bqAuthHTML(mode) {
  const lang = bqLangField("lang-auth");
  if (mode === "forgot") return `<div class="card auth-card"><h2>${esc(t("auth.forgotTitle"))}</h2>${lang}
    <label class="lbl" for="au-email">${esc(t("auth.email"))}</label><input class="field" id="au-email" type="email" autocomplete="email" required>
    <button type="button" class="btn pri block" id="au-send" style="margin-top:12px">${esc(t("auth.sendReset"))}</button>
    <button type="button" class="btn ghost block" id="au-back">${esc(t("auth.loginTitle"))}</button>
    <p class="small mut" id="au-msg"></p></div>`;
  if (mode === "reset") return `<div class="card auth-card"><h2>${esc(t("auth.resetTitle"))}</h2>
    <label class="lbl" for="au-pw">${esc(t("auth.password"))}</label><input class="field" id="au-pw" type="password" autocomplete="new-password" required minlength="8">
    <label class="lbl" for="au-pw2">${esc(t("auth.password2"))}</label><input class="field" id="au-pw2" type="password" autocomplete="new-password" required minlength="8">
    <button type="button" class="btn pri block" id="au-reset" style="margin-top:12px">${esc(t("auth.resetTitle"))}</button>
    <p class="small mut" id="au-msg"></p></div>`;
  const reg = mode === "register";
  return `<div class="card auth-card"><h2>${esc(t(reg ? "auth.registerTitle" : "auth.loginTitle"))}</h2>${lang}
    ${reg ? `<p class="small" id="au-invite" hidden></p>` : ""}
    ${reg ? `<label class="lbl" for="au-nome">${esc(t("auth.nome"))}</label><input class="field" id="au-nome" autocomplete="given-name" required maxlength="80">
      <label class="lbl" for="au-cognome">${esc(t("auth.cognome"))}</label><input class="field" id="au-cognome" autocomplete="family-name" required maxlength="80">
      <label class="lbl" for="au-tel">${esc(t("auth.telefono"))}</label><input class="field" id="au-tel" type="tel" autocomplete="tel" required maxlength="40">` : ""}
    <label class="lbl" for="au-email">${esc(t("auth.email"))}</label><input class="field" id="au-email" type="email" autocomplete="email" required>
    ${reg ? `<label class="lbl" for="au-nascita">${esc(t("auth.nascita"))}</label><input class="field" id="au-nascita" type="date" required>
      ${bqCountrySelect("IT")}
      <label class="lbl" for="au-citta">${esc(t("auth.citta"))}</label><input class="field" id="au-citta" autocomplete="address-level2" required maxlength="80">` : ""}
    <label class="lbl" for="au-pw">${esc(t("auth.password"))}</label><input class="field" id="au-pw" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required minlength="8">
    ${reg ? `<label class="lbl" for="au-pw2">${esc(t("auth.password2"))}</label><input class="field" id="au-pw2" type="password" autocomplete="new-password" required minlength="8">` : ""}
    <button type="button" class="btn pri block" id="au-go" style="margin-top:12px">${esc(t(reg ? "auth.submitRegister" : "auth.submitLogin"))}</button>
    <button type="button" class="btn ghost block" id="au-alt">${esc(t(reg ? "auth.have" : "auth.need"))}</button>
    ${reg ? "" : `<button type="button" class="btn ghost block" id="au-forgot">${esc(t("auth.forgot"))}</button>`}
    <button type="button" class="btn ghost block" id="au-home">${esc(t("pricing.back"))}</button>
    <p class="small mut" id="au-msg"></p></div>`;
}
function bqShowAuth(mode) {
  document.body.dataset.auth = mode || "login";
  const splash = document.getElementById("splash");
  if (splash) splash.hidden = true;
  let host = document.getElementById("auth-screen");
  if (!host) {
    host = document.createElement("div");
    host.id = "auth-screen";
    host.className = "auth-screen";
    document.body.appendChild(host);
  }
  host.hidden = false;
  bqRenderAuth(mode || "login");
}
function bqHideAuth() {
  delete document.body.dataset.auth;
  const host = document.getElementById("auth-screen");
  if (host) host.hidden = true;
}
function bqMsg(text, extra) {
  const el = document.getElementById("au-msg");
  if (!el) return;
  el.innerHTML = esc(text) + (extra || "");
}
function bqRenderAuth(mode) {
  const host = document.getElementById("auth-screen");
  if (!host) return;
  host.innerHTML = `<div class="auth-wrap">${bqAuthHTML(mode)}</div>`;
  bqBindLang(host);
  const home = document.getElementById("au-home"); if (home) home.onclick = () => { bqHideAuth(); bqShowSplash(); };
  const alt = document.getElementById("au-alt"); if (alt) alt.onclick = () => bqShowAuth(mode === "register" ? "login" : "register");
  const forgot = document.getElementById("au-forgot"); if (forgot) forgot.onclick = () => bqShowAuth("forgot");
  const back = document.getElementById("au-back"); if (back) back.onclick = () => bqShowAuth("login");
  const go = document.getElementById("au-go");
  if (go) go.onclick = () => mode === "register" ? bqDoRegister() : bqDoLogin();
  if (mode === "register") bqFillInvite();
  const send = document.getElementById("au-send"); if (send) send.onclick = () => bqDoForgot();
  const reset = document.getElementById("au-reset"); if (reset) reset.onclick = () => bqDoReset();
}
function bqInviteCode() {
  try { return (sessionStorage.getItem("biokinetiq.invito") || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40); }
  catch (e) { return ""; }
}
function bqFillInvite() {
  const code = bqInviteCode();
  const el = document.getElementById("au-invite");
  if (!code || !el) return;
  bqApi("/invites/" + code).then(info => {
    const node = document.getElementById("au-invite");
    if (!node) return;
    const price = typeof bqEuro === "function" ? bqEuro(info.priceCents) : "";
    node.hidden = false;
    node.textContent = t("invite.banner").replace("{coach}", info.coach || "").replace("{days}", String(info.trialDays || 30)).replace("{price}", price);
  }).catch(() => {
    const node = document.getElementById("au-invite");
    if (node) { node.hidden = false; node.textContent = t("invite.invalid"); }
  });
}
function bqInviteNote(info) {
  if (!info) return "";
  if (info.error === "taken") return t("invite.taken");
  if (info.error) return t("invite.invalid");
  const price = typeof bqEuro === "function" ? bqEuro(info.priceCents) : "";
  return t("invite.linked").replace("{coach}", info.coach || "").replace("{days}", String(info.trialDays || 30)).replace("{price}", price);
}
function bqValEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()); }
async function bqDoRegister() {
  const nome = $("#au-nome").value.trim(), cognome = $("#au-cognome").value.trim(), telefono = $("#au-tel").value.trim();
  const email = $("#au-email").value.trim(), nascita = $("#au-nascita").value, paese = $("#au-paese").value, citta = $("#au-citta").value.trim();
  const password = $("#au-pw").value, password2 = $("#au-pw2").value;
  if (!nome || !cognome || !telefono || !email || !nascita || !paese || !citta || !password) return bqMsg(t("auth.required"));
  if (!bqValEmail(email)) return bqMsg(t("auth.badEmail"));
  if (password.length < 8) return bqMsg(t("auth.shortPw"));
  if (password !== password2) return bqMsg(t("auth.mismatch"));
  try {
    const data = await bqApi("/register", { nome, cognome, telefono, email, nascita, paese, citta, password, invito: bqInviteCode() });
    let extra = "";
    if (data.devLink) extra = `<br><a class="btn sm" id="au-dev" href="${esc(data.devLink)}">${esc(t("auth.openVerify"))}</a>`;
    const note = data.invite ? " " + bqInviteNote(data.invite) : "";
    if (data.invite && data.invite.coach) { try { sessionStorage.removeItem("biokinetiq.invito"); } catch (e) { } }
    bqMsg((data.emailSent ? t("auth.pending") : t("auth.pending") + " " + t("auth.unconfigured")) + note, extra);
  } catch (e) { bqMsg(e.data && e.data.error === "email" ? t("auth.badEmail") : (e.data && e.data.message) || t("auth.required")); }
}
async function bqDoLogin() {
  const email = $("#au-email").value.trim(), password = $("#au-pw").value;
  if (!email || !password) return bqMsg(t("auth.required"));
  try {
    const data = await bqApi("/login", { email, password, invito: bqInviteCode() });
    bqSetSession(data.token, data.user);
    bqGateOpen();
    await bqSyncLocal();
    if (typeof bqLoadBilling === "function") await bqLoadBilling();
    if (data.invite && data.invite.coach) { try { sessionStorage.removeItem("biokinetiq.invito"); } catch (e) { } }
    if (typeof coachOnSession === "function") coachOnSession();
    else if (typeof setMode === "function" && typeof S !== "undefined") setMode(S.mode);
    const linked = data.invite && data.invite.coach ? " " + bqInviteNote(data.invite) : "";
    if (typeof toast === "function") toast(t("auth.hello") + " " + (data.user.nome || "") + linked);
  } catch (e) { bqMsg(t("auth.badLogin")); }
}
async function bqDoForgot() {
  const email = $("#au-email").value.trim();
  if (!bqValEmail(email)) return bqMsg(t("auth.badEmail"));
  try {
    const data = await bqApi("/forgot", { email });
    let extra = "";
    if (data.devLink) extra = `<br><a href="${esc(data.devLink)}">${esc(t("auth.openVerify"))}</a>`;
    bqMsg(t("auth.resetSent") + (data.emailSent ? "" : " " + t("auth.unconfigured")), extra);
  } catch (e) { bqMsg(t("auth.resetSent")); }
}
async function bqDoReset() {
  const password = $("#au-pw").value, password2 = $("#au-pw2").value;
  if (password.length < 8) return bqMsg(t("auth.shortPw"));
  if (password !== password2) return bqMsg(t("auth.mismatch"));
  const token = new URLSearchParams(location.search).get("reset") || "";
  try {
    await bqApi("/reset", { token, password });
    bqMsg(t("auth.resetOk"));
    setTimeout(() => bqShowAuth("login"), 600);
  } catch (e) { bqMsg(t("auth.badLogin")); }
}
async function bqLogout() {
  try { await bqApi("/logout", {}); } catch (e) { }
  bqSetSession("", null);
  bqGateLock();
}
function bqAccountSheet() {
  const u = bqUser();
  if (!u) { bqShowAuth("login"); return; }
  if (typeof openSheet !== "function") return;
  openSheet(`<h2>${esc(t("auth.account"))}</h2><p><b>${esc(t("auth.hello"))} ${esc(u.nome)} ${esc(u.cognome)}</b></p>
    <p class="small mut">${esc(u.email)} · ${esc(u.citta || "")} · ${esc(bqRegionName(u.paese || ""))}</p>
    <p class="small">${esc(t("auth.telefono"))}: ${esc(u.telefono || "")}</p>
    <button type="button" class="btn danger block" id="au-out">${esc(t("auth.logout"))}</button>`, r => {
    $("#au-out", r).onclick = () => { closeSheet(); bqLogout(); };
  });
}
async function bqConsumeLinks() {
  const q = new URLSearchParams(location.search);
  if (q.get("verify")) {
    try { await bqApi("/verify", { token: q.get("verify") }); if (typeof toast === "function") toast(t("auth.verified")); bqShowAuth("login"); }
    catch (e) { if (typeof toast === "function") toast(t("auth.badLogin")); }
    history.replaceState({}, "", location.pathname);
  } else if (q.get("reset")) bqShowAuth("reset");
  else if (q.get("invito")) {
    try { sessionStorage.setItem("biokinetiq.invito", q.get("invito").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)); } catch (e) { }
    const url = new URL(location.href);
    url.searchParams.delete("invito");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
    bqShowAuth("register");
  }
}
/* Accesso obbligatorio: il contenuto dell'app si vede solo con una sessione valida e verificata (/api/me 200). */
function bqShowSplash() {
  if (document.body.classList.contains("bq-authed")) return;
  const s = document.getElementById("splash"); if (s) s.hidden = false;
}
function bqGateOpen() {
  document.body.classList.add("bq-authed");
  bqHideAuth();
  const s = document.getElementById("splash"); if (s) s.hidden = true;
  if (typeof tourMaybe === "function") tourMaybe();
}
function bqGateLock() {
  document.body.classList.remove("bq-authed");
  try { localStorage.removeItem(BQ_TOKEN); localStorage.removeItem(BQ_USER); } catch (e) { }
  bqPaintAccount();
  if (!document.body.dataset.auth) bqShowSplash();
}
async function bqCheckSession() {
  if (!bqToken()) { bqGateLock(); return false; }
  try {
    const me = await bqApi("/me");
    if (me && me.user) { try { localStorage.setItem(BQ_USER, JSON.stringify(me.user)); } catch (e) { } }
    bqGateOpen();
    return true;
  } catch (e) { bqGateLock(); return false; }
}
function bqBootAuth() {
  const login = document.getElementById("splash-login");
  const reg = document.getElementById("splash-register");
  if (login) login.onclick = () => bqShowAuth("login");
  if (reg) reg.onclick = () => bqShowAuth("register");
  const acc = document.getElementById("btn-account");
  if (acc) acc.onclick = () => bqAccountSheet();
  bqPaintAccount();
  bqConsumeLinks();
  const splashGo = document.getElementById("splash-go");
  if (splashGo) splashGo.onclick = () => bqShowAuth("login");
  if (bqToken()) bqCheckSession().then(ok => ok && bqSyncLocal()).then(async () => {
    if (!document.body.classList.contains("bq-authed")) return;
    if (typeof bqLoadBilling === "function") await bqLoadBilling();
    if (typeof coachOnSession === "function") coachOnSession();
    else if (typeof setMode === "function" && typeof S !== "undefined") setMode(S.mode);
  });
  const plans = document.getElementById("splash-plans");
  if (plans) plans.onclick = () => { if (typeof bqShowPricing === "function") bqShowPricing("athlete"); };
}
