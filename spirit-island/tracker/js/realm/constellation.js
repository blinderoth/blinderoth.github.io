// Chapter: The Constellation. Spirits on a ring; lines join spirits that shared a game.
// Journal draws it in ink and watercolour, Night in firelight and glowing fungi.

(() => {
  let pinned = null;

  const short = (s, max) => s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;

  function render(ctx) {
    const svg = document.getElementById("cnSvg");
    const info = document.getElementById("cnInfo");
    const tableEl = document.getElementById("cnTable");
    if (!svg || !info) return;
    const night = ctx.theme === "night";

    const nodesBy = {}, edgesBy = {};
    (ctx.data.matches || []).forEach(m => {
      const names = Array.from(new Set((m.players || []).map(p => p.spirit).filter(Boolean))).sort();
      names.forEach(nm => { const e = (nodesBy[nm] = nodesBy[nm] || { name: nm, plays: 0, wins: 0 }); e.plays++; if (m.victory) e.wins++; });
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        const k = names[i] + "|" + names[j];
        const e = (edgesBy[k] = edgesBy[k] || { a: names[i], b: names[j], games: 0, wins: 0 });
        e.games++; if (m.victory) e.wins++;
      }
    });
    const order = new Map((ctx.all.spirits || []).map((s, i) => [s.name, i]));
    const art = new Map((ctx.all.spirits || []).map(s => [s.name, s.image]));
    const nodes = Object.values(nodesBy).sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
    const edges = Object.values(edgesBy).sort((a, b) => a.games - b.games);

    if (!nodes.length) {
      svg.innerHTML = "";
      info.innerHTML = `<p class="muted">No spirits walked the island in this stretch of time.</p>`;
      if (tableEl) tableEl.innerHTML = "";
      return;
    }
    if (pinned && !nodesBy[pinned]) pinned = null;

    const R = 290, pos = new Map();
    nodes.forEach((n, i) => {
      n.a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.x = +(Math.cos(n.a) * R).toFixed(1);
      n.y = +(Math.sin(n.a) * R).toFixed(1);
      n.r = +(8 + Math.sqrt(n.plays) * 4.6).toFixed(1);
      n.rate = (n.wins / n.plays) * 100;
      n.c = ctx.rateColor(n.rate);
      pos.set(n.name, n);
    });

    const defs = `
      <filter id="cnWob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
      <filter id="cnWash" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="14"/><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="cnGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      ${nodes.map((n, i) => `<clipPath id="cnC${i}"><circle cx="${n.x}" cy="${n.y}" r="${n.r}"/></clipPath>`).join("")}`;

    const backdrop = night
      ? `<circle r="${R}" class="cn-orbit"/>` + Array.from({ length: 30 }, (_, k) => { const a = k * 2.399, rr = 50 + ((k * 53) % 360); return `<circle class="cn-fly" cx="${(Math.cos(a) * rr).toFixed(1)}" cy="${(Math.sin(a) * rr).toFixed(1)}" r="${(1 + (k % 3) * 0.6).toFixed(1)}" style="animation-delay:${(k % 7) * 0.4}s" filter="url(#cnGlow)"/>`; }).join("")
      : `<circle r="${R}" class="cn-orbit" filter="url(#cnWob)"/><circle r="${R * 0.55}" class="cn-orbit inner" filter="url(#cnWob)"/>`;

    const edgeSvg = edges.map(e => {
      const A = pos.get(e.a), B = pos.get(e.b);
      const d = `M${A.x},${A.y} Q${((A.x + B.x) * 0.12).toFixed(1)},${((A.y + B.y) * 0.12).toFixed(1)} ${B.x},${B.y}`;
      const rate = (e.wins / e.games) * 100;
      const tip = `${e.a} + ${e.b}: ${e.games} ${e.games === 1 ? "game" : "games"}, ${Math.round(rate)}% won`;
      return night
        ? `<path class="cn-edge" data-a="${escapeHtml(e.a)}" data-b="${escapeHtml(e.b)}" d="${d}" stroke="${ctx.rateColor(rate)}" stroke-width="${(0.9 + e.games * 1.1).toFixed(2)}" filter="url(#cnGlow)"><title>${escapeHtml(tip)}</title></path>`
        : `<path class="cn-edge" data-a="${escapeHtml(e.a)}" data-b="${escapeHtml(e.b)}" d="${d}" stroke="var(--ink)" stroke-width="${(0.8 + e.games * 0.9).toFixed(2)}" filter="url(#cnWob)"><title>${escapeHtml(tip)}</title></path>`;
    }).join("");

    const nodeSvg = nodes.map((n, i) => {
      const img = art.get(n.name) || "";
      const deg = (n.a * 180) / Math.PI, left = Math.cos(n.a) < -0.001, lr = R + n.r + 16;
      const lx = (Math.cos(n.a) * lr).toFixed(1), ly = (Math.sin(n.a) * lr).toFixed(1);
      const pic = img ? `<image href="${escapeHtml(img)}" x="${n.x - n.r}" y="${n.y - n.r}" width="${n.r * 2}" height="${n.r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cnC${i})" class="cn-pic"/>` : "";
      const body = night
        ? `<circle cx="${n.x}" cy="${n.y}" r="${(n.r * 2.3).toFixed(1)}" fill="${n.c}" class="cn-aura"/>
           <circle cx="${n.x}" cy="${n.y}" r="${n.r + 5}" fill="${n.c}" opacity=".35" filter="url(#cnGlow)"/>
           ${pic}<circle cx="${n.x}" cy="${n.y}" r="${n.r + 1}" fill="none" stroke="${n.c}" stroke-width="1.6"/>`
        : `<circle cx="${n.x}" cy="${n.y}" r="${n.r + 14}" fill="${n.c}" class="cn-wash" filter="url(#cnWash)"/>
           ${pic}<circle cx="${n.x}" cy="${n.y}" r="${n.r + 1}" fill="none" stroke="var(--ink)" stroke-width="1.6" filter="url(#cnWob)"/>
           <circle cx="${n.x}" cy="${n.y}" r="${n.r + 4}" fill="none" stroke="var(--ink)" stroke-width=".7" stroke-opacity=".6" filter="url(#cnWob)"/>`;
      const aria = `${n.name}: ${n.plays} ${n.plays === 1 ? "game" : "games"}, ${Math.round(n.rate)}% won`;
      return `<g class="cn-node" data-name="${escapeHtml(n.name)}" tabindex="0" role="button" aria-pressed="${pinned === n.name}" aria-label="${escapeHtml(aria)}">${body}
        <circle cx="${n.x}" cy="${n.y}" r="${n.r + 6}" class="cn-focus"/>
        <text class="cn-label" x="${lx}" y="${ly}" transform="rotate(${(left ? deg + 180 : deg).toFixed(1)} ${lx} ${ly})" text-anchor="${left ? "end" : "start"}" dominant-baseline="middle">${escapeHtml(short(n.name, 22))}</text></g>`;
    }).join("");

    const games = (ctx.data.matches || []).length;
    svg.innerHTML = `<defs>${defs}</defs>${backdrop}<g>${edgeSvg}</g>
      <g aria-hidden="true"><text class="cn-core-num" y="8" text-anchor="middle">${nodes.length}</text>
      <text class="cn-core-lbl" y="36" text-anchor="middle">spirits awakened</text>
      <text class="cn-core-lbl dim" y="58" text-anchor="middle">${edges.length} bonds · ${games} ${games === 1 ? "game" : "games"}</text></g>
      <g>${nodeSvg}</g>`;

    const strongest = edges.slice().sort((x, y) => y.games - x.games || (y.wins / y.games) - (x.wins / x.games))[0];
    const defaultInfo = `
      <p class="kicker">Constellation</p>
      <h3>Who plays with whom</h3>
      <p class="hint">Hover a star to see its bonds. Click or press Enter to keep it lit; press Escape to let go.</p>
      ${strongest ? `<p class="hint"><b>Strongest bond:</b> ${escapeHtml(strongest.a)} and ${escapeHtml(strongest.b)}, ${strongest.games} ${strongest.games === 1 ? "game" : "games"}, ${Math.round((strongest.wins / strongest.games) * 100)}% won.</p>` : `<p class="hint">Every spirit fought alone in this stretch.</p>`}
      <div class="cn-scale" aria-hidden="true"><span>0% won</span><i></i><span>100%</span></div>`;

    const showInfo = name => {
      const n = name && pos.get(name);
      if (!n) { info.innerHTML = defaultInfo; return; }
      const partners = edges.filter(e => e.a === name || e.b === name)
        .map(e => ({ name: e.a === name ? e.b : e.a, games: e.games, rate: (e.wins / e.games) * 100 }))
        .sort((x, y) => y.games - x.games || y.rate - x.rate);
      info.innerHTML = `
        <p class="kicker">${pinned === name ? "Kept lit" : "Spirit"}</p>
        <h3>${escapeHtml(n.name)}</h3>
        <div class="figs">
          <div><strong>${n.plays}</strong><span>games</span></div>
          <div><strong style="color:${n.c}">${Math.round(n.rate)}%</strong><span>won</span></div>
          <div><strong>${partners.length}</strong><span>partners</span></div>
        </div>
        ${partners.length ? `<ul class="partners">${partners.slice(0, 6).map(p => `<li><i style="background:${ctx.rateColor(p.rate)}"></i><span>${escapeHtml(p.name)}</span><em>${p.games}× · ${Math.round(p.rate)}%</em></li>`).join("")}</ul>` : `<p class="hint">Always fought alone in this stretch.</p>`}
        <a class="tc-link" href="index.html#spirit=${encodeURIComponent(n.name)}">Open the dossier in the tracker →</a>`;
    };

    const light = name => {
      svg.classList.toggle("lit", !!name);
      const near = new Set();
      svg.querySelectorAll(".cn-edge").forEach(p => {
        const on = !!name && (p.dataset.a === name || p.dataset.b === name);
        p.classList.toggle("on", on);
        if (on) { near.add(p.dataset.a); near.add(p.dataset.b); }
      });
      svg.querySelectorAll(".cn-node").forEach(g => {
        g.classList.toggle("on", g.dataset.name === name);
        g.classList.toggle("near", !!name && near.has(g.dataset.name) && g.dataset.name !== name);
        g.setAttribute("aria-pressed", String(pinned === g.dataset.name));
      });
      showInfo(name);
    };

    svg.querySelectorAll(".cn-node").forEach(g => {
      const name = g.dataset.name;
      const toggle = () => { pinned = pinned === name ? null : name; light(pinned || name); };
      g.addEventListener("mouseenter", () => light(name));
      g.addEventListener("mouseleave", () => light(pinned));
      g.addEventListener("focus", () => light(name));
      g.addEventListener("blur", () => light(pinned));
      g.addEventListener("click", toggle);
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        if (e.key === "Escape") { pinned = null; light(null); }
      });
    });
    light(pinned);

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>Spirit</th><th>Games</th><th>Won</th><th>Most played with</th></tr></thead><tbody>${nodes.slice().sort((a, b) => b.plays - a.plays).map(n => {
        const top = edges.filter(e => e.a === n.name || e.b === n.name).sort((x, y) => y.games - x.games)[0];
        return `<tr><td>${escapeHtml(n.name)}</td><td>${n.plays}</td><td>${Math.round(n.rate)}%</td><td>${top ? `${escapeHtml(top.a === n.name ? top.b : top.a)} (${top.games})` : "—"}</td></tr>`;
      }).join("")}</tbody></table>`;
    }
  }

  Realm.register("constellation", render);
})();
