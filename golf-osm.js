/* KinetIQ - Lavagna golf con mappe reali di OpenStreetMap.
   Caricato solo quando si apre la lavagna golf in modalità «Mappa reale»: non fa parte del bundle iniziale.
   Nessuna chiave API e nessuna tile: si scaricano solo i vettori OSM del campo scelto (Overpass) e si disegnano in SVG.
   Dati © OpenStreetMap contributors (ODbL). */
"use strict";
(function () {
  const NOMINATIM = "https://nominatim.openstreetmap.org/search";
  const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  const ATTR = `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>`;
  const EARTH = 6371008.8, rad = d => d * Math.PI / 180;
  const COL = { bg: "#0f3320", rough: "#17492c", fairway: "#74d46f", tee: "#58c46c", bunker: "#e6d5a0", water: "#2f6fd6", green: "#2fe36d" };
  const H = 340;

  /* ---------- geometria pura (testabile) ---------- */
  function haversine(a, b) {
    const dp = rad(b[0] - a[0]), dl = rad(b[1] - a[1]);
    const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dl / 2) ** 2;
    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const lineLen = c => c.reduce((s, p, i) => i ? s + haversine([c[i - 1][1], c[i - 1][0]], [p[1], p[0]]) : 0, 0);
  const sameP = (a, b) => a[0] === b[0] && a[1] === b[1];
  function joinRings(segs) {
    const rings = []; segs = segs.filter(s => s.length > 1).map(s => s.slice());
    while (segs.length) {
      let ring = segs.pop();
      for (let guard = 0; guard < 5000 && !sameP(ring[0], ring[ring.length - 1]); guard++) {
        const end = ring[ring.length - 1];
        const i = segs.findIndex(s => sameP(s[0], end) || sameP(s[s.length - 1], end));
        if (i < 0) break;
        let s = segs.splice(i, 1)[0]; if (!sameP(s[0], end)) s = s.reverse();
        ring = ring.concat(s.slice(1));
      }
      if (ring.length >= 3) { if (!sameP(ring[0], ring[ring.length - 1])) ring.push(ring[0]); rings.push(ring); }
    }
    return rings;
  }
  const kindOf = t => t.golf || (t.natural === "water" ? "water" : null);
  const pickTags = t => { const o = {}; ["ref", "par", "dist", "name", "handicap"].forEach(k => { if (t[k] != null) o[k] = t[k]; }); return o; };
  /* risposta Overpass (out geom) -> GeoJSON FeatureCollection */
  function toGeo(j) {
    const features = [];
    for (const el of (j && j.elements) || []) {
      const t = el.tags || {}, kind = kindOf(t); if (!kind) continue;
      const props = { kind, ...pickTags(t) };
      if (el.type === "way" && el.geometry && el.geometry.length > 1) {
        const c = el.geometry.map(p => [p.lon, p.lat]), closed = c.length > 3 && sameP(c[0], c[c.length - 1]);
        features.push({ type: "Feature", properties: props, geometry: kind === "hole" || !closed ? { type: "LineString", coordinates: c } : { type: "Polygon", coordinates: [c] } });
      } else if (el.type === "relation" && el.members) {
        const out = [], inn = [];
        el.members.forEach(m => { if (m.type === "way" && m.geometry) (m.role === "inner" ? inn : out).push(m.geometry.map(p => [p.lon, p.lat])); });
        const o = joinRings(out), i = joinRings(inn);
        if (o.length) features.push({ type: "Feature", properties: props, geometry: { type: "MultiPolygon", coordinates: o.map((r, n) => n ? [r] : [r, ...i]) } });
      }
    }
    return { type: "FeatureCollection", features };
  }
  const ringsOf = g => g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
  const centroid = g => { const r = ringsOf(g)[0]; if (!r) return null; let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); return [y / r.length, x / r.length]; };
  function listHoles(geo) {
    const hs = geo.features.filter(f => f.properties.kind === "hole" && f.geometry.type === "LineString" && f.geometry.coordinates.length > 1)
      .map(f => ({ f, ref: parseInt(f.properties.ref, 10), par: f.properties.par, name: f.properties.name }));
    hs.sort((a, b) => (isNaN(a.ref) ? 999 : a.ref) - (isNaN(b.ref) ? 999 : b.ref));
    const seen = {};
    return hs.map((h, i) => {
      const c = h.f.geometry.coordinates, tee = [c[0][1], c[0][0]], end = [c[c.length - 1][1], c[c.length - 1][0]];
      let green = end, best = 60;
      geo.features.forEach(g => { if (g.properties.kind !== "green") return; const ce = centroid(g.geometry); if (!ce) return; const d = haversine(ce, end); if (d < best) { best = d; green = ce; } });
      const d = parseFloat(String(h.f.properties.dist || "").replace(",", ".")), len = d > 0 && !/y/i.test(String(h.f.properties.dist)) ? Math.round(d) : Math.round(lineLen(c));
      const n = isNaN(h.ref) ? i + 1 : h.ref; seen[n] = (seen[n] || 0) + 1;
      return { i, n, dup: seen[n], par: h.par, len, tee, green, line: c, label: `Buca ${n}${seen[n] > 1 ? " (" + seen[n] + ")" : ""}${h.par ? " · Par " + h.par : ""} · ${len} m` };
    });
  }
  /* proiezione locale tee->green in verticale: tee in basso, green in alto. Unità: viewBox alto 340. */
  function makeProj(hole, extraPts) {
    const lat0 = (hole.tee[0] + hole.green[0]) / 2, lon0 = (hole.tee[1] + hole.green[1]) / 2, kx = Math.cos(rad(lat0)) * 111320, ky = 111320;
    const xy = (lat, lon) => [(lon - lon0) * kx, (lat0 - lat) * ky];
    const [tx, ty] = xy(hole.tee[0], hole.tee[1]), [gx, gy] = xy(hole.green[0], hole.green[1]);
    const phi = -Math.PI / 2 - Math.atan2(gy - ty, gx - tx), c = Math.cos(phi), s = Math.sin(phi);
    const rot = (x, y) => [x * c - y * s, x * s + y * c];
    const pts = [...hole.line.map(p => rot(...xy(p[1], p[0]))), rot(tx, ty), rot(gx, gy), ...(extraPts || [])];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const Hm = (maxy - miny) + 64, Wm = Math.max((maxx - minx) + 84, Hm * .62), x0 = (minx + maxx) / 2 - Wm / 2, y0 = (miny + maxy) / 2 - Hm / 2, k = H / Hm;
    return {
      W: +(Wm * k).toFixed(2), H, k, mPerU: 1 / k,
      toU: (lat, lon) => { const r = rot(...xy(lat, lon)); return [(r[0] - x0) * k, (r[1] - y0) * k]; },
      fromU: (ux, uy) => { const rx = ux / k + x0, ry = uy / k + y0, x = rx * c + ry * s, y = -rx * s + ry * c; return [lat0 - y / ky, lon0 + x / kx]; }
    };
  }

  /* ---------- rete: Nominatim (max 1 richiesta/s) e Overpass ---------- */
  let lastNom = 0; const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function fetchText(url, opt, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opt, signal: ctl.signal });
      if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
      return await r.text();
    } catch (e) { if (e.name === "AbortError") e.timeout = true; throw e; } finally { clearTimeout(t); }
  }
  async function searchCourses(q) {
    const wait = Math.max(0, lastNom + 1100 - Date.now()); if (wait) await sleep(wait); lastNom = Date.now();
    const url = `${NOMINATIM}?format=jsonv2&q=${encodeURIComponent(q)}&limit=15&accept-language=it&extratags=0`;
    const j = JSON.parse(await fetchText(url, { headers: { Accept: "application/json" } }, 15000));
    return j.filter(r => r.class === "leisure" && r.type === "golf_course" && ["way", "relation", "node"].includes(r.osm_type)).slice(0, 8).map(r => ({
      key: r.osm_type + "/" + r.osm_id, type: r.osm_type, id: r.osm_id, name: (r.name || r.display_name.split(",")[0]).trim(),
      place: r.display_name.split(",").slice(1, 4).join(",").trim(), lat: +r.lat, lon: +r.lon, bbox: r.boundingbox ? r.boundingbox.map(Number) : null
    }));
  }
  const SEL = `["golf"~"^(hole|tee|fairway|green|bunker|rough|water_hazard|lateral_water_hazard)$"]`;
  function overpassQuery(c, bboxOnly) {
    const area = !bboxOnly && c.type !== "node";
    const sc = area ? "(area.a)" : c.bbox ? `(${c.bbox[0]},${c.bbox[2]},${c.bbox[1]},${c.bbox[3]})` : `(around:1800,${c.lat},${c.lon})`;
    return `[out:json][timeout:40];${area ? `${c.type}(${c.id})->.c;.c map_to_area->.a;` : ""}(way${SEL}${sc};relation${SEL}${sc};way["natural"="water"]${sc};relation["natural"="water"]${sc};);out geom tags;`;
  }
  async function overpass(query) {
    let last = null;
    for (const url of OVERPASS) {
      try {
        const txt = await fetchText(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: "data=" + encodeURIComponent(query) }, 45000);
        let j; try { j = JSON.parse(txt); } catch (_) { const e = new Error("risposta non valida"); e.busy = true; throw e; }
        if (j.remark && /timed out|out of memory|too busy/i.test(j.remark) && !(j.elements || []).length) { const e = new Error(j.remark); e.busy = true; throw e; }
        return j;
      } catch (e) { last = e; if (e.status === 400) break; }
    }
    throw last || new Error("rete");
  }
  async function downloadGeo(c) {
    let geo = toGeo(await overpass(overpassQuery(c, false)));
    if (!geo.features.length && c.type !== "node" && c.bbox) geo = toGeo(await overpass(overpassQuery(c, true)));
    return geo;
  }
  function errMsg(e) {
    if (e && e.status === 429) return "Troppe richieste a Overpass: attendi qualche secondo e riprova.";
    if (e && (e.timeout || e.status === 504 || e.busy)) return "Overpass (server pubblico) ha impiegato troppo tempo o è sovraccarico. Riprova tra poco.";
    if (!navigator.onLine) return "Sei offline: servono connessione per cercare un campo nuovo. I campi già scaricati restano disponibili.";
    return "Impossibile raggiungere OpenStreetMap in questo momento. Controlla la connessione e riprova.";
  }

  /* ---------- cache locale (IndexedDB) ---------- */
  const mem = {};
  const idb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("no idb"));
    const r = indexedDB.open("kinetiq-golf", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("courses", { keyPath: "key" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => { const t = db.transaction("courses", mode), rq = fn(t.objectStore("courses")); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }));
  const cacheGet = key => tx("readonly", s => s.get(key)).catch(() => mem[key]);
  const cachePut = rec => { mem[rec.key] = rec; return tx("readwrite", s => s.put(rec)).catch(() => { }); };
  const cacheDel = key => { delete mem[key]; return tx("readwrite", s => s.delete(key)).catch(() => { }); };
  const cacheAll = () => tx("readonly", s => s.getAll()).catch(() => Object.values(mem));

  /* ---------- UI ---------- */
  const f1 = n => n.toFixed(1);
  function shotPathU(s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const bend = s.t === "draw" ? -.16 : s.t === "fade" ? .14 : s.t === "lay" ? .05 : 0, mx = (s.x1 + s.x2) / 2 + nx * len * bend, my = (s.y1 + s.y2) / 2 + ny * len * bend;
    return `M${f1(s.x1)} ${f1(s.y1)} Q${f1(mx)} ${f1(my)} ${f1(s.x2)} ${f1(s.y2)}`;
  }
  const TOOLS = [["ruler", "Distanza"], ["draw", "Draw"], ["fade", "Fade"], ["lay", "Lay-up"]];

  async function mount(host, b, ctx) {
    const osm = b.osm = b.osm || { course: null, hole: 0, h: {}, clubs: [] };
    if (!Array.isArray(osm.clubs)) osm.clubs = [];
    const token = {}; host._tok = token; const alive = () => host._tok === token && document.body.contains(host);
    const attr = `<div class="osm-attr">${ATTR}</div>`;

    const clearBoardUI = () => { const r = $(".focusrow", ctx.view); if (r) r.remove(); KQM.fit = null; ctx.view.style.paddingBottom = ""; };
    async function screenSearch(msg) {
      clearBoardUI();
      const recent = ((await cacheAll()) || []).filter(r => r.geo).sort((a, c) => c.ts - a.ts).slice(0, 6);
      if (!alive()) return;
      host.innerHTML = `<div class="card og-card"><h3 style="margin:0 0 6px">Scegli il circolo</h3>
        <p class="small mut" style="margin:0 0 10px">Cerca il nome del campo e premi «Cerca» (o Invio). I dati sono le mappe libere di OpenStreetMap: la copertura delle buche dipende dai volontari e non è uniforme.</p>
        <form id="og-form" class="og-search" role="search"><input id="og-q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="words" placeholder="Es. Golf Club Milano" aria-label="Nome del campo da golf"><button class="btn" id="og-go" type="submit">Cerca</button></form>
        <div id="og-msg" class="og-msg" role="status" aria-live="polite">${msg ? esc(msg) : ""}</div><div id="og-res" class="og-res"></div>
        ${recent.length ? `<h4 class="dock-t" style="margin-top:14px">Già scaricati (anche offline)</h4><div class="og-res">${recent.map(r => `<button type="button" class="og-item" data-recent="${esc(r.key)}"><b>${esc(r.name)}</b><span>${esc(r.place || "")}</span></button>`).join("")}</div>` : ""}
        <p class="small mut" style="margin:14px 0 0">${ATTR} · Ricerca: Nominatim · Geometrie: Overpass API.</p></div>`;
      const form = $("#og-form", host), q = $("#og-q", host), res = $("#og-res", host), out = $("#og-msg", host);
      let busy = false;
      form.addEventListener("submit", async e => {
        e.preventDefault(); const text = q.value.trim(); if (text.length < 3 || busy) { if (text.length < 3) out.textContent = "Scrivi almeno 3 lettere."; return; }
        busy = true; $("#og-go", host).disabled = true; out.textContent = "Ricerca in corso…"; res.innerHTML = "";
        try {
          const list = await searchCourses(text); if (!alive()) return;
          out.textContent = list.length ? `${list.length} ${list.length === 1 ? "campo trovato" : "campi trovati"}. Tocca quello giusto.` : "Nessun campo da golf trovato con questo nome. Prova con la città o il nome completo.";
          res.innerHTML = list.map((c, i) => `<button type="button" class="og-item" data-i="${i}"><b>${esc(c.name)}</b><span>${esc(c.place)}</span></button>`).join("");
          $$("[data-i]", res).forEach(x => x.onclick = () => choose(list[+x.dataset.i]));
        } catch (er) {
          if (!alive()) return; out.innerHTML = `${esc(errMsg(er))} <button type="button" class="btn sm" id="og-retry">Riprova</button>`;
          $("#og-retry", out).onclick = () => form.requestSubmit();
        } finally { busy = false; const g = $("#og-go", host); if (g) g.disabled = false; }
      });
      $$("[data-recent]", host).forEach(x => x.onclick = async () => { const r = await cacheGet(x.dataset.recent); if (r) choose(r.course, r.geo); });
      q.focus({ preventScroll: true });
    }

    async function choose(course, geo, force) {
      clearBoardUI();
      osm.course = course; osm.hole = 0; save();
      host.innerHTML = `<div class="card og-card"><div class="og-load"><span class="spin" aria-hidden="true"></span><div><b>${esc(course.name)}</b><div class="small mut">Scarico le geometrie del campo da OpenStreetMap… può richiedere fino a un minuto.</div></div></div></div>${attr}`;
      try {
        if (!geo && !force) { const hit = await cacheGet(course.key); if (hit && hit.geo) geo = hit.geo; }
        if (!geo) { geo = await downloadGeo(course); await cachePut({ key: course.key, course, geo, name: course.name, place: course.place, ts: Date.now() }); }
        if (!alive()) return;
        showCourse(geo);
      } catch (e) {
        if (!alive()) return;
        host.innerHTML = `<div class="card og-card"><h3 style="margin:0 0 6px">${esc(course.name)}</h3><p class="og-msg err" role="alert">${esc(errMsg(e))}</p>
          <div class="btns"><button type="button" class="btn" id="og-retry">Riprova</button><button type="button" class="btn ghost" id="og-other">Cambia campo</button></div></div>${attr}`;
        $("#og-retry", host).onclick = () => choose(course, null, true);
        $("#og-other", host).onclick = () => { osm.course = null; save(); screenSearch(); };
      }
    }

    function showCourse(geo) {
      const holes = listHoles(geo), course = osm.course;
      if (!holes.length) { ctx.noHoles("Buche non mappate su OpenStreetMap per questo campo. Qui sotto la lavagna schematica."); return; }
      if (!(osm.hole >= 0 && osm.hole < holes.length)) osm.hole = 0;
      drawHole(geo, holes, course);
    }

    function drawHole(geo, holes, course) {
      const hole = holes[osm.hole], key = course.key + "#" + hole.i, hb = osm.h[key] = osm.h[key] || { shots: [], ink: [], pin: null };
      hb.shots = hb.shots || []; hb.ink = hb.ink || [];
      const P = makeProj(hole), W = P.W, toU = ([lon, lat]) => P.toU(lat, lon);
      const inView = pts => { let a = 1e9, c = -1e9, d = 1e9, e = -1e9; pts.forEach(p => { a = Math.min(a, p[0]); c = Math.max(c, p[0]); d = Math.min(d, p[1]); e = Math.max(e, p[1]); }); return !(c < -60 || a > W + 60 || e < -60 || d > H + 60); };
      const layers = { rough: [], fairway: [], water: [], tee: [], bunker: [], green: [] };
      geo.features.forEach(f => {
        const k = f.properties.kind === "water_hazard" || f.properties.kind === "lateral_water_hazard" ? "water" : f.properties.kind;
        if (!layers[k] || f.geometry.type === "LineString") return;
        const rings = ringsOf(f.geometry).map(r => r.map(toU)); if (!rings.length || !inView(rings[0])) return;
        layers[k].push(`<path d="${rings.map(r => "M" + r.map(p => f1(p[0]) + " " + f1(p[1])).join("L") + "Z").join("")}" fill-rule="evenodd"/>`);
      });
      const line = "M" + hole.line.map(toU).map(p => f1(p[0]) + " " + f1(p[1])).join("L");
      const tee = P.toU(hole.tee[0], hole.tee[1]), gr = P.toU(hole.green[0], hole.green[1]);
      const sb = P.mPerU * H < 260 ? 50 : 100, sbU = sb / P.mPerU;
      const base = `<rect x="-80" y="-80" width="${f1(W + 160)}" height="${H + 160}" fill="${COL.bg}"/>
        <g fill="${COL.rough}">${layers.rough.join("")}</g><g fill="${COL.fairway}">${layers.fairway.join("")}</g><g fill="${COL.water}" stroke="#7fb0ff" stroke-width=".6">${layers.water.join("")}</g>
        <g fill="${COL.tee}">${layers.tee.join("")}</g><g fill="${COL.bunker}" stroke="#a89560" stroke-width=".5">${layers.bunker.join("")}</g><g fill="${COL.green}" stroke="#c8ffd9" stroke-width=".6">${layers.green.join("")}</g>
        <path d="${line}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.1" stroke-dasharray="4 3"/>
        <g><rect x="${f1(tee[0] - 4)}" y="${f1(tee[1] - 2.5)}" width="8" height="5" rx="1" fill="#fff" stroke="#0d1a26" stroke-width=".8"/><text x="${f1(tee[0])}" y="${f1(tee[1] + 11)}" text-anchor="middle" class="og-lbl">TEE</text></g>
        <g><line x1="${f1(gr[0])}" y1="${f1(gr[1])}" x2="${f1(gr[0])}" y2="${f1(gr[1] - 16)}" stroke="#fff" stroke-width="1.2"/><path d="M${f1(gr[0])} ${f1(gr[1] - 16)}l8 3.2-8 3.2z" fill="#ff4d4d"/><circle cx="${f1(gr[0])}" cy="${f1(gr[1])}" r="2" fill="#0d1a26" stroke="#fff" stroke-width=".8"/></g>
        <g transform="translate(10 ${H - 12})"><line x1="0" y1="0" x2="${f1(sbU)}" y2="0" stroke="#fff" stroke-width="2"/><path d="M0 -3V3M${f1(sbU)} -3V3" stroke="#fff" stroke-width="1.4"/><text x="${f1(sbU / 2)}" y="-5" text-anchor="middle" class="og-lbl">${sb} m</text></g>`;

      const clubs = () => osm.clubs.filter(c => c.m > 0);
      const measure = p => { const ll = P.fromU(p[0], p[1]); return { tee: Math.round(haversine(hole.tee, ll)), rem: Math.round(haversine(ll, hole.green)) }; };
      const clubTxt = rem => { const cs = clubs(); if (!cs.length) return ""; const c = cs.reduce((a, d) => Math.abs(d.m - rem) < Math.abs(a.m - rem) ? d : a); return ` · più vicino tra le tue distanze: ${esc(c.n)} (${c.m} m)`; };
      const lastPoint = () => hb.pin || (hb.shots.length ? [hb.shots[hb.shots.length - 1].x2, hb.shots[hb.shots.length - 1].y2] : null);
      const readTxt = () => { const p = lastPoint(); if (!p) return "Tocca la mappa per misurare: dal tee e al green"; const m = measure(p); return `Dal tee ${m.tee} m · Rimangono ${m.rem} m${clubTxt(m.rem)}`; };

      const main = `<div class="dock-read"><div class="dr-t"><b id="og-ttl">${esc(hole.label)}</b><span class="sub" id="og-sub">${readTxt()}</span></div>
          <div class="dr-nav"><button type="button" class="btn sm icon" id="og-prev" aria-label="Buca precedente"${osm.hole ? "" : " disabled"}>‹</button><button type="button" class="btn sm icon" id="og-next" aria-label="Buca successiva"${osm.hole < holes.length - 1 ? "" : " disabled"}>›</button></div></div>
        <div class="dock-row">${TOOLS.map(([id, l]) => `<button type="button" class="chip ${osm.tool === id || (!osm.tool && id === "ruler") ? "on" : ""}" data-otool="${id}" aria-pressed="${osm.tool === id || (!osm.tool && id === "ruler")}">${l}</button>`).join("")}</div>`;
      const body = `<h4 class="dock-t">Buche</h4><div class="og-holes">${holes.map(h => `<button type="button" class="og-hole ${h.i === hole.i ? "on" : ""}" data-hole="${h.i}"><b>${h.n}${h.dup > 1 ? "·" + h.dup : ""}</b><span>${h.par ? "Par " + h.par : "Par n.d."} · ${h.len} m</span></button>`).join("")}</div>
        <div class="btns" style="margin-top:12px"><button type="button" class="btn sm" id="og-undo">Annulla ultimo colpo</button><button type="button" class="btn sm ghost" id="og-clr">Cancella tracce</button></div>
        <h4 class="dock-t">Le mie distanze (facoltativo)</h4>
        <p class="small mut" style="margin:0 0 8px">Non c'è nessuna tabella predefinita: se vuoi un suggerimento, inserisci tu i metri che fai con ogni bastone.</p>
        <div id="og-clubs"></div><form class="og-club-add" id="og-cadd"><input id="og-cn" placeholder="Bastone (es. Ferro 6)" aria-label="Nome bastone" maxlength="20"><input id="og-cm" type="number" inputmode="numeric" min="1" max="400" placeholder="m" aria-label="Metri"><button class="btn sm" type="submit">Aggiungi</button></form>
        <h4 class="dock-t">Campo</h4><div class="btns"><button type="button" class="btn sm ghost" id="og-other">Cambia campo</button><button type="button" class="btn sm ghost" id="og-refresh">Aggiorna dati OSM</button></div>
        <p class="small mut" style="margin:10px 0 0">Distanze calcolate con la formula di haversine sulle coordinate OSM, in metri: sono indicative. ${ATTR}.</p>`;
      host.innerHTML = `<div class="boardwrap stick" id="og-wrap"><svg id="board" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Mappa della buca ${hole.n}"><g id="og-base">${base}</g><g id="og-ov"></g></svg>${attr}</div>${kqDockHTML("og-dock", main, body)}`;
      const svg = $("#board", host), dock = $("#og-dock", host), wrap = $("#og-wrap", host);
      const fit = () => kqFitBox(svg, dock, [W / H], { x: 0, y: 0 });
      KQM.fit = fit; kqDockBind(dock, fit);
      let draft = null;
      const ov = () => {
        const items = hb.shots.map(s => `<path class="shot ${s.t}" d="${shotPathU(s)}"/>`);
        if (draft) items.push(`<path class="shot draft ${draft.t}" d="${shotPathU(draft)}"/>`);
        const p = hb.pin;
        if (p) {
          const m = measure(p);
          items.push(`<path class="og-ruler" d="M${f1(tee[0])} ${f1(tee[1])}L${f1(p[0])} ${f1(p[1])}L${f1(gr[0])} ${f1(gr[1])}"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="4.5" class="og-pin"/>
            <text x="${f1(Math.min(W - 6, Math.max(6, p[0])))}" y="${f1(Math.max(14, p[1] - 9))}" text-anchor="${p[0] > W / 2 ? "end" : "start"}" class="og-lbl big">Rimangono ${m.rem} m</text>`);
        }
        $("#og-ov", host).innerHTML = items.join("");
        $("#og-sub", host).textContent = readTxt();
      };
      const refresh = () => { ov(); kqInkSync(svg, hb); };
      refresh();
      const clubsUI = () => {
        const box = $("#og-clubs", host);
        box.innerHTML = osm.clubs.map((c, i) => `<div class="og-club"><span>${esc(c.n)}</span><b>${c.m} m</b><button type="button" class="btn sm ghost" data-cdel="${i}" aria-label="Elimina ${esc(c.n)}">×</button></div>`).join("");
        $$("[data-cdel]", box).forEach(x => x.onclick = () => { osm.clubs.splice(+x.dataset.cdel, 1); save(); clubsUI(); ov(); });
      };
      clubsUI();
      $("#og-cadd", host).onsubmit = e => { e.preventDefault(); const n = $("#og-cn", host).value.trim(), m = Math.round(+$("#og-cm", host).value); if (!n || !(m > 0 && m <= 400)) { toast("Inserisci nome e metri (1-400)"); return; } osm.clubs.push({ n, m }); save(); $("#og-cn", host).value = ""; $("#og-cm", host).value = ""; clubsUI(); ov(); };
      const go = i => { osm.hole = Math.max(0, Math.min(holes.length - 1, i)); save(); drawHole(geo, holes, course); };
      $("#og-prev", host).onclick = () => go(osm.hole - 1); $("#og-next", host).onclick = () => go(osm.hole + 1);
      $$("[data-hole]", host).forEach(x => x.onclick = () => go(+x.dataset.hole));
      $$("[data-otool]", host).forEach(x => x.onclick = () => { osm.tool = x.dataset.otool; save(); $$("[data-otool]", host).forEach(y => { const on = y === x; y.classList.toggle("on", on); y.setAttribute("aria-pressed", String(on)); }); });
      $("#og-undo", host).onclick = () => { if (hb.shots.length) hb.shots.pop(); else hb.pin = null; save(); ov(); };
      $("#og-clr", host).onclick = () => { hb.shots = []; hb.pin = null; save(); ov(); };
      $("#og-other", host).onclick = () => { osm.course = null; save(); screenSearch(); };
      $("#og-refresh", host).onclick = async () => { await cacheDel(course.key); choose(course, null, true); };
      const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(0, Math.min(W, q.x)), Math.max(0, Math.min(H, q.y))]; };
      let dr = null;
      svg.addEventListener("pointerdown", e => {
        e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (_) { }
        const p = pt(e), tool = osm.tool || "ruler"; dr = { a: p, tool };
        if (tool === "ruler") { hb.pin = p; ov(); }
      });
      svg.addEventListener("pointermove", e => {
        if (!dr) return; const p = pt(e);
        if (dr.tool === "ruler") { hb.pin = p; ov(); } else { draft = { t: dr.tool, x1: dr.a[0], y1: dr.a[1], x2: p[0], y2: p[1] }; ov(); }
      });
      const end = e => {
        if (!dr) return; const d = dr; dr = null; const had = draft; draft = null;
        if (d.tool !== "ruler" && e.type === "pointerup" && had && Math.hypot(had.x2 - had.x1, had.y2 - had.y1) > 12) { hb.shots.push(had); hb.pin = null; }
        save(); ov();
      };
      svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
      fit();
      kqBoardExtras(ctx.view, hb);
    }

    if (osm.course) choose(osm.course); else screenSearch();
  }

  window.KQGolfOSM = { mount, haversine, toGeo, listHoles, makeProj, joinRings, overpassQuery, shotPathU };
})();
