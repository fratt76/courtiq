/* BioKinetIQ - figure vettoriali dei passi. Lime #A6F03C, azzurro #1EC8E6, sfondo scuro.
   Ogni esercizio (prevenzione e routine) riceve 3 passi illustrati. */
"use strict";

const FIG_LIME = "#A6F03C";
const FIG_CYAN = "#1EC8E6";

function figF(n) { return (Number.isFinite(n) ? n : 0).toFixed(1); }
function figUnit(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  return { x: dx / L, y: dy / L, L };
}
function figLimb(a, b, r1, r2, hot) {
  if (!a || !b) return "";
  const u = figUnit(a, b), px = -u.y, py = u.x;
  const p = (pt, r, s) => `${figF(pt.x + px * r * s)} ${figF(pt.y + py * r * s)}`;
  const stroke = hot ? FIG_CYAN : FIG_LIME;
  const fill = hot ? "rgba(30,200,230,.35)" : "rgba(166,240,60,.16)";
  if (u.L < 1) return `<circle cx="${figF(a.x)}" cy="${figF(a.y)}" r="${figF(r1)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  return `<path d="M ${p(a, r1, 1)} L ${p(b, r2, 1)} L ${p(b, r2, -1)} L ${p(a, r1, -1)} Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="${figF(a.x)}" cy="${figF(a.y)}" r="${figF(Math.max(3.2, r1 * .55))}" fill="${FIG_CYAN}" stroke="none"/>` +
    `<circle cx="${figF(b.x)}" cy="${figF(b.y)}" r="${figF(Math.max(3.2, r2 * .55))}" fill="${FIG_CYAN}" stroke="none"/>`;
}
function figHead(h, face) {
  const f = face || 1;
  return `<ellipse cx="${figF(h.x)}" cy="${figF(h.y)}" rx="11" ry="13" fill="rgba(166,240,60,.2)" stroke="${FIG_LIME}" stroke-width="2"/>` +
    `<circle cx="${figF(h.x + f * 3.5)}" cy="${figF(h.y - 1)}" r="1.3" fill="${FIG_CYAN}"/>`;
}

/* Punti in un riquadro 200×220. hot: quale arto evidenziare. */
const FIG_POSE = {
  stand: { h: [100, 28], sL: [78, 52], sR: [122, 52], eL: [68, 84], eR: [132, 84], wL: [66, 112], wR: [134, 112], hpL: [86, 108], hpR: [114, 108], kL: [84, 156], kR: [116, 156], aL: [82, 198], aR: [118, 198] },
  armcircle: { h: [100, 28], sL: [78, 52], sR: [122, 52], eL: [48, 58], eR: [152, 58], wL: [28, 46], wR: [172, 46], hpL: [86, 108], hpR: [114, 108], kL: [84, 156], kR: [116, 156], aL: [82, 198], aR: [118, 198], hot: "arms" },
  wall: { h: [78, 32], sL: [62, 54], sR: [96, 54], eL: [58, 36], eR: [108, 36], wL: [54, 18], wR: [118, 16], hpL: [70, 104], hpR: [98, 104], kL: [68, 152], kR: [104, 152], aL: [66, 196], aR: [108, 196], prop: "wall", hot: "arms" },
  twist: { h: [100, 28], sL: [84, 54], sR: [124, 50], eL: [70, 78], eR: [150, 70], wL: [58, 96], wR: [168, 86], hpL: [86, 108], hpR: [114, 108], kL: [84, 156], kR: [116, 156], aL: [82, 198], aR: [118, 198], hot: "arms" },
  wrists: { h: [100, 30], sL: [78, 54], sR: [122, 54], eL: [70, 86], eR: [130, 86], wL: [62, 108], wR: [138, 108], hpL: [86, 110], hpR: [114, 110], kL: [84, 156], kR: [116, 156], aL: [82, 198], aR: [118, 198], hot: "arms" },
  quadruped: { side: 1, h: [46, 78], s: [70, 70], e: [78, 108], w: [86, 132], hp: [118, 78], k: [124, 118], a: [130, 150], hot: "arm" },
  cat: { side: 1, h: [40, 88], s: [68, 78], e: [76, 112], w: [84, 136], hp: [120, 86], k: [126, 120], a: [132, 150], hot: "torso" },
  cow: { side: 1, h: [48, 62], s: [74, 64], e: [80, 108], w: [88, 134], hp: [122, 70], k: [128, 116], a: [134, 150], hot: "torso" },
  lunge: { h: [108, 28], sL: [90, 52], sR: [126, 52], eL: [78, 78], eR: [140, 40], wL: [70, 100], wR: [152, 28], hpL: [96, 104], hpR: [120, 100], kL: [78, 150], kR: [142, 148], aL: [64, 196], aR: [156, 196], hot: "legs" },
  squat: { h: [100, 36], sL: [76, 58], sR: [124, 58], eL: [62, 86], eR: [138, 86], wL: [70, 108], wR: [130, 108], hpL: [82, 112], hpR: [118, 112], kL: [68, 156], kR: [132, 156], aL: [62, 198], aR: [138, 198], hot: "legs" },
  supine: { side: 1, h: [36, 70], s: [58, 74], e: [78, 60], w: [96, 52], hp: [100, 86], k: [132, 70], a: [160, 64], hot: "leg" },
  bridge: { side: 1, h: [40, 88], s: [64, 72], e: [78, 90], w: [90, 100], hp: [100, 64], k: [132, 86], a: [158, 98], hot: "torso" },
  deadbug: { side: 1, h: [40, 78], s: [62, 74], e: [70, 48], w: [86, 36], hp: [100, 90], k: [128, 64], a: [156, 48], hot: "arm" },
  plank: { side: 1, h: [36, 70], s: [58, 74], e: [70, 100], w: [78, 124], hp: [110, 74], k: [140, 96], a: [168, 118], hot: "torso" },
  birddog: { side: 1, h: [48, 72], s: [72, 70], e: [64, 48], w: [52, 32], hp: [118, 76], k: [150, 58], a: [176, 46], hot: "arm" },
  cobra: { side: 1, h: [48, 48], s: [78, 62], e: [70, 90], w: [64, 112], hp: [120, 96], k: [150, 104], a: [176, 108], hot: "torso" },
  seated: { h: [70, 48], sL: [54, 70], sR: [88, 70], eL: [46, 98], eR: [100, 96], wL: [40, 120], wR: [112, 118], hpL: [64, 112], hpR: [92, 112], kL: [100, 128], kR: [118, 128], aL: [150, 140], aR: [168, 140], prop: "bench", hot: "legs" },
  calf: { h: [100, 22], sL: [78, 48], sR: [122, 48], eL: [70, 80], eR: [130, 80], wL: [66, 108], wR: [134, 108], hpL: [86, 100], hpR: [114, 100], kL: [86, 148], kR: [114, 148], aL: [84, 186], aR: [116, 186], prop: "toes", hot: "legs" },
  sidelying: { side: 1, h: [40, 64], s: [62, 70], e: [78, 58], w: [92, 50], hp: [100, 86], k: [136, 78], a: [168, 74], hot: "leg" },
  clam: { side: 1, h: [36, 60], s: [58, 66], e: [72, 54], w: [86, 48], hp: [96, 90], k: [124, 62], a: [150, 70], hot: "leg" },
  kneehug: { side: 1, h: [40, 70], s: [62, 76], e: [90, 70], w: [112, 62], hp: [100, 92], k: [118, 70], a: [108, 52], hot: "leg" },
  breathe: { h: [100, 32], sL: [78, 56], sR: [122, 56], eL: [86, 78], eR: [114, 78], wL: [94, 96], wR: [106, 96], hpL: [86, 112], hpR: [114, 112], kL: [84, 158], kR: [116, 158], aL: [82, 198], aR: [118, 198], hot: "torso" },
  jog: { h: [104, 26], sL: [86, 50], sR: [122, 50], eL: [70, 70], eR: [142, 64], wL: [58, 90], wR: [156, 80], hpL: [92, 102], hpR: [118, 100], kL: [70, 140], kR: [138, 132], aL: [62, 178], aR: [150, 168], hot: "legs" },
  band: { h: [100, 28], sL: [78, 52], sR: [122, 52], eL: [64, 78], eR: [136, 78], wL: [58, 96], wR: [142, 96], hpL: [86, 108], hpR: [114, 108], kL: [84, 156], kR: [116, 156], aL: [82, 198], aR: [118, 198], prop: "band", hot: "arms" }
};

function figProp(kind) {
  if (kind === "wall") return `<line x1="168" y1="8" x2="168" y2="210" stroke="${FIG_CYAN}" stroke-width="3" stroke-linecap="round" opacity=".85"/>`;
  if (kind === "bench") return `<path d="M40 150 H150 V162 H40 Z" fill="none" stroke="${FIG_CYAN}" stroke-width="2"/>`;
  if (kind === "toes") return `<path d="M70 198 H132" stroke="${FIG_CYAN}" stroke-width="3" stroke-linecap="round"/>`;
  if (kind === "band") return `<path d="M58 96 Q100 78 142 96" fill="none" stroke="${FIG_CYAN}" stroke-width="2.4" stroke-linecap="round"/>`;
  return "";
}
function figFront(p) {
  const pt = a => ({ x: a[0], y: a[1] });
  const hotA = p.hot === "arms", hotL = p.hot === "legs", hotT = p.hot === "torso";
  const h = pt(p.h), sL = pt(p.sL), sR = pt(p.sR), hpL = pt(p.hpL), hpR = pt(p.hpR);
  const sM = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
  const hpM = { x: (hpL.x + hpR.x) / 2, y: (hpL.y + hpR.y) / 2 };
  return figProp(p.prop) +
    figLimb(sL, pt(p.eL), 6.2, 5, hotA) + figLimb(pt(p.eL), pt(p.wL), 5, 4, hotA) +
    figLimb(sR, pt(p.eR), 6.2, 5, hotA) + figLimb(pt(p.eR), pt(p.wR), 5, 4, hotA) +
    figLimb(hpL, pt(p.kL), 8, 6.2, hotL) + figLimb(pt(p.kL), pt(p.aL), 6.2, 4.6, hotL) +
    figLimb(hpR, pt(p.kR), 8, 6.2, hotL) + figLimb(pt(p.kR), pt(p.aR), 6.2, 4.6, hotL) +
    figLimb(hpL, hpR, 9, 9, hotT) + figLimb(sM, hpM, 11, 10, hotT) +
    figLimb(h, sM, 5, 7, false) + figHead(h, 1);
}
function figSide(p) {
  const pt = a => ({ x: a[0], y: a[1] });
  const hotA = p.hot === "arm", hotL = p.hot === "leg", hotT = p.hot === "torso";
  const h = pt(p.h), s = pt(p.s), hp = pt(p.hp);
  return figProp(p.prop) +
    figLimb(hp, pt(p.k), 8.5, 6.4, hotL) + figLimb(pt(p.k), pt(p.a), 6.4, 4.6, hotL) +
    figLimb(s, hp, 11, 10, hotT) +
    figLimb(s, pt(p.e), 6.2, 5, hotA) + figLimb(pt(p.e), pt(p.w), 5, 4, hotA) +
    figLimb(h, s, 5, 7, false) + figHead(h, 1);
}
function figSVG(pose) {
  const p = FIG_POSE[pose] || FIG_POSE.stand;
  const inner = p.side ? figSide(p) : figFront(p);
  return `<svg class="exfig-svg" viewBox="0 0 200 220" role="img" aria-hidden="true"><rect width="200" height="220" rx="16" fill="#0c1014"/>${inner}</svg>`;
}

function figPick(text) {
  const t = text.toLowerCase();
  const rules = [
    [/quattro zampe|bird|cane da caccia|braccio e gamba oppost/, "birddog"],
    [/gatto|mucca|arrotond/, "cat"],
    [/cobra|prono|pancia in giù|pancia in giu/, "cobra"],
    [/dead bug|insetto morto|braccio e la gamba oppost/, "deadbug"],
    [/ponte|glutei.*schiena|bacino.*sollev/, "bridge"],
    [/plank|tavola|addome in isometr/, "plank"],
    [/conchiglia|fianco.*ginocchio|sul fianco/, "clam"],
    [/libro|sdraiato sul fianco/, "sidelying"],
    [/ginocchio al petto|abbraccia.*ginocch/, "kneehug"],
    [/muro|parete/, "wall"],
    [/affondo/, "lunge"],
    [/squat|accosciat/, "squat"],
    [/sedut|sedia/, "seated"],
    [/polso|dita|pugno|mano/, "wrists"],
    [/elastico|banda|asciugamano/, "band"],
    [/caviglia|tallone|punta|polpaccio|achille/, "calf"],
    [/corsa|skip|saltell|sul posto/, "jog"],
    [/respira|respirazione/, "breathe"],
    [/ruota il busto|rotazion.*busto|torsione/, "twist"],
    [/cerchi|circonduz|braccia tese/, "armcircle"],
    [/sdraiat|supino|a terra sulla schiena|schiena a terra/, "supine"],
    [/quattro zampe|in quadrupedia/, "quadruped"]
  ];
  for (const [re, pose] of rules) if (re.test(t)) return pose;
  return "stand";
}
function figSplit(desc) {
  const parts = String(desc || "").split(/(?<=[.!])\s+/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : ["Esegui il gesto lentamente, nell'ampiezza senza dolore."];
}
/* Tre passi per qualunque esercizio: posizione, esecuzione, ritorno. */
function figGuide(name, detail, cue) {
  const blob = `${name || ""}. ${detail || ""}`;
  const pose = figPick(blob + " " + (cue || ""));
  const bits = figSplit(detail);
  const setup = {
    quadruped: "quadruped", cat: "quadruped", cow: "quadruped", birddog: "quadruped",
    cobra: "plank", bridge: "supine", deadbug: "supine", kneehug: "supine", sidelying: "sidelying", clam: "sidelying",
    lunge: "stand", squat: "stand", wall: "stand", calf: "stand", seated: "seated"
  }[pose] || "stand";
  const back = pose === "breathe" ? "breathe" : "stand";
  return [
    { pose: setup, text: "Parti da una posizione stabile. " + (bits[0] || "Allinea piedi o appoggi e respira.") },
    { pose, text: bits[1] || bits[0] || "Esegui il movimento lento, senza forzare." },
    { pose: back, text: cue ? ("Punto chiave: " + cue) : "Torna alla partenza e respira. Fermati se compare dolore." }
  ];
}
function figPanel(steps, index) {
  const i = Math.max(0, Math.min(steps.length - 1, index || 0));
  const st = steps[i];
  const dots = steps.map((_, k) => `<button type="button" class="exfig-dot ${k === i ? "on" : ""}" data-fig="${k}" aria-label="Passo ${k + 1}"></button>`).join("");
  return `<div class="exfig" data-exfig><div class="exfig-top"><span class="pill acc">Passo ${i + 1} di ${steps.length}</span></div>${figSVG(st.pose)}<p class="exfig-t">${esc(st.text)}</p><div class="exfig-dots">${dots}</div></div>`;
}
