/* KinetIQ - carico Foster, semaforo, sport biomeccanici, studio scheletro, rete specialisti.
   I dati restano sul dispositivo. Nessuna integrazione con Apple Salute, Strava o Garmin.
   Gli angoli dei preset sono dimostrativi: non sono misure di una persona reale. */
"use strict";

const KQ_ROLES = [["maestro", "Maestro/Tecnico"], ["fisio", "Fisioterapista/Osteopata"], ["prep", "Preparatore/Chinesiologo"]];
const KQ_ROLE = Object.fromEntries(KQ_ROLES);
const KQ_WA = "Ciao, utilizzo KinetIQ e vorrei condividere il mio report biomeccanico per una valutazione.";
const DUR_PRESETS = {
  padel: [45, 60, 90, 120], tennis: [45, 60, 90, 120], pickleball: [30, 45, 60, 90],
  running: [20, 30, 45, 60], sci: [60, 120, 180, 240], atletica: [30, 45, 60, 90],
  golf: [60, 120, 180, 240], kettlebell: [20, 30, 45, 60]
};
const KQ = { rete: "specs", specSport: "all", specCity: "", specOpen: false, studio: null, kbRAF: 0, kbUrl: {}, waZone: null, gaugeLast: null };

/* ---------- profili: finestre indicative, non misurazioni ---------- */
const SPORT_BIO = {
  padel: {
    angles: [
      ["Gomito all'impatto", "abbastanza disteso, davanti al corpo"],
      ["Polso", "stabile, senza frustare la palla"],
      ["Catena", "gambe e busto, non solo il braccio"]
    ],
    alert: "Esempio didattico: gomito basso e impatto arretrato, carico sull'epicondilo. Non è un tuo dato.",
    zones: ["gomito", "spalla", "polso", "lombare"],
    preset: "elbow_low"
  },
  tennis: {
    angles: [
      ["Impatto", "davanti al corpo, braccio non piegato di scatto"],
      ["Spalla", "il busto porta il braccio nel servizio"],
      ["Ginocchia", "piegate in preparazione"]
    ],
    alert: "Esempio didattico: impatto arretrato e braccio solo, possibile stress su spalla e schiena. Non è un tuo dato.",
    zones: ["spalla", "gomito", "lombare"],
    preset: "elbow_low"
  },
  pickleball: {
    angles: [
      ["Polso in dink", "fermo, gesto corto dalla spalla"],
      ["Ginocchia", "piegate, baricentro basso"],
      ["Busto", "stabile, senza crollare in avanti"]
    ],
    alert: "Esempio didattico: polso iper-mobile sulla Kitchen e poca spinta di gambe. Non è un tuo dato.",
    zones: ["polso", "gomito", "ginocchio"],
    preset: "elbow_low"
  },
  running: {
    angles: [
      ["Ginocchio in appoggio", "allineato al piede, senza cadere in dentro"],
      ["Appoggio", "piede sotto il bacino, non molto avanti"],
      ["Busto", "alto, leggera inclinazione dalle caviglie"]
    ],
    alert: "Esempio didattico: valgismo in appoggio e passo lungo. Non è un tuo dato.",
    zones: ["ginocchio", "anca", "achille", "tibia"],
    preset: "ski_valgus"
  },
  sci: {
    angles: [
      ["Valgismo del ginocchio", "finestra di riferimento: sotto gli 8° di deviazione interna"],
      ["Dorsiflessione della caviglia", "finestra di riferimento: 35°–45°, tallone a terra"],
      ["Flessione del ginocchio in assorbimento", "finestra di riferimento: 95°–110°"]
    ],
    alert: "Esempio didattico: ginocchio che cede in dentro sullo spigolo, stress sul crociato anteriore. Non è un tuo dato.",
    zones: ["ginocchio", "caviglia", "anca", "lombare"],
    preset: "ski_valgus"
  },
  golf: {
    angles: [
      ["X-factor (spalle rispetto al bacino)", "finestra di riferimento: 45°–55°"],
      ["Spine angle", "finestra di riferimento: 35°–42°, tenuto fino all'impatto"],
      ["Polso guida all'impatto", "finestra di riferimento: quasi piatto"]
    ],
    alert: "Esempio didattico: perdita dello spine angle e early extension, compressione sulla zona lombare. Non è un tuo dato.",
    zones: ["lombare", "gomito", "anca", "spalla"],
    preset: "golf_early"
  },
  kettlebell: {
    angles: [
      ["Cerniera anca/ginocchio", "finestra di riferimento: le ginocchia si piegano poco, il bacino va indietro"],
      ["Colonna in chiusura", "finestra di riferimento: 0° di iperestensione, corpo verticale"],
      ["Lockout overhead", "finestra di riferimento: polso, gomito e spalla sulla stessa linea"]
    ],
    alert: "Esempio didattico: chiusura dello swing in iperestensione lombare invece che con i glutei. Non è un tuo dato.",
    zones: ["lombare", "spalla", "polso", "anca"],
    preset: "kb_hyper"
  },
  atletica: {
    angles: [
      ["Squat", "ginocchia verso le punte, schiena neutra"],
      ["Atterraggio", "ginocchio allineato al piede"],
      ["Frenata", "più passi corti, baricentro basso"]
    ],
    alert: "Esempio didattico: ginocchia che cedono in dentro in atterraggio. Non è un tuo dato.",
    zones: ["ginocchio", "caviglia", "lombare", "spalla"],
    preset: "ski_valgus"
  }
};

const LONGEVITY = {
  golf: [
    { id: "golf_spine", title: "Decompressione spinale e X-factor", min: 20, type: "Mobilità e core", target: "Lombare e torace",
      steps: [
        ["Apertura del libro", 180, "Sdraiato sul fianco, ginocchia piegate. Apri il braccio verso il soffitto e torna. Alterna i lati."],
        ["Rotazioni del dorso", 180, "A quattro zampe, una mano dietro la testa. Gomito verso il braccio d'appoggio, poi verso il soffitto. Bacino fermo."],
        ["Gatto e mucca lento", 150, "A quattro zampe, arrotonda e inarca la schiena seguendo il respiro. Movimento piccolo."],
        ["Dead bug", 180, "Schiena a terra, braccia verso il soffitto, ginocchia a 90°. Distendi un braccio e la gamba opposta senza staccare la zona lombare."],
        ["Ponte per i glutei", 180, "Solleva il bacino stringendo i glutei. Non spingere le costole in su."],
        ["Respirazione a terra", 150, "Ginocchia piegate, una mano sull'addome. Inspira dal naso, espira lunga. La schiena resta appoggiata."]
      ] },
    { id: "golf_elbow", title: "Protezione del gomito del golfista", min: 15, type: "Tendine e presa", target: "Avambraccio del braccio guida",
      steps: [
        ["Circonduzioni dei polsi", 120, "Cerchi lenti, entrambi i sensi. Spalle basse."],
        ["Apri e chiudi le mani", 90, "Dita aperte e pugno morbido, senza stringere al massimo."],
        ["Presa morbida e rilascio", 150, "Stringi un asciugamano al 30% e rilascia. 10 volte, poi scuoti le mani."],
        ["Estensione lenta del polso", 180, "Avambraccio appoggiato, palmo in giù. Aiutati a salire, scendi da solo in 3 secondi. Peso minimo o senza peso."],
        ["Pronosupinazione", 150, "Gomito vicino al fianco, palmo in su e in giù, lento."],
        ["Stretch dolce dei flessori", 120, "Braccio avanti, palmo in su, con l'altra mano tira piano le dita verso di te. Fermati prima del dolore."]
      ] }
  ],
  sci: [
    { id: "ski_lca", title: "Pre-sciistica: ginocchio e controllo", min: 25, type: "Forza e stabilità", target: "Ginocchia, glutei, quadricipiti",
      steps: [
        ["Squat alla parete, fermo", 180, "Schiena al muro, scendi fin dove il ginocchio è comodo e le punte restano visibili. Tieni, respira. Ginocchio verso il secondo dito."],
        ["Conchiglia", 180, "Sul fianco, apri il ginocchio senza ruotare il bacino. 15 per lato, lente."],
        ["Ponte su una gamba (o due)", 180, "Se una gamba è instabile, fai il ponte a due piedi. Bacino orizzontale."],
        ["Affondo corto", 200, "Passo corto, ginocchio sopra la caviglia, tallone a terra. 8 per lato."],
        ["Atterraggio morbido", 180, "Piccolo salto sul posto, atterraggio sulle due punte e poi tutto il piede. Silenzioso. Fermati se il ginocchio cade in dentro."],
        ["Equilibrio su un piede", 180, "30 secondi per piede, vicino a un appoggio. Ginocchio morbido e allineato."],
        ["Respirazione", 120, "In piedi o a terra, 6 respiri lenti."]
      ] },
    { id: "ski_ankle", title: "Caviglia per lo scarpone", min: 15, type: "Mobilità", target: "Caviglia e polpaccio",
      steps: [
        ["Ginocchio verso il muro", 180, "Tallone a terra, ginocchio verso il secondo dito. 10 per lato, lenti."],
        ["Cerchi di caviglia", 120, "Seduto, cerchi ampi con la punta, entrambi i sensi."],
        ["Polpaccio sul gradino", 180, "Avampiede su un gradino basso, tallone che scende solo quanto è comodo. Tieni un appoggio."],
        ["Camminata sulle punte e sui talloni", 120, "Passi corti, 30 secondi per variante."],
        ["Affondo con ginocchio avanti", 180, "Solo l'ampiezza in cui il tallone resta a terra."],
        ["Respiro e scuotimento", 120, "Scuoti le gambe e fai 6 respiri lenti."]
      ] }
  ],
  kettlebell: [
    { id: "kb_hinge", title: "Core e cerniera d'anca", min: 20, type: "Controllo", target: "Lombare e catena posteriore",
      steps: [
        ["Respiro a pancia in su", 120, "Zona lombare che si appoggia a terra mentre espiri."],
        ["Dead bug", 180, "Schiena che non si stacca. Braccio e gamba opposti, lenti."],
        ["Bird dog", 180, "A quattro zampe, braccio e gamba opposti, 5 secondi. Bacino fermo, niente inarcamento."],
        ["Cerniera al muro", 200, "Talloni a una spanna dal muro. Manda il bacino indietro a toccare il muro, ginocchia poco piegate, schiena neutra. 10 volte."],
        ["Ponte per i glutei", 180, "In alto stringi i glutei e le costole restano basse. Non spingere la pancia in su."],
        ["Plank breve", 150, "Corpo in linea. Se la schiena cede, ginocchia a terra."],
        ["Camminata leggera sul posto", 90, "Sciogli anche e braccia."]
      ] },
    { id: "kb_shoulder", title: "Spalla stabile per l'overhead", min: 20, type: "Mobilità e tenuta", target: "Spalla e scapole",
      steps: [
        ["Scapolare in plank", 150, "Sulle ginocchia, senza piegare i gomiti spingi il pavimento lontano e torna."],
        ["Y-T-W a terra", 180, "A pancia in giù, lettere lente, pollici in su, collo lungo."],
        ["Halo a vuoto", 150, "Mani unite davanti al viso, disegna un cerchio lento intorno alla testa. Costole basse."],
        ["Arm bar a terra, senza peso", 180, "Sdraiato, un braccio verso il soffitto, ginocchia piegate. Rotola piano sul fianco tenendo il braccio verticale, poi torna."],
        ["Press lenta a vuoto", 180, "In piedi, glutei contratti, un braccio sale e scende. Le costole non si aprono."],
        ["Stretch della spalla sul muro", 150, "Avambraccio sul muro, gira il busto dal lato opposto solo quanto è comodo."],
        ["Respiro", 120, "Sei cicli lenti, spalle basse."]
      ] }
  ]
};

function kqSteps(list) { return list.map(([n, s, d]) => ({ n, s, d })); }
function kqStartLongevity(sport, id) {
  const r = (LONGEVITY[sport] || []).find(x => x.id === id); if (!r) return;
  const pack = { id: r.id, title: r.title, why: `${r.type} · ${r.target}. Scheda generale di ${SPORTS[sport] || sport}, non una prescrizione.`, steps: kqSteps(r.steps), gen: false };
  if (typeof pause === "function") pause();
  loadRoutine(pack, false);
  go("recupero");
  toast("Routine avviata in Recupero");
}
function kqLongevityBlock(sport) {
  const list = LONGEVITY[sport] || [];
  if (!list.length) return `<div class="card"><div class="row between"><h3>Routine 15–30 min</h3><span class="pill">${esc(SPORTS[sport] || "")}</span></div>
    <p class="small mut">Per questo sport le sessioni guidate da 20–60 minuti sono nel generatore qui sotto, e gli scarichi brevi sono in Recupero. Golf, Sci e Kettlebell hanno in più schede dedicate da 15–30 minuti.</p></div>`;
  return `<div class="card" id="long-block"><div class="row between"><h3>Routine 15–30 min</h3><span class="pill acc">${esc(SPORTS[sport] || "")}</span></div>
    <p class="small mut">Protocolli generali per lo sport selezionato. Fermati se compare dolore. Non sostituiscono il preparatore o il fisioterapista.</p>
    ${list.map(r => `<div class="long"><div class="row between"><b>${esc(r.title)}</b><span class="pill">${r.min} min</span></div>
      <p class="small mut" style="margin:4px 0 8px">${esc(r.type)} · ${esc(r.target)}</p>
      <ol class="small">${r.steps.map(([n]) => `<li>${esc(n)}</li>`).join("")}</ol>
      <button type="button" class="btn sm pri" data-long="${esc(sport)}:${esc(r.id)}">Avvia con il timer</button></div>`).join("")}</div>`;
}
function kqBindLongevity(root) {
  $$("[data-long]", root).forEach(b => b.onclick = () => { const [sp, id] = b.dataset.long.split(":"); kqStartLongevity(sp, id); });
}

/* ---------- semaforo pre-partita ---------- */
function kqSerious(info) {
  if (!info) return false;
  if (info.zone === "red") return true;
  if ((info.persistent || []).length || (info.persistentDays || []).length) return true;
  return Object.entries(info.active || {}).some(([, p]) => p.sev > 5 || p.type === "Fitta");
}
function kqCue(zone) {
  const g = zone && ZONES[zone] ? ZONES[zone].group : "";
  const map = {
    ginocchio: "Prima di entrare: circa 4 minuti di gluteo medio (conchiglia) e ginocchio verso il secondo dito.",
    caviglia: "Prima di entrare: circa 3 minuti di caviglia, tallone a terra, e appoggi morbidi.",
    achille: "Prima di entrare: polpacci lenti, niente balzi se il tendine tira.",
    tibia: "Prima di entrare: camminata e caviglia, senza salti.",
    lombare: "Prima di entrare: circa 4 minuti di respiro e cerniera d'anca, senza caricare la schiena.",
    gomito: "Prima di entrare: polsi lenti e presa morbida. Se il gesto fa male, accorcia.",
    polso: "Prima di entrare: circonduzioni dei polsi e presa morbida.",
    spalla: "Prima di entrare: circa 4 minuti di scapole (Y-T-W) senza dolore.",
    anca: "Prima di entrare: ponte e conchiglia, lenti."
  };
  return map[g] || "Prima di entrare attiva la zona che senti e tieni la seduta un filo più corta.";
}
function kqPrematch(info) {
  const pains = Object.entries(info.active || {}).sort((a, b) => b[1].sev - a[1].sev);
  const worst = pains[0];
  const strong = pains.some(([, p]) => p.sev >= 7 || p.type === "Fitta");
  const high = pains.some(([, p]) => p.sev > 5);
  const persist = (info.persistent || []).length || (info.persistentDays || []).length;
  const zn = worst ? ZONES[worst[0]].label : "";
  if (info.zone === "red" || strong || high) {
    const why = (strong || high) && zn ? `${zn} è sopra la soglia di prudenza. ` : `ACWR ${info.ratio == null ? "" : info.ratio.toFixed(2)}: il carico di 7 giorni è alto rispetto alle 4 settimane. `;
    return { lv: "red", title: "Rosso · scarico", text: why + "Meglio non fare una seduta intensa. Scarica, e se il dolore è forte rivolgiti a un professionista." };
  }
  if (info.zone === "yellow" || persist || (worst && worst[1].sev >= 3)) {
    const head = worst ? `${zn} ${worst[1].sev}/10. ` : "";
    return { lv: "yellow", title: "Giallo · attenzione", text: head + kqCue(worst ? worst[0] : (info.persistent || [])[0]) };
  }
  const extra = info.insufficient ? " Lo storico di carico è ancora corto: il semaforo si fida soprattutto dei fastidi." : "";
  return { lv: "green", title: "Verde · via libera", text: "Nessun fastidio rilevante. Tre minuti di attivazione standard, poi puoi entrare." + extra };
}
function kqPrematchHTML(info) {
  const p = kqPrematch(info);
  return `<div class="card prematch"><div class="row"><div class="sema ${p.lv}" aria-hidden="true">${p.lv === "green" ? "VIA" : p.lv === "yellow" ? "ATT." : "STOP"}</div>
    <div><h2 style="margin:0 0 4px">Check-in pre-partita</h2><b>${esc(p.title)}</b><p class="small" style="margin:4px 0 0">${esc(p.text)}</p></div></div>
    <button type="button" class="btn ${p.lv === "red" ? "" : "pri"} block" id="pm-go" style="margin-top:12px">${p.lv === "green" ? "Avvia attivazione 3 min" : p.lv === "yellow" ? "Avvia attivazione mirata" : "Apri lo scarico"}</button>
    <p class="small mut" style="margin:8px 0 0">Incrocia l'ultimo fastidio con il carico degli ultimi 7 giorni. Non è un via libera medico.</p></div>`;
}
function kqBindPrematch(root, info) {
  const b = $("#pm-go", root); if (!b) return;
  b.onclick = () => {
    const p = kqPrematch(info);
    if (p.lv === "green") { const r = ROUTINES.find(x => x.id === "r1"); loadRoutine(r, false); go("recupero"); }
    else { const rt = buildRoutine(info); loadRoutine(rt, false); go("recupero"); }
  };
}
function kqSpecBanner(info) {
  if (!kqSerious(info)) return "";
  return `<div class="card specban"><b>Rilevato un allarme da non ignorare</b>
    <p class="small" style="margin:6px 0 10px">Vuoi condividere il report biomeccanico con uno specialista della tua rete?</p>
    <button type="button" class="btn pri block" id="show-spec">Mostra specialisti</button></div>`;
}
function kqBindSpec(root) {
  const b = $("#show-spec", root); if (!b) return;
  b.onclick = () => { KQ.rete = "specs"; KQ.specSport = S.sport || "all"; go("rete"); };
}

function kqReport(zone) {
  const info = analyze(S.sessions, S.draftPains);
  const p = zone ? (S.draftPains[zone] || info.active[zone]) : null;
  const L = ["Sport: " + (SPORTS[S.sport] || S.sport || "-")];
  if (zone && ZONES[zone]) {
    L.push("Zona: " + ZONES[zone].label);
    if (p) {
      L.push("Intensità: " + p.sev + "/10");
      if (p.type) L.push("Sensazione: " + p.type);
      if (p.ctx) Object.entries(p.ctx).forEach(([, v]) => { if (v) L.push("Contesto: " + v); });
    }
    if ((info.persistent || []).includes(zone)) L.push("Segnalato nelle ultime 3 sessioni.");
    if ((info.persistentDays || []).includes(zone)) L.push("Presente in più giorni nelle ultime due settimane.");
  }
  L.push("Carico acuto (7 giorni, minuti × RPE): " + info.acute);
  L.push("Carico cronico (media settimanale sui 28 giorni): " + Math.round(info.chronic));
  L.push("ACWR: " + (info.ratio == null ? "dati insufficienti" : info.ratio.toFixed(2) + " · " + ZONE_TXT[info.zone][0]));
  L.push("", "Testo preparato da KinetIQ. Non è una diagnosi.");
  return L.join("\n");
}
function kqPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("3")) d = "39" + d;
  return d;
}
/* Chiamata: se il numero ha il prefisso internazionale (o è un cellulare italiano a 10 cifre) si compone con +, altrimenti com'è */
function kqTelLink(phone) {
  const raw = String(phone || ""), d = kqPhone(raw);
  const intl = /^\s*(\+|00)/.test(raw) || (d.length === 12 && d.startsWith("39"));
  return "tel:" + (intl ? "+" : "") + d;
}
function kqWaLink(phone, extra) {
  const text = extra ? KQ_WA + "\n\n" + extra : KQ_WA;
  return `https://wa.me/${kqPhone(phone)}?text=${encodeURIComponent(text)}`;
}
function kqContactSpec(zone) {
  KQ.waZone = zone || null;
  const list = S.specialists || [];
  if (!list.length) {
    openSheet(`<h2>Nessuno specialista in rubrica</h2>
      <p class="small">La rete è vuota: aggiungi tu il contatto (maestro, fisioterapista o preparatore). Non ci sono nominativi precompilati.</p>
      <button type="button" class="btn pri block" id="go-rete">Aggiungi un contatto</button>`, r => {
      $("#go-rete", r).onclick = () => { closeSheet(); KQ.rete = "specs"; KQ.specOpen = true; go("rete"); };
    });
    return;
  }
  const extra = kqReport(zone);
  const ranked = [...list].sort((a, b) => (a.role === "fisio" ? 0 : 1) - (b.role === "fisio" ? 0 : 1));
  openSheet(`<h2>Invia il riepilogo</h2>
    <p class="small mut">Si apre WhatsApp con il messaggio già scritto. Lo invii tu. L'app non manda nulla da sola.</p>
    ${ranked.map(s => `<div class="threq"><b>${esc(s.name)}</b><div class="small mut">${esc(KQ_ROLE[s.role] || s.role)} · ${esc(s.city || "")}</div>
      <div class="btns" style="margin-top:8px"><a class="btn sm pri" href="${esc(kqWaLink(s.phone, extra))}" target="_blank" rel="noopener">WhatsApp</a>${kqPhone(s.phone).length >= 8 ? `<a class="btn sm" href="${esc(kqTelLink(s.phone))}" aria-label="Chiama ${esc(s.name)}">Chiama</a>` : ""}</div></div>`).join("")}
    <button type="button" class="btn ghost block" id="go-rete">Apri la rete</button>`, r => {
    $("#go-rete", r).onclick = () => { closeSheet(); KQ.rete = "specs"; go("rete"); };
  });
}

function kqPainQuestions(sport) {
  const cat = (SPORT_CATS.find(c => c.sports.includes(sport)) || {}).id;
  const when = { id: "when", q: "Quando compare il fastidio?", opts: ["A freddo", "Durante il gesto", "Il giorno dopo"] };
  if (cat === "racchette") return [when, { id: "gear", q: "Com'è l'attrezzo?", opts: ["Rigido", "Medio", "Morbido", "Non so"] }];
  if (sport === "kettlebell") return [when, { id: "gear", q: "Che ghiria usi di solito?", opts: ["Fino a 8 kg", "12–16 kg", "20 kg o più"] }];
  if (sport === "golf") return [{ id: "when", q: "Quando compare?", opts: ["Nel backswing", "All'impatto", "Il giorno dopo"] }];
  if (sport === "sci") return [{ id: "when", q: "Quando compare?", opts: ["In curva", "A fine giornata", "Il giorno dopo"] }];
  if (sport === "running") return [{ id: "when", q: "Quando compare?", opts: ["A freddo", "Dopo qualche km", "Il giorno dopo"] }];
  return [when];
}

/* ---------- navigazione e barra sport ---------- */
function kqRenderSportBar() {
  const bar = $("#sportbar"); if (!bar) return;
  if (bar.dataset.built !== "1") {
    bar.innerHTML = `<div class="sportbar-scroll">${SPORT_CATS.map(c => `<div class="sg"><span class="sg-l">${esc(c.label)}</span><div class="sg-row">${c.sports.map(id =>
      `<button type="button" class="chip" data-val="${id}">${sportIcon(id, 18)}${esc(SPORTS[id])}</button>`).join("")}</div></div>`).join("")}</div>`;
    bar.dataset.built = "1";
    $$("[data-val]", bar).forEach(b => b.onclick = () => kqSetSport(b.dataset.val));
  }
  $$("[data-val]", bar).forEach(b => b.classList.toggle("on", b.dataset.val === S.sport));
  const sc = $(".sportbar-scroll", bar), chip = $(".chip.on", bar);
  if (sc && chip) {
    const a = sc.getBoundingClientRect(), b = chip.getBoundingClientRect();
    if (b.left < a.left + 4 || b.right > a.right - 4) sc.scrollLeft += b.left - a.left - 12;
  }
}
function kqSetSport(id) {
  if (!SPORTS[id]) return;
  S.sport = id;
  if (typeof CK !== "undefined") CK.sport = id;
  if (S.drillSport && S.drillSport !== "all") S.drillSport = id;
  if (typeof VS !== "undefined") { VS.sport = id; VS.shot = null; }
  if (isCourt(id) || TACTICAL_SPORTS.includes(id)) S.boardSport = id;
  if (S.prev) S.prev.sport = id;
  save();
  render();
}
function kqRenderSubnav() {
  const el = $("#subnav"); if (!el) return;
  const groups = {
    campo: [["drill", "Drill"], ["lavagna", "Lavagna"], ["tecnica", "Tecnica"]],
    salute: [["corpo", "Fastidi"], ["recupero", "Recupero"], ["prevenzione", "Prevenzione"]],
    video: [["video", "Video"], ["studio", "Studio"]],
    rete: [["specs", "Specialisti"], ["test", "Test sul campo"]]
  };
  const p = (typeof PARENT !== "undefined" && PARENT[TAB]) || "oggi";
  const g = groups[p];
  if (!g) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  const cur = p === "rete" ? KQ.rete : TAB;
  el.innerHTML = `<div class="seg full" role="group">${g.map(([id, l]) => `<button type="button" class="${cur === id ? "on" : ""}" data-sub="${id}">${l}</button>`).join("")}</div>`;
  $$("[data-sub]", el).forEach(b => b.onclick = () => {
    if (p === "rete") { KQ.rete = b.dataset.sub; render(); }
    else go(b.dataset.sub);
  });
}

/* ---------- scheda tecnica e libreria kettlebell ---------- */
const KB_LIB = [
  { id: "swing", title: "Hardstyle Swing", sub: "Cerniera d'anca balistica",
    explain: "Estensione dell'anca guidata da glutei e ischiocrurali. La ghiria fluttua in avanti per inerzia: non si solleva di braccia.",
    cues: ["Le ginocchia si piegano poco e il bacino va indietro.", "In alto sei una tavola verticale: glutei e addome contratti, niente caduta all'indietro.", "Inspira scendendo, espira forte nel punto di massima estensione."],
    fault: "Iperestensione lombare in chiusura, oppure sollevare di spalle. La forza di taglio finisce sui dischi invece che sui glutei.",
    speak: "Glutei contratti" },
  { id: "tgu", title: "Turkish Get-Up", sub: "Dal suolo alla posizione eretta",
    explain: "Movimento lento, dal pavimento fino in piedi, con il peso che resta verticale. Serve a tenere stabile la spalla sotto carico.",
    cues: ["Spalla bassa, gomito disteso, polso dritto per tutto il tempo.", "Lo sguardo resta sulla campana fino all'affondo.", "Un passaggio alla volta: gomito, mano, ponte, ginocchio, in piedi."],
    fault: "Gomito che cede e campana che esce dalla verticale: rischio sulla capsula della spalla.",
    speak: "Spalla bloccata" },
  { id: "clean", title: "Clean e rack", sub: "Dal pavimento al petto",
    explain: "La ghiria sale vicina al corpo e si appoggia sull'avambraccio, con il gomito basso, pronta per squat o press.",
    cues: ["Traiettoria stretta, come una cerniera, non un arco largo.", "La mano infila la maniglia prima che la ghisa tocchi l'avambraccio.", "In rack il gomito è vicino alle costole e il polso è neutro."],
    fault: "Impatto secco della ghisa sull'avambraccio, o polso piegato all'indietro.",
    speak: "Gomito basso" },
  { id: "press", title: "Military Press", sub: "Spinta verticale da fermo",
    explain: "Spinta sopra la testa senza usare le gambe. Glutei e addome fanno da base, la schiena non si inarca per compensare.",
    cues: ["Parti da fermo, senza slancio.", "Glutei contratti e costole basse mentre il braccio sale.", "In alto polso, gomito e spalla sono sulla stessa linea."],
    fault: "Inarcare la schiena all'indietro perché manca mobilità di torace o forza di spalla.",
    speak: "Costole basse" }
];

function kqKbPose(id, t) {
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const mix = (A, B, u) => { const o = {}; for (const k in A) o[k] = lerp(A[k], B[k], u); return o; };
  const ease = u => (1 - Math.cos(Math.min(1, Math.max(0, u)) * Math.PI)) / 2;
  if (id === "swing") {
    const down = { head: [118, 48], sh: [112, 70], hip: [78, 118], knee: [96, 150], an: [90, 186], wr: [64, 156], bell: [52, 168] };
    const top = { head: [150, 40], sh: [138, 64], hip: [136, 112], knee: [138, 152], an: [134, 188], wr: [196, 72], bell: [214, 78] };
    const u = (1 - Math.cos(t * Math.PI * 2)) / 2;
    return { pose: mix(down, top, u), phase: u < 0.5 ? "Cerniera" : "Plank verticale" };
  }
  if (id === "tgu") {
    const P = [
      { head: [70, 70], sh: [86, 78], hip: [120, 96], knee: [150, 110], an: [180, 120], wr: [86, 28], bell: [86, 16] },
      { head: [78, 78], sh: [96, 92], hip: [130, 100], knee: [160, 108], an: [188, 124], wr: [96, 30], bell: [96, 16] },
      { head: [120, 70], sh: [120, 96], hip: [120, 130], knee: [150, 150], an: [180, 170], wr: [120, 28], bell: [120, 14] },
      { head: [140, 36], sh: [140, 62], hip: [140, 112], knee: [148, 150], an: [146, 186], wr: [140, 22], bell: [140, 10] }
    ];
    const seg = t * (P.length - 1), i = Math.min(P.length - 2, Math.floor(seg)), u = ease(seg - i);
    const names = ["Supino, braccio su", "Sul gomito", "Mezzo ginocchio", "In piedi"];
    return { pose: mix(P[i], P[i + 1], u), phase: names[u > 0.65 ? i + 1 : i] };
  }
  if (id === "clean") {
    const low = { head: [150, 46], sh: [140, 68], hip: [100, 120], knee: [118, 152], an: [112, 188], wr: [78, 170], bell: [70, 182] };
    const rack = { head: [156, 42], sh: [146, 66], hip: [142, 114], knee: [146, 154], an: [142, 188], wr: [120, 86], bell: [108, 96] };
    const u = ease((1 - Math.cos(t * Math.PI * 2)) / 2);
    return { pose: mix(low, rack, u), phase: u < 0.55 ? "Stacco stretto" : "Rack" };
  }
  const rack = { head: [150, 42], sh: [140, 66], hip: [140, 114], knee: [144, 154], an: [140, 188], wr: [118, 84], bell: [108, 96] };
  const up = { head: [150, 40], sh: [140, 64], hip: [140, 114], knee: [144, 154], an: [140, 188], wr: [140, 28], bell: [140, 16] };
  const u = ease((1 - Math.cos(t * Math.PI * 2)) / 2);
  return { pose: mix(rack, up, u), phase: u < 0.5 ? "Dal rack" : "Lockout" };
}
function kqDrawKb(cv, id, t) {
  const ctx = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0d1a26"; ctx.fillRect(0, 0, w, h);
  const frame = kqKbPose(id || "swing", t);
  const pose = frame && frame.pose;
  if (!pose || !pose.head || !pose.sh) return;
  const phase = frame.phase || "";
  const X = p => p[0] / 240 * w, Y = p => p[1] / 200 * h;
  const line = (a, b) => { if (!pose[a] || !pose[b]) return; ctx.beginPath(); ctx.moveTo(X(pose[a]), Y(pose[a])); ctx.lineTo(X(pose[b]), Y(pose[b])); ctx.stroke(); };
  ctx.lineCap = "round"; ctx.lineWidth = Math.max(4, w / 70); ctx.strokeStyle = "#05f3fa";
  line("head", "sh"); line("sh", "hip"); line("hip", "knee"); line("knee", "an"); line("sh", "wr");
  ctx.fillStyle = "#eef3ff";
  ctx.beginPath(); ctx.arc(X(pose.head), Y(pose.head), Math.max(7, w / 42), 0, 7); ctx.fill();
  const bx = X(pose.bell), by = Y(pose.bell);
  ctx.fillStyle = "#3ef07b"; ctx.beginPath(); ctx.arc(bx, by, Math.max(8, w / 36), 0, 7); ctx.fill();
  ctx.strokeStyle = "#eef3ff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by - Math.max(6, w / 48), Math.max(6, w / 46), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = "#93a3c2"; ctx.font = `${Math.max(12, w / 28)}px system-ui,sans-serif`;
  ctx.fillText(phase, 10, h - 12);
  ctx.fillStyle = "#05f3fa"; ctx.font = `${Math.max(10, w / 34)}px system-ui,sans-serif`;
  ctx.fillText("Schema didattico", 10, 18);
}
function kqStartKbAnim() {
  cancelAnimationFrame(KQ.kbRAF);
  const cvs = $$("canvas.kb-cv");
  if (!cvs.length || (TAB !== "tecnica" && TAB !== "drill")) return;
  const t0 = performance.now();
  const loop = now => {
    const t = ((now - t0) / 1000 % 3.2) / 3.2;
    cvs.forEach(cv => kqDrawKb(cv, cv.dataset.ex, t));
    KQ.kbRAF = requestAnimationFrame(loop);
  };
  KQ.kbRAF = requestAnimationFrame(loop);
}
function kqStopAnims() { if (typeof KQM !== "undefined") KQM.fit = null; cancelAnimationFrame(KQ.kbRAF); KQ.kbRAF = 0; if (KQ.studio && KQ.studio.anim) { cancelAnimationFrame(KQ.studio.anim); KQ.studio.anim = 0; } }

function kqRenderTecnica() {
  const v = $("#view-tecnica");
  const id = S.sport || "tennis";
  const b = SPORT_BIO[id] || SPORT_BIO.tennis;
  const zones = b.zones.map(z => GROUP_LABELS[z] || z).join(", ");
  v.innerHTML = `${kqSpecBanner(analyze(S.sessions, S.draftPains))}
    <div class="card"><div class="row between"><h2 class="h-ic">${sportIcon(id, 24)}${esc(SPORTS[id])}</h2><span class="pill acc">Tecnica</span></div>
      <p class="small mut">Finestre di riferimento usate in campo. Non sono una misura del tuo gesto e non sono una diagnosi.</p>
      <ul class="list">${b.angles.map(([k, val]) => `<li><div class="grow"><div class="t">${esc(k)}</div><div class="s">${esc(val)}</div></div></li>`).join("")}</ul>
      <div class="alert yellow"><span>ℹ️</span><div>${esc(b.alert)}</div></div>
      <p class="small">Zone da tenere d'occhio sulla mappa: <b>${esc(zones)}</b></p>
      <div class="btns"><button type="button" class="btn sm" id="tec-body">Apri la mappa</button>
        <button type="button" class="btn sm" id="tec-st">Studio scheletro</button>
        <button type="button" class="btn sm ghost" id="tec-dr">Drill</button></div></div>
    ${kqLongevityBlock(id)}
    ${id === "kettlebell" ? kqKbLibraryHTML() : ""}
    ${DISCLAIMER}`;
  kqBindSpec(v); kqBindLongevity(v);
  $("#tec-body", v).onclick = () => go("corpo");
  $("#tec-st", v).onclick = () => kqOpenStudio(b.preset);
  $("#tec-dr", v).onclick = () => { S.drillSport = id; save(); go("drill"); };
  if (id === "kettlebell") kqBindKb(v);
}
function kqKbLibraryHTML() {
  return `<div class="card"><h2>Libreria Kettlebell</h2>
    <p class="small mut">I quattro fondamentali, con uno schema animato del gesto corretto. Non è un video reale: quando avrai le tue clip, caricale nello spazio sotto ogni scheda. Restano su questo telefono, solo per la sessione, e non partono verso nessun server.</p>
    ${KB_LIB.map(ex => `<article class="kb" id="kb-${ex.id}">
      <h3 style="margin-bottom:2px">${esc(ex.title)}</h3><p class="small mut" style="margin:0 0 8px">${esc(ex.sub)}</p>
      <canvas class="kb-cv" data-ex="${ex.id}" width="640" height="400" aria-label="Schema animato: ${esc(ex.title)}"></canvas>
      <p class="small">${esc(ex.explain)}</p>
      <h4>Checklist biomeccanica</h4><ol class="small">${ex.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ol>
      <div class="alert red"><span>⚠️</span><div><b>Errore critico.</b> ${esc(ex.fault)}</div></div>
      <div class="kb-slot"><p class="small mut" style="margin:0 0 8px"><b>Spazio video.</b> Qui potrai mettere il tuo filmato. Oggi lo schema animato mostra il gesto corretto; nessun link esterno.</p>
        <label class="btn sm">Carica un video<input type="file" accept="video/*" data-kbvid="${ex.id}" hidden></label>
        <video playsinline controls hidden></video></div>
      <div class="btns" style="margin-top:8px"><button type="button" class="btn sm" data-kbst="${ex.id}">Vedi l'errore nello Studio</button>
        <button type="button" class="btn sm ghost" data-kbgo="${ex.id}">Registra il tuo gesto</button></div>
    </article>`).join("")}</div>`;
}
function kqBindKb(root) {
  $$("[data-kbvid]", root).forEach(inp => inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const id = inp.dataset.kbvid;
    if (KQ.kbUrl[id]) URL.revokeObjectURL(KQ.kbUrl[id]);
    KQ.kbUrl[id] = URL.createObjectURL(f);
    const vid = inp.closest(".kb-slot").querySelector("video");
    vid.hidden = false; vid.src = KQ.kbUrl[id];
    toast("Video caricato solo su questo telefono");
  });
  const shot = { swing: "swing", tgu: "tgu", clean: "clean", press: "press" };
  $$("[data-kbst]", root).forEach(b => b.onclick = () => kqOpenStudio(b.dataset.kbst === "swing" ? "kb_hyper" : "kb_hyper"));
  $$("[data-kbgo]", root).forEach(b => b.onclick = () => {
    VS.sport = "kettlebell"; VS.shot = shot[b.dataset.kbgo] || "swing"; go("video");
  });
}

/* ---------- studio scheletro ---------- */
const STUDIO = [
  { id: "kb_hyper", sport: "Kettlebell", title: "Iperestensione in chiusura di swing",
    note: "Preset dimostrativo: figure disegnate per la lezione, non ricavate da un video reale.",
    phrase: "Glutei contratti", force: "Forza di taglio su L5-S1 (schema)",
    nodes: [
      { id: "head", x: 78, y: 40, tx: 98, ty: 38 },
      { id: "shoulder", x: 96, y: 68, tx: 98, ty: 68, drag: true },
      { id: "elbow", x: 132, y: 78, tx: 150, ty: 74, drag: true },
      { id: "wrist", x: 168, y: 86, tx: 188, ty: 80 },
      { id: "lumbar", x: 108, y: 108, tx: 99, ty: 104, drag: true },
      { id: "hip", x: 120, y: 145, tx: 100, ty: 142, drag: true },
      { id: "knee", x: 112, y: 198, tx: 102, ty: 196, drag: true },
      { id: "ankle", x: 100, y: 252, tx: 100, ty: 252 }
    ],
    bones: [["head", "shoulder"], ["shoulder", "elbow"], ["elbow", "wrist"], ["shoulder", "lumbar"], ["lumbar", "hip"], ["hip", "knee"], ["knee", "ankle"]],
    metric(n) {
      const ext = Math.atan2(n.hip.x - n.shoulder.x, n.hip.y - n.shoulder.y) * 180 / Math.PI;
      const zone = ext > 15 ? "red" : ext > 8 ? "amber" : "green";
      return { zone, text: `Iperestensione schematica ${ext.toFixed(0)}°`, sub: "Finestra verde: circa 0°–8°. Il numero è del disegno, non del tuo corpo." };
    },
    arrow(n, m) { if (m.zone === "green") return null; const len = 22 + Math.min(40, Math.abs(n.hip.x - n.shoulder.x)); return [n.lumbar.x, n.lumbar.y, n.lumbar.x - len, n.lumbar.y - 8]; } },
  { id: "golf_early", sport: "Golf", title: "Early extension, perdita dello spine angle",
    note: "Preset dimostrativo: il bacino «sbagliato» è verso la palla e il busto si è alzato.",
    phrase: "Bacino indietro", force: "Il bacino scivola verso la palla (schema)",
    nodes: [
      { id: "head", x: 140, y: 46, tx: 164, ty: 58 },
      { id: "shoulder", x: 136, y: 72, tx: 150, ty: 86, drag: true },
      { id: "elbow", x: 154, y: 102, tx: 172, ty: 112, drag: true },
      { id: "wrist", x: 166, y: 132, tx: 190, ty: 140 },
      { id: "lumbar", x: 130, y: 118, tx: 112, ty: 122, drag: true },
      { id: "hip", x: 128, y: 158, tx: 78, ty: 162, drag: true },
      { id: "knee", x: 120, y: 206, tx: 100, ty: 204, drag: true },
      { id: "ankle", x: 108, y: 256, tx: 108, ty: 256 }
    ],
    bones: [["head", "shoulder"], ["shoulder", "elbow"], ["elbow", "wrist"], ["shoulder", "lumbar"], ["lumbar", "hip"], ["hip", "knee"], ["knee", "ankle"]],
    metric(n) {
      const lean = Math.atan2(Math.abs(n.shoulder.x - n.hip.x), n.hip.y - n.shoulder.y) * 180 / Math.PI;
      const zone = lean < 20 || lean > 55 ? "red" : lean < 32 || lean > 48 ? "amber" : "green";
      return { zone, text: `Spine angle schematico ${lean.toFixed(0)}°`, sub: "Finestra verde di questo preset: 32°–48°. È un disegno, non il tuo swing." };
    },
    arrow(n, m) { if (m.zone === "green") return null; return [n.hip.x, n.hip.y, n.hip.x + 42, n.hip.y - 6]; } },
  { id: "elbow_low", sport: "Tennis / Padel", title: "Gomito basso e arretrato",
    note: "Preset dimostrativo dell'impatto con il gomito sotto e dietro la spalla.",
    phrase: "Gomito alto", force: "Carico sul gomito (schema)",
    nodes: [
      { id: "head", x: 78, y: 52, tx: 102, ty: 56 },
      { id: "shoulder", x: 84, y: 88, tx: 84, ty: 88, drag: true },
      { id: "elbow", x: 62, y: 140, tx: 132, ty: 76, drag: true },
      { id: "wrist", x: 48, y: 178, tx: 170, ty: 96, drag: true },
      { id: "lumbar", x: 88, y: 122, tx: 90, ty: 120 },
      { id: "hip", x: 92, y: 156, tx: 92, ty: 156 },
      { id: "knee", x: 100, y: 206, tx: 100, ty: 206, drag: true },
      { id: "ankle", x: 96, y: 256, tx: 96, ty: 256 }
    ],
    bones: [["head", "shoulder"], ["shoulder", "elbow"], ["elbow", "wrist"], ["shoulder", "lumbar"], ["lumbar", "hip"], ["hip", "knee"], ["knee", "ankle"]],
    metric(n) {
      const arm = Math.atan2(n.elbow.y - n.shoulder.y, n.elbow.x - n.shoulder.x) * 180 / Math.PI;
      const front = n.elbow.x > n.shoulder.x + 6;
      const zone = arm <= 15 && arm >= -25 && front ? "green" : arm <= 40 && front ? "amber" : "red";
      return { zone, text: `Braccio rispetto all'orizzontale ${arm.toFixed(0)}°`, sub: "Verde: gomito avanti e all'altezza della spalla (circa −25° / +15°). Disegno, non un tuo fotogramma." };
    },
    arrow(n, m) { if (m.zone === "green") return null; return [n.elbow.x, n.elbow.y, n.elbow.x, n.elbow.y + 46]; } },
  { id: "ski_valgus", sport: "Sci", title: "Valgismo del ginocchio",
    note: "Preset dimostrativo: vista frontale, ginocchio destro che cede verso l'interno.",
    phrase: "Ginocchio allineato", force: "Stress sul crociato (schema)",
    nodes: [
      { id: "head", x: 100, y: 32, tx: 100, ty: 32 },
      { id: "shL", x: 68, y: 68, tx: 68, ty: 68 },
      { id: "shR", x: 132, y: 68, tx: 132, ty: 68 },
      { id: "hipL", x: 78, y: 128, tx: 78, ty: 128 },
      { id: "hipR", x: 122, y: 128, tx: 122, ty: 128, drag: true },
      { id: "kneeL", x: 76, y: 190, tx: 76, ty: 190 },
      { id: "ankleL", x: 74, y: 252, tx: 74, ty: 252 },
      { id: "kneeR", x: 108, y: 190, tx: 126, ty: 190, drag: true },
      { id: "ankleR", x: 128, y: 252, tx: 128, ty: 252 }
    ],
    bones: [["head", "shL"], ["head", "shR"], ["shL", "shR"], ["shL", "hipL"], ["shR", "hipR"], ["hipL", "hipR"], ["hipL", "kneeL"], ["kneeL", "ankleL"], ["hipR", "kneeR"], ["kneeR", "ankleR"]],
    metric(n) {
      const hip = n.hipR, knee = n.kneeR, ankle = n.ankleR;
      const t = (knee.y - hip.y) / ((ankle.y - hip.y) || 1);
      const lineX = hip.x + (ankle.x - hip.x) * t;
      const inward = lineX - knee.x;
      const thigh = Math.hypot(knee.x - hip.x, knee.y - hip.y) || 1;
      const deg = Math.atan2(Math.max(0, inward), thigh) * 180 / Math.PI;
      const zone = deg > 12 ? "red" : deg > 8 ? "amber" : "green";
      return { zone, text: `Valgismo schematico ${deg.toFixed(0)}°`, sub: "Finestra verde: sotto gli 8°. È la deviazione del disegno, non un test clinico." };
    },
    arrow(n, m) { if (m.zone === "green") return null; return [n.kneeR.x, n.kneeR.y, n.kneeR.x - 36, n.kneeR.y]; } }
];
function kqPreset(id) { return STUDIO.find(p => p.id === id) || STUDIO[0]; }
function kqOpenStudio(id) { KQ.studio = null; KQ.wantPreset = id; go("studio"); }
function kqEnsureStudio() {
  const id = (KQ.studio && KQ.studio.id) || KQ.wantPreset || (SPORT_BIO[S.sport] || {}).preset || "kb_hyper";
  if (!KQ.studio || KQ.studio.id !== id) {
    const p = kqPreset(id);
    const nodes = {}; p.nodes.forEach(n => nodes[n.id] = { x: n.x, y: n.y });
    KQ.studio = { id: p.id, nodes, morph: 0, zonePrev: null, anim: 0 };
  }
  KQ.wantPreset = null;
  return KQ.studio;
}
function kqDisplayed() {
  const st = KQ.studio, p = kqPreset(st.id), t = st.morph, o = {};
  p.nodes.forEach(n => { const c = st.nodes[n.id]; o[n.id] = { x: c.x + (n.tx - c.x) * t, y: c.y + (n.ty - c.y) * t }; });
  return o;
}
function kqVibe(pat) {
  const fb = S.fb || {}; if (!fb.vibe || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(pat); } catch (e) { }
}
function kqTone() {
  const fb = S.fb || {}; if (!fb.tone) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    AC = AC || new Ctx(); if (AC.resume) AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
    o.frequency.setValueAtTime(440, t0); o.frequency.linearRampToValueAtTime(880, t0 + 0.08);
    g.gain.setValueAtTime(0.12, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.21);
  } catch (e) { }
}
function kqSpeak(text) {
  const fb = S.fb || {}; if (!fb.voice || !text || !window.speechSynthesis || typeof SpeechSynthesisUtterance !== "function") return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = "it-IT"; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch (e) { }
}
function kqFeedback(zone, phrase) {
  const st = KQ.studio; if (!st) return;
  const prev = st.zonePrev;
  if (prev === zone) return;
  st.zonePrev = zone;
  if (prev == null) { if (zone === "red") kqVibe([80, 50, 80]); return; }
  if (zone === "red") kqVibe([80, 50, 80]);
  if (zone === "green") { kqVibe(40); kqTone(); kqSpeak(phrase); }
}
function kqStudioSync() {
  const st = KQ.studio; if (!st) return;
  const p = kqPreset(st.id), pose = kqDisplayed(), m = p.metric(pose);
  const ghost = {}; p.nodes.forEach(n => ghost[n.id] = { x: n.tx, y: n.ty });
  const setLine = (el, a, b) => { if (!el) return; el.setAttribute("x1", a.x); el.setAttribute("y1", a.y); el.setAttribute("x2", b.x); el.setAttribute("y2", b.y); };
  p.bones.forEach(([a, b], i) => {
    setLine($("#gb-" + i), ghost[a], ghost[b]);
    const ln = $("#bb-" + i); setLine(ln, pose[a], pose[b]); if (ln) ln.setAttribute("class", "bone " + m.zone);
  });
  p.nodes.forEach(n => {
    const g = $("#nd-" + n.id); if (!g) return;
    g.setAttribute("transform", `translate(${pose[n.id].x.toFixed(1)} ${pose[n.id].y.toFixed(1)})`);
    g.setAttribute("class", "nd" + (n.drag ? " drag" : "") + " " + m.zone + (st.sel === n.id ? " sel" : ""));
  });
  const ar = p.arrow(pose, m), fg = $("#st-force");
  if (fg) {
    if (!ar) fg.setAttribute("visibility", "hidden");
    else {
      fg.setAttribute("visibility", "visible");
      const [x1, y1, x2, y2] = ar;
      $("#st-fl").setAttribute("x1", x1); $("#st-fl").setAttribute("y1", y1); $("#st-fl").setAttribute("x2", x2); $("#st-fl").setAttribute("y2", y2);
      const h = arrowHead(x1, y1, x2, y2); $("#st-fh").setAttribute("points", h.pts);
      const lab = $("#st-flab"); lab.setAttribute("x", (x1 + x2) / 2); lab.setAttribute("y", (y1 + y2) / 2 - 6); lab.textContent = p.force;
    }
  }
  const box = $("#st-read"); if (box) box.innerHTML = `<b class="z-${m.zone === "amber" ? "yellow" : m.zone}">${esc(m.text)}</b><span class="small mut sub">${esc(m.sub)}</span>`;
  const sl = $("#st-morph"); if (sl && document.activeElement !== sl) sl.value = Math.round(st.morph * 100);
  kqFeedback(m.zone, p.phrase);
}
const KQ_NODE_LABEL = { head: "Testa", shoulder: "Spalla", elbow: "Gomito", wrist: "Polso", lumbar: "Lombare", hip: "Anca", knee: "Ginocchio", ankle: "Caviglia", hipR: "Anca dx", kneeR: "Ginocchio dx" };
function kqRenderStudio() {
  const v = $("#view-studio");
  const st = kqEnsureStudio();
  const p = kqPreset(st.id);
  const fb = S.fb || { vibe: true, voice: true, tone: true };
  const canV = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const canS = typeof window.speechSynthesis !== "undefined";
  const canT = !!(window.AudioContext || window.webkitAudioContext);
  const dragNodes = p.nodes.filter(n => n.drag);
  if (st.sel && !dragNodes.some(n => n.id === st.sel)) st.sel = null;
  v.innerHTML = `<div class="card tight"><h2>Studio correzione</h2>
    <p class="small mut">Trascina i nodi con l'anello, oppure scegli un nodo nel pannello in basso e trascina in un punto qualsiasi dello schema: il dito non copre il punto. Il colore segue l'angolo chiave: rosso, ambra, verde.</p>
    <div class="chips" id="st-pres">${STUDIO.map(x => `<button type="button" class="chip ${x.id === p.id ? "on" : ""}" data-pre="${x.id}">${esc(x.sport)}</button>`).join("")}</div>
    <p class="small" style="margin:8px 0 0"><b>${esc(p.title)}</b><br><span class="mut">${esc(p.note)}</span></p></div>
    <div class="boardwrap studio-wrap stick" id="st-wrap"><svg id="st-svg" viewBox="0 0 200 280" aria-label="Scheletro da correggere">
      <rect width="200" height="280" fill="#0d1a26"/>
      <g id="st-ghost">${p.bones.map((_, i) => `<line id="gb-${i}" class="bone ghost"/>`).join("")}</g>
      <g id="st-bones">${p.bones.map((_, i) => `<line id="bb-${i}" class="bone"/>`).join("")}</g>
      <g id="st-force" visibility="hidden"><line id="st-fl"/><polygon id="st-fh"/><text id="st-flab"></text></g>
      <g id="st-nodes">${p.nodes.map(n => `<g id="nd-${n.id}" class="nd ${n.drag ? "drag" : ""}" data-node="${n.id}"><circle r="${n.drag ? 11 : 5}"/></g>`).join("")}</g>
    </svg></div>
    ${kqDockHTML("st-dock", `<div id="st-read" class="dock-read"></div>
        <div class="dock-row"><label class="dock-lbl" for="st-morph">Ghost <b id="st-mv">${Math.round(st.morph * 100)}%</b></label>
        <input type="range" id="st-morph" min="0" max="100" value="${Math.round(st.morph * 100)}" aria-label="Morphing verso il riferimento">
        <button type="button" class="btn pri sm" id="st-anim">Anima correzione</button></div>`,
      `<h4 class="dock-t">Nodo da muovere</h4>
        <div class="chips" id="st-sel">${dragNodes.map(n => `<button type="button" class="chip ${st.sel === n.id ? "on" : ""}" data-sel="${n.id}">${esc(KQ_NODE_LABEL[n.id] || n.id)}</button>`).join("")}</div>
        <button type="button" class="btn ghost block" id="st-reset" style="margin-top:10px">Torna al preset</button>
        <h4 class="dock-t">Feedback</h4>
        <label class="check"><input type="checkbox" id="fb-vibe" ${fb.vibe ? "checked" : ""} ${canV ? "" : "disabled"}> Vibrazione ${canV ? "" : "(non disponibile su questo dispositivo)"}</label>
        <label class="check"><input type="checkbox" id="fb-tone" ${fb.tone ? "checked" : ""} ${canT ? "" : "disabled"}> Tono 440 → 880 Hz ${canT ? "" : "(audio non disponibile)"}</label>
        <label class="check"><input type="checkbox" id="fb-voice" ${fb.voice ? "checked" : ""} ${canS ? "" : "disabled"}> Voce breve ${canS ? "" : "(sintesi vocale non disponibile)"}</label>
        <p class="small mut">In zona rossa: doppio impulso. Quando entri nel verde: un impulso breve, un tono e, se attiva, una frase. Se il telefono non supporta vibrazione o voce, restano il colore e i gradi.</p>${DISCLAIMER}`)}`;
  $$("[data-pre]", v).forEach(b => b.onclick = () => { KQ.studio = null; KQ.wantPreset = b.dataset.pre; kqRenderStudio(); });
  const dock = $("#st-dock", v), svg = $("#st-svg", v);
  const fit = () => kqFitBox(svg, dock, [200 / 280], { x: 16, y: 18 });
  KQM.fit = fit;
  kqDockBind(dock, () => fit());
  fit();
  const sl = $("#st-morph", v);
  sl.oninput = () => { st.morph = +sl.value / 100; $("#st-mv").textContent = sl.value + "%"; kqStudioSync(); };
  $("#st-anim", v).onclick = () => {
    if (st.anim) cancelAnimationFrame(st.anim);
    if (st.morph > 0.98) st.morph = 0;
    const from = st.morph, t0 = performance.now();
    const frame = now => {
      const k = Math.min(1, (now - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
      st.morph = from + (1 - from) * e;
      const lab = $("#st-mv"); if (lab) lab.textContent = Math.round(st.morph * 100) + "%";
      kqStudioSync();
      if (k < 1 && TAB === "studio") st.anim = requestAnimationFrame(frame);
    };
    st.anim = requestAnimationFrame(frame);
  };
  $("#st-reset", v).onclick = () => { KQ.studio = null; KQ.wantPreset = p.id; kqRenderStudio(); };
  const setFb = (key, el) => { el.onchange = () => { S.fb = Object.assign({ vibe: true, voice: true, tone: true }, S.fb); S.fb[key] = el.checked; save(); }; };
  setFb("vibe", $("#fb-vibe", v)); setFb("tone", $("#fb-tone", v)); setFb("voice", $("#fb-voice", v));
  const paintSel = () => { $$("#st-sel [data-sel]", v).forEach(b => b.classList.toggle("on", b.dataset.sel === st.sel)); kqStudioSync(); };
  $$("#st-sel [data-sel]", v).forEach(b => b.onclick = () => { st.sel = st.sel === b.dataset.sel ? null : b.dataset.sel; paintSel(); });
  let drag = null;
  const toSvg = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.addEventListener("pointerdown", e => {
    const g = e.target.closest("[data-node]");
    let nd = g && p.nodes.find(n => n.id === g.dataset.node);
    if (nd && !nd.drag) nd = null;
    if (!nd && st.sel) nd = p.nodes.find(n => n.id === st.sel);
    if (!nd) return;
    if (st.morph > 0.001) {
      const pose = kqDisplayed();
      p.nodes.forEach(n => { st.nodes[n.id] = { x: pose[n.id].x, y: pose[n.id].y }; });
      st.morph = 0; const m = $("#st-morph"); if (m) m.value = 0; const lab = $("#st-mv"); if (lab) lab.textContent = "0%";
    }
    const q = toSvg(e), cur = st.nodes[nd.id];
    drag = { id: nd.id, dx: cur.x - q.x, dy: cur.y - q.y };
    if (st.sel !== nd.id) { st.sel = nd.id; paintSel(); }
    try { svg.setPointerCapture(e.pointerId); } catch (err) { }
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    const q = toSvg(e);
    st.nodes[drag.id] = { x: Math.max(8, Math.min(192, q.x + drag.dx)), y: Math.max(8, Math.min(272, q.y + drag.dy)) };
    kqStudioSync();
  });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  kqStudioSync();
}

/* ---------- lavagne dedicate ---------- */
function kqBoardSports() { return ["padel", "tennis", "pickleball", "golf", "sci", "kettlebell"]; }
function kqBoardBar(sport) {
  return `<div class="seg full scrollseg" id="bs">${kqBoardSports().map(id => `<button type="button" class="${id === sport ? "on" : ""}" data-s="${id}">${esc(SPORTS[id])}</button>`).join("")}</div>`;
}
function kqBindBoardBar(v) {
  $$("#bs button", v).forEach(x => x.onclick = () => { S.boardSport = x.dataset.s; save(); renderBoard(); });
}
function kqTac(sport) {
  if (!S.boards[sport] || !S.boards[sport].tac) S.boards[sport] = { tac: true, tool: sport === "kettlebell" ? "swing" : sport === "golf" ? "draw" : "draw", shots: [], pts: [], bell: { x: 0.28, y: 0.82 } };
  return S.boards[sport];
}
function kqRenderTactical(v, sport) {
  const b = kqTac(sport);
  if (sport === "golf") kqGolfHTML(v, b);
  else if (sport === "sci") kqSkiHTML(v, b);
  else kqBellHTML(v, b);
  kqBindBoardBar(v);
}
const KQ_LOADED = {};
function kqLoadScript(src) {
  return KQ_LOADED[src] || (KQ_LOADED[src] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete KQ_LOADED[src]; rej(new Error("load")); };
    document.head.appendChild(s);
  }));
}
function kqGolfModeBar(b) {
  return `<div class="seg full" id="g-mode" style="margin-top:8px">${[["schema", "Schematica"], ["map", "Mappa reale"]].map(([id, l]) => `<button type="button" class="${(b.mode || "schema") === id ? "on" : ""}" data-mode="${id}">${l}</button>`).join("")}</div>`;
}
function kqGolfHTML(v, b) {
  const note = b.notice; delete b.notice;
  if (b.mode === "map") { kqGolfMapHTML(v, b); return; }
  const tools = [["draw", "Draw"], ["fade", "Fade"], ["lay", "Lay-up"], ["push", "Push"], ["slice", "Slice"]];
  if (!tools.some(t => t[0] === b.tool)) b.tool = "draw";
  v.innerHTML = `<div class="card tight">${kqBoardBar("golf")}${kqGolfModeBar(b)}
    ${note ? `<p class="og-msg" role="status" style="margin:8px 0 0">${esc(note)}</p>` : ""}
    <p class="small mut" style="margin:8px 0">Fairway schematico. Scegli la forma e trascina dal basso verso la buca. È una lavagna, non la traiettoria di un colpo reale.</p>
    <div class="toolbar">${tools.map(([id, l]) => `<button type="button" class="chip ${b.tool === id ? "on" : ""}" data-tool="${id}">${l}</button>`).join("")}
      <button type="button" class="chip" id="g-demo">Esempio draw/fade</button><button type="button" class="chip" id="g-clr">Pulisci</button></div></div>
    <div class="boardwrap">${kqGolfSVG(b)}</div>
    <p class="legendrow small mut"><span>Draw: curva a sinistra</span><span>Fade: curva a destra</span><span>Lay-up: colpo di sicurezza</span><span>Push e slice: traiettorie aperte</span></p>`;
  $$("[data-tool]", v).forEach(x => x.onclick = () => { b.tool = x.dataset.tool; save(); renderBoard(); });
  $("#g-clr", v).onclick = () => { b.shots = []; save(); renderBoard(); };
  $("#g-demo", v).onclick = () => {
    b.shots = [{ t: "draw", x1: .62, y1: .9, x2: .42, y2: .12, demo: true }, { t: "fade", x1: .4, y1: .9, x2: .58, y2: .12, demo: true }];
    save(); renderBoard(); toast("Traiettorie dimostrative, non un colpo reale");
  };
  kqBindGolf($("#board", v), b);
  kqBindGolfMode(v, b);
  kqBoardExtras(v, b);
}
function kqBindGolfMode(v, b) {
  $$("#g-mode [data-mode]", v).forEach(x => x.onclick = () => { b.mode = x.dataset.mode; save(); renderBoard(); });
}
function kqGolfMapHTML(v, b) {
  v.innerHTML = `<div class="card tight">${kqBoardBar("golf")}${kqGolfModeBar(b)}</div><div id="og-host"><div class="card og-card"><div class="og-load"><span class="spin" aria-hidden="true"></span><div class="small mut">Carico il modulo mappe…</div></div></div></div>`;
  kqBindGolfMode(v, b);
  const host = $("#og-host", v);
  kqLoadScript("golf-osm.js").then(() => {
    if (!document.body.contains(host)) return;
    KQGolfOSM.mount(host, b, { view: v, noHoles: msg => { b.notice = msg; b.mode = "schema"; save(); renderBoard(); } });
  }).catch(() => {
    host.innerHTML = `<div class="card og-card"><p class="og-msg err" role="alert">Non riesco a caricare il modulo mappe (serve connessione la prima volta).</p><div class="btns"><button type="button" class="btn" id="og-rl">Riprova</button><button type="button" class="btn ghost" id="og-sc">Lavagna schematica</button></div></div>`;
    $("#og-rl", host).onclick = () => kqGolfMapHTML(v, b);
    $("#og-sc", host).onclick = () => { b.mode = "schema"; save(); renderBoard(); };
  });
}
function kqShotPath(s) {
  const X = v => v * 200, Y = v => v * 340;
  const x1 = X(s.x1), y1 = Y(s.y1), x2 = X(s.x2), y2 = Y(s.y2), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const bend = (s.t === "draw" ? -32 : s.t === "fade" ? 28 : s.t === "slice" ? 44 : s.t === "lay" ? 6 : 16);
  return `M ${x1} ${y1} Q ${mx + bend} ${my} ${x2} ${y2}`;
}
function kqGolfSVG(b) {
  const shots = (b.shots || []).map(s => `<path class="shot ${s.t}" d="${kqShotPath(s)}"/>`).join("");
  return `<svg id="board" viewBox="0 0 200 340" preserveAspectRatio="xMidYMid meet">
    <rect width="200" height="340" fill="#0d1a26"/>
    <path d="M70 20 C60 80 58 160 64 250 C68 300 80 330 100 336 C120 330 132 300 136 250 C142 160 140 80 130 20 Z" fill="#14532d"/>
    <ellipse cx="100" cy="48" rx="28" ry="18" fill="#166534"/>
    <circle cx="100" cy="46" r="3.5" fill="#0b1220"/><circle cx="100" cy="44" r="1.4" fill="#eef3ff"/>
    <ellipse cx="58" cy="200" rx="16" ry="10" fill="#c4b48a" opacity=".85"/>
    <ellipse cx="146" cy="150" rx="14" ry="9" fill="#c4b48a" opacity=".85"/>
    ${shots}<path id="gdraft" class="shot draft" d="" visibility="hidden"/>
    <text x="100" y="332" text-anchor="middle" fill="#93a3c2" font-size="9">TEE</text>
    <text x="100" y="16" text-anchor="middle" fill="#93a3c2" font-size="8">BUCA</text></svg>`;
}
function kqBindGolf(svg, b) {
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.max(0, Math.min(1, q.x / 200)), y: Math.max(0, Math.min(1, q.y / 340)) }; };
  let drag = null;
  svg.addEventListener("pointerdown", e => { drag = { a: pt(e), b: null }; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
  svg.addEventListener("pointermove", e => {
    if (!drag) return; drag.b = pt(e);
    const d = $("#gdraft"); d.setAttribute("d", kqShotPath({ t: b.tool, x1: drag.a.x, y1: drag.a.y, x2: drag.b.x, y2: drag.b.y })); d.setAttribute("class", "shot draft " + b.tool); d.setAttribute("visibility", "visible");
  });
  const end = () => {
    if (!drag || !drag.b) { drag = null; return; }
    if (Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) > 0.05) b.shots.push({ t: b.tool, x1: drag.a.x, y1: drag.a.y, x2: drag.b.x, y2: drag.b.y });
    drag = null; save(); renderBoard();
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", () => { drag = null; });
}
/* ---------- Lavagna Sci: tracciato con pali, linea ideale e linea in ritardo (geometria schematica, nessun dato esterno) ---------- */
const SKI_W = 200, SKI_H = 340;
const SKI_KINDS = { sl: "Slalom Speciale", gs: "Gigante" };
/* Ogni preset: punti della linea di massima pendenza (coordinate normalizzate u,v sul viewBox 200×340) e contorno di sfondo */
const SKI_PRESETS = {
  dritto: { label: "Pendio Dritto", fall: [[.5, .05], [.5, .5], [.5, .93]], bands: [[0, 1, 30]] },
  diagonale: { label: "Pendenza Diagonale con Contropendenza", fall: [[.26, .05], [.42, .2], [.62, .38], [.74, .52], [.68, .68], [.52, .82], [.4, .93]], bands: [[0, 1, 28]] },
  muro: { label: "Muro con Cambio di Pendenza", fall: [[.54, .05], [.5, .3], [.46, .5], [.44, .7], [.5, .93]], bands: [[0, .36, 30], [.36, .62, 9], [.62, 1, 30]] }
};
function kqSkiCurve(pts, per = 18) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) for (let t = 0; t < per; t++) {
    const u = t / per, u2 = u * u, u3 = u2 * u, f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]);
  }
  out.push(pts[pts.length - 1]);
  for (let i = 1; i < out.length; i++) if (out[i][1] < out[i - 1][1]) out[i][1] = out[i - 1][1];
  return out;
}
/* linea di massima pendenza: posizione u e tangente (verso valle) a quota v */
function kqSkiFall(id) {
  const pre = SKI_PRESETS[id] || SKI_PRESETS.dritto, line = kqSkiCurve(pre.fall);
  const at = v => {
    let i = 1; while (i < line.length - 1 && line[i][1] < v) i++;
    const a = line[i - 1], c = line[i], t = c[1] === a[1] ? 0 : Math.max(0, Math.min(1, (v - a[1]) / (c[1] - a[1])));
    const dx = (c[0] - a[0]) * SKI_W, dy = (c[1] - a[1]) * SKI_H, L = Math.hypot(dx, dy) || 1;
    return { u: a[0] + (c[0] - a[0]) * t, tx: dx / L, ty: dy / L };
  };
  return { line, at, pre };
}
const skiXY = p => [p[0] * SKI_W, p[1] * SKI_H];
function kqSki(b) {
  if (!b.ski) b.ski = { kind: "sl", preset: "dritto", gates: [], colorMode: "auto", tool: "gate", green: true, red: true };
  const k = b.ski;
  if (!Array.isArray(k.free)) k.free = (b.pts && b.pts.length > 1) ? [b.pts] : [];
  return k;
}
function kqSkiNextColor(k) { return k.colorMode === "red" ? "r" : k.colorMode === "blue" ? "b" : (k.gates.length % 2 ? "b" : "r"); }
/* calcola le due linee e i punti di cambio spigolo dai pali posati */
function kqSkiLines(k) {
  const F = kqSkiFall(k.preset), gs = k.kind === "gs", gates = [...k.gates].sort((a, b) => a.v - b.v);
  if (!gates.length) return { green: "", red: "", changes: [], F };
  const half = gs ? .05 : 0, inner = gs ? half * .45 : .028;
  const apex = (g, i, late) => {
    const fx = F.at(g.v).u; let s = Math.sign(g.u - fx); if (!s) s = i % 2 ? 1 : -1;
    return { s, p: late ? [g.u - s * inner * .4, g.v + .04] : [g.u - s * inner, g.v - .05] };
  };
  const build = late => {
    const A = gates.map((g, i) => apex(g, i, late));
    for (let i = 1; i < A.length; i++) if (A[i].p[1] < A[i - 1].p[1] + .025) A[i].p[1] = A[i - 1].p[1] + .025;
    const top = .045, bot = .955;
    return { A, pts: [[F.at(top).u, top], ...A.map(a => a.p), [F.at(bot).u, bot]] };
  };
  const g = build(false), r = build(true), f = n => n.toFixed(1);
  const tan = p => { const t = F.at(Math.min(.97, Math.max(.03, p[1]))); return [t.tx, t.ty]; };
  let gd = "", segs = [];
  g.pts.forEach((p, i) => {
    const P = skiXY(p);
    if (!i) { gd = `M${f(P[0])} ${f(P[1])}`; return; }
    const Q = skiXY(g.pts[i - 1]), h = .45 * Math.hypot(P[0] - Q[0], P[1] - Q[1]), t0 = tan(g.pts[i - 1]), t1 = tan(p);
    const c1 = [Q[0] + t0[0] * h, Q[1] + t0[1] * h], c2 = [P[0] - t1[0] * h, P[1] - t1[1] * h];
    gd += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(P[0])} ${f(P[1])}`;
    segs.push([Q, c1, c2, P]);
  });
  const changes = [];
  segs.forEach((sg, i) => {
    if (i === 0 || i === segs.length - 1) return;
    const bez = t => { const m = 1 - t; return [0, 1].map(d => m * m * m * sg[0][d] + 3 * m * m * t * sg[1][d] + 3 * m * t * t * sg[2][d] + t * t * t * sg[3][d]); };
    let prev = null;
    for (let n = 0; n <= 60; n++) {
      const P = bez(n / 60), side = P[0] - F.at(P[1] / SKI_H).u * SKI_W;
      if (prev != null && Math.sign(side) !== Math.sign(prev.side) && prev.side !== 0) {
        const dx = P[0] - prev.P[0], dy = P[1] - prev.P[1], L = Math.hypot(dx, dy) || 1;
        changes.push({ x: P[0], y: P[1], nx: -dy / L, ny: dx / L }); break;
      }
      prev = { P, side };
    }
  });
  let rd = "";
  r.pts.forEach((p, i) => {
    const P = skiXY(p);
    if (!i) { rd = `M${f(P[0])} ${f(P[1])}`; return; }
    const Q = skiXY(r.pts[i - 1]);
    if (i === r.pts.length - 1) { rd += ` L${f(P[0])} ${f(P[1])}`; return; }
    const N = skiXY(r.pts[i + 1]), l1 = Math.hypot(P[0] - Q[0], P[1] - Q[1]) || 1, l2 = Math.hypot(N[0] - P[0], N[1] - P[1]) || 1, tr = 9;
    const a = [P[0] - (P[0] - Q[0]) / l1 * Math.min(tr, l1 / 2), P[1] - (P[1] - Q[1]) / l1 * Math.min(tr, l1 / 2)];
    const c = [P[0] + (N[0] - P[0]) / l2 * Math.min(tr, l2 / 2), P[1] + (N[1] - P[1]) / l2 * Math.min(tr, l2 / 2)];
    rd += ` L${f(a[0])} ${f(a[1])} Q${f(P[0])} ${f(P[1])} ${f(c[0])} ${f(c[1])}`;
  });
  return { green: gd, red: rd, changes, F };
}
function kqSkiGateSVG(g, n, kind) {
  const [x, y] = skiXY([g.u, g.v]), col = g.c === "b" ? "#3b9dff" : "#ff4d4d", ol = "#0d1a26";
  if (kind === "gs") {
    const w = 10, t = 17;
    return `<g class="gate gate-${g.c}" data-gate="${n}"><path d="M${x - w} ${y}V${y - t}M${x + w} ${y}V${y - t}" stroke="${ol}" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M${x - w} ${y}V${y - t}M${x + w} ${y}V${y - t}" stroke="#e8eef6" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="${x - w}" y="${y - t}" width="${2 * w}" height="9" fill="${col}" stroke="${ol}" stroke-width=".8"/>
      <circle cx="${x - w}" cy="${y}" r="2.4" fill="${col}" stroke="${ol}" stroke-width=".8"/><circle cx="${x + w}" cy="${y}" r="2.4" fill="${col}" stroke="${ol}" stroke-width=".8"/>
      <text x="${x}" y="${y - t - 2.5}" class="gate-n">${n + 1}</text></g>`;
  }
  return `<g class="gate gate-${g.c}" data-gate="${n}"><path d="M${x} ${y}L${x + .8} ${y - 5}" stroke="${ol}" stroke-width="4.2" stroke-linecap="round"/><path d="M${x + .8} ${y - 5}L${x + 3.6} ${y - 19}" stroke="${ol}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M${x} ${y}L${x + .8} ${y - 5}" stroke="#e8eef6" stroke-width="2" stroke-dasharray="1.2 1" stroke-linecap="round"/><path d="M${x + .8} ${y - 5}L${x + 3.6} ${y - 19}" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y}" r="2.6" fill="${ol}" stroke="${col}" stroke-width="1.2"/><text x="${x + 6.5}" y="${y - 12}" class="gate-n">${n + 1}</text></g>`;
}
function kqSkiInner(b) {
  const k = kqSki(b), L = kqSkiLines(k), F = L.F, id = k.preset;
  const bg = id === "diagonale" ? `<linearGradient id="sk-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#32597d"/><stop offset="1" stop-color="#1b3550"/></linearGradient>`
    : id === "muro" ? `<linearGradient id="sk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#335a7e"/><stop offset=".34" stop-color="#2b4d6f"/><stop offset=".4" stop-color="#173149"/><stop offset=".6" stop-color="#14293f"/><stop offset=".66" stop-color="#2a4c6d"/><stop offset="1" stop-color="#335a7e"/></linearGradient>`
    : `<linearGradient id="sk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d4f72"/><stop offset="1" stop-color="#1d3a58"/></linearGradient>`;
  let contours = "";
  F.pre.bands.forEach(([v0, v1, sp]) => {
    for (let y = Math.max(20, v0 * SKI_H + sp / 2); y < Math.min(300, v1 * SKI_H); y += sp) {
      const t = F.at(y / SKI_H), cx = t.u * SKI_W, nx = -t.ty, ny = t.tx;
      contours += `<line x1="${(cx - nx * 110).toFixed(1)}" y1="${(y - ny * 110).toFixed(1)}" x2="${(cx + nx * 110).toFixed(1)}" y2="${(y + ny * 110).toFixed(1)}"/>`;
    }
  });
  const fall = F.line.map((p, i) => `${i ? "L" : "M"}${(p[0] * SKI_W).toFixed(1)} ${(p[1] * SKI_H).toFixed(1)}`).join(" ");
  const chev = [.14, .3, .46, .62, .78, .9].map(v => { const t = F.at(v), x = t.u * SKI_W, y = v * SKI_H, nx = -t.ty, ny = t.tx;
    return `<path d="M${(x - nx * 4 - t.tx * 4).toFixed(1)} ${(y - ny * 4 - t.ty * 4).toFixed(1)}L${(x + t.tx * 3).toFixed(1)} ${(y + t.ty * 3).toFixed(1)}L${(x + nx * 4 - t.tx * 4).toFixed(1)} ${(y + ny * 4 - t.ty * 4).toFixed(1)}"/>`; }).join("");
  const extra = id === "diagonale" ? `<polygon points="150,160 186,150 186,262 138,250" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3"/><text x="163" y="214" class="sk-note" text-anchor="middle">contro-</text><text x="163" y="223" class="sk-note" text-anchor="middle">pendenza</text>`
    : id === "muro" ? `<line x1="12" x2="188" y1="${.36 * SKI_H}" y2="${.36 * SKI_H}" class="sk-cut"/><line x1="12" x2="188" y1="${.62 * SKI_H}" y2="${.62 * SKI_H}" class="sk-cut"/><text x="16" y="${.36 * SKI_H - 3}" class="sk-note">cambio di pendenza</text><text x="16" y="${.62 * SKI_H + 9}" class="sk-note">cambio di pendenza</text><text x="184" y="${.5 * SKI_H}" class="sk-note" text-anchor="end">muro</text>` : "";
  const gates = [...k.gates].map((g, i) => ({ g, i })).sort((a, c) => a.g.v - c.g.v);
  const free = k.free.map(s => `<path class="sk-free" d="${s.map((p, i) => `${i ? "L" : "M"}${(p[0] * SKI_W).toFixed(1)} ${(p[1] * SKI_H).toFixed(1)}`).join(" ")}"/>`).join("");
  const ch = L.changes.map(c => `<g class="sk-chg"><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.4"/><line x1="${(c.x - c.nx * 7).toFixed(1)}" y1="${(c.y - c.ny * 7).toFixed(1)}" x2="${(c.x + c.nx * 7).toFixed(1)}" y2="${(c.y + c.ny * 7).toFixed(1)}"/>
    <text x="${(c.x + (c.x > 100 ? -8 : 8)).toFixed(1)}" y="${(c.y + 2).toFixed(1)}" text-anchor="${c.x > 100 ? "end" : "start"}">cambio spigolo</text></g>`).join("");
  return `<defs>${bg}<clipPath id="sk-clip"><rect x="10" y="14" width="180" height="292" rx="14"/></clipPath></defs>
    <rect width="${SKI_W}" height="${SKI_H}" fill="#0d1a26"/>
    <rect x="10" y="14" width="180" height="292" rx="14" fill="url(#sk-bg)"/>
    <g clip-path="url(#sk-clip)"><g class="sk-cont">${contours}</g>${extra}
    <path id="sk-fall" d="${fall}" class="sk-fall"/><g class="sk-chev">${chev}</g>
    ${k.red && L.red ? `<path id="sk-red" class="sk-line sk-late" d="${L.red}"/>` : ""}${k.green && L.green ? `<path id="sk-green" class="sk-line sk-ideal" d="${L.green}"/>` : ""}
    ${free}</g>
    <text x="100" y="11" text-anchor="middle" class="sk-cap">LINEA DI MASSIMA PENDENZA (tratteggio)</text>
    ${k.green && L.green ? ch : ""}${gates.map(({ g, i }) => kqSkiGateSVG(g, i, k.kind)).join("")}
    <polygon points="30,314 170,314 156,334 44,334" fill="#243a50"/><text x="100" y="327" text-anchor="middle" class="sk-cap2">${esc(SKI_KINDS[k.kind].toUpperCase())} · ${esc(F.pre.label.toUpperCase())}</text>`;
}
function kqSkiSVG(b) {
  return `<svg id="board" viewBox="0 0 ${SKI_W} ${SKI_H}" preserveAspectRatio="xMidYMid meet" aria-label="Lavagna sci: pendio e pali">${kqSkiInner(b)}</svg>`;
}
function kqSkiHTML(v, b) {
  const k = kqSki(b);
  const chip = (cls, attr, label, on) => `<button type="button" class="chip ${on ? "on" : ""} ${cls}" ${attr} aria-pressed="${!!on}">${label}</button>`;
  const main = `<div class="dock-row ski-main">
      ${chip("", 'data-skitool="gate"', "Posa pali", k.tool === "gate")}${chip("", 'data-skitool="free"', "Disegno libero", k.tool === "free")}
      <button type="button" class="btn sm" id="s-undo">Cancella ultimo palo</button></div>`;
  const body = `<h4 class="dock-t">Tipo di tracciato</h4>
      <div class="seg full" id="s-kind">${Object.entries(SKI_KINDS).map(([id, l]) => `<button type="button" class="${k.kind === id ? "on" : ""}" data-kind="${id}">${l}</button>`).join("")}</div>
      <h4 class="dock-t">Pendio</h4>
      <div class="chips" id="s-preset">${Object.entries(SKI_PRESETS).map(([id, p]) => chip("", `data-preset="${id}"`, esc(p.label), k.preset === id)).join("")}</div>
      <h4 class="dock-t">Colore del prossimo palo</h4>
      <div class="seg full" id="s-col">${[["auto", "Alterna"], ["red", "Rosso"], ["blue", "Blu"]].map(([id, l]) => `<button type="button" class="${k.colorMode === id ? "on" : ""}" data-col="${id}">${l}</button>`).join("")}</div>
      <h4 class="dock-t">Linee</h4>
      <div class="chips">${chip("", 'id="s-green"', '<i class="lg ideal"></i>Linea ideale', k.green)}${chip("", 'id="s-red"', '<i class="lg late"></i>Linea in ritardo', k.red)}</div>
      <div class="btns" style="margin-top:12px"><button type="button" class="btn sm danger" id="s-reset">Reset</button><button type="button" class="btn sm ghost" id="s-clr">Pulisci disegno</button></div>
      <p class="small mut" style="margin:10px 0 0">Tocca il pendio per posare un palo: il colore si alterna da solo. La linea verde passa a monte di ogni porta e inizia l'arco prima del palo; la rossa gira tardi, con l'apice sotto il palo. Il segno «cambio spigolo» è dove la verde attraversa la linea di massima pendenza. È uno schema geometrico, non il rilievo di una pista reale.</p>`;
  v.innerHTML = `<div class="card tight">${kqBoardBar("sci")}
    <p class="small mut" style="margin:8px 0 0" id="s-info"></p></div>
    <div class="boardwrap stick" id="s-wrap">${kqSkiSVG(b)}</div>
    ${kqDockHTML("s-dock", main, body)}`;
  const svg = $("#board", v), dock = $("#s-dock", v);
  const fit = () => kqFitBox(svg, dock, [SKI_W / SKI_H], { x: 16, y: 18 });
  KQM.fit = fit; kqDockBind(dock, fit); fit();
  kqBindSki(svg, b, v);
}
function kqBindSki(svg, b, v) {
  const k = kqSki(b);
  const info = () => { const el = $("#s-info", v); if (el) el.textContent = `${SKI_KINDS[k.kind]} · ${SKI_PRESETS[k.preset].label} · ${k.gates.length} ${k.gates.length === 1 ? "palo" : "pali"}${k.gates.length ? ` · prossimo: ${kqSkiNextColor(k) === "r" ? "rosso" : "blu"}` : ""}`; };
  const redraw = () => { svg.innerHTML = kqSkiInner(b); kqInkSync(svg, b); info(); save(); };
  const seg = (sel, attr, fn) => $$(`${sel} [${attr}]`, v).forEach(x => x.onclick = () => { fn(x.dataset[attr.replace("data-", "")]); $$(`${sel} [${attr}]`, v).forEach(y => { y.classList.toggle("on", y === x); y.setAttribute && y.getAttribute("aria-pressed") != null && y.setAttribute("aria-pressed", String(y === x)); }); redraw(); });
  seg("#s-kind", "data-kind", x => { k.kind = x; });
  seg("#s-preset", "data-preset", x => { k.preset = x; });
  seg("#s-col", "data-col", x => { k.colorMode = x; });
  $$("[data-skitool]", v).forEach(x => x.onclick = () => { k.tool = x.dataset.skitool; $$("[data-skitool]", v).forEach(y => { y.classList.toggle("on", y === x); y.setAttribute("aria-pressed", String(y === x)); }); save(); });
  const tog = (id, key) => { const el = $(id, v); el.onclick = () => { k[key] = !k[key]; el.classList.toggle("on", k[key]); el.setAttribute("aria-pressed", String(k[key])); redraw(); }; };
  tog("#s-green", "green"); tog("#s-red", "red");
  $("#s-undo", v).onclick = () => { if (!k.gates.length) { toast("Nessun palo da cancellare"); return; } k.gates.pop(); redraw(); };
  $("#s-reset", v).onclick = () => { if (k.gates.length || k.free.length || (b.ink || []).length) { if (!confirm("Cancellare pali, linee e disegni di questa lavagna?")) return; } k.gates = []; k.free = []; b.pts = []; b.ink = []; k.colorMode = "auto"; $$("#s-col [data-col]", v).forEach(y => y.classList.toggle("on", y.dataset.col === "auto")); redraw(); kqBoardExtras(v, b); };
  $("#s-clr", v).onclick = () => { k.free = []; b.pts = []; redraw(); };
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(.07, Math.min(.93, q.x / SKI_W)), Math.max(.06, Math.min(.9, q.y / SKI_H))]; };
  let st = null;
  svg.addEventListener("pointerdown", e => {
    if (e.target.closest && e.target.closest("#ink") && false) return;
    const p = pt(e); st = { x: e.clientX, y: e.clientY, stroke: null };
    if (k.tool === "free") { st.stroke = [p]; k.free.push(st.stroke); }
    try { svg.setPointerCapture(e.pointerId); } catch (_) { }
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    if (!st || !st.stroke) return; const p = pt(e), l = st.stroke[st.stroke.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) > .012) { st.stroke.push(p); svg.innerHTML = kqSkiInner(b); kqInkSync(svg, b); }
  });
  const end = e => {
    if (!st) return; const s = st; st = null;
    if (k.tool === "free") { if (s.stroke.length < 2) k.free = k.free.filter(x => x !== s.stroke); redraw(); return; }
    if (e && e.type === "pointerup" && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) {
      const p = pt(e); k.gates.push({ u: +p[0].toFixed(4), v: +p[1].toFixed(4), c: kqSkiNextColor(k) }); redraw();
    }
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", () => { st = null; });
  kqBoardExtras(v, b);
  info();
}
function kqBellHTML(v, b) {
  const modes = [["swing", "Swing"], ["tgu", "TGU"], ["snatch", "Snatch"]];
  v.innerHTML = `<div class="card tight">${kqBoardBar("kettlebell")}
    <p class="small mut" style="margin:8px 0">Trascina la ghiria. Verde se resta sulla traiettoria schematica, rosso se esce. Non è il tracciato di un tuo swing.</p>
    <div class="toolbar">${modes.map(([id, l]) => `<button type="button" class="chip ${b.tool === id ? "on" : ""}" data-tool="${id}">${l}</button>`).join("")}</div></div>
    <div class="boardwrap">${kqBellSVG(b)}</div>
    <p class="small" id="bell-msg"></p>`;
  $$("[data-tool]", v).forEach(x => x.onclick = () => { b.tool = x.dataset.tool; b.bell = kqBellPath(b.tool)[0]; save(); renderBoard(); });
  kqBindBell($("#board", v), b);
  kqBellMsg(b);
  kqBoardExtras(v, b);
}
function kqBellPath(mode) {
  if (mode === "tgu") return [[.62, .82], [.62, .62], [.58, .42], [.55, .22], [.52, .1]];
  if (mode === "snatch") return [[.3, .84], [.38, .7], [.48, .48], [.52, .28], [.5, .12]];
  return [[.3, .78], [.36, .62], [.48, .46], [.66, .34], [.82, .3]];
}
function kqBellDist(mode, bell) {
  const pts = kqBellPath(mode);
  let best = 99;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], dx = c[0] - a[0], dy = c[1] - a[1];
    const L = dx * dx + dy * dy || 1;
    let u = ((bell.x - a[0]) * dx + (bell.y - a[1]) * dy) / L; u = Math.max(0, Math.min(1, u));
    best = Math.min(best, Math.hypot(bell.x - (a[0] + u * dx), bell.y - (a[1] + u * dy)));
  }
  return best;
}
function kqBellSVG(b) {
  const pts = kqBellPath(b.tool);
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0] * 200} ${p[1] * 280}`).join(" ");
  const ok = kqBellDist(b.tool, b.bell) < 0.07;
  return `<svg id="board" viewBox="0 0 200 280">
    <rect width="200" height="280" fill="#0d1a26"/>
    <g stroke="#22345a" stroke-width="8" fill="none" stroke-linecap="round">
      <line x1="120" y1="70" x2="118" y2="40"/><line x1="118" y1="78" x2="116" y2="140"/><line x1="116" y1="140" x2="124" y2="190"/><line x1="124" y1="190" x2="120" y2="250"/>
      <line x1="118" y1="86" x2="150" y2="100"/></g>
    <circle cx="118" cy="36" r="10" fill="#22345a"/>
    <path d="${d}" fill="none" stroke="#34d399" stroke-width="2" stroke-dasharray="5 4"/>
    <g id="bell" class="${ok ? "ok" : "bad"}" transform="translate(${b.bell.x * 200} ${b.bell.y * 280})"><circle r="14"/><path d="M-8 -10 a10 10 0 0 1 16 0" fill="none" stroke="#eef3ff" stroke-width="2"/></g>
    </svg>`;
}
function kqBellMsg(b) {
  const ok = kqBellDist(b.tool, b.bell) < 0.07;
  const el = $("#bell-msg"); if (!el) return;
  el.innerHTML = ok ? `<span class="z-green">Sulla traiettoria schematica.</span>` : `<span class="z-red">Fuori dalla traiettoria schematica.</span> Avvicina la ghiria alla linea verde.`;
}
function kqBindBell(svg, b) {
  const bell = $("#bell", svg);
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.max(0.05, Math.min(0.95, q.x / 200)), y: Math.max(0.05, Math.min(0.95, q.y / 280)) }; };
  let on = false;
  const move = e => { if (!on) return; b.bell = pt(e); bell.setAttribute("transform", `translate(${b.bell.x * 200} ${b.bell.y * 280})`); const ok = kqBellDist(b.tool, b.bell) < 0.07; bell.setAttribute("class", ok ? "ok" : "bad"); kqBellMsg(b); };
  svg.addEventListener("pointerdown", e => { on = true; svg.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  svg.addEventListener("pointermove", move);
  const end = () => { if (!on) return; on = false; save(); };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
}

/* ---------- rete specialisti e test ---------- */
function kqRenderRete() {
  const v = $("#view-rete");
  v.innerHTML = KQ.rete === "test" ? `<div id="rete-ui"></div>${kqTestHTML()}` : `${kqSpecsHTML()}<article id="test-sheet" hidden></article>`;
  if (KQ.rete === "test") { $("#rete-ui", v).innerHTML = ""; $("#kq-print", v).onclick = kqPrintTest; }
  else kqBindSpecs(v);
}
function kqSpecsHTML() {
  const list = S.specialists || [];
  const cities = [...new Set(list.map(s => (s.city || "").trim()).filter(Boolean))];
  const sport = KQ.specSport || "all";
  const city = (KQ.specCity || "").trim().toLowerCase();
  const shown = list.filter(s => (sport === "all" || (s.sports || []).includes(sport)) && (!city || (s.city || "").toLowerCase().includes(city)));
  return `<div id="rete-ui"><div class="card"><h2>Rete specialisti</h2>
    <p class="small mut">Elenco vuoto finché non aggiungi tu i contatti. Nessun nominativo di esempio e nessun badge di verifica: la rubrica è la tua.</p>
    <div class="alert yellow"><span>⚕️</span><div>KinetIQ non sostituisce il medico, il fisioterapista o il coach. Il tasto WhatsApp prepara solo un messaggio.</div></div>
    <label class="lbl">Sport</label>
    <div class="chips" data-group="sp-sport"><button type="button" class="chip ${sport === "all" ? "on" : ""}" data-val="all">Tutti</button>${SPORT_IDS.map(id => `<button type="button" class="chip ${sport === id ? "on" : ""}" data-val="${id}">${sportIcon(id, 18)}${esc(SPORTS[id])}</button>`).join("")}</div>
    <label class="lbl" for="sp-city">Città</label>
    <input class="field" id="sp-city" list="sp-cities" placeholder="Filtra per città" value="${esc(KQ.specCity || "")}">
    <datalist id="sp-cities">${cities.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
    <button type="button" class="btn pri block" id="sp-add" style="margin-top:12px">${KQ.specOpen ? "Chiudi scheda" : "+ Aggiungi contatto"}</button>
    <div id="sp-form"${KQ.specOpen ? "" : " hidden"}></div></div>
    <div class="card"><h3>${shown.length ? shown.length + " contatt" + (shown.length === 1 ? "o" : "i") : "Nessun contatto"}</h3>
    ${shown.length ? shown.map(s => `<div class="threq"><div class="row between"><b>${esc(s.name)}</b><span class="pill">${esc(KQ_ROLE[s.role] || "")}</span></div>
      <div class="small">${esc(s.title || "")}</div>
      <div class="small mut">${(s.sports || []).map(id => SPORTS[id] || id).join(", ")} · ${esc(s.city || "")} · ${(s.modes || []).map(m => m === "video" ? "video consulto" : "studio").join(" / ")}</div>
      <div class="btns" style="margin-top:8px"><a class="btn sm pri" href="${esc(kqWaLink(s.phone, KQ.waZone ? kqReport(KQ.waZone) : ""))}" target="_blank" rel="noopener">WhatsApp</a>
        ${kqPhone(s.phone).length >= 8 ? `<a class="btn sm" href="${esc(kqTelLink(s.phone))}" aria-label="Chiama ${esc(s.name)}">Chiama</a>` : ""}
        <button type="button" class="btn sm danger" data-del="${esc(s.id)}">Elimina</button></div></div>`).join("")
      : `<div class="empty">Aggiungi maestro, fisioterapista o preparatore. I filtri per sport e città compariranno quando ci saranno contatti.</div>`}
    </div>${DISCLAIMER}</div>`;
}
function kqSpecForm() {
  const sports = SPORT_IDS.map(id => `<button type="button" class="chip" data-sp="${id}">${sportIcon(id, 18)}${esc(SPORTS[id])}</button>`).join("");
  return `<div class="pvblock"><label class="lbl" for="sf-name">Nome</label><input class="field" id="sf-name" maxlength="80" placeholder="Nome e cognome">
    <label class="lbl" for="sf-title">Qualifica</label><input class="field" id="sf-title" maxlength="80" placeholder="es. Maestro, fisioterapista, chinesiologo">
    <label class="lbl">Ruolo</label><div class="chips" id="sf-role">${KQ_ROLES.map(([id, l], i) => `<button type="button" class="chip ${i === 0 ? "on" : ""}" data-role="${id}">${l}</button>`).join("")}</div>
    <label class="lbl">Sport</label><div class="chips" id="sf-sports">${sports}</div>
    <label class="lbl" for="sf-city">Città</label><input class="field" id="sf-city" maxlength="60" placeholder="es. Torino">
    <label class="lbl">Modalità</label><div class="chips" id="sf-mode"><button type="button" class="chip on" data-mode="studio">Studio</button><button type="button" class="chip" data-mode="video">Video consulto</button></div>
    <label class="lbl" for="sf-phone">Telefono WhatsApp</label><input class="field" id="sf-phone" type="tel" inputmode="tel" placeholder="es. 333 1234567">
    <button type="button" class="btn pri block" id="sf-save" style="margin-top:12px">Salva contatto</button></div>`;
}
function kqBindSpecs(v) {
  bindChips(v, "sp-sport", val => { KQ.specSport = val; render(); });
  const city = $("#sp-city", v); if (city) city.oninput = () => {
    KQ.specCity = city.value; const pos = city.selectionStart; render();
    const c = $("#sp-city"); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (e) { } }
  };
  $("#sp-add", v).onclick = () => { KQ.specOpen = !KQ.specOpen; render(); };
  const form = $("#sp-form", v);
  if (KQ.specOpen && form) {
    form.innerHTML = kqSpecForm();
    let role = "maestro"; const sports = new Set(); const modes = new Set(["studio"]);
    $$("#sf-role .chip", form).forEach(b => b.onclick = () => { role = b.dataset.role; $$("#sf-role .chip", form).forEach(x => x.classList.toggle("on", x === b)); });
    $$("#sf-sports .chip", form).forEach(b => b.onclick = () => { const id = b.dataset.sp; sports.has(id) ? sports.delete(id) : sports.add(id); b.classList.toggle("on", sports.has(id)); });
    $$("#sf-mode .chip", form).forEach(b => b.onclick = () => { const id = b.dataset.mode; modes.has(id) ? modes.delete(id) : modes.add(id); b.classList.toggle("on", modes.has(id)); });
    $("#sf-save", form).onclick = () => {
      const name = $("#sf-name", form).value.trim(), phone = $("#sf-phone", form).value.trim();
      if (!name) return toast("Inserisci il nome");
      if (kqPhone(phone).length < 8) return toast("Inserisci un telefono WhatsApp");
      if (!sports.size) return toast("Scegli almeno uno sport");
      if (!modes.size) return toast("Scegli studio, video consulto o entrambi");
      S.specialists = S.specialists || [];
      S.specialists.push({ id: uid(), name, title: $("#sf-title", form).value.trim(), role, sports: [...sports], city: $("#sf-city", form).value.trim(), modes: [...modes], phone });
      KQ.specOpen = false; save(); toast("Contatto salvato su questo dispositivo"); render();
    };
  }
  $$("[data-del]", v).forEach(b => b.onclick = () => {
    if (!confirm("Eliminare questo contatto da questo dispositivo?")) return;
    S.specialists = (S.specialists || []).filter(s => s.id !== b.dataset.del); save(); render();
  });
}
function kqTestHTML() {
  return `<article class="card" id="test-sheet">
    <h2>Test sul campo</h2>
    <p class="small">Protocollo di validazione, circa 15 minuti a tester. Da fare con tre profili: un maestro di racchetta (padel o tennis), un coach di kettlebell o preparatore, un fisioterapista o osteopata dello sport.</p>
    <p class="small mut">Gli angoli che vedi nello Studio sono preset dimostrativi. Il test serve a capire se la finestra verde coincide con ciò che il professionista accetta sul campo.</p>
    <h3>Fase A · Il test del dito</h3>
    <p>Apri un preset (iperestensione, early extension, gomito basso o valgismo) e chiedi:</p>
    <p><b>«Trascina il punto del corpo dove secondo te l'allievo dovrebbe trovarsi.»</b></p>
    <ul class="small"><li>Capisce subito quale nodo prendere?</li><li>La zona verde è quella che accetterebbe in campo, o è troppo rigida / troppo larga?</li></ul>
    <h3>Fase B · Occhio umano e semaforo</h3>
    <p>Fai vedere tre situazioni: una esecuzione che il tester ritiene corretta, una con un errore lieve, una con un errore evidente (video reale dell'allievo, oppure i preset dello Studio dichiarati come dimostrativi).</p>
    <ul class="small"><li>Il semaforo (verde, giallo, rosso) coincide con il giudizio immediato?</li><li>Se il tester vede un rischio e l'app è verde, o il contrario, annota di quanto allargare o stringere la finestra.</li></ul>
    <h3>Fase C · Tre domande</h3>
    <ol class="small">
      <li>Se mostri questa schermata con lo scheletro a un allievo, capisce il difetto più in fretta che con la sola spiegazione verbale?</li>
      <li>Useresti questa schermata a fine lezione per mandare all'allievo il riassunto dell'errore su WhatsApp?</li>
      <li>Cosa manca su questa schermata che per te è fondamentale vedere prima di correggere il gesto?</li>
    </ol>
    <h3>Note del tester</h3>
    <p class="small">Nome e ruolo ________________________________</p>
    <p class="small">Sport ________________________________</p>
    <p class="small">Data ________________________________</p>
    <p class="small">Fase A ________________________________</p>
    <p class="small">Fase B ________________________________</p>
    <p class="small">Domanda 1 ________________________________</p>
    <p class="small">Domanda 2 ________________________________</p>
    <p class="small">Domanda 3 ________________________________</p>
    <p class="small mut">KinetIQ non sostituisce il maestro, il medico o il fisioterapista. Questo foglio raccoglie il loro giudizio.</p>
    <button type="button" class="btn pri block" id="kq-print">Stampa o salva PDF</button>
  </article>`;
}
function kqPrintTest() {
  document.body.classList.add("printing-test");
  const done = () => document.body.classList.remove("printing-test");
  window.addEventListener("afterprint", done, { once: true });
  setTimeout(done, 2000);
  window.print();
}

/* ---------- tachimetro: animazione dell'ago ---------- */
function kqGaugeKick() {
  $$("[data-needle]").forEach(g => {
    const raw = g.dataset.to;
    if (raw === "") { g.setAttribute("opacity", "0"); return; }
    const to = +raw;
    const from = KQ.gaugeLast == null ? to : KQ.gaugeLast;
    KQ.gaugeLast = to;
    const t0 = performance.now();
    const frame = now => {
      if (!g.isConnected) return;
      const k = Math.min(1, (now - t0) / 750), e = 1 - Math.pow(1 - k, 3);
      g.setAttribute("transform", `rotate(${(from + (to - from) * e).toFixed(2)} 60 64)`);
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
