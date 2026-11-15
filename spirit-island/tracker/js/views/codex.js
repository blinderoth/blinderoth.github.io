// Spirits tab (codex)
// Classic script: shares globals with the other files in js/core and js/views.

  // =========================================================================
  // 4. ISLAND COMPENDIUM (SPIRITS, POWER CARDS, SETUP & 3D MINIATURES)
  // =========================================================================
  // The Dossier lives in the Spirits tab as its own sub-view.
  function setCodexSubtab(name) {
    currentCodexSubtab = name;
    document.querySelectorAll("#codexSubNav .sub-nav-btn").forEach(b => b.classList.toggle("active", b.getAttribute("data-codex") === name));
    document.querySelectorAll(".codex-subview").forEach(v => {
      v.style.display = v.id === `codex-${name}` ? "block" : "none";
    });
  }

  function openDossier() {
    switchTab("codex");
    setCodexSubtab("dossier");
    renderDossier();
    document.getElementById("dossierCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCodexView() {
    document.querySelectorAll("#codexSubNav .sub-nav-btn").forEach(btn => {
      btn.onclick = () => setCodexSubtab(btn.getAttribute("data-codex"));
    });

    renderCodexSpirits();
    renderCodexInvaders();
    renderCodexPowers();
  }

  function renderCodexSpirits() {
    setTimeout(() => { if (window.SpiritAnimations) window.SpiritAnimations.applyAuras(); }, 50);
    const gallery = document.getElementById("codexSpiritsGallery");
    if (!gallery) return;

    const searchQ = (document.getElementById("codexSpiritSearch")?.value || "").toLowerCase().trim();
    const compFilter = document.getElementById("codexSpiritComplexity")?.value || "";
    const expFilter = document.getElementById("codexSpiritExpansion")?.value || "";

    const spiritStats = SIAnalytics.computeSpiritStats(getStatsData());
    const filtered = spiritStats.filter(s => {
      if (compFilter && s.complexity !== compFilter) return false;
      if (expFilter && s.expansion !== expFilter) return false;
      if (searchQ && !`${s.name} ${s.affinityProfile} ${s.expansion}`.toLowerCase().includes(searchQ)) return false;
      return true;
    });

    gallery.innerHTML = filtered.map(sp => `
        <div class="spirit-card compact" data-spirit-card="${escapeHtml(sp.name)}">
          <div class="spirit-card-avatar-box">
            <img src="${escapeHtml(sp.image)}" alt="" style="${getFocalStyle(sp)}" loading="lazy" onerror="this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'">
          </div>
          <div class="spirit-compact-body">
            <h4 class="spirit-compact-name">${escapeHtml(sp.name)}</h4>
            <div class="spirit-compact-meta">
              <span class="badge ${getComplexityBadgeClass(sp.complexity)}">${escapeHtml(sp.complexity)}</span>
              <span class="spirit-compact-exp">${escapeHtml(sp.expansion)}</span>
            </div>
            <div class="mono spirit-compact-stat">
              ${sp.gamesPlayed} ${sp.gamesPlayed === 1 ? "game" : "games"} \u2022 <strong>${sp.winRate !== null ? Math.round(sp.winRate) + "% win" : "unplayed"}</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm inspect-dossier-btn" data-spirit="${escapeHtml(sp.name)}" aria-label="Open dossier for ${escapeHtml(sp.name)}">Dossier \u2192</button>
        </div>
      `).join("");

    gallery.querySelectorAll(".inspect-dossier-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const spName = btn.getAttribute("data-spirit");
        selectedDossierAspect = "Base";
        selectedDossierSpirit = spName;
        openDossier();
      });
    });

    ["codexSpiritSearch", "codexSpiritComplexity", "codexSpiritExpansion"].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "1";
        el.addEventListener("input", renderCodexSpirits);
        el.addEventListener("change", renderCodexSpirits);
      }
    });
  }

  // --- Codex: Adversaries & Scenarios reference ---
  function renderCodexInvaders() {
    const container = document.getElementById("codexInvadersBody");
    if (!container) return;
    const advStats = SIAnalytics.computeAdversaryStats(getStatsData());
    const matches = appData.matches || [];

    const advCards = advStats.map(a => `
      <div class="spirit-card" style="padding:0.9rem;${a.owned ? "" : "opacity:0.75;"}">
        <div style="display:flex;align-items:center;gap:0.7rem;margin-bottom:0.5rem;">
          ${advIcon(a, 54, 36)}
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.92rem;">${escapeHtml(a.name)}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);">${escapeHtml(a.expansion)} · ${a.owned ? "Owned" : "Not owned"}</div>
          </div>
        </div>
        <div class="mono" style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:0.4rem;">Difficulty by level: ${a.levels.map((d, i) => `<span title="Level ${i}">${d}</span>`).join(" · ")}</div>
        <div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.4;margin-bottom:0.4rem;"><strong>Loss:</strong> ${escapeHtml(a.lossCondition || "—")}</div>
        <div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.4;">${escapeHtml(a.strategyNotes || "")}</div>
        <div class="mono" style="display:flex;gap:0.7rem;font-size:0.72rem;border-top:1px solid var(--border-subtle);margin-top:0.55rem;padding-top:0.45rem;">
          <span>${a.games}g / ${a.wins}w</span>
          <span style="color:var(--accent-emerald-light);">${a.winRate !== null ? Math.round(a.winRate) + "%" : "—"}</span>
          <span>Max Lvl ${a.maxLevelDefeated ?? "—"}</span>
        </div>
      </div>`).join("");

    const scenCards = (appData.scenarios || []).map(s => {
      const sm = matches.filter(m => m.scenario === s.name);
      const w = sm.filter(m => m.victory).length;
      const best = sm.length ? Math.max(...sm.map(m => Number(m.score || 0))) : 0;
      return `
        <div class="spirit-card" style="padding:0.8rem;${s.owned ? "" : "opacity:0.75;"}">
          <div style="display:flex;align-items:center;gap:0.65rem;">
            ${scenIcon(s, 44)}
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.88rem;">${escapeHtml(s.name)}</div>
              <div style="font-size:0.7rem;color:var(--text-secondary);">${escapeHtml(s.expansion)} · Diff ${s.difficulty >= 0 ? "+" + s.difficulty : s.difficulty} · ${s.owned ? "Owned" : "Not owned"}</div>
            </div>
          </div>
          <div class="mono" style="display:flex;gap:0.7rem;font-size:0.72rem;margin-top:0.5rem;">
            <span>${sm.length}g / ${w}w</span>
            <span>★ ${best > 0 ? SIAnalytics.formatNum(best, 1) : "—"}</span>
          </div>
        </div>`;
    }).join("");

    container.innerHTML = `
      <div class="panel-card" style="margin-bottom:1.25rem;">
        <div class="panel-header"><div><div class="panel-title serif-title">ADVERSARIES</div><div class="panel-subtitle">Flags, difficulty ladders, loss conditions & your record</div></div></div>
        <div class="spirits-gallery">${advCards}</div>
      </div>
      <div class="panel-card">
        <div class="panel-header"><div><div class="panel-title serif-title">SCENARIOS</div><div class="panel-subtitle">Scenario icons, difficulty modifier & your record</div></div></div>
        <div class="spirits-gallery">${scenCards}</div>
      </div>
    `;
  }

  function renderCodexPowers() {
    const elemFilterBar = document.getElementById("powerElementToggles");
    if (elemFilterBar && elemFilterBar.children.length === 0) {
      Object.keys(ELEMENT_COLORS).forEach(elName => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary btn-sm";
        btn.innerHTML = `${ELEMENT_EMOJIS[elName]} ${elName}`;
        btn.addEventListener("click", () => {
          if (activePowerElements.has(elName)) {
            activePowerElements.delete(elName);
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-secondary");
          } else {
            activePowerElements.add(elName);
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary");
          }
          renderPowersList();
        });
        elemFilterBar.appendChild(btn);
      });

      ["powerSearchInput", "powerCategorySelect", "powerSpeedSelect", "powerSetSelect"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", renderPowersList);
        el?.addEventListener("change", renderPowersList);
      });
    }

    renderPowersList();
  }

  function renderPowersList() {
    const grid = document.getElementById("powersCompendiumGrid");
    const countEl = document.getElementById("powersFilteredCount");
    if (!grid) return;

    const q = (document.getElementById("powerSearchInput")?.value || "").toLowerCase().trim();
    const cat = document.getElementById("powerCategorySelect")?.value || "";
    const spd = document.getElementById("powerSpeedSelect")?.value || "";
    const setFilter = document.getElementById("powerSetSelect")?.value || "";

    const filtered = (appData.powers || []).filter(p => {
      if (cat && p.category !== cat) return false;
      if (spd && p.speed !== spd) return false;
      if (setFilter && p.set !== setFilter) return false;
      for (const reqEl of activePowerElements) {
        if (!(p.elements || []).includes(reqEl)) return false;
      }
      if (q) {
        const hay = `${p.name} ${p.description} ${p.spirit} ${p.target} ${(p.elements || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${(appData.powers || []).length} Power Cards`;
    }

    grid.innerHTML = filtered.map(p => `
      <div class="power-card ${p.speed === 'Fast' ? 'fast-power' : 'slow-power'}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.55rem;">
            <span class="cost-circle">${p.cost}</span>
            <div>
              <div style="font-weight:700;font-size:0.92rem;">${escapeHtml(p.name)}</div>
              <div style="font-size:0.7rem;color:var(--text-secondary);">
                ${escapeHtml(p.category)} ${p.spirit ? `• ${escapeHtml(p.spirit)}` : ""} • ${escapeHtml(p.set)}
              </div>
            </div>
          </div>
          <span class="badge ${p.speed === 'Fast' ? 'badge-loss' : 'badge-neutral'}">${p.speed === 'Fast' ? '⚡ Fast' : '🐢 Slow'}</span>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.74rem;color:var(--text-secondary);background:transparent;padding:0.3rem 0.55rem;border-radius:6px;">
          <span><strong>Range:</strong> ${escapeHtml(p.range || "—")}</span>
          <span><strong>Target:</strong> ${escapeHtml(p.target || "Any")}</span>
        </div>

        <div style="font-size:0.8rem;color:var(--text-primary);line-height:1.45;">
          ${escapeHtml(p.description)}
        </div>

        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:auto;">
          ${(p.elements || []).map(el => `
            <span class="badge badge-neutral" style="border-color:${ELEMENT_COLORS[el]}55;color:${ELEMENT_COLORS[el]};">
              ${ELEMENT_EMOJIS[el]} ${el}
            </span>
          `).join("")}
        </div>
      </div>
    `).join("");
  }
