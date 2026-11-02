/* BioKinetIQ API. Avvio: node --experimental-sqlite server/server.js
   SMTP solo se configurato (nessun invio reale finché SMTP_HOST è vuoto). */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCb);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
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
);`);

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
async function sendMail({ to, subject, text }) {
  mkdirSync(outbox, { recursive: true });
  writeFileSync(join(outbox, Date.now() + "-" + String(to).replace(/[^\w.@-]+/g, "_") + ".txt"), `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
  if (!smtpOn()) return { sent: false };
  const nm = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const tx = nm.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined
  });
  await tx.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
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
const PLANS = {
  athlete: { name: "BioKinetIQ Athlete", month: 799, year: 8789 },
  coach: { name: "BioKinetIQ Coach", month: 1499, year: 16489 }
};
const TRIAL_MS = 30 * 86400000;
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
  return { plan: row.plan, interval: row.interval, status: trial ? "trialing" : row.status, trialEnds: row.trial_ends, active, name: (PLANS[row.plan] || {}).name || row.plan };
}
function currentSub(userId) {
  return db.prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created DESC LIMIT 1").get(userId);
}
async function handleBilling(req, res, path, body, me) {
  if (req.method === "GET" && path === "/api/billing/config") {
    const s = stripeKey();
    return send(res, 200, { stripeTest: s.mode === "test", localTrial: s.mode !== "test", plans: PLANS });
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
      params.set("subscription_data[trial_period_days]", "30");
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: "Bearer " + s.key, "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      const j = await r.json();
      if (!r.ok) return send(res, 502, { error: "stripe", message: "Checkout di test non creato" });
      return send(res, 200, { url: j.url, test: true });
    }
    const row = { id: id(), user_id: me.id, plan, interval, status: "trialing", trial_ends: now() + TRIAL_MS, created: now() };
    db.prepare("INSERT INTO subscriptions (id,user_id,plan,interval,status,trial_ends,stripe_session,created) VALUES (?,?,?,?,?,?,NULL,?)")
      .run(row.id, row.user_id, row.plan, row.interval, row.status, row.trial_ends, row.created);
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
    const row = { id: id(), trial_ends: now() + TRIAL_MS };
    db.prepare("INSERT INTO subscriptions (id,user_id,plan,interval,status,trial_ends,stripe_session,created) VALUES (?,?,?,?, 'trialing', ?, ?, ?)")
      .run(row.id, me.id, plan, interval, row.trial_ends, sid, now());
    return send(res, 200, { subscription: subPublic(currentSub(me.id)), charged: false });
  }
  return send(res, 404, { error: "notfound" });
}

async function handleApi(req, res, path) {
  const body = req.method === "POST" ? await readBody(req) : {};
  if (req.method === "POST" && path === "/api/register") {
    const nome = String(body.nome || "").trim(), cognome = String(body.cognome || "").trim();
    const telefono = String(body.telefono || "").trim(), email = String(body.email || "").trim().toLowerCase();
    const nascita = String(body.nascita || ""), paese = String(body.paese || ""), citta = String(body.citta || "").trim();
    const password = String(body.password || "");
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
    try { const m = await sendMail({ to: email, subject: "Conferma BioKinetIQ", text: "Conferma l'account: " + link }); emailSent = m.sent; }
    catch (e) { emailSent = false; }
    const out = { ok: true, emailSent };
    if (!emailSent) out.unconfigured = true;
    if (devLinks()) out.devLink = link;
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
    return send(res, 200, { token: tok, user: userPublic(row) });
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
      try { const m = await sendMail({ to: email, subject: "Reimposta password BioKinetIQ", text: link }); emailSent = m.sent; } catch (e) { emailSent = false; }
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

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url.pathname);
    else if (process.env.SERVE_STATIC === "0") { res.writeHead(404); res.end(); }
    else serveStatic(req, res, url.pathname);
  } catch (e) {
    send(res, 500, { error: "server", message: "Errore interno" });
  }
}).listen(PORT, () => {
  console.log("BioKinetIQ API su " + PUBLIC_URL + " smtp=" + (smtpOn() ? "on" : "off"));
});
