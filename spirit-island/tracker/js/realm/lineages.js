// Chapter: The Lineages. One strip per spirit, one stripe per game in time order.
// A stripe is drawn where the spirit played: colour = result, height = difficulty.

(() => {
  let cur = { row: 0, col: null };

  function render(ctx) {
    const svg = document.getElementById("linSvg");
    const info = document.getElementById("linInfo");
    const tableEl = document.getElementById("linTable");
    if (!svg) return;
    const games = ctx.data.matches || [];
    const n = games.length;
    const rowsBy = new Map();
    games.forEach((m, gi) => (m.players || []).forEach(p => {
      if (!p.spirit) return;
      if (!rowsBy.has(p.spirit)) rowsBy.set(p.spirit, { name: p.spirit, cells: new Map(), first: gi });
      rowsBy.get(p.spirit).cells.set(gi, { m, p });
    }));
    const rows = Array.from(rowsBy.values()).sort((a, b) => a.first - b.first);
    if (!rows.length) { svg.innerHTML = ""; info.innerHTML = `<p class="muted">No games in this stretch.</p>`; return; }
    if (cur.row >= rows.length) cur = { row: 0, col: null };

    const W = Math.max(320, Math.round(svg.parentElement.clientWidth || 900));
    const narrow = W < 560;
    const labelW = narrow ? 0 : 230, rowH = narrow ? 34 : 26, labelH = narrow ? 14 : 0;
    const padR = 54, top = 6;
    const step = (W - labelW - padR) / Math.max(1, n);
    const maxD = Math.max(1, ...games.map(m => Number(m.difficulty || 0)));
    const H = top + rows.length * rowH + 30;
    const stripeW = Math.max(1.5, Math.min(14, step * 0.7));

    const art = new Map((ctx.all.spirits || []).map(s => [s.name, s.image]));
    let body = "";
    rows.forEach((r, ri) => {
      const y = top + ri * rowH;
      const base = y + rowH - 6;
      const plays = r.cells.size, wins = Array.from(r.cells.values()).filter(c => c.m.victory).length;
      body += `<g class="ln-row${ri === cur.row ? " on" : ""}" data-r="${ri}">
        <rect class="ln-band" x="0" y="${y}" width="${W}" height="${rowH}"/>
        <line class="ln-base" x1="${labelW}" x2="${W - padR}" y1="${base}" y2="${base}"/>
        ${narrow
          ? `<text class="ln-name small" x="0" y="${y + 11}">${escapeHtml(r.name)}</text>`
          : `${art.get(r.name) ? `<clipPath id="lnC${ri}"><circle cx="11" cy="${y + rowH / 2}" r="10"/></clipPath><image href="${escapeHtml(art.get(r.name))}" x="1" y="${y + rowH / 2 - 10}" width="20" height="20" clip-path="url(#lnC${ri})" preserveAspectRatio="xMidYMid slice"/>` : ""}
             <text class="ln-name" x="28" y="${y + rowH / 2 + 5}">${escapeHtml(r.name.length > 25 ? r.name.slice(0, 24) + "…" : r.name)}</text>`}
        ${Array.from(r.cells.entries()).map(([gi, c]) => {
          const h = Math.max(4, (rowH - 8 - labelH) * (Number(c.m.difficulty || 0) / maxD));
          const x = labelW + gi * step + (step - stripeW) / 2;
          return `<rect class="ln-stripe ${c.m.victory ? "win" : "loss"}${ri === cur.row && gi === cur.col ? " on" : ""}" data-g="${gi}" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${stripeW.toFixed(1)}" height="${h.toFixed(1)}" rx="1"/>`;
        }).join("")}
        <text class="ln-count" x="${W - padR + 8}" y="${y + rowH / 2 + 5}">${wins}/${plays}</text>
      </g>`;
    });

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.innerHTML = `${body}
      <text class="td-axis" x="${labelW}" y="${H - 8}">${escapeHtml(ctx.fmtDate(games[0].date))}</text>
      <text class="td-axis" x="${W - padR}" y="${H - 8}" text-anchor="end">${escapeHtml(ctx.fmtDate(games[n - 1].date))}</text>
      <text class="td-axis" x="${W - padR + 8}" y="${H - 8}">won</text>`;

    const show = () => {
      const r = rows[cur.row];
      svg.querySelectorAll(".ln-row").forEach(g => g.classList.toggle("on", Number(g.dataset.r) === cur.row));
      svg.querySelectorAll(".ln-stripe").forEach(s => s.classList.toggle("on", Number(s.closest(".ln-row").dataset.r) === cur.row && Number(s.dataset.g) === cur.col));
      const c = cur.col !== null ? r.cells.get(cur.col) : null;
      const plays = r.cells.size, wins = Array.from(r.cells.values()).filter(x => x.m.victory).length;
      const players = Array.from(new Set(Array.from(r.cells.values()).map(x => (x.p.player || "").trim()).filter(Boolean)));
      info.innerHTML = c
        ? `<p class="kicker">${escapeHtml(r.name)}</p><h3>Invasion #${escapeHtml(c.m.id)}, ${c.m.victory ? "won" : "lost"}</h3>
           <p class="hint">${escapeHtml(ctx.fmtDate(c.m.date))} · played by ${escapeHtml(c.p.player || "?")}${c.p.aspect && c.p.aspect !== "Base" ? ` as ${escapeHtml(c.p.aspect)}` : ""} · difficulty ${escapeHtml(c.m.difficulty ?? 0)}${c.m.adversary1 ? ` · ${escapeHtml(c.m.adversary1)}` : ""}</p>
           <a class="tc-link" href="index.html#game=${encodeURIComponent(c.m.id)}">Open in the tracker →</a>`
        : `<p class="kicker">Lineage</p><h3>${escapeHtml(r.name)}</h3>
           <p class="hint">${plays} ${plays === 1 ? "game" : "games"}, ${wins} won, first seen ${escapeHtml(ctx.fmtDate(games[r.first].date))}. Played by ${players.map(escapeHtml).join(", ") || "nobody named"}.</p>
           <a class="tc-link" href="index.html#spirit=${encodeURIComponent(r.name)}">Open the dossier in the tracker →</a>`;
    };
    const colAt = (clientX, box) => Math.floor(((clientX - box.left) * (W / box.width) - labelW) / step);
    svg.onpointermove = e => {
      const g = e.target.closest(".ln-row");
      if (!g) return;
      const ri = Number(g.dataset.r), col = colAt(e.clientX, svg.getBoundingClientRect());
      const c = rows[ri].cells.has(col) ? col : null;
      if (ri !== cur.row || c !== cur.col) { cur = { row: ri, col: c }; show(); }
    };
    svg.onclick = svg.onpointermove;
    svg.onkeydown = e => {
      const r = rows[cur.row];
      const cols = Array.from(r.cells.keys()).sort((a, b) => a - b);
      if (e.key === "ArrowDown") { e.preventDefault(); cur = { row: Math.min(rows.length - 1, cur.row + 1), col: null }; }
      else if (e.key === "ArrowUp") { e.preventDefault(); cur = { row: Math.max(0, cur.row - 1), col: null }; }
      else if (e.key === "ArrowRight") { e.preventDefault(); const nx = cols.find(c => cur.col === null || c > cur.col); cur.col = nx !== undefined ? nx : cols[cols.length - 1]; }
      else if (e.key === "ArrowLeft") { e.preventDefault(); const pv = cols.slice().reverse().find(c => cur.col !== null && c < cur.col); cur.col = pv !== undefined ? pv : cols[0]; }
      else if (e.key === "Enter") { const a = info.querySelector("a.tc-link"); if (a) location.href = a.href; return; }
      else return;
      show();
    };
    show();

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>Spirit</th><th>Games</th><th>Won</th><th>First</th><th>Last</th></tr></thead><tbody>${rows.map(r => {
        const cells = Array.from(r.cells.keys()).sort((a, b) => a - b);
        return `<tr><td>${escapeHtml(r.name)}</td><td>${r.cells.size}</td><td>${Array.from(r.cells.values()).filter(c => c.m.victory).length}</td><td>${escapeHtml(games[cells[0]].date || "")}</td><td>${escapeHtml(games[cells[cells.length - 1]].date || "")}</td></tr>`;
      }).join("")}</tbody></table>`;
    }
  }

  Realm.register("lineages", render);
})();
