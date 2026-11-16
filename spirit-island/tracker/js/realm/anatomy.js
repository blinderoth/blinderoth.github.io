// Chapter: Anatomy of a Score. Every game's score split into the pieces of the formula.
// Win:  5 × difficulty + 10 + 2 × invader cards left + (Dahan − blight) / players
// Loss: 2 × difficulty + invader cards out + (Dahan − blight) / players

(() => {
  let sortBy = "played";   // "played" | "score"
  let cursor = null;
  const PARTS = [
    { key: "diff", label: "Difficulty" },
    { key: "bonus", label: "Victory bonus" },
    { key: "cards", label: "Invader cards" },
    { key: "island", label: "Island (Dahan − blight)" }
  ];

  function parts(m) {
    const d = Number(m.difficulty || 0);
    const players = Math.max(1, Number(m.playerCount || (m.players || []).length || 1));
    const island = (Number(m.dahan || 0) - Number(m.blight || 0)) / players;
    return m.victory
      ? { diff: 5 * d, bonus: 10, cards: 2 * Number(m.invaderCardsInDeck || 0), island }
      : { diff: 2 * d, bonus: 0, cards: Number(m.invaderCardsNotInDeck || 0), island };
  }
  const total = p => p.diff + p.bonus + p.cards + p.island;
  const f1 = n => (Math.round(n * 10) / 10).toString();

  function render(ctx) {
    const svg = document.getElementById("anatomySvg");
    const info = document.getElementById("anatomyInfo");
    const share = document.getElementById("anatomyShare");
    const tableEl = document.getElementById("anatomyTable");
    const sortEl = document.getElementById("anatomySort");
    if (!svg) return;

    if (sortEl && !sortEl.dataset.bound) {
      sortEl.dataset.bound = "1";
      sortEl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { sortBy = b.dataset.sort; cursor = null; Realm.renderAll(); }));
    }
    sortEl?.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sort === sortBy)));

    const rows = (ctx.data.matches || []).map(m => ({ m, p: parts(m) }));
    if (sortBy === "score") rows.sort((a, b) => total(b.p) - total(a.p));
    const n = rows.length;
    if (!n) { svg.innerHTML = ""; info.innerHTML = `<p class="muted">No games in this stretch.</p>`; if (share) share.innerHTML = ""; return; }
    if (cursor === null || cursor >= n) cursor = sortBy === "score" ? 0 : n - 1;

    // Where the points come from, across the window
    const sums = { diff: 0, bonus: 0, cards: 0, island: 0 };
    rows.forEach(r => PARTS.forEach(k => { sums[k.key] += r.p[k.key]; }));
    const pos = PARTS.reduce((t, k) => t + Math.max(0, sums[k.key]), 0) || 1;
    if (share) {
      share.innerHTML = `<div class="an-bar">${PARTS.filter(k => sums[k.key] > 0).map(k => `<span class="an-seg ${k.key}" style="flex:${sums[k.key].toFixed(2)}" title="${k.label}: ${Math.round(sums[k.key] / pos * 100)}%"></span>`).join("")}</div>
        <div class="an-legend">${PARTS.map(k => `<span><i class="an-sw ${k.key}"></i>${k.label} <b>${sums[k.key] >= 0 ? Math.round(sums[k.key] / pos * 100) + "%" : f1(sums[k.key]) + " pts"}</b></span>`).join("")}</div>`;
    }

    const W = Math.max(320, Math.round(svg.parentElement.clientWidth || 900));
    const narrow = W < 560;
    const H = narrow ? 260 : 300, padL = narrow ? 30 : 40, padR = 10, top = 14, bottom = 26;
    const maxPos = Math.max(10, ...rows.map(r => r.p.diff + r.p.bonus + r.p.cards + Math.max(0, r.p.island)));
    const minNeg = Math.min(0, ...rows.map(r => Math.min(0, r.p.island)));
    const span = maxPos - minNeg;
    const y0 = top + (H - top - bottom) * (maxPos / span);
    const unit = (H - top - bottom) / span;
    const slot = (W - padL - padR) / n;
    const bw = Math.max(2, Math.min(26, slot * 0.72));

    const bars = rows.map((r, i) => {
      const x = padL + i * slot + (slot - bw) / 2;
      let y = y0, segs = "";
      ["diff", "bonus", "cards"].forEach(k => {
        const h = r.p[k] * unit;
        if (h <= 0) return;
        y -= h;
        segs += `<rect class="an-seg ${k}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>`;
      });
      const isl = r.p.island * unit;
      if (isl > 0) { y -= isl; segs += `<rect class="an-seg island" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${isl.toFixed(1)}"/>`; }
      else if (isl < 0) segs += `<rect class="an-seg island neg" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(-isl).toFixed(1)}"/>`;
      return `<g class="an-col${r.m.victory ? "" : " loss"}${i === cursor ? " on" : ""}" data-i="${i}">${segs}
        <rect class="an-hit" data-i="${i}" x="${(padL + i * slot).toFixed(1)}" y="${top}" width="${slot.toFixed(1)}" height="${H - top - bottom + 6}"/></g>`;
    }).join("");
    const ticks = [0, Math.round(maxPos / 2), Math.round(maxPos)].map(t => `<line class="td-grid" x1="${padL}" x2="${W - padR}" y1="${(y0 - t * unit).toFixed(1)}" y2="${(y0 - t * unit).toFixed(1)}"/><text class="td-axis" x="${padL - 6}" y="${(y0 - t * unit + 4).toFixed(1)}" text-anchor="end">${t}</text>`).join("");

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.innerHTML = `${ticks}<line class="an-zero" x1="${padL}" x2="${W - padR}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>${bars}
      <text class="td-axis" x="${padL}" y="${H - 6}">${sortBy === "score" ? "Highest score" : "First game in view"}</text>
      <text class="td-axis" x="${W - padR}" y="${H - 6}" text-anchor="end">${sortBy === "score" ? "Lowest" : "Latest"}</text>`;

    const showCard = () => {
      const { m, p } = rows[cursor];
      info.innerHTML = `
        <p class="kicker">Invasion #${escapeHtml(m.id)} · ${escapeHtml(ctx.fmtDate(m.date))} · ${m.victory ? "Victory" : "Defeat"}</p>
        <h3>${f1(total(p))} points</h3>
        <ul class="an-sum">
          <li><i class="an-sw diff"></i><span>Difficulty ${escapeHtml(m.difficulty ?? 0)} × ${m.victory ? 5 : 2}</span><b>${f1(p.diff)}</b></li>
          ${m.victory ? `<li><i class="an-sw bonus"></i><span>Victory bonus</span><b>10</b></li>` : ""}
          <li><i class="an-sw cards"></i><span>${m.victory ? `Invader cards left ${escapeHtml(m.invaderCardsInDeck ?? 0)} × 2` : `Invader cards out ${escapeHtml(m.invaderCardsNotInDeck ?? 0)}`}</span><b>${f1(p.cards)}</b></li>
          <li><i class="an-sw island"></i><span>(Dahan ${escapeHtml(m.dahan ?? 0)} − blight ${escapeHtml(m.blight ?? 0)}) ÷ ${Math.max(1, Number(m.playerCount || (m.players || []).length || 1))} players</span><b>${f1(p.island)}</b></li>
        </ul>
        <a class="tc-link" href="index.html#game=${encodeURIComponent(m.id)}">Open in the tracker →</a>`;
    };
    const setCursor = i => {
      cursor = Math.max(0, Math.min(n - 1, i));
      svg.querySelectorAll(".an-col").forEach(g => g.classList.toggle("on", Number(g.dataset.i) === cursor));
      showCard();
    };
    svg.querySelectorAll(".an-hit").forEach(h => {
      h.addEventListener("pointerenter", () => setCursor(Number(h.dataset.i)));
      h.addEventListener("click", () => setCursor(Number(h.dataset.i)));
    });
    svg.onkeydown = e => {
      if (e.key === "ArrowRight") { e.preventDefault(); setCursor(cursor + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setCursor(cursor - 1); }
      else if (e.key === "Enter") location.href = `index.html#game=${encodeURIComponent(rows[cursor].m.id)}`;
    };
    showCard();

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>#</th><th>Result</th><th>Difficulty</th><th>Bonus</th><th>Cards</th><th>Island</th><th>Total</th></tr></thead><tbody>${rows.map(({ m, p }) => `<tr><td>${escapeHtml(m.id)}</td><td>${m.victory ? "Victory" : "Defeat"}</td><td>${f1(p.diff)}</td><td>${f1(p.bonus)}</td><td>${f1(p.cards)}</td><td>${f1(p.island)}</td><td>${f1(total(p))}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  Realm.register("anatomy", render);
})();
