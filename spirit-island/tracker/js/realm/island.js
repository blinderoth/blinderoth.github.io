// Chapter: The Island. Each adversary holds a stretch of the island; levels 0 to 6 run from the coast inland.
// A ring is grown when you have won at that level, blighted when you have only lost there, bare when untried.
// Scenarios sit around the island as landmarks in the sea.

(() => {
  let cur = { a: 0, l: 0, kind: "ring" };   // keyboard / hover cursor
  const LEVELS = 7;

  const shortAdv = n => String(n).replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "").replace("Brandenburg-Prussia", "Prussia").replace("Habsburg Monarchy", "Habsburg").replace("Habsburg Mining Expedition", "Mining Exp.");
  const scnFamily = n => /^(Normal|Large) Surges of Colonization$/.test(n) ? "Surges of Colonization" : n;

  // An organic coastline: radius wobbles with the angle
  const coast = (R, t) => R * (1 + 0.055 * Math.sin(3 * t + 1.1) + 0.035 * Math.sin(5 * t + 2.3) + 0.025 * Math.sin(8 * t + 0.4));
  const pt = (r, t) => [Math.cos(t) * r, Math.sin(t) * r];

  function band(R, t1, t2, fOut, fIn) {
    const N = 22, out = [], inn = [];
    for (let k = 0; k <= N; k++) {
      const t = t1 + (t2 - t1) * (k / N), c = coast(R, t);
      out.push(pt(c * fOut, t));
      inn.push(pt(c * fIn, t));
    }
    const path = out.concat(inn.reverse());
    return "M" + path.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L") + " Z";
  }

  function stats(ctx) {
    const advs = (ctx.all.adversaries || []);
    const by = {};
    advs.forEach(a => { by[a.name] = Array.from({ length: LEVELS }, () => ({ games: [], wins: [] })); });
    (ctx.data.matches || []).forEach(m => {
      [[m.adversary1, m.adversary1Level], [m.adversary2, m.adversary2Level]].forEach(([name, lvl]) => {
        if (!name || !by[name] || lvl === null || lvl === "" || lvl === undefined) return;
        const L = Number(lvl);
        if (!(L >= 0 && L < LEVELS)) return;
        by[name][L].games.push(m);
        if (m.victory) by[name][L].wins.push(m);
      });
    });
    const scn = new Map();
    (ctx.all.scenarios || []).forEach(s => { const k = scnFamily(s.name); if (!scn.has(k)) scn.set(k, { name: k, ref: s, games: [], wins: [] }); });
    (ctx.data.matches || []).forEach(m => {
      if (!m.scenario) return;
      const e = scn.get(scnFamily(m.scenario));
      if (!e) return;
      e.games.push(m); if (m.victory) e.wins.push(m);
    });
    return { advs, by, scn: Array.from(scn.values()) };
  }

  const bestGame = c => c.wins.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || c.games.slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];

  function cardFor(ctx, S) {
    if (cur.kind === "scn") {
      const s = S.scn[cur.a];
      if (!s) return "";
      const g = bestGame(s);
      const state = s.wins.length ? "Won" : s.games.length ? "Not won yet" : "Not played";
      return `<p class="kicker">Landmark</p><h3>${escapeHtml(s.name)}</h3>
        <p class="hint">${state} · ${s.games.length} ${s.games.length === 1 ? "game" : "games"}, ${s.wins.length} ${s.wins.length === 1 ? "win" : "wins"}${s.wins.length ? ` · best ${SIAnalytics.formatNum(Math.max(...s.wins.map(m => Number(m.score || 0))), 1)}` : ""}</p>
        ${g ? `<a class="tc-link" href="index.html#game=${encodeURIComponent(g.id)}">Open ${s.wins.length ? "the best win" : "the latest try"} in the tracker →</a>` : ""}`;
    }
    const a = S.advs[cur.a];
    if (!a) return "";
    const c = S.by[a.name][cur.l];
    const g = bestGame(c);
    const won = c.wins.length, tried = c.games.length;
    const reclaimed = S.by[a.name].filter(x => x.wins.length).length;
    const state = won ? "Grown back" : tried ? "Blighted" : "Untouched";
    return `<p class="kicker">${escapeHtml(shortAdv(a.name))} · level ${cur.l}</p><h3>${state}</h3>
      <p class="hint">${tried ? `${tried} ${tried === 1 ? "game" : "games"}, ${won} ${won === 1 ? "win" : "wins"}${won ? ` · best ${SIAnalytics.formatNum(Math.max(...c.wins.map(m => Number(m.score || 0))), 1)}` : ""}` : "No invasion at this level yet."}</p>
      <p class="hint">${escapeHtml(a.name)}: ${reclaimed} of ${LEVELS} levels reclaimed.</p>
      ${g ? `<a class="tc-link" href="index.html#game=${encodeURIComponent(g.id)}">Open ${won ? "the best win" : "the latest try"} in the tracker →</a>` : ""}`;
  }

  function render(ctx) {
    const svg = document.getElementById("islandSvg");
    const info = document.getElementById("islandInfo");
    const tableEl = document.getElementById("islandTable");
    if (!svg) return;
    const S = stats(ctx);
    const nA = S.advs.length;
    if (!nA) { svg.innerHTML = ""; return; }
    if (cur.kind === "ring" && cur.a >= nA) cur.a = 0;
    if (cur.kind === "scn" && cur.a >= S.scn.length) cur = { a: 0, l: 0, kind: "ring" };

    const R = 270, core = 0.2, bandW = (1 - core) / LEVELS;
    const gap = 0.012;
    const sector = (Math.PI * 2) / nA;
    let rings = "", labels = "", seams = "";
    S.advs.forEach((a, ai) => {
      const t1 = -Math.PI / 2 + ai * sector + gap, t2 = -Math.PI / 2 + (ai + 1) * sector - gap;
      S.by[a.name].forEach((c, l) => {
        const cls = c.wins.length ? "won" : c.games.length ? "lost" : "bare";
        const d = band(R, t1, t2, 1 - l * bandW, 1 - (l + 1) * bandW + 0.006);
        rings += `<path class="is-ring ${cls}${cur.kind === "ring" && cur.a === ai && cur.l === l ? " on" : ""}" data-a="${ai}" data-l="${l}" d="${d}"/>`;
        if (cls === "lost") rings += `<path class="is-hatch" d="${d}" fill="url(#isHatch)"/>`;
      });
      const tm = (t1 + t2) / 2;
      const [fx, fy] = pt(coast(R, tm) + 34, tm);
      const flag = (a.flag || a.localIcon || "").replace(/\.svg$/, ".webp");
      const left = Math.cos(tm) < -0.2, right = Math.cos(tm) > 0.2;
      labels += `<g class="is-flag" data-a="${ai}">
        <image href="${escapeHtml(flag)}" x="${(fx - 17).toFixed(1)}" y="${(fy - 11).toFixed(1)}" width="34" height="22" preserveAspectRatio="xMidYMid slice"/>
        <text class="is-name" x="${fx.toFixed(1)}" y="${(fy + 26).toFixed(1)}" text-anchor="${left ? "end" : right ? "start" : "middle"}" dx="${left ? 14 : right ? -14 : 0}">${escapeHtml(shortAdv(a.name))}</text></g>`;
      const [sx, sy] = pt(coast(R, t1 - gap), t1 - gap);
      seams += `<line class="is-seam" x1="0" y1="0" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}"/>`;
    });

    // Scenario landmarks in the sea
    const nS = S.scn.length, RS = 392;
    const marks = S.scn.map((s, si) => {
      const t = -Math.PI / 2 + (si + 0.5) * (Math.PI * 2 / nS) + Math.PI / nA;
      const [x, y] = pt(RS, t);
      const img = String(s.ref.image || "").replace(/\.svg$/, ".webp");
      const cls = s.wins.length ? "won" : s.games.length ? "lost" : "bare";
      return `<g class="is-scn ${cls}${cur.kind === "scn" && cur.a === si ? " on" : ""}" data-s="${si}">
        <clipPath id="isS${si}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17"/></clipPath>
        <circle class="is-scn-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20"/>
        <image href="${escapeHtml(img)}" x="${(x - 17).toFixed(1)}" y="${(y - 17).toFixed(1)}" width="34" height="34" clip-path="url(#isS${si})" preserveAspectRatio="xMidYMid slice"/>
        <title>${escapeHtml(s.name)}</title></g>`;
    }).join("");

    const reclaimed = S.advs.reduce((n, a) => n + S.by[a.name].filter(c => c.wins.length).length, 0);
    const total = nA * LEVELS;
    const scnWon = S.scn.filter(s => s.wins.length).length;

    svg.innerHTML = `
      <defs>
        <pattern id="isHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="7" class="is-hatch-line"/></pattern>
        <filter id="isInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${ctx.theme === "journal" ? 4 : 0}"/></filter>
        <filter id="isGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${ctx.theme === "night" ? 6 : 0}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle class="is-sea" r="440"/>
      <circle class="is-wave" r="${R + 64}"/><circle class="is-wave" r="${R + 100}"/>
      <path class="is-shore" d="${band(R * 1.035, -Math.PI / 2, Math.PI * 1.5, 1, 0)}" filter="url(#isInk)"/>
      <g filter="url(#isInk)">${rings}</g>
      ${seams}
      <circle class="is-heart" r="${(R * core * 1.02).toFixed(1)}" filter="url(#isGlow)"/>
      <text class="is-heart-num" y="4" text-anchor="middle">${reclaimed}</text>
      <text class="is-heart-lbl" y="26" text-anchor="middle">of ${total} reclaimed</text>
      ${labels}${marks}`;

    // ---- interaction ----
    const set = c => {
      cur = c;
      svg.querySelectorAll(".is-ring").forEach(p => p.classList.toggle("on", cur.kind === "ring" && Number(p.dataset.a) === cur.a && Number(p.dataset.l) === cur.l));
      svg.querySelectorAll(".is-scn").forEach(g => g.classList.toggle("on", cur.kind === "scn" && Number(g.dataset.s) === cur.a));
      info.innerHTML = cardFor(ctx, S);
    };
    svg.querySelectorAll(".is-ring").forEach(p => {
      const c = () => set({ a: Number(p.dataset.a), l: Number(p.dataset.l), kind: "ring" });
      p.addEventListener("pointerenter", c); p.addEventListener("click", c);
    });
    svg.querySelectorAll(".is-scn").forEach(g => {
      const c = () => set({ a: Number(g.dataset.s), l: 0, kind: "scn" });
      g.addEventListener("pointerenter", c); g.addEventListener("click", c);
    });
    svg.onkeydown = e => {
      const k = e.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Tab"].includes(k) || k === "Tab") return;
      e.preventDefault();
      if (k === "Enter") { const a = info.querySelector("a.tc-link"); if (a) location.href = a.href; return; }
      if (cur.kind === "scn") {
        if (k === "ArrowRight") set({ ...cur, a: (cur.a + 1) % nS });
        else if (k === "ArrowLeft") set({ ...cur, a: (cur.a - 1 + nS) % nS });
        else if (k === "ArrowDown") set({ a: 0, l: LEVELS - 1, kind: "ring" });
        return;
      }
      if (k === "ArrowRight") set({ ...cur, a: (cur.a + 1) % nA });
      else if (k === "ArrowLeft") set({ ...cur, a: (cur.a - 1 + nA) % nA });
      else if (k === "ArrowDown") set({ ...cur, l: Math.min(LEVELS - 1, cur.l + 1) });
      else if (k === "ArrowUp") { if (cur.l === 0) set({ a: 0, l: 0, kind: "scn" }); else set({ ...cur, l: cur.l - 1 }); }
    };
    info.innerHTML = cardFor(ctx, S);

    const sum = document.getElementById("islandSummary");
    if (sum) sum.innerHTML = `<b>${reclaimed}</b> of ${total} adversary levels grown back · <b>${scnWon}</b> of ${nS} landmarks won`;

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>Adversary</th>${Array.from({ length: LEVELS }, (_, l) => `<th>L${l}</th>`).join("")}</tr></thead><tbody>${S.advs.map(a => `<tr><td>${escapeHtml(a.name)}</td>${S.by[a.name].map(c => `<td>${c.wins.length ? "Won" : c.games.length ? "Lost" : "–"}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <table><thead><tr><th>Scenario</th><th>Games</th><th>Wins</th></tr></thead><tbody>${S.scn.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${s.games.length}</td><td>${s.wins.length}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  Realm.register("island", render);
})();
