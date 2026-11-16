// Chapter: The Tides. Every game in date order as a wave; score is the height.
// Foam above each crest = surviving Dahan, sludge below = blight. The brush under the wave sets the time window.

(() => {
  let cursor = null;            // index of the highlighted game
  let drag = null;              // active brush drag

  function smoothPath(pts) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function spiritsOf(m) { return (m.players || []).map(p => p.spirit).filter(Boolean); }

  function card(ctx, m) {
    if (!m) return `<p class="muted">No games in this stretch.</p>`;
    const adv = m.adversary1 ? `${escapeHtml(m.adversary1)}${m.adversary1Level !== null && m.adversary1Level !== "" && m.adversary1Level !== undefined ? " L" + escapeHtml(m.adversary1Level) : ""}` : "Base island";
    return `
      <div class="tc-head">
        <span class="tc-badge ${m.victory ? "win" : "loss"}">${m.victory ? "Victory" : "Defeat"}</span>
        <h3>Invasion #${escapeHtml(m.id)} <em>${escapeHtml(ctx.fmtDate(m.date))}</em></h3>
      </div>
      <p class="tc-spirits">${(m.players || []).map(p => `${escapeHtml(p.spirit || "?")}${p.aspect && p.aspect !== "Base" ? ` <i>(${escapeHtml(p.aspect)})</i>` : ""} <span class="muted">· ${escapeHtml(p.player || "")}</span>`).join("<br>")}</p>
      <p class="tc-foe">${adv}${m.scenario ? ` · ${escapeHtml(m.scenario)}` : ""}${!m.victory && m.lossCondition ? ` · <span class="lossword">${escapeHtml(m.lossCondition)}</span>` : ""}</p>
      <div class="tc-figs">
        <div><b>${SIAnalytics.formatNum(m.score, 1)}</b><span>score</span></div>
        <div><b>${escapeHtml(m.difficulty ?? 0)}</b><span>difficulty</span></div>
        <div><b>${escapeHtml(m.dahan ?? 0)}</b><span>Dahan</span></div>
        <div><b>${escapeHtml(m.blight ?? 0)}</b><span>blight</span></div>
      </div>
      ${m.notes ? `<p class="tc-notes">“${escapeHtml(m.notes)}”</p>` : ""}
      <a class="tc-link" href="index.html#game=${encodeURIComponent(m.id)}">Open in the tracker →</a>`;
  }

  function render(ctx) {
    const svg = document.getElementById("tidesSvg");
    const cardEl = document.getElementById("tideCard");
    const tableEl = document.getElementById("tidesTable");
    if (!svg) return;
    const G = ctx.games, n = G.length;
    if (!n) { svg.innerHTML = ""; cardEl.innerHTML = `<p class="muted">No invasions yet.</p>`; return; }

    const W = Math.max(320, Math.round(svg.parentElement.clientWidth || 900));
    const narrow = W < 560;
    const H = narrow ? 270 : 320;
    const padL = narrow ? 30 : 42, padR = 14, top = 26, waveBottom = H - 74, brushY = H - 34;
    const step = n > 1 ? (W - padL - padR) / (n - 1) : 0;
    const xOf = i => padL + i * step;
    const maxScore = Math.max(10, ...G.map(m => Number(m.score || 0)));
    const yOf = s => waveBottom - (Math.max(0, Number(s || 0)) / maxScore) * (waveBottom - top - 18);
    const pts = G.map((m, i) => [xOf(i), yOf(m.score)]);
    const linePath = smoothPath(pts);
    const areaPath = `${linePath} L${xOf(n - 1).toFixed(1)},${waveBottom} L${xOf(0).toFixed(1)},${waveBottom} Z`;
    const r = ctx.range;
    if (cursor === null || cursor >= n) cursor = r.to;
    if (cursor < r.from || cursor > r.to) cursor = r.to;

    // Score gridlines
    const ticks = [0, 0.5, 1].map(f => Math.round(maxScore * f));
    const grid = ticks.map(t => `<line class="td-grid" x1="${padL}" x2="${W - padR}" y1="${yOf(t).toFixed(1)}" y2="${yOf(t).toFixed(1)}"/><text class="td-axis" x="${padL - 8}" y="${(yOf(t) + 4).toFixed(1)}" text-anchor="end">${t}</text>`).join("");

    // Month labels where the month changes
    let lastMonth = "";
    const months = G.map((m, i) => {
      const mo = String(m.date || "").slice(0, 7);
      if (!mo || mo === lastMonth) return "";
      lastMonth = mo;
      const label = new Date(mo + "-15T12:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      return `<line class="td-month" x1="${xOf(i).toFixed(1)}" x2="${xOf(i).toFixed(1)}" y1="${top}" y2="${waveBottom + 6}"/><text class="td-axis" x="${(xOf(i) + 4).toFixed(1)}" y="${waveBottom + 18}">${label}</text>`;
    }).join("");

    // Crests, foam and sludge
    const fs = narrow ? 0.9 : 1.4;
    const marks = G.map((m, i) => {
      const x = xOf(i).toFixed(1), y = yOf(m.score);
      const foam = Math.max(0, Number(m.dahan || 0)) * fs, sludge = Math.max(0, Number(m.blight || 0)) * fs;
      return `<g class="td-game${i >= r.from && i <= r.to ? "" : " out"}${i === cursor ? " on" : ""}" data-i="${i}">
        ${foam ? `<line class="td-foam" x1="${x}" x2="${x}" y1="${(y - 6).toFixed(1)}" y2="${(y - 6 - foam).toFixed(1)}"/>` : ""}
        ${sludge ? `<line class="td-sludge" x1="${x}" x2="${x}" y1="${(y + 6).toFixed(1)}" y2="${Math.min(waveBottom, y + 6 + sludge).toFixed(1)}"/>` : ""}
        <circle class="td-crest ${m.victory ? "win" : "loss"}" cx="${x}" cy="${y.toFixed(1)}" r="${narrow ? 3.4 : 4.6}"/>
      </g>`;
    }).join("");

    const hits = G.map((m, i) => `<rect class="td-hit" data-i="${i}" x="${(xOf(i) - Math.max(step, 6) / 2).toFixed(1)}" y="${top - 10}" width="${Math.max(step, 6).toFixed(1)}" height="${waveBottom - top + 16}"/>`).join("");

    // Outside the window is veiled
    const x0 = n > 1 ? xOf(r.from) - step / 2 : padL - 6, x1 = n > 1 ? xOf(r.to) + step / 2 : padL + 6;
    const veil = (r.from > 0 ? `<rect class="td-veil" x="0" y="${top - 12}" width="${Math.max(0, x0).toFixed(1)}" height="${waveBottom - top + 14}"/>` : "")
      + (r.to < n - 1 ? `<rect class="td-veil" x="${x1.toFixed(1)}" y="${top - 12}" width="${Math.max(0, W - x1).toFixed(1)}" height="${waveBottom - top + 14}"/>` : "");

    const cx = xOf(cursor);
    const brush = `
      <rect class="td-track" x="${padL - 6}" y="${brushY - 7}" width="${W - padL - padR + 12}" height="14" rx="7"/>
      <rect class="td-window" x="${x0.toFixed(1)}" y="${brushY - 7}" width="${Math.max(10, x1 - x0).toFixed(1)}" height="14" rx="7"/>
      <g class="td-handle" data-h="from" role="slider" tabindex="0" aria-label="Start of the time window" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${r.from + 1}" aria-valuetext="${escapeHtml(ctx.fmtDate(G[r.from].date))}, game ${r.from + 1} of ${n}" transform="translate(${x0.toFixed(1)},${brushY})"><circle r="11" class="td-grip"/><line x1="0" x2="0" y1="-5" y2="5"/></g>
      <g class="td-handle" data-h="to" role="slider" tabindex="0" aria-label="End of the time window" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${r.to + 1}" aria-valuetext="${escapeHtml(ctx.fmtDate(G[r.to].date))}, game ${r.to + 1} of ${n}" transform="translate(${x1.toFixed(1)},${brushY})"><circle r="11" class="td-grip"/><line x1="0" x2="0" y1="-5" y2="5"/></g>`;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.innerHTML = `
      <defs>
        <linearGradient id="tdFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sea)" stop-opacity=".55"/><stop offset="1" stop-color="var(--sea)" stop-opacity=".06"/></linearGradient>
        <filter id="tdInk" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="${ctx.theme === "journal" ? 3 : 0}"/></filter>
        <filter id="tdGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${ctx.theme === "night" ? 3 : 0}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${grid}${months}
      <path class="td-area" d="${areaPath}" fill="url(#tdFill)" filter="url(#tdInk)"/>
      <path class="td-line" d="${linePath}" filter="url(#tdGlow)"/>
      <line class="td-cursor" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${top - 10}" y2="${waveBottom}"/>
      ${marks}${veil}${hits}${brush}`;

    cardEl.innerHTML = card(ctx, G[cursor]);
    if (tableEl) {
      const rows = G.slice(r.from, r.to + 1);
      tableEl.innerHTML = `<table><thead><tr><th>#</th><th>Date</th><th>Result</th><th>Spirits</th><th>Score</th><th>Dahan</th><th>Blight</th></tr></thead><tbody>${rows.map(m => `<tr><td>${escapeHtml(m.id)}</td><td>${escapeHtml(m.date || "")}</td><td>${m.victory ? "Victory" : "Defeat"}</td><td>${spiritsOf(m).map(escapeHtml).join(", ")}</td><td>${SIAnalytics.formatNum(m.score, 1)}</td><td>${escapeHtml(m.dahan ?? 0)}</td><td>${escapeHtml(m.blight ?? 0)}</td></tr>`).join("")}</tbody></table>`;
    }

    // ---- interaction ----
    const setCursor = i => {
      cursor = Math.max(0, Math.min(n - 1, i));
      svg.querySelectorAll(".td-game").forEach(g => g.classList.toggle("on", Number(g.dataset.i) === cursor));
      const c = svg.querySelector(".td-cursor");
      if (c) { c.setAttribute("x1", xOf(cursor).toFixed(1)); c.setAttribute("x2", xOf(cursor).toFixed(1)); }
      cardEl.innerHTML = card(ctx, G[cursor]);
    };
    svg.querySelectorAll(".td-hit").forEach(h => {
      h.addEventListener("pointerenter", () => setCursor(Number(h.dataset.i)));
      h.addEventListener("click", () => setCursor(Number(h.dataset.i)));
    });
    svg.onkeydown = e => {
      if (e.target !== svg) return;
      if (e.key === "ArrowRight") { e.preventDefault(); setCursor(cursor + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setCursor(cursor - 1); }
      else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
      else if (e.key === "End") { e.preventDefault(); setCursor(n - 1); }
      else if (e.key === "Enter") { location.href = `index.html#game=${encodeURIComponent(G[cursor].id)}`; }
    };

    const idxAt = clientX => {
      const box = svg.getBoundingClientRect();
      const x = (clientX - box.left) * (W / box.width);
      return n > 1 ? Math.round((x - padL) / step) : 0;
    };
    svg.querySelectorAll(".td-handle").forEach(hd => {
      hd.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); drag = { kind: hd.dataset.h }; svg.setPointerCapture(e.pointerId); });
      hd.addEventListener("keydown", e => {
        const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const which = hd.dataset.h;
        if (which === "from") ctx.setRange(r.from + delta, r.to); else ctx.setRange(r.from, r.to + delta);
        requestAnimationFrame(() => requestAnimationFrame(() => svg.querySelector(`.td-handle[data-h="${which}"]`)?.focus()));
      });
    });
    const win = svg.querySelector(".td-window");
    win.addEventListener("pointerdown", e => { e.preventDefault(); drag = { kind: "move", start: idxAt(e.clientX), from: r.from, to: r.to }; svg.setPointerCapture(e.pointerId); });
    svg.onpointermove = e => {
      if (!drag) return;
      const i = idxAt(e.clientX);
      if (drag.kind === "from") ctx.setRange(Math.min(i, ctx.range.to), ctx.range.to);
      else if (drag.kind === "to") ctx.setRange(ctx.range.from, Math.max(i, ctx.range.from));
      else {
        const span = drag.to - drag.from;
        let f = drag.from + (i - drag.start);
        f = Math.max(0, Math.min(n - 1 - span, f));
        ctx.setRange(f, f + span);
      }
    };
    svg.onpointerup = svg.onpointercancel = () => { drag = null; };
  }

  Realm.register("tides", render);
})();
