// Overview and Games tab tables: guardians, adversary clearance, loss autopsy
// Classic script: shares globals with the other files in js/core and js/views.

  // Guardians expanded on screen. Not saved, so the table starts collapsed on load.
  const guardianOpen = new Set();
  const shortAdvName = n => String(n).replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "").replace("Brandenburg-Prussia", "Prussia").replace("Habsburg Monarchy", "Habsburg").replace("Habsburg Mining Expedition", "Mining Exp.");
  const pct = v => (v === null || v === undefined) ? "—" : Math.round(v) + "%";

  function guardianDetailHtml(p) {
    const stat = (label, val) => `<div class="gd-stat"><span>${label}</span><strong>${val}</strong></div>`;
    const counts = p.spiritCount.byCount;
    const maxK = Math.max(3, p.spiritCount.max);
    const perGame = [];
    for (let k = 1; k <= maxK; k++) {
      if (k === 1 || k <= 3 || counts[k]) {
        const c = counts[k] || { games: 0, wins: 0 };
        perGame.push(stat(`${k} spirit${k === 1 ? "" : "s"}`, `${c.games} <em>${c.games ? pct((c.wins / c.games) * 100) + " won" : "games"}</em>`));
      }
    }
    const topSpirits = p.spirits.slice(0, 5), restSpirits = p.spirits.slice(5);
    const spiritRow = s => `<li><span class="gd-sp">${s.image ? `<img src="${escapeHtml(s.image)}" alt="">` : ""}${escapeHtml(s.name)}</span><span class="mono">${s.plays}</span><span class="mono gd-dim">${pct(s.winRate)}</span></li>`;
    const aspects = p.aspects.slice(0, 6).map(a => `<span class="gd-chip" title="${escapeHtml(a.spirit)}">${escapeHtml(a.name)} <b>${a.plays}</b></span>`).join("");
    const advs = p.adversaries.map(a => `<span class="gd-chip${a.level === null ? " off" : ""}">${escapeHtml(shortAdvName(a.name))} <b>${a.level === null ? "–" : "L" + a.level}</b></span>`).join("");
    return `
      <div class="gd-grid">
        <div class="gd-block">
          <h4>Record</h4>
          <div class="gd-stats">
            ${stat("Games", p.games)}${stat("Won", p.wins)}${stat("Lost", p.losses)}${stat("Win rate", pct(p.winRate))}
            ${stat("Avg score", SIAnalytics.formatNum(p.avgScore, 1))}${stat("Best difficulty won", p.maxDifficultyWon || "—")}${stat("Win streak", p.streak)}
          </div>
          <h4>Spirits per game</h4>
          <div class="gd-stats">${perGame.join("")}</div>
        </div>
        <div class="gd-block">
          <h4>Spirits (${p.spirits.length})</h4>
          <ul class="gd-list"><li class="gd-head"><span></span><span>Plays</span><span>Won</span></li>${topSpirits.map(spiritRow).join("")}</ul>
          ${restSpirits.length ? `<details class="gd-more"><summary>Show ${restSpirits.length} more</summary><ul class="gd-list">${restSpirits.map(spiritRow).join("")}</ul></details>` : ""}
        </div>
        <div class="gd-block">
          <h4>Aspects tried: ${p.aspectsTried} of ${p.aspectsAvailable}</h4>
          <div class="gd-chips">${aspects || '<span class="gd-dim">None yet</span>'}</div>
          <h4>Best level beaten</h4>
          <div class="gd-chips">${advs || '<span class="gd-dim">No adversaries owned</span>'}</div>
          <div class="gd-dim gd-foot">Scenarios won: ${p.scenariosWon} of ${p.scenariosTotal}</div>
        </div>
      </div>`;
  }

  function renderCouncilLeaderboard() {
    const council = SIAnalytics.computePlayerStats(getStatsData());
    const tbody = document.getElementById("councilTbody");
    const tfoot = document.getElementById("councilTfoot");
    if (!tbody) return;

    const statsData = getStatsData();
    council.guardians.sort((a, b) => b.uniqueMatches - a.uniqueMatches || b.deployments - a.deployments || a.name.localeCompare(b.name));
    tbody.innerHTML = council.guardians.map((g, gi) => {
      const canOpen = g.uniqueMatches > 0;
      const open = canOpen && guardianOpen.has(g.name);
      return `
      <tr class="guardian-row${canOpen ? " has-detail" : ""}${open ? " open" : ""}" data-guardian="${escapeHtml(g.name)}">
        <td>
          <div style="display:flex;align-items:center;gap:0.55rem;">
            ${(() => {
              const sp = (appData.spirits || []).find(x => x.name === g.signatureSpirit);
              return sp && sp.image
                ? `<span class="guardian-avatar" title="Signature spirit: ${escapeHtml(sp.name)}"><img src="${escapeHtml(sp.image)}" alt="" loading="lazy" style="${getFocalStyle(sp)}" onerror="this.parentElement.classList.add('no-img');this.remove()"><b>${escapeHtml(g.name.charAt(0))}</b></span>`
                : `<span class="guardian-avatar no-img"><b>${escapeHtml(g.name.charAt(0))}</b></span>`;
            })()}
            <div style="flex:1;">
              <div style="font-weight:700;">${escapeHtml(g.name)}</div>
              <div style="font-size:0.68rem;color:var(--text-secondary);">${g.uniqueMatches} matches</div>
            </div>
            ${canOpen ? `<button type="button" class="guardian-toggle" aria-expanded="${open}" aria-controls="guardianDetail${gi}" aria-label="Show overview for ${escapeHtml(g.name)}"></button>` : ""}
          </div>
        </td>
        <td class="mono" style="font-weight:700;">${g.deployments}</td>
        <td class="mono" style="color:var(--accent-emerald-light);">${g.victories}</td>
        <td class="mono">${SIAnalytics.formatNum(g.winRate, 1)}%</td>
        <td>
          ${g.signatureSpirit !== "—" ? `
            <span class="spirit-player-chip" data-spirit="${escapeHtml(g.signatureSpirit)}">
              <img src="${escapeHtml(g.signatureSpiritImg)}" alt="">
              <span>${escapeHtml(g.signatureSpirit)}</span>
            </span>
          ` : "—"}
        </td>
        <td class="mono" style="font-weight:700;color:var(--accent-gold-light);">${SIAnalytics.formatNum(g.highScore, 2)}</td>
      </tr>
      ${canOpen ? `<tr class="guardian-detail" id="guardianDetail${gi}"${open ? "" : " hidden"}><td colspan="6">${guardianDetailHtml(SIAnalytics.computeGuardianProfile(statsData, g.name))}</td></tr>` : ""}
    `;
    }).join("");

    tbody.querySelectorAll("tr.guardian-row.has-detail").forEach(row => {
      const toggle = () => {
        const name = row.getAttribute("data-guardian");
        const detail = row.nextElementSibling;
        const nowOpen = detail.hidden;
        detail.hidden = !nowOpen;
        row.classList.toggle("open", nowOpen);
        row.querySelector(".guardian-toggle")?.setAttribute("aria-expanded", String(nowOpen));
        if (nowOpen) guardianOpen.add(name); else guardianOpen.delete(name);
      };
      row.addEventListener("click", e => { if (!e.target.closest(".spirit-player-chip")) toggle(); });
    });

    tbody.querySelectorAll(".spirit-player-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        inspectSpiritInDossier(chip.getAttribute("data-spirit"));
      });
    });

    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="background:rgba(245,158,11,0.08);font-weight:800;">
          <td>TOTALS</td>
          <td class="mono">${council.totals.deployments}</td>
          <td class="mono" style="color:var(--accent-emerald-light);">${council.totals.victories}</td>
          <td class="mono">${SIAnalytics.formatNum(council.totals.winRate, 1)}%</td>
          <td><span class="badge badge-win">${council.totals.activeGuardians} Active Guardians</span></td>
          <td class="mono" style="color:var(--accent-gold-light);">${SIAnalytics.formatNum(council.totals.highScore, 1)}</td>
        </tr>
      `;
    }

  }

  // The game a clearance cell points to: the highest-scoring win, else the latest loss.
  function pickGameFor(matches) {
    const wins = (matches || []).filter(m => m.victory).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (wins.length) return wins[0].id;
    const losses = (matches || []).slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return losses.length ? losses[0].id : "";
  }

  function renderAdversaryGauntlet() {
    const advStats = SIAnalytics.computeAdversaryStats(getStatsData());

    const zenContainer = document.getElementById("zenGauntletContainer");
    if (zenContainer) {
      zenContainer.innerHTML = advStats.map(adv => {
        const pillars = adv.gauntlet.map(cell => {
          const pick = pickGameFor(cell.matches);
          const lvlLabel = `${adv.name} level ${cell.level}`;
          if (cell.status === "WIN") {
            const title = `${lvlLabel}: best win ${SIAnalytics.formatNum(cell.score, 1)} pts`;
            return `<button type="button" class="zen-pillar zp-win" data-game="${pick}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title + ". Open game")}">L${cell.level} · ${Math.round(cell.score)}</button>`;
          }
          if (cell.status === "LOSS") {
            const title = `${lvlLabel}: ${cell.matches.length} ${cell.matches.length === 1 ? "try" : "tries"}, no win`;
            return `<button type="button" class="zen-pillar zp-loss" data-game="${pick}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title + ". Open game")}">L${cell.level} · Loss</button>`;
          }
          const title = `${lvlLabel}: not played`;
          return `<span class="zen-pillar zp-empty" title="${escapeHtml(title)}">L${cell.level}</span>`;
        }).join("");

        return `
          <div class="zen-gauntlet-row">
            <div class="zen-gauntlet-name">${advIcon(adv, 38, 25)}<span>${escapeHtml(adv.name)}</span></div>
            <div class="zen-gauntlet-rate" style="font-weight:600;color:${adv.winRate === null || adv.winRate === undefined ? 'var(--text-muted)' : adv.winRate >= 50 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">${adv.winRate === null || adv.winRate === undefined ? 'Not played' : SIAnalytics.formatNum(adv.winRate, 0) + '% win'}</div>
            <div class="zen-pillars">
              ${pillars}
            </div>
            <div class="zen-gauntlet-total mono" title="${adv.games} games, ${adv.wins} wins">${adv.games} ${adv.games === 1 ? "game" : "games"} / ${adv.wins} ${adv.wins === 1 ? "win" : "wins"}</div>
          </div>
        `;
      }).join("");
    }

    const scnContainer = document.getElementById("zenScenarioContainer");
    if (scnContainer) {
      scnContainer.innerHTML = SIAnalytics.computeScenarioStats(getStatsData()).map(sc => {
        const cls = sc.wins > 0 ? "zp-win" : sc.games > 0 ? "zp-loss" : "zp-empty";
        const meta = sc.games === 0 ? "Not played" : `${sc.wins}/${sc.games} won${sc.bestScore !== null ? " · " + SIAnalytics.formatNum(sc.bestScore, 1) : ""}`;
        const tip = `${sc.name}: ${sc.games} ${sc.games === 1 ? "game" : "games"}, ${sc.wins} ${sc.wins === 1 ? "win" : "wins"}${sc.bestScore !== null ? ", best " + SIAnalytics.formatNum(sc.bestScore, 1) + " pts" : ""}`;
        const inner = `
            ${scenIcon(sc.scenario, 40)}
            <div class="zen-scn-text">
              <div class="zen-scn-name">${escapeHtml(sc.name)}</div>
              <div class="zen-scn-meta mono">${meta}</div>
            </div>`;
        return sc.gameId
          ? `<button type="button" class="zen-scn-card ${cls}" data-game="${sc.gameId}" title="${escapeHtml(tip)}" aria-label="${escapeHtml(tip + ". Open game")}">${inner}</button>`
          : `<div class="zen-scn-card ${cls}" title="${escapeHtml(tip)}">${inner}</div>`;
      }).join("");
    }

    [zenContainer, scnContainer].forEach(box => {
      if (!box || box.dataset.gameBound) return;
      box.dataset.gameBound = "1";
      box.addEventListener("click", e => {
        const btn = e.target.closest("[data-game]");
        if (btn && window.inspectGame) window.inspectGame(Number(btn.getAttribute("data-game")));
      });
    });
  }

  function renderLossAutopsy() {
    const autopsy = SIAnalytics.computeLossAutopsy(getStatsData());
    const tbody = document.getElementById("lossAutopsyTbody");
    if (!tbody) return;

    tbody.innerHTML = autopsy.breakdown.map(item => {
      const pct = autopsy.totalLosses > 0 ? Math.round((item.count / autopsy.totalLosses) * 100) : 0;
      const badgeCls = item.riskTier === "CRITICAL" ? "badge-loss" : (item.riskTier === "HIGH" ? "badge-moderate" : "badge-neutral");
      return `
        <tr>
          <td style="font-weight:700;">${escapeHtml(item.type)}</td>
          <td class="mono" style="font-weight:700;">${item.count} <span style="color:var(--text-secondary);font-size:0.74rem;">(${pct}%)</span></td>
          <td><span class="badge ${badgeCls}">${escapeHtml(item.riskTier)}</span></td>
        </tr>
      `;
    }).join("");
  }
