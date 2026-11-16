// Spirit constellation (Spirit Realm scheme): every spirit that has been played is a star on a ring.
// Lines join spirits that shared a game; thicker = more games together, colour = win rate together.
// Hover or focus a star to see its partners; click, Enter or Space opens its dossier.
// Classic script: shares globals with the other files in js/core and js/views.

  function cnWinColor(rate) {
    if (rate === null || rate === undefined) return "hsl(228, 20%, 60%)";
    const h = rate < 50 ? 8 + (rate / 50) * 34 : 42 + ((rate - 50) / 50) * 113;   // ember -> gold -> jade
    return `hsl(${Math.round(h)}, 85%, 62%)`;
  }

  function cnShort(name, max) {
    return name.length > max ? name.slice(0, max - 1).trimEnd() + "…" : name;
  }

  function renderConstellation() {
    const svg = document.getElementById("constellationSvg");
    const info = document.getElementById("constellationInfo");
    if (!svg || !info) return;

    const data = getStatsData({ playerSlotsOnly: false });
    const nodesBy = {}, edgesBy = {};
    (data.matches || []).forEach(m => {
      const names = Array.from(new Set((m.players || []).map(p => p.spirit).filter(Boolean)));
      names.forEach(n => {
        const e = (nodesBy[n] = nodesBy[n] || { name: n, plays: 0, wins: 0 });
        e.plays++; if (m.victory) e.wins++;
      });
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const [a, b] = [names[i], names[j]].sort();
          const e = (edgesBy[a + "|" + b] = edgesBy[a + "|" + b] || { a, b, games: 0, wins: 0 });
          e.games++; if (m.victory) e.wins++;
        }
      }
    });

    const spiritOrder = new Map((appData.spirits || []).map((s, i) => [s.name, i]));
    const spiritInfo = new Map((appData.spirits || []).map(s => [s.name, s]));
    const nodes = Object.values(nodesBy).sort((x, y) => (spiritOrder.get(x.name) ?? 999) - (spiritOrder.get(y.name) ?? 999) || x.name.localeCompare(y.name));
    const edges = Object.values(edgesBy);

    if (!nodes.length) {
      svg.innerHTML = "";
      info.innerHTML = `<p class="cn-hint">No games logged yet. Stars appear as spirits are played.</p>`;
      return;
    }

    const R = 285;
    const pos = new Map();
    nodes.forEach((n, i) => {
      const ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.ang = ang;
      n.x = Math.cos(ang) * R;
      n.y = Math.sin(ang) * R;
      n.r = 8 + Math.sqrt(n.plays) * 4.4;
      n.rate = n.plays ? (n.wins / n.plays) * 100 : null;
      pos.set(n.name, n);
    });

    const edgeSvg = edges.sort((x, y) => x.games - y.games).map(e => {
      const A = pos.get(e.a), B = pos.get(e.b);
      const cx = (A.x + B.x) * 0.12, cy = (A.y + B.y) * 0.12;     // pull the curve toward the centre
      const rate = (e.wins / e.games) * 100;
      const tip = `${e.a} + ${e.b}: ${e.games} ${e.games === 1 ? "game" : "games"}, ${Math.round(rate)}% won`;
      return `<path class="cn-edge" data-a="${escapeHtml(e.a)}" data-b="${escapeHtml(e.b)}" d="M${A.x.toFixed(1)},${A.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${B.x.toFixed(1)},${B.y.toFixed(1)}" stroke="${cnWinColor(rate)}" stroke-width="${(0.9 + e.games * 1.15).toFixed(2)}"><title>${escapeHtml(tip)}</title></path>`;
    }).join("");

    const nodeSvg = nodes.map((n, i) => {
      const img = spiritInfo.get(n.name)?.image || "";
      const deg = (n.ang * 180) / Math.PI;
      const left = Math.cos(n.ang) < -0.001;
      const lr = R + n.r + 10;
      const lx = Math.cos(n.ang) * lr, ly = Math.sin(n.ang) * lr;
      const label = `<text class="cn-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="rotate(${(left ? deg + 180 : deg).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})" text-anchor="${left ? "end" : "start"}" dominant-baseline="middle">${escapeHtml(cnShort(n.name, 22))}</text>`;
      const aria = `${n.name}: ${n.plays} ${n.plays === 1 ? "game" : "games"}, ${Math.round(n.rate)}% won. Open dossier`;
      return `
        <g class="cn-node" data-name="${escapeHtml(n.name)}" tabindex="0" role="button" aria-label="${escapeHtml(aria)}">
          <clipPath id="cnClip${i}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}"/></clipPath>
          <circle class="cn-halo" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r + 7).toFixed(1)}" fill="${cnWinColor(n.rate)}"/>
          <circle class="cn-disc" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="${cnWinColor(n.rate)}"/>
          ${img ? `<image href="${escapeHtml(img)}" x="${(n.x - n.r).toFixed(1)}" y="${(n.y - n.r).toFixed(1)}" width="${(n.r * 2).toFixed(1)}" height="${(n.r * 2).toFixed(1)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cnClip${i})"/>` : ""}
          <circle class="cn-ring" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${(n.r + 1.5).toFixed(1)}" stroke="${cnWinColor(n.rate)}"/>
          ${label}
        </g>`;
    }).join("");

    const totalGames = (data.matches || []).length;
    svg.innerHTML = `
      <circle class="cn-orbit" r="${R}"/>
      <circle class="cn-orbit inner" r="${R * 0.55}"/>
      <g class="cn-edges">${edgeSvg}</g>
      <g class="cn-core" aria-hidden="true">
        <text class="cn-core-num" y="-6">${nodes.length}</text>
        <text class="cn-core-label" y="22">spirits awake</text>
        <text class="cn-core-label dim" y="42">${edges.length} bonds · ${totalGames} games</text>
      </g>
      <g class="cn-nodes">${nodeSvg}</g>`;

    const strongest = edges.slice().sort((x, y) => y.games - x.games || (y.wins / y.games) - (x.wins / x.games))[0];
    const defaultInfo = `
      <p class="cn-kicker">Constellation</p>
      <h3 class="cn-title">Who plays with whom</h3>
      <p class="cn-hint">Each star is a spirit, sized by games and coloured by win rate. Lines join spirits that fought side by side. Hover or tab to a star, click to open its dossier.</p>
      ${strongest ? `<div class="cn-bond"><span>Strongest bond</span><strong>${escapeHtml(strongest.a)} + ${escapeHtml(strongest.b)}</strong><em>${strongest.games} games · ${Math.round((strongest.wins / strongest.games) * 100)}% won</em></div>` : ""}
      <div class="cn-scale" aria-hidden="true"><span>0% won</span><i></i><span>100%</span></div>`;

    const showInfo = name => {
      const n = pos.get(name);
      if (!n) { info.innerHTML = defaultInfo; return; }
      const partners = edges.filter(e => e.a === name || e.b === name)
        .map(e => ({ name: e.a === name ? e.b : e.a, games: e.games, rate: (e.wins / e.games) * 100 }))
        .sort((x, y) => y.games - x.games || y.rate - x.rate);
      info.innerHTML = `
        <p class="cn-kicker">Star</p>
        <h3 class="cn-title">${escapeHtml(n.name)}</h3>
        <div class="cn-figs">
          <div><strong>${n.plays}</strong><span>games</span></div>
          <div><strong style="color:${cnWinColor(n.rate)}">${Math.round(n.rate)}%</strong><span>won</span></div>
          <div><strong>${partners.length}</strong><span>partners</span></div>
        </div>
        ${partners.length ? `<ul class="cn-partners">${partners.slice(0, 6).map(p => `<li><i style="background:${cnWinColor(p.rate)}"></i><span>${escapeHtml(p.name)}</span><em>${p.games}× · ${Math.round(p.rate)}%</em></li>`).join("")}</ul>` : `<p class="cn-hint">Always played alone so far.</p>`}
        <p class="cn-hint">Click or press Enter to open the dossier.</p>`;
    };

    const setActive = name => {
      svg.classList.toggle("has-active", !!name);
      const near = new Set();
      svg.querySelectorAll(".cn-edge").forEach(p => {
        const on = !!name && (p.dataset.a === name || p.dataset.b === name);
        p.classList.toggle("on", on);
        if (on) { near.add(p.dataset.a); near.add(p.dataset.b); }
      });
      svg.querySelectorAll(".cn-node").forEach(g => {
        g.classList.toggle("on", g.dataset.name === name);
        g.classList.toggle("near", !!name && near.has(g.dataset.name) && g.dataset.name !== name);
      });
      showInfo(name);
    };

    showInfo(null);
    let lastPointer = "mouse";
    svg.querySelectorAll(".cn-node").forEach(g => {
      const name = g.dataset.name;
      g.addEventListener("pointerdown", e => { lastPointer = e.pointerType; });
      g.addEventListener("mouseenter", () => setActive(name));
      g.addEventListener("mouseleave", () => { if (document.activeElement !== g) setActive(null); });
      g.addEventListener("focus", () => setActive(name));
      g.addEventListener("blur", () => setActive(null));
      g.addEventListener("click", () => {
        // On touch, the first tap shows the star's details; a second tap opens the dossier.
        if (lastPointer === "touch" && !g.classList.contains("on")) { setActive(name); return; }
        if (window.selectAndShowDossier) window.selectAndShowDossier(name);
      });
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (window.selectAndShowDossier) window.selectAndShowDossier(name); }
      });
    });
  }

  window.renderConstellation = renderConstellation;
