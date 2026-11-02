/* BioKinetIQ - lingue ufficiali UE. L'italiano è la sorgente (i18n/it.json); le altre lingue sono file separati. */
"use strict";

function bqEsc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
if (typeof esc !== "function") var esc = bqEsc;

const BQ_LANGS = ["bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr", "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv"];
const BQ_LANG_KEY = "biokinetiq.lang";
const BQ_EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
let BQ_DICT = {};
let BQ_IT = {};

function bqLang() {
  try { const s = localStorage.getItem(BQ_LANG_KEY); if (BQ_LANGS.includes(s)) return s; } catch (e) { }
  return "it";
}
function t(key) {
  if (BQ_DICT && BQ_DICT[key]) return BQ_DICT[key];
  if (BQ_IT && BQ_IT[key]) return BQ_IT[key];
  return key;
}
function bqRegionName(code) {
  try { return new Intl.DisplayNames([bqLang()], { type: "region" }).of(code) || code; } catch (e) { return code; }
}
function bqLangName(code) {
  try { return new Intl.DisplayNames([bqLang()], { type: "language" }).of(code) || code; } catch (e) { return code; }
}
async function bqLoadLang(code) {
  const lang = BQ_LANGS.includes(code) ? code : "it";
  try { localStorage.setItem(BQ_LANG_KEY, lang); } catch (e) { }
  if (!BQ_IT || !BQ_IT["splash.enter"]) {
    const r = await fetch("i18n/it.json");
    BQ_IT = await r.json();
  }
  if (lang === "it") BQ_DICT = BQ_IT;
  else {
    try { const r = await fetch("i18n/" + lang + ".json"); BQ_DICT = r.ok ? await r.json() : BQ_IT; }
    catch (e) { BQ_DICT = BQ_IT; }
  }
  document.documentElement.lang = lang === "ga" ? "ga" : lang;
  bqApplyChrome();
  document.querySelectorAll("[data-lang-select]").forEach(sel => {
    const keep = lang;
    sel.innerHTML = bqLangOptions();
    sel.value = keep;
  });
  if (document.body.dataset.auth && typeof bqRenderAuth === "function") bqRenderAuth(document.body.dataset.auth);
}
function bqLangOptions() {
  const cur = bqLang();
  return BQ_LANGS.map(c => `<option value="${c}" ${c === cur ? "selected" : ""}>${esc(bqLangName(c))}</option>`).join("");
}
function bqLangField(id) {
  return `<label class="lbl" for="${id}">${esc(t("lang.label"))}</label><select class="field" id="${id}" data-lang-select>${bqLangOptions()}</select>`;
}
function bqBindLang(root) {
  (root || document).querySelectorAll("[data-lang-select]").forEach(sel => { sel.onchange = () => bqLoadLang(sel.value); });
}
function bqApplyChrome() {
  const set = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = t(key); };
  set("#splash-tagline", "splash.tagline");
  set("#splash-note", "splash.note");
  set("#splash-go", "splash.enter");
  document.querySelectorAll("label[for='lang-splash']").forEach(lab => { lab.textContent = t("lang.label"); });
  set("#splash-login", "splash.login");
  set("#splash-register", "splash.register");
  if (document.body.dataset.mode !== "coach") set("#tab-oggi-label", "nav.today");
  const tabs = { campo: "nav.field", video: "nav.video", salute: "nav.health", rete: "nav.network" };
  document.querySelectorAll(".tabs button").forEach(b => {
    const span = b.querySelector("span");
    if (tabs[b.dataset.tab] && span) span.textContent = t(tabs[b.dataset.tab]);
  });
  document.querySelectorAll(".mode button").forEach(b => {
    if (b.dataset.mode === "player") b.textContent = t("mode.player");
    if (b.dataset.mode === "coach") b.textContent = t("mode.coach");
  });
  const acc = document.getElementById("btn-account");
  if (acc) acc.textContent = t("auth.account");
}
function bqBootI18n() {
  const splashLang = document.getElementById("lang-splash");
  if (splashLang && !splashLang.dataset.ready) {
    splashLang.innerHTML = bqLangOptions();
    splashLang.dataset.ready = "1";
    bqBindLang(document);
  }
  return bqLoadLang(bqLang());
}
function bqFillEmptyLangSelects() {
  document.querySelectorAll("[data-lang-select]").forEach(sel => {
    if (sel.options && sel.options.length) return;
    sel.innerHTML = bqLangOptions();
  });
  bqBindLang(document);
}
document.addEventListener("DOMContentLoaded", bqFillEmptyLangSelects);
