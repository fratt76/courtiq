/* CourtIQ - Video del colpo.
   Tutto avviene sul telefono: il video resta un URL locale (object URL), non viene caricato da nessuna parte
   e non viene conservato dopo la chiusura. Checklist e note vanno nel salvataggio locale dell'app.
   L'analisi automatica usa un modello di stima della posa che gira nel browser (MediaPipe Pose Landmarker,
   Apache 2.0, file in vendor/mediapipe). */
"use strict";

/* ================= motore di analisi (funzioni pure, testabili) ================= */
const CIQV = (() => {
  const P = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHe: 29, rHe: 30, lFt: 31, rFt: 32 };
  const KEY = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const deg = r => r * 180 / Math.PI;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
  /* angolo in B (gradi) formato da A-B-C */
  function angle3(a, b, c) {
    const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y); if (!n) return null;
    return deg(Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n))));
  }
  /* inclinazione rispetto alla verticale (0 = verticale) del segmento dal basso (a) all'alto (b) */
  const leanFromVertical = (lo, hi) => deg(Math.atan2(Math.abs(hi.x - lo.x), lo.y - hi.y));
  const pct = (arr, q) => { const a = arr.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
  const median = a => pct(a, 0.5);
  const toPx = (lms, w, h) => lms.map(p => ({ x: p.x * w, y: p.y * h, z: (p.z || 0) * w, v: p.visibility == null ? 1 : p.visibility }));
  function unwrap(arr) { const out = []; let off = 0, prev = null; for (const a of arr) { if (a == null) { out.push(null); continue; } let x = a + off; if (prev != null) { while (x - prev > 180) { off -= 360; x -= 360; } while (x - prev < -180) { off += 360; x += 360; } } out.push(x); prev = x; } return out; }
  function med3(arr) { return arr.map((x, i) => { if (x == null) return null; const w = [arr[i - 1], x, arr[i + 1]].filter(v => v != null).sort((a, b) => a - b); return w[Math.floor(w.length / 2)]; }); }
  function smooth(arr, k = 1) { return arr.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (arr[j] != null) { s += arr[j]; n++; } return arr[i] == null ? null : s / n; }); }

  /* metriche di un singolo fotogramma (punti in pixel) */
  function frameMetrics(p, side) {
    const S = side === "L" ? { sh: P.lSh, el: P.lEl, wr: P.lWr, hip: P.lHip } : { sh: P.rSh, el: P.rEl, wr: P.rWr, hip: P.rHip };
    const shM = mid(p[P.lSh], p[P.rSh]), hipM = mid(p[P.lHip], p[P.rHip]);
    const torso = dist(shM, hipM) || 1;
    const legOk = (h, k, a) => Math.min(p[h].v ?? 1, p[k].v ?? 1, p[a].v ?? 1) >= 0.5; // gamba poco visibile o fuori campo: angolo non stimato
    const kneeL = legOk(P.lHip, P.lKn, P.lAn) ? angle3(p[P.lHip], p[P.lKn], p[P.lAn]) : null, kneeR = legOk(P.rHip, P.rKn, P.rAn) ? angle3(p[P.rHip], p[P.rKn], p[P.rAn]) : null;
    return {
      elbow: angle3(p[S.sh], p[S.el], p[S.wr]),                         // 180 = braccio disteso
      shoulderAbd: angle3(p[S.hip], p[S.sh], p[S.el]),                  // apertura braccio rispetto al busto
      trunkLean: leanFromVertical(hipM, shM),                           // 0 = busto verticale
      rot: deg(Math.atan2(p[P.rSh].z - p[P.lSh].z, p[P.rSh].x - p[P.lSh].x)), // orientamento linea spalle (stima, usa la profondità)
      kneeFlexL: kneeL == null ? null : 180 - kneeL, kneeFlexR: kneeR == null ? null : 180 - kneeR,
      kneeFlex: kneeL == null && kneeR == null ? null : Math.max(kneeL == null ? 0 : 180 - kneeL, kneeR == null ? 0 : 180 - kneeR),
      wristAboveElbow: p[S.wr].y < p[S.el].y, wristAboveShoulder: p[S.wr].y < p[S.sh].y,
      wristRelElbow: { dx: (p[S.wr].x - p[S.el].x) / torso, dy: (p[S.el].y - p[S.wr].y) / torso },
      shoulderRatio: Math.abs(p[P.lSh].x - p[P.rSh].x) / torso, torso, shM, hipM
    };
  }
  /* spostamento interno del ginocchio rispetto alla linea anca-caviglia, normalizzato sulla gamba (vista frontale) */
  function valgus(p, leg) {
    const hip = p[leg === "L" ? P.lHip : P.rHip], kn = p[leg === "L" ? P.lKn : P.rKn], an = p[leg === "L" ? P.lAn : P.rAn];
    const midX = (p[P.lHip].x + p[P.rHip].x) / 2;
    if (an.y === hip.y) return null;
    const lineX = hip.x + (an.x - hip.x) * (kn.y - hip.y) / (an.y - hip.y);
    const len = dist(hip, kn) + dist(kn, an) || 1;
    return (kn.x - lineX) * Math.sign(midX - hip.x) / len;
  }
  /* appoggi del piede: massimi locali della quota della caviglia (y cresce verso il basso) */
  function footStrikes(ys, ts, minGap = 0.25) {
    const thr = pct(ys, 0.6); const out = [];
    for (let i = 1; i < ys.length - 1; i++) {
      const y = ys[i]; if (y == null || y < thr) continue;
      let peak = true; for (let j = Math.max(0, i - 2); j <= Math.min(ys.length - 1, i + 2); j++) if (j !== i && ys[j] != null && ys[j] > y) peak = false;
      if (!peak) continue;
      if (out.length && ts[i] - ts[out[out.length - 1]] < minGap) { if (y > ys[out[out.length - 1]]) out[out.length - 1] = i; continue; }
      out.push(i);
    }
    return out;
  }
  function cadenceFrom(strikeTimes) {
    if (strikeTimes.length < 4) return null;
    const span = strikeTimes[strikeTimes.length - 1] - strikeTimes[0]; if (span <= 0) return null;
    return (strikeTimes.length - 1) / span * 60;
  }
  const r0 = x => Math.round(x);

  /* analisi completa: frames = [{t, lms}] con lms in coordinate normalizzate MediaPipe (0-1) o null */
  function analyze(frames, opt) {
    const { w, h, shot, cfg } = opt;
    const q = cfg.quality, rules = Object.assign({}, cfg.kinds[shot.kind] || {}, shot.rules || {});
    const tips = shot.view === "front"
      ? ["Riprendi di fronte, con il telefono all'altezza del bacino.", "Tutto il corpo nell'inquadratura, piedi compresi.", "Buona luce, senza controluce.", "Telefono fermo (appoggialo o usa un supporto)."]
      : ["Riprendi di lato, perpendicolare alla direzione del colpo o della corsa.", "Tutto il corpo nell'inquadratura, piedi compresi.", "Buona luce, senza controluce.", "Telefono fermo (appoggialo o usa un supporto)."];
    const det = frames.filter(f => f.lms && f.lms.length >= 33);
    const reasons = [];
    if (frames.length < q.minFrames) reasons.push("Video troppo corto per l'analisi.");
    const detRatio = frames.length ? det.length / frames.length : 0;
    if (frames.length && detRatio < q.minDetectedRatio) reasons.push(`Persona riconosciuta solo nel ${r0(detRatio * 100)}% dei fotogrammi.`);
    const px = det.map(f => ({ t: f.t, p: toPx(f.lms, w, h), raw: f.lms }));
    const vis = px.length ? px.reduce((s, f) => s + KEY.reduce((a, k) => a + f.p[k].v, 0) / KEY.length, 0) / px.length : 0;
    if (px.length && vis < q.minVisibility) reasons.push("Punti del corpo poco visibili o incerti.");
    const inF = px.length ? px.filter(f => KEY.every(k => f.raw[k].x > -0.02 && f.raw[k].x < 1.02 && f.raw[k].y > -0.02 && f.raw[k].y < 1.02) && Math.max(f.p[P.lAn].v, f.p[P.rAn].v) >= 0.5).length / px.length : 0; // caviglie: il modello stima anche punti fuori campo, con visibilità bassa
    if (px.length && inF < q.minInFrameRatio) reasons.push("Il corpo esce dall'inquadratura (servono anche i piedi).");
    let side = "R";
    if (px.length > 2) { let mL = 0, mR = 0; for (let i = 1; i < px.length; i++) { mL += dist(px[i].p[P.lWr], px[i - 1].p[P.lWr]); mR += dist(px[i].p[P.rWr], px[i - 1].p[P.rWr]); } side = mL > mR ? "L" : "R"; }
    const M = px.map(f => frameMetrics(f.p, side));
    const ratios = M.map(m => m.shoulderRatio);
    if (px.length) {
      if (shot.view === "side" && pct(ratios, 0.25) > q.sideMaxShoulderRatio) reasons.push("L'inquadratura non sembra laterale.");
      if (shot.view === "front" && pct(ratios, 0.5) < q.frontMinShoulderRatio) reasons.push("L'inquadratura non sembra frontale.");
    }
    const quality = { frames: frames.length, detected: det.length, detRatio, visibility: vis, inFrame: inF, view: shot.view, shoulderRatio: median(ratios) };
    const ts = px.map(f => f.t);
    const series = { t: ts, elbow: M.map(m => m.elbow), shoulderAbd: M.map(m => m.shoulderAbd), kneeFlex: M.map(m => m.kneeFlex), trunkLean: M.map(m => m.trunkLean) };
    const base = { reliable: false, reasons, tips, quality, series, side, frames: px.map(f => ({ t: f.t, lms: f.raw })) };
    if (reasons.length) return base;

    const fb = []; const metrics = {}; let impact = null, strikes = [];
    const chk = t => fb.push({ lv: "check", t }), ok = t => fb.push({ lv: "ok", t });
    const kind = shot.kind;
    if (["ground", "overhead", "volley", "soft", "underhand"].includes(kind)) {
      const wrI = side === "L" ? P.lWr : P.rWr;
      const sp = px.map((f, i) => i ? dist(f.p[wrI], px[i - 1].p[wrI]) / (M[i].torso || 1) / Math.max(1e-3, f.t - px[i - 1].t) : null);
      const ss = smooth(sp, 1); let bi = 1;
      for (let i = 1; i < ss.length; i++) if (ss[i] != null && (ss[bi] == null || ss[i] > ss[bi])) bi = i;
      const m = M[bi]; impact = { i: bi, t: ts[bi] };
      // stime robuste: serie filtrate (mediana su 3 fotogrammi), finestra limitata attorno all'impatto, percentili invece di max/min
      const kfS = med3(M.map(x => x.kneeFlex));
      const prep = kfS.filter((x, i) => i < Math.max(1, bi) && ts[i] >= ts[bi] - 1.5 && x != null);
      const win = M.map((x, i) => Math.abs(ts[i] - ts[bi]) <= 1 ? x.rot : null).filter(x => x != null);
      const rc = median(win); const rd = win.map(a => ((a - rc + 540) % 360) - 180);
      const rotRange = rd.length ? Math.min(180, pct(rd, 0.9) - pct(rd, 0.1)) : 0;
      Object.assign(metrics, { elbowImpact: m.elbow, shoulderAbdImpact: m.shoulderAbd, trunkLeanImpact: m.trunkLean, kneeFlexPrep: prep.length ? pct(prep, 0.9) : null, rotRange, wristAboveShoulder: m.wristAboveShoulder, wristAboveElbow: m.wristAboveElbow });
      if (rules.elbowImpactMin != null) {
        if (m.elbow < rules.elbowImpactMin) chk(`Gomito molto chiuso all'impatto (circa ${r0(m.elbow)}°): possibile sovraccarico del gomito, da verificare con il maestro.`);
        else ok(`Gomito abbastanza disteso all'impatto (circa ${r0(m.elbow)}°).`);
      }
      if (rules.wristAboveShoulder && !m.wristAboveShoulder) chk("Il punto di impatto sembra basso rispetto alla spalla: possibile colpo non preso in alto, da verificare.");
      if (rules.kneeFlexPrepMin != null && !prep.length) chk("Gambe poco visibili prima del colpo: flessione delle ginocchia non stimata. Riprendi con i piedi dentro l'inquadratura.");
      else if (rules.kneeFlexPrepMin != null) {
        if (metrics.kneeFlexPrep < rules.kneeFlexPrepMin) chk(`Poca flessione delle ginocchia nella preparazione (circa ${r0(metrics.kneeFlexPrep)}°): possibile spinta più dalle braccia che dalle gambe, da verificare.`);
        else ok(`Ginocchia piegate in preparazione (circa ${r0(metrics.kneeFlexPrep)}°).`);
      }
      if (rules.trunkRotRangeMin != null) {
        if (rotRange < rules.trunkRotRangeMin) chk("Busto poco ruotato durante il colpo (stima): possibile gesto solo di braccio, da verificare con il maestro.");
        else ok("Rotazione del busto presente durante il colpo (stima).");
      }
      if (rules.trunkLeanMax != null && m.trunkLean > rules.trunkLeanMax) chk(`Busto molto inclinato all'impatto (circa ${r0(m.trunkLean)}°): possibile perdita di equilibrio o carico sulla schiena, da verificare.`);
    } else if (kind === "run_side" || kind === "run_front") {
      const yl = px.map(f => f.p[P.lAn].y), yr = px.map(f => f.p[P.rAn].y);
      const sl = footStrikes(yl, ts).map(i => ({ i, leg: "L" })), sr = footStrikes(yr, ts).map(i => ({ i, leg: "R" }));
      strikes = sl.concat(sr).sort((a, b) => a.i - b.i);
      const dur = ts.length ? ts[ts.length - 1] - ts[0] : 0;
      const cad = dur >= 2.5 ? cadenceFrom(strikes.map(s => ts[s.i])) : null;
      metrics.cadence = cad; metrics.strikes = strikes.length;
      metrics.trunkLean = median(M.map(m => m.trunkLean));
      if (cad == null) chk("Clip troppo corta o pochi appoggi visibili per stimare la cadenza: riprendi almeno 4-5 secondi di corsa.");
      else if (rules.cadenceLow != null && cad < rules.cadenceLow) chk(`Cadenza stimata circa ${r0(cad)} passi/min, piuttosto bassa: possibile passo lungo. Se vuoi lavorarci, aumenti graduali del 5-10% (metronomo nel calcolatore della sezione Drill), da verificare con l'allenatore.`);
      else ok(`Cadenza stimata circa ${r0(cad)} passi/min.`);
      if (kind === "run_side") {
        const dir = Math.sign(median(px.map(f => (f.p[P.lFt].x + f.p[P.rFt].x) - (f.p[P.lHe].x + f.p[P.rHe].x)))) || 1;
        const os = strikes.map(s => { const p = px[s.i].p, an = p[s.leg === "L" ? P.lAn : P.rAn], hip = mid(p[P.lHip], p[P.rHip]);
          const leg = dist(p[s.leg === "L" ? P.lHip : P.rHip], p[s.leg === "L" ? P.lKn : P.rKn]) + dist(p[s.leg === "L" ? P.lKn : P.rKn], an) || 1;
          return (an.x - hip.x) * dir / leg; });
        metrics.overstride = median(os);
        if (metrics.overstride != null) {
          if (metrics.overstride > rules.overstrideMax) chk("Il piede sembra atterrare molto avanti rispetto al bacino (possibile overstriding): prova passi più corti e frequenti, da verificare.");
          else ok("Appoggio del piede abbastanza vicino alla verticale del bacino.");
        }
      } else {
        const vv = []; px.forEach((f, i) => { vv.push(valgus(f.p, "L"), valgus(f.p, "R")); });
        metrics.valgus = pct(vv, 0.9);
        if (metrics.valgus != null && metrics.valgus > rules.valgusMax) chk("Il ginocchio sembra cadere verso l'interno durante l'appoggio: possibile scarso controllo di anca e gluteo, da verificare con un professionista. Utile la routine «Anche, glutei e bandelletta».");
        else if (metrics.valgus != null) ok("Ginocchia abbastanza allineate durante l'appoggio.");
      }
      if (rules.trunkLeanMax != null && metrics.trunkLean > rules.trunkLeanMax) chk(`Busto molto inclinato (circa ${r0(metrics.trunkLean)}°): prova a correre più alto, con l'inclinazione che parte dalle caviglie. Da verificare.`);
      else ok(`Inclinazione del busto contenuta (circa ${r0(metrics.trunkLean)}°).`);
    } else if (kind === "golf_swing") {
      const wrI = side === "L" ? P.lWr : P.rWr;
      const sp = px.map((f, i) => i ? dist(f.p[wrI], px[i - 1].p[wrI]) / (M[i].torso || 1) / Math.max(1e-3, f.t - px[i - 1].t) : null);
      const ss = smooth(sp, 1); let bi = 1;
      for (let i = 1; i < ss.length; i++) if (ss[i] != null && (ss[bi] == null || ss[i] > ss[bi])) bi = i;
      const m = M[bi]; impact = { i: bi, t: ts[bi] };
      metrics.trunkLeanImpact = m.trunkLean; metrics.elbowImpact = m.elbow;
      if (m.trunkLean < (rules.trunkLeanMin ?? 25)) chk(`Il busto all'impatto sembra poco inclinato (circa ${r0(m.trunkLean)}° sul piano dell'immagine): possibile early extension, da verificare con il maestro. Nello Studio trovi un preset dimostrativo, non una misura sul tuo corpo.`);
      else if (rules.trunkLeanMax != null && m.trunkLean > rules.trunkLeanMax) chk(`Il busto sembra molto piegato (circa ${r0(m.trunkLean)}°): da verificare con il maestro.`);
      else ok(`Inclinazione del busto presente all'impatto (circa ${r0(m.trunkLean)}°, stima 2D).`);
      if (rules.elbowImpactMin != null && m.elbow < rules.elbowImpactMin) chk(`Braccio guida abbastanza piegato all'impatto (circa ${r0(m.elbow)}°): da verificare.`);
      else if (m.elbow != null) ok(`Braccio abbastanza disteso all'impatto (circa ${r0(m.elbow)}°).`);
    } else if (kind === "hinge") {
      let hi = 0; M.forEach((m, i) => { if ((m.trunkLean || 0) > (M[hi].trunkLean || 0)) hi = i; });
      metrics.trunkLeanHinge = M[hi].trunkLean; metrics.kneeFlexHinge = M[hi].kneeFlex; impact = { i: hi, t: ts[hi] };
      const maxKnee = rules.kneeFlexAtHingeMax;
      if (maxKnee != null && metrics.kneeFlexHinge != null && metrics.kneeFlexHinge > maxKnee) chk(`Nel punto più inclinato le ginocchia sono piegate circa ${r0(metrics.kneeFlexHinge)}°: il gesto sembra più uno squat che una cerniera d'anca. Da verificare. Il confronto con la chiusura corretta è nello Studio (preset dimostrativo).`);
      else if (metrics.kneeFlexHinge != null) ok(`Nel punto basso le ginocchia restano relativamente distese (circa ${r0(metrics.kneeFlexHinge)}°): compatibile con una cerniera.`);
      else chk("Ginocchia poco visibili: la cerniera non è stimabile. Riprendi di lato, corpo intero.");
      chk("L'iperestensione lombare in chiusura non si misura in modo affidabile su un video 2D: controllala nello Studio scheletro o con il coach.");
    } else {
      /* di fronte la flessione del ginocchio non si misura sul piano dell'immagine: il punto più basso è dato dal bacino */
      const front = shot.view === "front";
      let di = 0; M.forEach((m, i) => { if (front ? m.hipM.y > M[di].hipM.y : m.kneeFlex > M[di].kneeFlex) di = i; });
      metrics.kneeFlexMax = front ? null : M[di].kneeFlex; impact = { i: di, t: ts[di] };
      metrics.trunkLeanAtDepth = M[di].trunkLean;
      if (!front && rules.kneeFlexMin != null && metrics.kneeFlexMax != null) {
        if (metrics.kneeFlexMax < rules.kneeFlexMin) chk(kind === "squat" ? `Squat poco profondo (flessione massima circa ${r0(metrics.kneeFlexMax)}°): possibile limite di mobilità o di forza, da verificare. Scendi solo quanto riesci senza dolore e con la schiena neutra.` : `Poca flessione delle ginocchia (circa ${r0(metrics.kneeFlexMax)}°): possibile atterraggio o frenata rigidi, da verificare.`);
        else ok(`Flessione delle ginocchia adeguata al gesto (circa ${r0(metrics.kneeFlexMax)}°).`);
      }
      if (rules.trunkLeanMax != null && metrics.trunkLeanAtDepth > rules.trunkLeanMax) chk(`Busto molto inclinato in avanti nel punto più basso (circa ${r0(metrics.trunkLeanAtDepth)}°): possibile carico sulla zona lombare, da verificare.`);
      if (rules.valgusMax != null) {
        const vv = []; px.forEach(f => vv.push(valgus(f.p, "L"), valgus(f.p, "R"))); metrics.valgus = pct(vv, 0.9);
        if (metrics.valgus > rules.valgusMax) chk("Le ginocchia sembrano cadere verso l'interno: possibile scarso controllo, da verificare con un preparatore o un fisioterapista.");
        else ok("Ginocchia abbastanza allineate ai piedi.");
      }
    }
    return Object.assign(base, { reliable: true, metrics, impact, strikes, feedback: fb });
  }
  return { P, angle3, leanFromVertical, frameMetrics, valgus, footStrikes, cadenceFrom, pct, unwrap, analyze };
})();
window.CIQV = CIQV;

/* ================= interfaccia ================= */
const POSE_LINKS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32]];
const VCOLORS = ["#c8f53a", "#f87171", "#60a5fa", "#fbbf24", "#ffffff"];
const VS = { sport: null, shot: null, url: null, name: "", tool: "none", color: VCOLORS[0], shapes: [], cur: null, res: null, skel: true, tsOff: 0, lm: null, busy: false,
  urlA: null, urlB: null, offB: 0 };
const VIDEO_NOTE = "La revisione del video è un aiuto per autovalutarti: non sostituisce il maestro, il medico o il fisioterapista.";
const AN_NOTE = "Indicazioni automatiche e approssimative ricavate da un video 2D: non sono una diagnosi e non sostituiscono il maestro, il medico o il fisioterapista. Se hai dolore, rivolgiti a un medico.";
const vShots = () => VIDEO_SHOTS[VS.sport] || [];
const vShot = () => vShots().find(s => s.id === VS.shot) || vShots()[0];
const fmtT = t => `${Math.floor(t / 60)}:${pad2(Math.floor(t % 60))}.${pad2(Math.floor((t % 1) * 100))}`;

function renderVideo() {
  const v = $("#view-video");
  VS.sport = VS.sport || S.sport || "tennis"; if (!VIDEO_SHOTS[VS.sport]) VS.sport = "tennis";
  if (!vShots().some(s => s.id === VS.shot)) VS.shot = vShots()[0].id;
  if ($("#vd-root", v)) { paintSportShot(); paintChecklist(); return; }
  v.innerHTML = `<div id="vd-root">
    <div class="card"><div class="row between"><h2>Video del colpo</h2><span class="pill acc">sul telefono</span></div>
      <p class="small mut" style="margin-top:0">Registra o scegli un video breve (3-10 secondi). Il video resta sul telefono: non viene inviato da nessuna parte e non viene conservato quando chiudi l'app.</p>
      <div id="vd-sports"></div><div id="vd-shots" style="margin-top:8px"></div>
      <div class="btns" style="margin-top:12px"><label class="btn pri">🎥 Registra<input type="file" id="vd-rec" accept="video/*" capture="environment" hidden></label>
        <label class="btn">🖼️ Dalla galleria<input type="file" id="vd-pick" accept="video/*" hidden></label></div>
      <p class="small mut" id="vd-tip" style="margin:10px 0 0"></p></div>
    <div class="card" id="vd-player" hidden>
      <div class="vstage" id="vd-stage"><video id="vd-v" playsinline muted preload="auto"></video><canvas id="vd-pose"></canvas><canvas id="vd-draw"></canvas></div>
      <div class="row vtime"><input type="range" id="vd-seek" min="0" max="1000" value="0" aria-label="Posizione"><span id="vd-time" class="small mut">0:00.00</span></div>
      <div class="vctl"><button type="button" class="btn sm" id="vd-fb" aria-label="Fotogramma indietro">⏮ −1</button><button type="button" class="btn sm pri" id="vd-play">▶ Play</button><button type="button" class="btn sm" id="vd-ff" aria-label="Fotogramma avanti">+1 ⏭</button></div>
      <div class="seg full" id="vd-speed">${[0.25, 0.5, 1].map(r => `<button type="button" data-r="${r}" class="${r === 1 ? "on" : ""}">${String(r).replace(".", ",")}x</button>`).join("")}</div>
      <div class="toolbar" id="vd-tools">${[["none", "👆 Nessuno"], ["line", "／ Linea"], ["angle", "∠ Angolo"], ["free", "✎ Mano libera"]].map(([id, l]) => `<button type="button" class="chip ${id === VS.tool ? "on" : ""}" data-dt="${id}">${l}</button>`).join("")}</div>
      <div class="toolbar">${VCOLORS.map(c => `<button type="button" class="swatch ${c === VS.color ? "on" : ""}" data-col="${c}" style="background:${c}" aria-label="Colore ${c}"></button>`).join("")}<span class="sp"></span>
        <button type="button" class="chip" id="vd-undo">↶</button><button type="button" class="chip" id="vd-clear">Pulisci</button></div>
      <div class="btns"><button type="button" class="btn sm" id="vd-snap">📸 Salva fotogramma</button><label class="switch small" id="vd-skel-w" hidden><input type="checkbox" id="vd-skel" checked> Scheletro</label></div>
      <p class="small mut" style="margin:8px 0 0">Metti in pausa e disegna sul fotogramma: linee, angoli con 3 tocchi (mostra i gradi) o a mano libera.</p></div>
    <div class="card" id="vd-an"><div class="row between"><h3>Analisi automatica</h3><span class="pill">sperimentale</span></div>
      <div class="alert yellow"><span>⚠️</span><div>${AN_NOTE}</div></div>
      <button type="button" class="btn pri block" id="vd-an-go" disabled>Analizza il video</button>
      <p class="small mut" id="vd-an-prog" style="margin:8px 0 0">Carica un video per iniziare. La prima analisi scarica il modello (circa 20 MB), poi funziona anche offline.</p>
      <div id="vd-an-out"></div></div>
    <div class="card" id="vd-check"></div>
    <div class="card"><h3>Confronto affiancato</h3><p class="small mut" style="margin-top:0">Due video (ad esempio prima e dopo) riprodotti insieme. Per allinearli porta ciascun video al momento del colpo con la sua barra, poi tocca «Allinea qui».</p>
      <div class="btns"><label class="btn sm">Video A<input type="file" id="vd-a" accept="video/*" hidden></label><label class="btn sm">Video B<input type="file" id="vd-b" accept="video/*" hidden></label></div>
      <div class="vsbs" id="vd-sbs" hidden><video id="vd-va" playsinline muted controls preload="auto"></video><video id="vd-vb" playsinline muted controls preload="auto"></video></div>
      <div id="vd-sbs-ctl" hidden><div class="vctl"><button type="button" class="btn sm" id="vd-s-fb">⏮ −1</button><button type="button" class="btn sm pri" id="vd-s-play">▶ Play</button><button type="button" class="btn sm" id="vd-s-ff">+1 ⏭</button></div>
        <div class="seg full" id="vd-s-speed">${[0.25, 0.5, 1].map(r => `<button type="button" data-r="${r}" class="${r === 1 ? "on" : ""}">${String(r).replace(".", ",")}x</button>`).join("")}</div>
        <button type="button" class="btn sm block" id="vd-s-align" style="margin-top:8px">Allinea qui (stesso istante del colpo)</button><p class="small mut" id="vd-s-off" style="margin:6px 0 0"></p></div></div>
    <div class="disclaimer"><span>🎥</span><span>${VIDEO_NOTE}</span></div>
  </div>`;
  paintSportShot(); bindPlayer(); bindSbs(); paintChecklist();
}

function paintSportShot() {
  $("#vd-sports").innerHTML = sportChips(VS.sport, "vd-sport");
  $("#vd-shots").innerHTML = `<div class="chips" data-group="vd-shot">${vShots().map(s => `<button type="button" class="chip ${s.id === VS.shot ? "on" : ""}" data-val="${s.id}">${esc(s.label)}</button>`).join("")}</div>`;
  const sh = vShot();
  $("#vd-tip").textContent = `Per l'analisi: inquadratura ${sh.view === "front" ? "frontale" : "laterale"}, corpo intero, buona luce, telefono fermo.`;
  bindChips($("#vd-root"), "vd-sport", x => { VS.sport = x; VS.shot = vShots()[0].id; paintSportShot(); paintChecklist(); clearAnalysis(); });
  bindChips($("#vd-root"), "vd-shot", x => { VS.shot = x; paintSportShot(); paintChecklist(); clearAnalysis(); });
}

function paintChecklist() {
  const box = $("#vd-check"); if (!box) return; const sh = vShot(); const key = VS.sport + ":" + sh.id;
  S.videoChecks = S.videoChecks || {}; const st = S.videoChecks[key] || { done: [], note: "" };
  box.innerHTML = `<div class="row between"><h3>Checklist: ${esc(sh.label)}</h3><span class="pill">${st.done.length}/${sh.checklist.length}</span></div>
    <p class="small mut" style="margin-top:0">Riguarda il video al rallentatore e spunta ciò che ritrovi.</p>
    <ul class="vchk">${sh.checklist.map((c, i) => `<li><label><input type="checkbox" data-ck="${i}" ${st.done.includes(i) ? "checked" : ""}> <span>${esc(c)}</span></label></li>`).join("")}</ul>
    <textarea class="field" id="vd-note" placeholder="Note su questo colpo (facoltative)">${esc(st.note)}</textarea>
    <button type="button" class="btn sm ghost" id="vd-ck-reset" style="margin-top:8px">Azzera checklist</button>`;
  const put = () => { S.videoChecks[key] = st; save(); $(".pill", box).textContent = `${st.done.length}/${sh.checklist.length}`; };
  $$("[data-ck]", box).forEach(c => c.onchange = () => { const i = +c.dataset.ck; st.done = st.done.filter(x => x !== i); if (c.checked) st.done.push(i); put(); });
  $("#vd-note", box).oninput = e => { st.note = e.target.value; put(); };
  $("#vd-ck-reset", box).onclick = () => { st.done = []; st.note = ""; put(); paintChecklist(); };
}

/* ---------- player e disegno ---------- */
function loadMain(file) {
  if (!file) return; if (VS.url) URL.revokeObjectURL(VS.url);
  VS.url = URL.createObjectURL(file); VS.name = file.name || "video"; VS.shapes = []; VS.cur = null; clearAnalysis();
  const vid = $("#vd-v"); vid.src = VS.url; $("#vd-player").hidden = false; vid.load();
}
function bindPlayer() {
  const vid = $("#vd-v"), seek = $("#vd-seek");
  $("#vd-rec").onchange = e => loadMain(e.target.files[0]);
  $("#vd-pick").onchange = e => loadMain(e.target.files[0]);
  vid.addEventListener("loadedmetadata", () => {
    const ar = vid.videoWidth / vid.videoHeight || 16 / 9; const st = $("#vd-stage");
    st.style.aspectRatio = `${vid.videoWidth} / ${vid.videoHeight}`; st.style.maxWidth = `calc(62vh * ${ar.toFixed(4)})`;
    $("#vd-an-go").disabled = false; $("#vd-an-prog").textContent = "Pronto per l'analisi. La prima volta scarica il modello (circa 20 MB), poi funziona anche offline.";
    requestAnimationFrame(() => { sizeCanvases(); paintOverlay(); });
    vid.currentTime = 0.001;
  });
  const upd = () => { $("#vd-time").textContent = fmtT(vid.currentTime || 0); if (vid.duration) seek.value = Math.round(vid.currentTime / vid.duration * 1000); paintPose(); };
  vid.addEventListener("timeupdate", upd); vid.addEventListener("seeked", upd);
  vid.addEventListener("play", () => { $("#vd-play").textContent = "⏸ Pausa"; const loop = () => { if (!vid.paused) { upd(); requestAnimationFrame(loop); } }; loop(); });
  vid.addEventListener("pause", () => $("#vd-play").textContent = "▶ Play");
  vid.addEventListener("ended", () => $("#vd-play").textContent = "▶ Play");
  seek.oninput = () => { if (vid.duration) { vid.pause(); vid.currentTime = seek.value / 1000 * vid.duration; } };
  $("#vd-play").onclick = () => vid.paused ? vid.play().catch(() => { }) : vid.pause();
  const stepF = d => { vid.pause(); vid.currentTime = Math.max(0, Math.min((vid.duration || 0), vid.currentTime + d / 30)); };
  $("#vd-fb").onclick = () => stepF(-1); $("#vd-ff").onclick = () => stepF(1);
  $$("#vd-speed button").forEach(b => b.onclick = () => { vid.playbackRate = +b.dataset.r; $$("#vd-speed button").forEach(x => x.classList.toggle("on", x === b)); });
  $$("#vd-tools [data-dt]").forEach(b => b.onclick = () => { VS.tool = b.dataset.dt; VS.cur = null; $$("#vd-tools [data-dt]").forEach(x => x.classList.toggle("on", x === b)); $("#vd-draw").classList.toggle("on", VS.tool !== "none"); if (VS.tool !== "none") vid.pause(); paintOverlay(); });
  $$("[data-col]").forEach(b => b.onclick = () => { VS.color = b.dataset.col; $$("[data-col]").forEach(x => x.classList.toggle("on", x === b)); });
  $("#vd-undo").onclick = () => { if (VS.cur) VS.cur = null; else VS.shapes.pop(); paintOverlay(); };
  $("#vd-clear").onclick = () => { VS.shapes = []; VS.cur = null; paintOverlay(); };
  $("#vd-snap").onclick = snapshot;
  $("#vd-skel").onchange = e => { VS.skel = e.target.checked; paintPose(); };
  $("#vd-an-go").onclick = runAnalysis;
  window.addEventListener("resize", () => { sizeCanvases(); paintOverlay(); paintPose(); });
  const cv = $("#vd-draw");
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener("pointerdown", e => {
    if (VS.tool === "none") return; e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); const p = pos(e);
    if (VS.tool === "angle") { if (!VS.cur) VS.cur = { t: "angle", c: VS.color, pts: [] }; VS.cur.pts.push(p); if (VS.cur.pts.length === 3) { VS.shapes.push(VS.cur); VS.cur = null; } }
    else VS.cur = { t: VS.tool, c: VS.color, pts: VS.tool === "line" ? [p, p] : [p], drag: true };
    paintOverlay();
  });
  cv.addEventListener("pointermove", e => { if (!VS.cur || !VS.cur.drag) return; const p = pos(e); if (VS.cur.t === "line") VS.cur.pts[1] = p; else VS.cur.pts.push(p); paintOverlay(); });
  const up = () => { if (VS.cur && VS.cur.drag) { delete VS.cur.drag; if (VS.cur.pts.length > 1) VS.shapes.push(VS.cur); VS.cur = null; paintOverlay(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
}
function sizeCanvases() {
  const st = $("#vd-stage"); if (!st) return; const r = st.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  for (const id of ["#vd-pose", "#vd-draw"]) { const c = $(id); c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d)); }
}
/* disegna le forme su un contesto di dimensioni w x h (coordinate normalizzate 0-1) */
function drawShapes(ctx, w, h, shapes, scale = 1) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of shapes) {
    const pts = s.pts.map(([x, y]) => [x * w, y * h]); ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = 3 * scale;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    if (s.t !== "free") pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4.5 * scale, 0, 7); ctx.fill(); });
    if (s.t === "angle" && pts.length === 3) {
      const a = CIQV.angle3({ x: pts[0][0], y: pts[0][1] }, { x: pts[1][0], y: pts[1][1] }, { x: pts[2][0], y: pts[2][1] });
      if (a != null) { const txt = Math.round(a) + "°"; ctx.font = `bold ${16 * scale}px system-ui, sans-serif`; const tw = ctx.measureText(txt).width;
        const x = pts[1][0] + 10 * scale, y = pts[1][1] - 10 * scale; ctx.fillStyle = "rgba(11,18,32,.8)"; ctx.fillRect(x - 4 * scale, y - 16 * scale, tw + 8 * scale, 22 * scale); ctx.fillStyle = s.c; ctx.fillText(txt, x, y); }
    }
  }
}
function paintOverlay() {
  const c = $("#vd-draw"); if (!c) return; const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height);
  const d = window.devicePixelRatio || 1; drawShapes(ctx, c.width, c.height, VS.shapes.concat(VS.cur ? [VS.cur] : []), d);
}
function nearestFrame(t) {
  if (!VS.res || !VS.res.frames.length) return null; let best = null, bd = 1e9;
  for (const f of VS.res.frames) { const dd = Math.abs(f.t - t); if (dd < bd) { bd = dd; best = f; } }
  return bd <= 0.15 ? best : null;
}
function drawPose(ctx, lms, w, h, scale = 1) {
  ctx.lineWidth = 3 * scale; ctx.strokeStyle = "rgba(200,245,58,.9)"; ctx.fillStyle = "#0b1220";
  for (const [a, b] of POSE_LINKS) { const p = lms[a], q = lms[b]; if (!p || !q) continue; ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke(); }
  ctx.strokeStyle = "#c8f53a";
  for (let i = 11; i < 33; i++) { const p = lms[i]; if (!p) continue; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3.5 * scale, 0, 7); ctx.fill(); ctx.stroke(); }
}
function paintPose() {
  const c = $("#vd-pose"); if (!c) return; const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height);
  if (!VS.skel) return; const f = nearestFrame($("#vd-v").currentTime); if (f) drawPose(ctx, f.lms, c.width, c.height, window.devicePixelRatio || 1);
}
function snapshot() {
  const vid = $("#vd-v"); if (!vid.videoWidth) { toast("Carica prima un video"); return; }
  const w = vid.videoWidth, h = vid.videoHeight, c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(vid, 0, 0, w, h); const sc = w / ($("#vd-stage").getBoundingClientRect().width || w);
  if (VS.skel) { const f = nearestFrame(vid.currentTime); if (f) drawPose(ctx, f.lms, w, h, sc); }
  drawShapes(ctx, w, h, VS.shapes, sc);
  c.toBlob(async blob => {
    if (!blob) { toast("Impossibile salvare il fotogramma"); return; }
    const name = `kinetiq-colpo-${today()}-${fmtT(vid.currentTime).replace(/[:.]/g, "")}.png`;
    try { const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ files: [file], title: "KinetIQ" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Fotogramma salvato");
  }, "image/png");
}

/* ---------- analisi ---------- */
function clearAnalysis() { VS.res = null; const o = $("#vd-an-out"); if (o) o.innerHTML = ""; const w = $("#vd-skel-w"); if (w) w.hidden = true; paintPose && $("#vd-pose") && paintPose(); }
async function getLandmarker() {
  if (VS.lm) return VS.lm;
  const base = new URL("vendor/mediapipe/", location.href).href;
  const mp = await import(base + "vision_bundle.mjs");
  const files = await mp.FilesetResolver.forVisionTasks(base + "wasm");
  VS.lm = await mp.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: base + "pose_landmarker_lite.task", delegate: "CPU" },
    runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  return VS.lm;
}
function seekTo(vid, t) {
  return new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; vid.removeEventListener("seeked", fin); res(); };
    vid.addEventListener("seeked", fin); vid.currentTime = t; setTimeout(fin, 2000); });
}
async function runAnalysis() {
  if (VS.busy) return; const vid = $("#vd-v"); if (!vid.duration) { toast("Carica prima un video"); return; }
  const prog = $("#vd-an-prog"), btn = $("#vd-an-go"); VS.busy = true; btn.disabled = true; clearAnalysis();
  const sh = vShot(); const t0 = performance.now();
  try {
    const mock = typeof window.CIQ_POSE_MOCK === "function" ? window.CIQ_POSE_MOCK : null;
    let lm = null;
    if (!mock) { prog.textContent = "Carico il modello di analisi sul telefono…"; lm = await getLandmarker(); }
    vid.pause(); await vid.play().catch(() => { }); vid.pause();
    const fps = VIDEO_RULES.sampleFps[sh.kind] || VIDEO_RULES.sampleFps.default;
    const dur = vid.duration, start = dur > VIDEO_RULES.maxSeconds ? Math.min(vid.currentTime, dur - VIDEO_RULES.maxSeconds) : 0, end = Math.min(dur, start + VIDEO_RULES.maxSeconds);
    const frames = []; const n = Math.max(1, Math.floor((end - start) * fps));
    for (let k = 0; k <= n; k++) {
      const t = Math.min(end - 0.001, start + k / fps); await seekTo(vid, t);
      let lms = null;
      if (mock) lms = mock(t, vid.videoWidth, vid.videoHeight);
      else { const r = lm.detectForVideo(vid, Math.round(VS.tsOff + t * 1000)); lms = r && r.landmarks && r.landmarks[0] ? r.landmarks[0] : null; }
      frames.push({ t, lms });
      if (k % 3 === 0) { prog.textContent = `Analizzo i fotogrammi… ${Math.round(k / n * 100)}%`; await new Promise(r => setTimeout(r, 0)); }
    }
    VS.tsOff += (end + 1) * 1000;
    VS.res = CIQV.analyze(frames, { w: vid.videoWidth, h: vid.videoHeight, shot: sh, cfg: VIDEO_RULES });
    VS.res.ms = Math.round(performance.now() - t0);
    prog.textContent = `Analisi completata: ${frames.length} fotogrammi in ${(VS.res.ms / 1000).toFixed(1)} s, tutto sul telefono.`;
    paintAnalysis(); $("#vd-skel-w").hidden = false;
    if (VS.res.impact) { await seekTo(vid, VS.res.impact.t); }
    paintPose();
  } catch (e) {
    prog.textContent = "Non è stato possibile avviare l'analisi su questo dispositivo. Puoi comunque usare rallentatore, disegno e checklist.";
    console.info("analisi non disponibile", e && e.message);
  } finally { VS.busy = false; btn.disabled = false; }
}
function graphSVG(res) {
  const s = res.series, t = s.t; if (t.length < 2) return "";
  const W = 320, H = 150, t0 = t[0], t1 = t[t.length - 1] || 1, X = x => 8 + (x - t0) / (t1 - t0 || 1) * (W - 16), Y = v => H - 14 - v / 180 * (H - 26);
  const lines = [["elbow", "#c8f53a", "Gomito"], ["shoulderAbd", "#60a5fa", "Spalla"], ["kneeFlex", "#fbbf24", "Ginocchio (flessione)"], ["trunkLean", "#f87171", "Busto (inclinazione)"]];
  const path = k => s[k].map((v, i) => v == null ? "" : `${i && s[k][i - 1] != null ? "L" : "M"}${X(t[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
  const grid = [0, 45, 90, 135, 180].map(g => `<line x1="8" x2="${W - 8}" y1="${Y(g)}" y2="${Y(g)}" class="gl"/><text x="${W - 6}" y="${Y(g) - 2}" class="gt" text-anchor="end">${g}°</text>`).join("");
  const imp = res.impact ? `<line x1="${X(res.impact.t)}" x2="${X(res.impact.t)}" y1="6" y2="${H - 12}" class="gimp"/><text x="${X(res.impact.t) + 3}" y="14" class="gt">${["squat", "landing", "decel"].includes(vShot().kind) ? "massima flessione" : "impatto stimato"}</text>` : "";
  const st = (res.strikes || []).map(k => `<circle cx="${X(t[k.i])}" cy="${H - 8}" r="3" class="gst"/>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="vgraph" id="vd-graph" data-t0="${t0}" data-t1="${t1}">${grid}${lines.map(([k, c]) => `<path d="${path(k)}" stroke="${c}" fill="none" stroke-width="2"/>`).join("")}${imp}${st}</svg>
    <div class="legendrow small mut">${lines.map(([, c, l]) => `<span><i class="lg" style="background:${c}"></i>${l}</span>`).join("")}${(res.strikes || []).length ? `<span><i class="lg" style="background:#fff;border-radius:50%"></i>Appoggi</span>` : ""}</div>
    <p class="small mut" style="margin:4px 0 0">Tocca il grafico per andare a quel punto del video.</p>`;
}
function paintAnalysis() {
  const r = VS.res, o = $("#vd-an-out"); if (!r) return;
  const qtxt = `Fotogrammi analizzati ${r.quality.frames}, persona trovata nel ${Math.round(r.quality.detRatio * 100)}%.`;
  if (!r.reliable) {
    o.innerHTML = `<div class="alert red" id="vd-unrel"><span>🎥</span><div><b>Risultato non affidabile</b><br>${r.reasons.map(esc).join("<br>")}</div></div>
      <h4>Per un video analizzabile</h4><ul class="small">${r.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul><p class="small mut">${qtxt}</p>${graphSVG(r)}`;
  } else {
    const m = r.metrics, k = [];
    const f = (v, u = "°") => v == null ? "–" : Math.round(v) + u;
    if (m.elbowImpact != null) k.push([f(m.elbowImpact), "gomito all'impatto"], [f(m.kneeFlexPrep), "flessione ginocchia"], [f(m.trunkLeanImpact), "busto all'impatto"]);
    else if (m.cadence !== undefined) k.push([m.cadence == null ? "–" : Math.round(m.cadence), "passi/min (stima)"], [f(m.trunkLean), "inclinazione busto"], [m.overstride != null ? (m.overstride * 100).toFixed(0) + "%" : m.valgus != null ? (m.valgus * 100).toFixed(0) + "%" : "–", m.overstride != null ? "piede avanti / gamba" : "ginocchio verso l'interno"]);
    else k.push([f(m.kneeFlexMax), "flessione massima"], [f(m.trunkLeanAtDepth), "busto nel punto basso"], [m.valgus != null ? (m.valgus * 100).toFixed(0) + "%" : "–", "ginocchio verso l'interno"]);
    o.innerHTML = `<div class="kpis">${k.map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join("")}</div>
      <h4>Indicazioni da verificare</h4><ul class="vfb" id="vd-fb-list">${r.feedback.map(x => `<li class="${x.lv}"><span>${x.lv === "ok" ? "✓" : "!"}</span><span>${esc(x.t)}</span></li>`).join("")}</ul>
      <p class="small mut">${qtxt} Braccio analizzato: ${r.side === "L" ? "sinistro" : "destro"}. Valori stimati sul piano dell'immagine.</p>${graphSVG(r)}`;
  }
  const g = $("#vd-graph"); if (g) g.onclick = e => { const rc = g.getBoundingClientRect(); const fr = (e.clientX - rc.left) / rc.width; const t0 = +g.dataset.t0, t1 = +g.dataset.t1;
    const vid = $("#vd-v"); vid.pause(); vid.currentTime = Math.max(0, t0 + (fr * 320 - 8) / 304 * (t1 - t0)); };
}

/* ---------- confronto affiancato ---------- */
function bindSbs() {
  const A = $("#vd-va"), B = $("#vd-vb");
  const show = () => { const ok = !!(VS.urlA && VS.urlB); $("#vd-sbs").hidden = !(VS.urlA || VS.urlB); $("#vd-sbs-ctl").hidden = !ok; };
  $("#vd-a").onchange = e => { const f = e.target.files[0]; if (!f) return; if (VS.urlA) URL.revokeObjectURL(VS.urlA); VS.urlA = URL.createObjectURL(f); A.src = VS.urlA; show(); };
  $("#vd-b").onchange = e => { const f = e.target.files[0]; if (!f) return; if (VS.urlB) URL.revokeObjectURL(VS.urlB); VS.urlB = URL.createObjectURL(f); B.src = VS.urlB; show(); };
  const syncB = () => { const t = A.currentTime + VS.offB; if (B.duration) B.currentTime = Math.max(0, Math.min(B.duration, t)); };
  $("#vd-s-play").onclick = () => { if (A.paused) { syncB(); A.play().catch(() => { }); B.play().catch(() => { }); $("#vd-s-play").textContent = "⏸ Pausa"; } else { A.pause(); B.pause(); syncB(); $("#vd-s-play").textContent = "▶ Play"; } };
  A.addEventListener("ended", () => { B.pause(); $("#vd-s-play").textContent = "▶ Play"; });
  const st = d => { A.pause(); B.pause(); $("#vd-s-play").textContent = "▶ Play"; A.currentTime = Math.max(0, A.currentTime + d / 30); B.currentTime = Math.max(0, B.currentTime + d / 30); };
  $("#vd-s-fb").onclick = () => st(-1); $("#vd-s-ff").onclick = () => st(1);
  $$("#vd-s-speed button").forEach(b => b.onclick = () => { A.playbackRate = B.playbackRate = +b.dataset.r; $$("#vd-s-speed button").forEach(x => x.classList.toggle("on", x === b)); });
  $("#vd-s-align").onclick = () => { VS.offB = B.currentTime - A.currentTime; $("#vd-s-off").textContent = `Video B allineato: ${VS.offB >= 0 ? "+" : ""}${VS.offB.toFixed(2).replace(".", ",")} s rispetto al video A.`; };
}
