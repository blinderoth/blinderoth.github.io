// Chapter: The Weather. An 8-spoke element radar built from the innate elements of the spirits played.
// Per game: the average element profile of its spirits. Wins and losses are averaged separately.
// A guardian picker narrows it to the spirits one person played.

(() => {
  const ELEMENTS = ["Sun", "Moon", "Fire", "Air", "Water", "Earth", "Plant", "Animal"];
  let who = "";   // "" = everyone

  function profile(ctx) {
    const spirits = new Map((ctx.all.spirits || []).map(s => [s.name, s.elements || {}]));
    const acc = { win: { sum: ELEMENTS.map(() => 0), n: 0 }, loss: { sum: ELEMENTS.map(() => 0), n: 0 } };
    (ctx.data.matches || []).forEach(m => {
      const slots = (m.players || []).filter(p => p.spirit && (!who || (p.player || "").trim() === who));
      if (!slots.length) return;
      const v = ELEMENTS.map(e => slots.reduce((t, p) => t + Number((spirits.get(p.spirit) || {})[e] || 0), 0) / slots.length);
      const bucket = m.victory ? acc.win : acc.loss;
      v.forEach((x, i) => { bucket.sum[i] += x; });
      bucket.n++;
    });
    const avg = b => b.n ? b.sum.map(x => x / b.n) : null;
    return { win: avg(acc.win), loss: avg(acc.loss), nWin: acc.win.n, nLoss: acc.loss.n };
  }

  function render(ctx) {
    const svg = document.getElementById("weatherSvg");
    const info = document.getElementById("weatherInfo");
    const picker = document.getElementById("weatherWho");
    const tableEl = document.getElementById("weatherTable");
    if (!svg) return;

    // Guardian picker: everyone + each guardian with a game in the window
    const names = Array.from(new Set((ctx.data.matches || []).flatMap(m => (m.players || []).map(p => (p.player || "").trim()).filter(Boolean))));
    const counts = new Map(names.map(n => [n, (ctx.data.matches || []).filter(m => (m.players || []).some(p => (p.player || "").trim() === n)).length]));
    names.sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
    if (who && !names.includes(who)) who = "";
    if (picker) {
      picker.innerHTML = [["", "Everyone"]].concat(names.map(n => [n, n])).map(([v, l]) => `<button type="button" data-who="${escapeHtml(v)}" aria-pressed="${who === v}">${escapeHtml(l)}</button>`).join("");
      picker.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { who = b.dataset.who; render(ctx); }));
    }

    const P = profile(ctx);
    const max = Math.max(1, ...(P.win || []), ...(P.loss || [])) * 1.12;
    const R = 230;
    const ang = i => -Math.PI / 2 + (i / ELEMENTS.length) * Math.PI * 2;
    const at = (i, v) => [Math.cos(ang(i)) * R * (v / max), Math.sin(ang(i)) * R * (v / max)];
    const poly = vals => vals.map((v, i) => at(i, v).map(n => n.toFixed(1)).join(",")).join(" ");
    const icons = ctx.all.elementIcons || {};

    const rings = [0.25, 0.5, 0.75, 1].map(f => `<polygon class="wx-grid" points="${ELEMENTS.map((_, i) => [Math.cos(ang(i)) * R * f, Math.sin(ang(i)) * R * f].map(n => n.toFixed(1)).join(",")).join(" ")}"/>`).join("");
    const spokes = ELEMENTS.map((e, i) => {
      const [x, y] = [Math.cos(ang(i)) * R, Math.sin(ang(i)) * R];
      const [lx, ly] = [Math.cos(ang(i)) * (R + 38), Math.sin(ang(i)) * (R + 38)];
      return `<line class="wx-spoke" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>
        ${icons[e] ? `<image href="${escapeHtml(icons[e])}" x="${(lx - 13).toFixed(1)}" y="${(ly - 22).toFixed(1)}" width="26" height="26"/>` : ""}
        <text class="wx-lbl" x="${lx.toFixed(1)}" y="${(ly + 18).toFixed(1)}" text-anchor="middle">${e}</text>`;
    }).join("");

    const shape = (vals, cls) => vals ? `<polygon class="wx-shape ${cls}" points="${poly(vals)}" filter="url(#wxFx)"/>${vals.map((v, i) => { const [x, y] = at(i, v); return `<circle class="wx-dot ${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"><title>${ELEMENTS[i]}: ${v.toFixed(2)} on average in ${cls === "win" ? "wins" : "losses"}</title></circle>`; }).join("")}` : "";

    svg.innerHTML = `
      <defs>
        <filter id="wxFx" x="-20%" y="-20%" width="140%" height="140%">${ctx.theme === "journal"
          ? `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="6"/>`
          : `<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`}</filter>
      </defs>
      ${rings}${spokes}${shape(P.loss, "loss")}${shape(P.win, "win")}`;

    // Reading the sky: which elements tilt toward wins, which toward losses
    let text = "";
    if (P.win && P.loss) {
      const diff = ELEMENTS.map((e, i) => ({ e, d: P.win[i] - P.loss[i] })).sort((a, b) => b.d - a.d);
      const top = diff[0], low = diff[diff.length - 1];
      text = `<p class="hint">Wins carry more <b>${top.e}</b> (+${top.d.toFixed(1)} per spirit). Losses lean on <b>${low.e}</b> (${(-low.d).toFixed(1)} more per spirit).</p>`;
    } else if (P.win || P.loss) {
      text = `<p class="hint">Only ${P.win ? "wins" : "losses"} in this stretch, so there is nothing to compare yet.</p>`;
    }
    const strongest = (P.win || P.loss) ? ELEMENTS.map((e, i) => ({ e, v: ((P.win || [])[i] || 0) * P.nWin + ((P.loss || [])[i] || 0) * P.nLoss })).sort((a, b) => b.v - a.v)[0] : null;
    info.innerHTML = `
      <p class="kicker">${who ? escapeHtml(who) : "Everyone"}</p>
      <h3>${strongest ? `Mostly ${strongest.e}` : "Clear skies"}</h3>
      <div class="wx-key"><span class="wx-k win"></span>Wins (${P.nWin}) <span class="wx-k loss"></span>Losses (${P.nLoss})</div>
      ${text || `<p class="hint">No games for this guardian in this stretch.</p>`}
      <p class="hint muted">Built from each spirit's printed elements. Cards played in a game are not logged.</p>`;

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>Element</th><th>Wins, avg per spirit</th><th>Losses, avg per spirit</th></tr></thead><tbody>${ELEMENTS.map((e, i) => `<tr><td>${e}</td><td>${P.win ? P.win[i].toFixed(2) : "–"}</td><td>${P.loss ? P.loss[i].toFixed(2) : "–"}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  Realm.register("weather", render);
})();
