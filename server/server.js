/* BioKinetIQ API. Avvio: node --experimental-sqlite server/server.js
   SMTP solo se configurato (nessun invio reale finché SMTP_HOST è vuoto). */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import QRCode from "qrcode";

const scrypt = promisify(scryptCb);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), "data");
const outbox = join(dirname(fileURLToPath(import.meta.url)), "outbox");
mkdirSync(dataDir, { recursive: true });

function loadEnvFile() {
  const p = join(dirname(fileURLToPath(import.meta.url)), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[k] == null) process.env[k] = v;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL || "http://127.0.0.1:" + PORT).replace(/\/$/, "");
const db = new DatabaseSync(join(dataDir, "biokinetiq.sqlite"));
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL, cognome TEXT NOT NULL, telefono TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, nascita TEXT NOT NULL, paese TEXT NOT NULL, citta TEXT NOT NULL,
  pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT, verify_exp INTEGER,
  reset_token TEXT, reset_exp INTEGER,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, exp INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY, blob TEXT NOT NULL, updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL,
  interval TEXT NOT NULL, status TEXT NOT NULL, trial_ends INTEGER,
  stripe_session TEXT, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY, coach_id TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coach_links (
  athlete_id TEXT PRIMARY KEY, coach_id TEXT NOT NULL, invite_code TEXT, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS athlete_status (
  athlete_id TEXT PRIMARY KEY, sport TEXT, light TEXT NOT NULL, label TEXT NOT NULL,
  detail TEXT, load_zone TEXT, ratio REAL, pains_json TEXT, updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS drill_assignments (
  id TEXT PRIMARY KEY, coach_id TEXT NOT NULL, athlete_id TEXT NOT NULL,
  drills_json TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_ledger (
  id TEXT PRIMARY KEY, coach_id TEXT NOT NULL, athlete_id TEXT NOT NULL,
  period TEXT NOT NULL, cents INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL,
  UNIQUE (coach_id, athlete_id, period)
);`);
function addCol(table, col, def) {
  const cols = db.prepare("PRAGMA table_info(" + table + ")").all();
  if (!cols.some(c => c.name === col)) db.exec("ALTER TABLE " + table + " ADD COLUMN " + col + " " + def);
}
addCol("subscriptions", "price_cents", "INTEGER");
addCol("subscriptions", "source", "TEXT");

const EU = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const now = () => Date.now();
const id = () => randomBytes(12).toString("hex");
const token = () => randomBytes(24).toString("hex");

async function hashPw(password, salt = randomBytes(16).toString("hex")) {
  const buf = await scrypt(password, salt, 32);
  return { salt, hash: Buffer.from(buf).toString("hex") };
}
async function checkPw(password, salt, hash) {
  const buf = Buffer.from(await scrypt(password, salt, 32));
  const got = Buffer.from(hash, "hex");
  return got.length === buf.length && timingSafeEqual(got, buf);
}
function userPublic(row) {
  if (!row) return null;
  return { id: row.id, nome: row.nome, cognome: row.cognome, telefono: row.telefono, email: row.email, nascita: row.nascita, paese: row.paese, citta: row.citta, verified: !!row.verified };
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}
function smtpOn() { return !!(process.env.SMTP_HOST && process.env.SMTP_FROM); }
function devLinks() {
  if (process.env.ALLOW_DEV_LINKS === "1") return true;
  if (process.env.ALLOW_DEV_LINKS === "0") return false;
  return !smtpOn() && process.env.NODE_ENV !== "production";
}
function htmlEscape(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function mailHeaders(tag) {
  return {
    "X-Mailin-Tag": tag,
    "X-Mailin-Track": "0",
    "X-Mailin-Track-Clicks": "0",
    "X-Mailin-Track-Opens": "0"
  };
}
function accountMail({ nome, link, kind }) {
  const reset = kind === "reset";
  const subject = reset ? "Reimposta la password BioKinetIQ" : "Conferma il tuo account BioKinetIQ";
  const button = reset ? "Reimposta password" : "Conferma account";
  const valid = reset ? "Il link è valido per 1 ora." : "Il link è valido per 24 ore.";
  const ignore = reset
    ? "Se non hai chiesto tu di reimpostare la password, ignora questo messaggio."
    : "Se non hai creato tu questo account, ignora questo messaggio.";
  const intro = reset
    ? "Hai chiesto di scegliere una nuova password per BioKinetIQ."
    : "Manca solo un passo per attivare il tuo account BioKinetIQ.";
  const safeName = htmlEscape(nome || "");
  const safeLink = htmlEscape(link);
  const text = [
    "Ciao " + (nome || "") + ",",
    "",
    intro,
    "",
    button + ": " + link,
    "",
    valid,
    "",
    "Se il pulsante non si apre, copia questo indirizzo nel browser:",
    link,
    "",
    ignore,
    "",
    "BioKinetIQ · Longevità Atletica & Biomeccanica"
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#0b1220;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;margin:0;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#121f2c;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="background:#0a0b0d;padding:28px 24px 22px;">
<img src="https://biokinetiq.eu/icons/biokinetiq-logo-600.png" alt="BioKinetIQ" width="280" style="display:block;width:280px;max-width:80%;height:auto;border:0;">
</td></tr>
<tr><td style="height:6px;line-height:6px;font-size:0;background:#A6F03C;background-image:linear-gradient(90deg,#A6F03C,#1EC8E6);">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#eef3ff;font-size:16px;line-height:1.5;">
<p style="margin:0 0 12px;">Ciao ${safeName},</p>
<p style="margin:0 0 22px;color:#c5d2e4;">${htmlEscape(intro)}</p>
<p style="margin:0 0 22px;text-align:center;">
<a href="${safeLink}" style="display:inline-block;background:#A6F03C;color:#0b1220;font-weight:800;text-decoration:none;padding:16px 32px;border-radius:999px;font-size:18px;line-height:1.2;">${button}</a>
</p>
<p style="margin:0 0 16px;">${htmlEscape(valid)}</p>
<p style="margin:0 0 16px;color:#c5d2e4;">Se il pulsante non si apre, copia questo indirizzo nel browser:<br>
<a href="${safeLink}" style="color:#1EC8E6;word-break:break-all;">${safeLink}</a></p>
<p style="margin:0 0 8px;color:#96a8bf;">${htmlEscape(ignore)}</p>
</td></tr>
<tr><td style="padding:16px 28px 22px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#96a8bf;font-size:13px;line-height:1.45;border-top:1px solid #27394d;">
BioKinetIQ · Longevità Atletica &amp; Biomeccanica<br>Messaggio automatico, non rispondere a questa email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html, tag: reset ? "reimposta-password" : "conferma-account" };
}
async function sendMail({ to, subject, text, html, tag }) {
  const headers = mailHeaders(tag || "biokinetiq");
  const from = { name: "BioKinetIQ", address: process.env.SMTP_FROM || "noreply@biokinetiq.eu" };
  mkdirSync(outbox, { recursive: true });
  const headerLines = Object.entries(headers).map(([k, v]) => k + ": " + v).join("\n");
  writeFileSync(join(outbox, Date.now() + "-" + String(to).replace(/[^\w.@-]+/g, "_") + ".txt"),
    `From: BioKinetIQ <${from.address}>\nTo: ${to}\nSubject: ${subject}\n${headerLines}\n\n${text}\n\n--- html ---\n${html || ""}\n`);
  if (!smtpOn()) return { sent: false };
  const nm = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const tx = nm.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined
  });
  await tx.sendMail({ from, to, subject, text, html, headers });
  return { sent: true };
}
function authUser(req) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(tok);
  if (!s || s.exp < now()) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(s.user_id);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webp": "image/webp" };
function envInt(name, fallback, min, max) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
/* 799 = 7,99 €, prezzo Athlete deciso. */
const PLANS = {
  athlete: { name: "BioKinetIQ Athlete", month: envInt("ATHLETE_MONTH_CENTS", 799, 50, 100000), year: envInt("ATHLETE_YEAR_CENTS", 8789, 50, 200000), trialDays: envInt("ATHLETE_TRIAL_DAYS", 30, 1, 365) },
  coach: { name: "BioKinetIQ Coach", month: envInt("COACH_MONTH_CENTS", 1499, 50, 100000), year: envInt("COACH_YEAR_CENTS", 16489, 50, 200000), trialDays: envInt("COACH_TRIAL_DAYS", 30, 1, 365) }
};
function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return { mode: "local" };
  if (key.startsWith("sk_live_")) return { mode: "reject" };
  if (!key.startsWith("sk_test_")) return { mode: "reject" };
  return { mode: "test", key };
}
function priceId(plan, interval) {
  const map = {
    "athlete:month": process.env.STRIPE_PRICE_ATHLETE_MONTH,
    "athlete:year": process.env.STRIPE_PRICE_ATHLETE_YEAR,
    "coach:month": process.env.STRIPE_PRICE_COACH_MONTH,
    "coach:year": process.env.STRIPE_PRICE_COACH_YEAR
  };
  return map[plan + ":" + interval] || "";
}
function subPublic(row) {
  if (!row) return null;
  const trial = row.status === "trialing" && row.trial_ends > now();
  const active = row.status === "active" || trial;
  const price = row.price_cents || (PLANS[row.plan] && PLANS[row.plan][row.interval]) || null;
  return {
    plan: row.plan, interval: row.interval, status: trial ? "trialing" : row.status,
    trialEnds: row.trial_ends, active, priceCents: price, source: row.source || "",
    name: (PLANS[row.plan] || {}).name || row.plan
  };
}
function shareConfig() {
  return { enabled: process.env.REVENUE_SHARE === "1", cents: envInt("REVENUE_SHARE_CENTS", 150, 0, 100000), method: "ledger" };
}
function testTools() {
  if (stripeKey().mode === "reject") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LINKS !== "1") return false;
  return true;
}
function periodKey(ts = now()) {
  const d = new Date(ts);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
function trafficFrom(pains, loadZone, persistent) {
  const list = Array.isArray(pains) ? pains : [];
  const severe = list.some(p => Number(p.sev) >= 7 || p.type === "Fitta");
  const mild = list.some(p => Number(p.sev) >= 1 && Number(p.sev) < 7 && p.type !== "Fitta");
  const bits = [];
  if (loadZone === "red") bits.push("carico sopra la soglia");
  if (persistent) bits.push("fastidio che torna");
  if (severe) bits.push("fastidio forte o a fitta");
  if (loadZone === "red" || persistent || severe) {
    return { light: "red", label: "Rosso · sovraccarico da verificare prima della lezione", detail: bits.join(" · ") };
  }
  if (mild) {
    return { light: "yellow", label: "Giallo · fastidio lieve registrato", detail: "fastidio lieve in Salute" };
  }
  if (loadZone === "yellow") {
    return { light: "yellow", label: "Giallo · carico in aumento", detail: "carico in aumento, senza fastidio segnato" };
  }
  return { light: "green", label: "Verde · nessun fastidio", detail: "" };
}
function coachName(row) {
  if (!row) return "";
  return (row.nome + " " + row.cognome).trim();
}
function requireCoach(me) {
  if (!me) return { code: 401, error: "auth" };
  const pub = subPublic(currentSub(me.id));
  if (!pub || !pub.active || pub.plan !== "coach") return { code: 402, error: "coach_plan", message: "Serve il piano Coach in prova o attivo." };
  return null;
}
function ensureAthleteTrial(userId, source) {
  const cur = currentSub(userId);
  if (cur) return subPublic(cur);
  const trialEnds = now() + PLANS.athlete.trialDays * 86400000;
  const sid = id();
  db.prepare("INSERT INTO subscriptions (id,user_id,plan,interval,status,trial_ends,stripe_session,created,price_cents,source) VALUES (?,?,?,?,?,?,NULL,?,?,?)")
    .run(sid, userId, "athlete", "month", "trialing", trialEnds, now(), PLANS.athlete.month, source || "invite");
  return subPublic(currentSub(userId));
}
function attachInvite(userId, inviteRow) {
  if (!inviteRow) return { error: "invite" };
  if (inviteRow.coach_id === userId) return { error: "self", message: "Non puoi usare il tuo invito." };
  const existing = db.prepare("SELECT * FROM coach_links WHERE athlete_id = ?").get(userId);
  if (existing && existing.coach_id !== inviteRow.coach_id) return { error: "taken", message: "Sei già collegato a un altro coach." };
  if (!existing) {
    db.prepare("INSERT INTO coach_links (athlete_id, coach_id, invite_code, created) VALUES (?,?,?,?)")
      .run(userId, inviteRow.coach_id, inviteRow.code, now());
  }
  const trial = ensureAthleteTrial(userId, "invite");
  const coach = db.prepare("SELECT nome, cognome FROM users WHERE id = ?").get(inviteRow.coach_id);
  return { coach: coachName(coach), trialDays: PLANS.athlete.trialDays, priceCents: PLANS.athlete.month, trial };
}
function invitePublic(code) {
  const row = db.prepare("SELECT * FROM invites WHERE code = ?").get(code);
  if (!row) return null;
  const coach = db.prepare("SELECT nome, cognome FROM users WHERE id = ?").get(row.coach_id);
  return { code: row.code, coach: coachName(coach), trialDays: PLANS.athlete.trialDays, priceCents: PLANS.athlete.month };
}
function athletePaying(userId) {
  const sub = currentSub(userId);
  return !!(sub && sub.plan === "athlete" && sub.status === "active");
}
function syncShare(coachId) {
  const cfg = shareConfig();
  if (!cfg.enabled) return { enabled: false, method: "ledger" };
  const period = periodKey();
  const links = db.prepare("SELECT athlete_id FROM coach_links WHERE coach_id = ?").all(coachId);
  for (const link of links) {
    if (!athletePaying(link.athlete_id)) continue;
    db.prepare("INSERT INTO share_ledger (id,coach_id,athlete_id,period,cents,status,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(coach_id, athlete_id, period) DO NOTHING")
      .run(id(), coachId, link.athlete_id, period, cfg.cents, "accrued", now());
  }
  const rows = db.prepare("SELECT * FROM share_ledger WHERE coach_id = ? AND period = ?").all(coachId, period);
  const earnings = rows.reduce((s, r) => s + r.cents, 0);
  const coachMonth = PLANS.coach.month;
  const gap = Math.max(0, coachMonth - earnings);
  const need = cfg.cents > 0 ? Math.ceil(gap / cfg.cents) : 0;
  return {
    enabled: true, method: "ledger", period, centsEach: cfg.cents,
    activePaying: rows.length, earningsCents: earnings, coachMonthCents: coachMonth,
    covered: earnings >= coachMonth, gapCents: gap, athletesToCover: need,
    note: "Registro manuale: le quote restano segnate qui. Non parte alcun trasferimento Stripe Connect e non esce denaro."
  };
}
function rosterFor(coachId) {
  const links = db.prepare("SELECT * FROM coach_links WHERE coach_id = ? ORDER BY created DESC").all(coachId);
  const athletes = links.map(link => {
    const u = db.prepare("SELECT nome, cognome FROM users WHERE id = ?").get(link.athlete_id);
    const st = db.prepare("SELECT * FROM athlete_status WHERE athlete_id = ?").get(link.athlete_id);
    const sub = subPublic(currentSub(link.athlete_id));
    let pains = [];
    try { pains = st && st.pains_json ? JSON.parse(st.pains_json) : []; } catch (e) { pains = []; }
    const assigns = db.prepare("SELECT id, drills_json, created FROM drill_assignments WHERE athlete_id = ? AND coach_id = ? ORDER BY created DESC LIMIT 3").all(link.athlete_id, coachId);
    return {
      id: link.athlete_id,
      name: coachName(u),
      sport: (st && st.sport) || "",
      light: (st && st.light) || "wait",
      label: (st && st.label) || "In attesa dei dati di Salute",
      detail: (st && st.detail) || "",
      loadZone: (st && st.load_zone) || "",
      ratio: st ? st.ratio : null,
      pains,
      updated: st ? st.updated : null,
      paying: athletePaying(link.athlete_id),
      subscription: sub,
      assignments: assigns.map(a => ({ id: a.id, created: a.created, drills: JSON.parse(a.drills_json) }))
    };
  });
  return athletes;
}
function markAthletePaying(userId) {
  if (!testTools()) return null;
  let sub = currentSub(userId);
  if (sub && sub.plan !== "athlete") return subPublic(sub);
  if (!sub) {
    ensureAthleteTrial(userId, "test");
    sub = currentSub(userId);
  }
  db.prepare("UPDATE subscriptions SET status = 'active', price_cents = ?, trial_ends = ? WHERE id = ?")
    .run(PLANS.athlete.month, now() - 1000, sub.id);
  return subPublic(currentSub(userId));
}
async function inviteSvg(url) {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 220, color: { dark: "#0b1220", light: "#ffffff" } });
}
function currentSub(userId) {
  return db.prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created DESC LIMIT 1").get(userId);
}
async function handleBilling(req, res, path, body, me) {
  if (req.method === "GET" && path === "/api/billing/config") {
    const s = stripeKey();
    const share = shareConfig();
    return send(res, 200, { stripeTest: s.mode === "test", localTrial: s.mode !== "test", plans: PLANS, share, testTools: testTools() });
  }
  if (!me) return send(res, 401, { error: "auth" });
  if (req.method === "GET" && path === "/api/billing") return send(res, 200, { subscription: subPublic(currentSub(me.id)) });
  if (req.method === "POST" && path === "/api/billing/start") {
    const plan = body.plan === "coach" ? "coach" : body.plan === "athlete" ? "athlete" : "";
    const interval = body.interval === "year" ? "year" : body.interval === "month" ? "month" : "";
    if (!plan || !interval) return send(res, 400, { error: "plan" });
    const s = stripeKey();
    if (s.mode === "reject") return send(res, 400, { error: "live_key", message: "Solo chiavi Stripe di test (sk_test_)." });
    if (s.mode === "test") {
      const price = priceId(plan, interval);
      if (!price) return send(res, 400, { error: "price", message: "Manca STRIPE_PRICE_* per questo piano. Nessun prezzo live viene creato." });
      const params = new URLSearchParams();
      params.set("mode", "subscription");
      params.set("success_url", PUBLIC_URL + "/?billing=ok&session_id={CHECKOUT_SESSION_ID}");
      params.set("cancel_url", PUBLIC_URL + "/?billing=cancel");
      params.set("client_reference_id", me.id);
      params.set("customer_email", me.email);
      params.set("line_items[0][price]", price);
      params.set("line_items[0][quantity]", "1");
      params.set("subscription_data[trial_period_days]", String(PLANS[plan].trialDays));
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: "Bearer " + s.key, "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      const j = await r.json();
      if (!r.ok) return send(res, 502, { error: "stripe", message: "Checkout di test non creato" });
      return send(res, 200, { url: j.url, test: true });
    }
    const row = { id: id(), user_id: me.id, plan, interval, status: "trialing", trial_ends: now() + PLANS[plan].trialDays * 86400000, created: now(), price_cents: PLANS[plan][interval] };
    db.prepare("INSERT INTO subscriptions (id,user_id,plan,interval,status,trial_ends,stripe_session,created,price_cents,source) VALUES (?,?,?,?,?,?,NULL,?,?,?)")
      .run(row.id, row.user_id, row.plan, row.interval, row.status, row.trial_ends, row.created, row.price_cents, "local");
    return send(res, 200, { subscription: subPublic(row), local: true, charged: false });
  }
  if (req.method === "POST" && path === "/api/billing/confirm") {
    const s = stripeKey();
    if (s.mode !== "test") return send(res, 400, { error: "stripe" });
    const sid = String(body.sessionId || "");
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sid), { headers: { Authorization: "Bearer " + s.key } });
    const j = await r.json();
    if (!r.ok || j.client_reference_id !== me.id) return send(res, 400, { error: "session" });
    const plan = body.plan === "coach" ? "coach" : "athlete";
    const interval = body.interval === "year" ? "year" : "month";
    const row = { id: id(), trial_ends: now() + PLANS[plan].trialDays * 86400000 };
    db.prepare("INSERT INTO subscriptions (id,user_id,plan,interval,status,trial_ends,stripe_session,created,price_cents,source) VALUES (?,?,?,?, 'trialing', ?, ?, ?, ?, ?)")
      .run(row.id, me.id, plan, interval, row.trial_ends, sid, now(), PLANS[plan][interval], "stripe_test");
    return send(res, 200, { subscription: subPublic(currentSub(me.id)), charged: false });
  }
  if (req.method === "POST" && path === "/api/billing/test-pay") {
    if (!me) return send(res, 401, { error: "auth" });
    if (!testTools()) return send(res, 403, { error: "test" });
    const sub = markAthletePaying(me.id);
    return send(res, 200, { subscription: sub, charged: false, test: true });
  }
  return send(res, 404, { error: "notfound" });
}

async function handleCoach(req, res, path, body, me) {
  if (req.method === "GET" && path === "/api/me/coach") {
    if (!me) return send(res, 401, { error: "auth" });
    const link = db.prepare("SELECT * FROM coach_links WHERE athlete_id = ?").get(me.id);
    if (!link) return send(res, 200, { coach: null });
    const coach = db.prepare("SELECT nome, cognome FROM users WHERE id = ?").get(link.coach_id);
    return send(res, 200, { coach: coachName(coach), coachId: link.coach_id });
  }
  if (req.method === "GET" && path === "/api/me/drills") {
    if (!me) return send(res, 401, { error: "auth" });
    const rows = db.prepare("SELECT a.id, a.drills_json, a.created, a.coach_id, u.nome, u.cognome FROM drill_assignments a JOIN users u ON u.id = a.coach_id WHERE a.athlete_id = ? ORDER BY a.created DESC LIMIT 8").all(me.id);
    return send(res, 200, { assignments: rows.map(r => ({ id: r.id, created: r.created, coach: coachName(r), drills: JSON.parse(r.drills_json) })) });
  }
  if (req.method === "POST" && path === "/api/coach/status") {
    if (!me) return send(res, 401, { error: "auth" });
    const painsIn = Array.isArray(body.pains) ? body.pains.slice(0, 16) : [];
    const pains = painsIn.map(p => ({
      zone: String(p.zone || "").slice(0, 40),
      label: String(p.label || "").slice(0, 80),
      sev: Math.max(0, Math.min(10, Number(p.sev) || 0)),
      type: String(p.type || "").slice(0, 40)
    })).filter(p => p.zone);
    const loadZone = ["red", "yellow", "green", "low", "none"].includes(body.loadZone) ? body.loadZone : "none";
    const persistent = body.persistent === true;
    const light = trafficFrom(pains, loadZone, persistent);
    const sport = String(body.sport || "").slice(0, 24);
    const ratio = Number.isFinite(Number(body.ratio)) ? Number(body.ratio) : null;
    db.prepare(`INSERT INTO athlete_status (athlete_id,sport,light,label,detail,load_zone,ratio,pains_json,updated)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(athlete_id) DO UPDATE SET sport=excluded.sport, light=excluded.light, label=excluded.label, detail=excluded.detail, load_zone=excluded.load_zone, ratio=excluded.ratio, pains_json=excluded.pains_json, updated=excluded.updated`)
      .run(me.id, sport, light.light, light.label, light.detail, loadZone, ratio, JSON.stringify(pains), now());
    return send(res, 200, light);
  }
  const denied = requireCoach(me);
  if (denied) return send(res, denied.code, { error: denied.error, message: denied.message || "" });
  if (req.method === "GET" && path === "/api/coach/home") {
    return send(res, 200, {
      athletes: rosterFor(me.id),
      share: syncShare(me.id),
      trialDays: PLANS.athlete.trialDays,
      athleteMonthCents: PLANS.athlete.month,
      coachMonthCents: PLANS.coach.month,
      testTools: testTools()
    });
  }
  if (req.method === "POST" && path === "/api/coach/invite") {
    let code = "";
    if (!body.rotate) {
      const latest = db.prepare("SELECT code FROM invites WHERE coach_id = ? ORDER BY created DESC LIMIT 1").get(me.id);
      if (latest) code = latest.code;
    }
    if (!code) {
      code = randomBytes(9).toString("hex");
      db.prepare("INSERT INTO invites (code, coach_id, created) VALUES (?,?,?)").run(code, me.id, now());
    }
    const url = PUBLIC_URL + "/?invito=" + code;
    const svg = await inviteSvg(url);
    return send(res, 200, { code, url, svg, trialDays: PLANS.athlete.trialDays, priceCents: PLANS.athlete.month });
  }
  if (req.method === "POST" && path === "/api/coach/assign") {
    const athleteId = String(body.athleteId || "");
    const link = db.prepare("SELECT * FROM coach_links WHERE athlete_id = ? AND coach_id = ?").get(athleteId, me.id);
    if (!link) return send(res, 404, { error: "link" });
    const raw = Array.isArray(body.drills) ? body.drills : [];
    const drills = raw.map(d => ({
      id: String(d.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 20),
      title: String(d.title || "").slice(0, 120),
      sport: String(d.sport || "").slice(0, 24)
    })).filter(d => d.id && d.title);
    if (drills.length < 2 || drills.length > 3) return send(res, 400, { error: "drills", message: "Servono 2 o 3 drill." });
    const aid = id();
    db.prepare("INSERT INTO drill_assignments (id,coach_id,athlete_id,drills_json,created) VALUES (?,?,?,?,?)")
      .run(aid, me.id, athleteId, JSON.stringify(drills), now());
    return send(res, 200, { id: aid, drills });
  }
  if (req.method === "POST" && path === "/api/coach/test-pay") {
    if (!testTools()) return send(res, 403, { error: "test" });
    const athleteId = String(body.athleteId || "");
    const link = db.prepare("SELECT * FROM coach_links WHERE athlete_id = ? AND coach_id = ?").get(athleteId, me.id);
    if (!link) return send(res, 404, { error: "link" });
    return send(res, 200, { subscription: markAthletePaying(athleteId), charged: false, test: true });
  }
  return send(res, 404, { error: "notfound" });
}

async function handleApi(req, res, path) {
  const body = req.method === "POST" ? await readBody(req) : {};
  if (req.method === "GET" && path.startsWith("/api/invites/")) {
    const code = decodeURIComponent(path.slice("/api/invites/".length)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
    const info = invitePublic(code);
    if (!info) return send(res, 404, { error: "invite" });
    return send(res, 200, info);
  }
  if (req.method === "POST" && path === "/api/register") {
    const nome = String(body.nome || "").trim(), cognome = String(body.cognome || "").trim();
    const telefono = String(body.telefono || "").trim(), email = String(body.email || "").trim().toLowerCase();
    const nascita = String(body.nascita || ""), paese = String(body.paese || ""), citta = String(body.citta || "").trim();
    const password = String(body.password || "");
    const inviteCode = String(body.invito || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
    const inviteRow = inviteCode ? db.prepare("SELECT * FROM invites WHERE code = ?").get(inviteCode) : null;
    if (inviteCode && !inviteRow) return send(res, 400, { error: "invite", message: "Invito non valido" });
    if (!nome || !cognome || !telefono || !email || !nascita || !paese || !citta || !password) return send(res, 400, { error: "required" });
    if (!emailOk(email)) return send(res, 400, { error: "email" });
    if (password.length < 8) return send(res, 400, { error: "password" });
    if (!EU.has(paese)) return send(res, 400, { error: "country" });
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return send(res, 409, { error: "exists", message: "Email già registrata" });
    const pw = await hashPw(password);
    const uid = id(), vt = token();
    db.prepare(`INSERT INTO users (id,nome,cognome,telefono,email,nascita,paese,citta,pass_salt,pass_hash,verified,verify_token,verify_exp,created)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?)`).run(uid, nome, cognome, telefono, email, nascita, paese, citta, pw.salt, pw.hash, vt, now() + 86400000, now());
    const link = PUBLIC_URL + "/?verify=" + vt;
    let emailSent = false;
    try {
      const mail = accountMail({ nome, link, kind: "verify" });
      const m = await sendMail({ to: email, ...mail });
      emailSent = m.sent;
    }
    catch (e) { emailSent = false; }
    const out = { ok: true, emailSent };
    if (!emailSent) out.unconfigured = true;
    if (devLinks()) out.devLink = link;
    if (inviteRow) out.invite = attachInvite(uid, inviteRow);
    return send(res, 201, out);
  }
  if (req.method === "POST" && path === "/api/verify") {
    const row = db.prepare("SELECT * FROM users WHERE verify_token = ?").get(String(body.token || ""));
    if (!row || row.verify_exp < now()) return send(res, 400, { error: "token" });
    db.prepare("UPDATE users SET verified = 1, verify_token = NULL, verify_exp = NULL WHERE id = ?").run(row.id);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && path === "/api/login") {
    const email = String(body.email || "").trim().toLowerCase();
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!row || !row.verified || !(await checkPw(String(body.password || ""), row.pass_salt, row.pass_hash))) return send(res, 401, { error: "login" });
    const tok = token();
    db.prepare("INSERT INTO sessions (token, user_id, exp) VALUES (?,?,?)").run(tok, row.id, now() + 30 * 86400000);
    const inviteCode = String(body.invito || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
    let invite = null;
    if (inviteCode) {
      const inviteRow = db.prepare("SELECT * FROM invites WHERE code = ?").get(inviteCode);
      invite = inviteRow ? attachInvite(row.id, inviteRow) : { error: "invite" };
    }
    return send(res, 200, { token: tok, user: userPublic(row), invite });
  }
  if (req.method === "POST" && path === "/api/logout") {
    const h = req.headers.authorization || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (tok) db.prepare("DELETE FROM sessions WHERE token = ?").run(tok);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && path === "/api/forgot") {
    const email = String(body.email || "").trim().toLowerCase();
    const row = emailOk(email) ? db.prepare("SELECT * FROM users WHERE email = ?").get(email) : null;
    let emailSent = false, link = "";
    if (row) {
      const rt = token();
      db.prepare("UPDATE users SET reset_token = ?, reset_exp = ? WHERE id = ?").run(rt, now() + 3600000, row.id);
      link = PUBLIC_URL + "/?reset=" + rt;
      try {
        const mail = accountMail({ nome: row.nome, link, kind: "reset" });
        const m = await sendMail({ to: email, ...mail });
        emailSent = m.sent;
      } catch (e) { emailSent = false; }
    }
    const out = { ok: true, emailSent };
    if (row && !emailSent) out.unconfigured = true;
    if (row && devLinks()) out.devLink = link;
    return send(res, 200, out);
  }
  if (req.method === "POST" && path === "/api/reset") {
    const row = db.prepare("SELECT * FROM users WHERE reset_token = ?").get(String(body.token || ""));
    const password = String(body.password || "");
    if (!row || row.reset_exp < now() || password.length < 8) return send(res, 400, { error: "token" });
    const pw = await hashPw(password);
    db.prepare("UPDATE users SET pass_salt = ?, pass_hash = ?, reset_token = NULL, reset_exp = NULL WHERE id = ?").run(pw.salt, pw.hash, row.id);
    return send(res, 200, { ok: true });
  }
  const me = authUser(req);
  if (req.method === "GET" && path === "/api/me") {
    if (!me) return send(res, 401, { error: "auth" });
    const data = db.prepare("SELECT blob FROM user_data WHERE user_id = ?").get(me.id);
    let blob = null;
    try { blob = data ? JSON.parse(data.blob) : null; } catch (e) { blob = null; }
    return send(res, 200, { user: userPublic(me), blob });
  }
  if (req.method === "POST" && path === "/api/me/data") {
    if (!me) return send(res, 401, { error: "auth" });
    db.prepare("INSERT INTO user_data (user_id, blob, updated) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET blob = excluded.blob, updated = excluded.updated")
      .run(me.id, JSON.stringify(body.blob || {}), now());
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok: true, smtp: smtpOn() });
  if (path.startsWith("/api/billing")) return handleBilling(req, res, path, body, me);
  if (path.startsWith("/api/coach") || path === "/api/me/drills" || path === "/api/me/coach") return handleCoach(req, res, path, body, me);
  return send(res, 404, { error: "notfound" });
}

function serveStatic(req, res, path) {
  let rel = decodeURIComponent(path.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = normalize(join(root, rel));
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  const ext = extname(file);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(file));
}

const HOST = process.env.HOST || "127.0.0.1";
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url.pathname);
    else if (process.env.SERVE_STATIC === "0") { res.writeHead(404); res.end(); }
    else serveStatic(req, res, url.pathname);
  } catch (e) {
    send(res, 500, { error: "server", message: "Errore interno" });
  }
}).listen(PORT, HOST, () => {
  console.log("BioKinetIQ API su " + PUBLIC_URL + " bind=" + HOST + " smtp=" + (smtpOn() ? "on" : "off"));
});
