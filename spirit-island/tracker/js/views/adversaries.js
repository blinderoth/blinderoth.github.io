// Adversaries tab: threat matrix, council, gauntlet, recommender, loss autopsy
// Classic script: shares globals with the other files in js/core and js/views.

  function renderAdversaryThreatMatrix() {
    const advStats = SIAnalytics.computeAdversaryStats(getStatsData());
    const tbody = document.getElementById("adversaryThreatTbody");
    if (!tbody) return;

    tbody.innerHTML = advStats.map(adv => {
      const winPct = adv.winRate !== null ? `${Math.round(adv.winRate)}%` : "—";
      let badgeClass = "badge-unchallenged";
      if (adv.threatLevel === "Contained") badgeClass = "badge-contained";
      else if (adv.threatLevel === "Moderate Threat") badgeClass = "badge-moderate";
      else if (adv.threatLevel === "High Threat") badgeClass = "badge-high-threat";

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.6rem;">
              ${advIcon(adv, 30, 20)}
              <div>
                <div style="font-weight:700;">${escapeHtml(adv.name)}</div>
                <div style="font-size:0.7rem;color:var(--text-secondary);">${escapeHtml(adv.expansion)}</div>
              </div>
            </div>
          </td>
          <td class="mono">${adv.games} <span style="color:var(--text-secondary);font-size:0.75rem;">(${adv.wins}W)</span></td>
          <td class="mono" style="font-weight:700;">${winPct}</td>
          <td class="mono">${adv.maxLevelDefeated !== null ? `Level ${adv.maxLevelDefeated}` : "—"}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(adv.threatLevel)}</span></td>
        </tr>
      `;
    }).join("");
  }

  function renderCouncilLeaderboard() {
    const council = SIAnalytics.computePlayerStats(getStatsData());
    const tbody = document.getElementById("councilTbody");
    const tfoot = document.getElementById("councilTfoot");
    const notesEl = document.getElementById("councilNotes");
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
          <td>COUNCIL TOTALS</td>
          <td class="mono">${council.totals.deployments}</td>
          <td class="mono" style="color:var(--accent-emerald-light);">${council.totals.victories}</td>
          <td class="mono">${SIAnalytics.formatNum(council.totals.winRate, 1)}%</td>
          <td><span class="badge badge-win">${council.totals.activeGuardians} Active Guardians</span></td>
          <td class="mono" style="color:var(--accent-gold-light);">${SIAnalytics.formatNum(council.totals.highScore, 1)}</td>
        </tr>
      `;
    }

    if (notesEl && council.guardians.length > 0) {
      const topG = [...council.guardians].sort((a, b) => b.deployments - a.deployments)[0];
      const kpis = SIAnalytics.computeGlobalKPIs(getStatsData());
      notesEl.innerHTML = `Most Experienced Guardian: <strong>${escapeHtml(topG.name)}</strong> (${topG.deployments} spirit deployments across ${topG.uniqueMatches} sessions) • Overall Campaign Win Rate: <strong>${SIAnalytics.formatNum(kpis.winRate, 1)}%</strong> across all ${kpis.totalMatches} logged matches.`;
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
          let title = `${adv.name} Level ${cell.level} (Diff ${adv.levels[cell.level]}): Unchallenged — Click to log match!`;
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
            <div class="zen-gauntlet-name">${escapeHtml(adv.name)}</div>
            <div class="zen-gauntlet-rate" style="font-weight:600;color:${adv.winRate === null || adv.winRate === undefined ? 'var(--text-muted)' : adv.winRate >= 50 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'};">${adv.winRate === null || adv.winRate === undefined ? 'Not played' : SIAnalytics.formatNum(adv.winRate, 0) + '% win'}</div>
            <div class="zen-pillars">
              ${pillars}
            </div>
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

  function renderRecommender() {
    const pCountEl = document.getElementById("recPlayerCount");
    const modeEl = document.getElementById("recMode");
    const container = document.getElementById("recommenderBody");
    if (!container) return;

    const playerCount = pCountEl ? Number(pCountEl.value) : 2;
    const mode = modeEl ? modeEl.value : "campaign";

    currentRecommendation = SIAnalytics.generateRecommendation(appData, { playerCount, mode });
    const rec = currentRecommendation;

    container.innerHTML = `
      <div class="recommender-box">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.65rem;">
          <div>
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-gold-light);font-weight:700;">
              Target Adversary & Expedition Tier
            </div>
            <div style="display:flex;align-items:center;gap:0.55rem;margin-top:0.2rem;">
              ${rec.adversary ? advIcon(rec.adversary, 26, 18) : ""}
              <span style="font-size:1.05rem;font-weight:800;">${escapeHtml(rec.adversary?.name || "Base Island")}</span>
              <span class="badge badge-moderate">Level ${rec.level} (Diff ${rec.difficulty})</span>
            </div>
          </div>
          <span class="badge badge-win">${escapeHtml(rec.levelReason)}</span>
        </div>

        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-secondary);font-weight:700;margin-top:0.5rem;">
          Recommended Spirit Synergy Lineup (${rec.spirits.length} ${rec.spirits.length === 1 ? 'Guardian' : 'Guardians'})
        </div>
        <div class="rec-spirits-list">
          ${rec.spirits.map((sp, i) => `
            <div class="rec-spirit-card" style="cursor:pointer;" data-spirit="${escapeHtml(sp.name)}">
              <img src="${escapeHtml(sp.image)}" alt="${escapeHtml(sp.name)}" onerror=\"this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'\">
              <div>
                <div style="font-size:0.68rem;color:var(--accent-gold-light);font-weight:700;">SPIRIT ${i + 1} • ${escapeHtml(sp.complexity)}</div>
                <div style="font-weight:700;font-size:0.88rem;">${escapeHtml(sp.name)}</div>
                <div style="font-size:0.72rem;color:var(--text-secondary);">${escapeHtml(sp.affinityProfile)} • ${sp.gamesPlayed} played</div>
              </div>
            </div>
          `).join("")}
        </div>

        <div style="background:transparent;border:1px solid var(--border-subtle);border-radius:10px;padding:0.75rem 0.9rem;margin-top:0.65rem;">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--accent-emerald-light);margin-bottom:0.35rem;">
            ⚔️ Tactical Briefing & Directives
          </div>
          <ul style="padding-left:1.1rem;font-size:0.8rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.25rem;">
            ${rec.directives.map(d => `<li>${escapeHtml(d)}</li>`).join("")}
          </ul>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:0.85rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="rerollRecBtn">🎲 Reroll Pairing</button>
          <button type="button" class="btn btn-emerald btn-sm" id="dispatchRecBtn">🚀 Dispatch to Match Logger</button>
        </div>
      </div>
    `;

    container.querySelectorAll(".rec-spirit-card").forEach(card => {
      card.addEventListener("click", () => inspectSpiritInDossier(card.getAttribute("data-spirit")));
    });

    document.getElementById("rerollRecBtn")?.addEventListener("click", () => renderRecommender());
    document.getElementById("dispatchRecBtn")?.addEventListener("click", () => {
      if (!currentRecommendation) return;
      const defaultPlayers = (appData.players || []).map(p => p.name);
      openMatchModal({
        adversary1: currentRecommendation.adversary?.name || "",
        adversary1Level: currentRecommendation.level,
        players: currentRecommendation.spirits.map((s, idx) => ({
          spirit: s.name,
          aspect: "",
          player: defaultPlayers[idx] || defaultPlayers[0] || "Benjamin"
        }))
      });
    });

    if (pCountEl && !pCountEl.dataset.bound) {
      pCountEl.dataset.bound = "1";
      pCountEl.addEventListener("change", () => renderRecommender());
    }
    if (modeEl && !modeEl.dataset.bound) {
      modeEl.dataset.bound = "1";
      modeEl.addEventListener("change", () => renderRecommender());
    }
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
          <td style="font-size:0.79rem;color:var(--text-secondary);">${escapeHtml(item.countermeasure)}</td>
        </tr>
      `;
    }).join("");
  }
