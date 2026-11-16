// Overview and Games tab tables: guardians, adversary clearance, loss autopsy
// Classic script: shares globals with the other files in js/core and js/views.

  function renderCouncilLeaderboard() {
    const council = SIAnalytics.computePlayerStats(getStatsData());
    const tbody = document.getElementById("councilTbody");
    const tfoot = document.getElementById("councilTfoot");
    if (!tbody) return;

    tbody.innerHTML = council.guardians.map(g => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.55rem;">
            <span style="width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.4);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:0.78rem;color:var(--accent-gold-light);">
              ${escapeHtml(g.name.charAt(0))}
            </span>
            <div>
              <div style="font-weight:700;">${escapeHtml(g.name)}</div>
              <div style="font-size:0.68rem;color:var(--text-secondary);">${g.uniqueMatches} matches</div>
            </div>
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
    `).join("");

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

  function renderAdversaryGauntlet() {
    const advStats = SIAnalytics.computeAdversaryStats(getStatsData());

    const zenContainer = document.getElementById("zenGauntletContainer");
    if (zenContainer) {
      zenContainer.innerHTML = advStats.map(adv => {
        const pillars = adv.gauntlet.map(cell => {
          let cls = "zp-empty";
          let label = `L${cell.level}`;
          let title = `${adv.name} Level ${cell.level} (Diff ${adv.levels[cell.level]}): Unchallenged`;
          if (cell.status === "WIN") {
            cls = "zp-win";
            label = `L${cell.level} · ${Math.round(cell.score)}`;
            title = `${adv.name} Level ${cell.level}: Conquered! Score: ${SIAnalytics.formatNum(cell.score, 1)} pts`;
          } else if (cell.status === "LOSS") {
            cls = "zp-loss";
            label = `L${cell.level} · Loss`;
            title = `${adv.name} Level ${cell.level}: Defeated (${cell.matches.length} tries)`;
          }
          return `<button type="button" class="zen-pillar ${cls}" title="${title}" aria-label="${title}" onclick="if(window.openQuickMatchLog) window.openQuickMatchLog('${escapeHtml(adv.name).replace(/'/g, "\\'")}', ${cell.level})">${label}</button>`;
        }).join("");

        return `
          <div class="zen-gauntlet-row">
            <div class="zen-gauntlet-name">${advIcon(adv, 28, 19)}<span>${escapeHtml(adv.name)}</span></div>
            <div class="zen-gauntlet-rate" style="font-weight:600;color:${adv.winRate === null || adv.winRate === undefined ? 'var(--text-muted)' : adv.winRate >= 50 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">${adv.winRate === null || adv.winRate === undefined ? 'Not played' : SIAnalytics.formatNum(adv.winRate, 0) + '% win'}</div>
            <div class="zen-pillars">
              ${pillars}
            </div>
            <div class="zen-gauntlet-total mono" title="${adv.games} games, ${adv.wins} wins">${adv.games} ${adv.games === 1 ? "game" : "games"} / ${adv.wins} ${adv.wins === 1 ? "win" : "wins"}</div>
          </div>
        `;
      }).join("");
    }

    const tbody = document.getElementById("gauntletTbody");
    if (!tbody) return;

    tbody.innerHTML = advStats.map(adv => {
      const cellsHtml = adv.gauntlet.map(cell => {
        let cls = "gauntlet-empty";
        let text = "—";
        let title = `${adv.name} Level ${cell.level} (Diff ${adv.levels[cell.level]}): Unchallenged — Click to log a match!`;

        if (cell.status === "WIN") {
          cls = "gauntlet-win";
          text = `${SIAnalytics.formatNum(cell.score, 1)} pts`;
          title = `${adv.name} Level ${cell.level}: Conquered! Record Score: ${SIAnalytics.formatNum(cell.score, 2)} pts (${cell.matches.length} matches)`;
        } else if (cell.status === "LOSS") {
          cls = "gauntlet-loss";
          text = "LOSS";
          title = `${adv.name} Level ${cell.level}: Attempted Defeat (${cell.matches.length} attempts) — Click to launch rematch!`;
        }

        return `
          <td>
            <span class="gauntlet-cell ${cls}" data-adv="${escapeHtml(adv.name)}" data-lvl="${cell.level}" title="${escapeHtml(title)}">
              ${text}
            </span>
          </td>
        `;
      }).join("");

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.55rem;">
              ${advIcon(adv, 24, 16)}
              <span style="font-weight:700;">${escapeHtml(adv.name)}</span>
            </div>
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".gauntlet-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        const advName = cell.getAttribute("data-adv");
        const lvl = Number(cell.getAttribute("data-lvl"));
        openMatchModal({
          adversary1: advName,
          adversary1Level: lvl
        });
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
