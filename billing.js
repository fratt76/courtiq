/* BioKinetIQ - piani in prova. Nessun addebito reale: Stripe solo con sk_test_, altrimenti prova locale. */
"use strict";

let BQ_SUB = null;
let BQ_BILLING_READY = false;
let BQ_BILL = { stripeTest: false, localTrial: true, plans: null, share: { enabled: false } };

const BQ_PRICES = {
  athlete: { month: "7,99 €", year: "87,89 €" },
  coach: { month: "14,99 €", year: "164,89 €" }
};

function bqEuro(cents) {
  const n = Number(cents) / 100;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function bqPriceLabel(plan, interval) {
  const p = BQ_BILL.plans && BQ_BILL.plans[plan];
  if (p && p[interval] != null) return bqEuro(p[interval]);
  return BQ_PRICES[plan][interval];
}
async function bqLoadBilling() {
  try { BQ_BILL = Object.assign({ plans: null, share: { enabled: false } }, await bqApi("/billing/config")); }
  catch (e) { }
  if (!bqToken()) { BQ_SUB = null; BQ_BILLING_READY = true; return; }
  try {
    const data = await bqApi("/billing");
    BQ_SUB = data.subscription || null;
  } catch (e) { BQ_SUB = null; }
  BQ_BILLING_READY = true;
}
function bqPlanOk(need) {
  if (!bqUser()) return true;
  if (!BQ_SUB || !BQ_SUB.active) return false;
  if (need === "coach" && BQ_SUB.plan !== "coach") return false;
  return true;
}
async function bqShowPricing(reason) {
  if (!BQ_BILL.plans) { try { await bqLoadBilling(); } catch (e) { } }
  let host = document.getElementById("pricing-screen");
  if (!host) {
    host = document.createElement("div");
    host.id = "pricing-screen";
    host.className = "auth-screen";
    document.body.appendChild(host);
  }
  host.hidden = false;
  const note = BQ_BILL.stripeTest ? t("pricing.stripe") : t("pricing.local");
  const card = (plan, alt) => {
    const days = (BQ_BILL.plans && BQ_BILL.plans[plan] && BQ_BILL.plans[plan].trialDays) || 30;
    const trial = t("pricing.trialN").replace("{days}", String(days));
    const trialText = trial === "pricing.trialN" ? t("pricing.trial") : trial;
    return `<article class="card"><h3>${esc(t(plan === "athlete" ? "pricing.athlete" : "pricing.coach"))}</h3>
    <p class="small mut">${esc(t(alt))}</p>
    <p>${esc(trialText)}</p>
    <p><b>${esc(bqPriceLabel(plan, "month"))}</b> ${esc(t("pricing.perMonth"))}<br><b>${esc(bqPriceLabel(plan, "year"))}</b> ${esc(t("pricing.perYear"))}</p>
    <button type="button" class="btn pri block" data-plan="${plan}" data-interval="month">${esc(t("pricing.monthBtn"))}</button>
    <button type="button" class="btn block" data-plan="${plan}" data-interval="year">${esc(t("pricing.yearBtn"))}</button></article>`;
  };
  host.innerHTML = `<div class="auth-wrap"><div class="card"><h2>${esc(t("pricing.title"))}</h2>
    <p class="small">${esc(t(reason === "coach" ? "pricing.needCoach" : "pricing.needPlan"))}</p>
    <p class="small mut">${esc(note)}</p></div>
    ${card("athlete", "pricing.altAthlete")}${card("coach", "pricing.altCoach")}
    <button type="button" class="btn ghost block" id="pr-close">${esc(t("pricing.back"))}</button></div>`;
  host.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => bqStartPlan(b.dataset.plan, b.dataset.interval));
  document.getElementById("pr-close").onclick = () => { host.hidden = true; };
}
async function bqStartPlan(plan, interval) {
  if (!bqUser()) { bqShowAuth("register"); return; }
  try {
    const data = await bqApi("/billing/start", { plan, interval });
    if (data.url) { location.href = data.url; return; }
    BQ_SUB = data.subscription;
    const host = document.getElementById("pricing-screen");
    if (host) host.hidden = true;
    if (typeof toast === "function") toast(t("pricing.started"));
  } catch (e) {
    if (typeof toast === "function") toast((e.data && e.data.message) || t("pricing.needPlan"));
  }
}
function bqGate(need) {
  if (bqPlanOk(need || "athlete")) return true;
  bqShowPricing(need || "athlete");
  return false;
}
