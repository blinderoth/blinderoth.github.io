// Achievements tab: milestone celebration, summary and view wiring
// Classic script: shares globals with the other files in js/core and js/views.

  function collectNewMilestones(prevAch, nextAch, matchObj) {
    const playedSpirits = Array.from(new Set((matchObj.players || []).map(p => p.spirit).filter(Boolean)));
    const spiritsMap = {};
    (appData.spirits || []).forEach(s => { spiritsMap[s.name] = s; });
    const adversaries = appData.adversaries || [];

    const results = [];
    playedSpirits.forEach(spName => {
      const prev = prevAch?.bySpirit?.[spName];
      const next = nextAch?.bySpirit?.[spName];
      if (!prev || !next) return;
      const items = [];

      if (!prev.wonAny && next.wonAny) items.push("First Victory");

      const prevDiff = Math.max(0, prev.maxDiffWon || 0);
      const nextDiff = Math.min(10, next.maxDiffWon || 0);
      if (nextDiff > prevDiff) {
        items.push(nextDiff === prevDiff + 1
          ? `Difficulty ${nextDiff}+ Victory`
          : `Difficulty ${prevDiff + 1}–${nextDiff}+ Victories`);
      }

      if ((prev.maxScoreWon || 0) < 40 && (next.maxScoreWon || 0) >= 40) {
        items.push("Score 40+ Victory");
      }

      adversaries.forEach(adv => {
        const pLvl = prev.advMaxLevel?.[adv.name] ?? -1;
        const nLvl = next.advMaxLevel?.[adv.name] ?? -1;
        if (nLvl > pLvl) {
          const shortAdv = adv.name.replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "");
          items.push(nLvl === pLvl + 1
            ? `${shortAdv} Lv. ${nLvl}`
            : `${shortAdv} Lv. ${pLvl + 1}–${nLvl}`);
        }
      });

      next.scenariosWon?.forEach(sc => {
        if (!prev.scenariosWon?.has(sc)) items.push(`Scenario: ${sc}`);
      });

      next.teammatesWon?.forEach(tm => {
        if (!prev.teammatesWon?.has(tm)) items.push(`Synergy: ${tm}`);
      });

      if (items.length > 0) {
        results.push({ spirit: spiritsMap[spName] || { name: spName, image: "" }, items });
      }
    });
    return results;
  }

  function celebrateNewMilestones(unlockedBySpirit) {
    document.querySelectorAll(".milestone-celebration-overlay, .milestone-motes-burst").forEach(el => el.remove());

    const totalCount = unlockedBySpirit.reduce((sum, g) => sum + g.items.length, 0);
    const burst = document.createElement("div");
    burst.className = "milestone-motes-burst";
    const colors = ["#D4A44E", "#4DA674", "#F4C977", "#84D9A6", "#E8C56E"];
    for (let i = 0; i < 30; i++) {
      const mote = document.createElement("span");
      mote.className = "milestone-mote";
      const angle = (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.25;
      const dist = 110 + Math.random() * 170;
      mote.style.setProperty("--tx", `${Math.round(Math.cos(angle) * dist)}px`);
      mote.style.setProperty("--ty", `${Math.round(Math.sin(angle) * dist)}px`);
      mote.style.setProperty("--rot", `${Math.round((Math.random() - 0.5) * 240)}deg`);
      mote.style.setProperty("--sz", `${6 + Math.round(Math.random() * 6)}px`);
      mote.style.setProperty("--dur", `${(0.85 + Math.random() * 0.45).toFixed(2)}s`);
      mote.style.setProperty("--delay", `${(Math.random() * 0.12).toFixed(2)}s`);
      mote.style.setProperty("--mote-color", colors[i % colors.length]);
      burst.appendChild(mote);
    }

    const overlay = document.createElement("div");
    overlay.className = "milestone-celebration-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "New Milestone Unlocked");

    const groupsHtml = unlockedBySpirit.map(g => `
      <div class="milestone-spirit-group">
        ${g.spirit.image ? `<img src="${escapeHtml(g.spirit.image)}" alt="" style="${getFocalStyle(g.spirit)}" onerror="this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'">` : ""}
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">${escapeHtml(g.spirit.name)}</div>
          <div class="milestone-pill-list">
            ${g.items.map(it => `<span class="milestone-pill">✔ ${escapeHtml(it)}</span>`).join("")}
          </div>
        </div>
      </div>
    `).join("");

    overlay.innerHTML = `
      <div class="milestone-celebration-card">
        <div class="milestone-seal-badge" aria-hidden="true">🏆</div>
        <h3 class="serif-title" style="text-align:center;margin:0 0 0.2rem;font-size:1.25rem;color:var(--accent-gold-light);">
          ${totalCount === 1 ? "New Milestone Unlocked!" : `${totalCount} New Milestones Unlocked!`}
        </h3>
        <p style="text-align:center;font-size:0.82rem;color:var(--text-secondary);margin:0 0 1rem;">
          Your latest reckoning carved new mastery into the island's memory.
        </p>
        ${groupsHtml}
        <div style="display:flex;justify-content:center;gap:0.6rem;margin-top:1rem;">
          <button type="button" class="btn-zen btn-zen-secondary" id="milestoneDismissBtn">Continue</button>
          <button type="button" class="btn-zen btn-zen-primary" id="milestoneViewAchBtn">View Achievements</button>
        </div>
      </div>
    `;

    const close = () => {
      overlay.remove();
      burst.remove();
      document.removeEventListener("keydown", onEsc);
    };
    const onEsc = (e) => { if (e.key === "Escape") close(); };

    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onEsc);
    document.body.appendChild(burst);
    document.body.appendChild(overlay);

    overlay.querySelector("#milestoneDismissBtn")?.addEventListener("click", close);
    overlay.querySelector("#milestoneViewAchBtn")?.addEventListener("click", () => {
      close();
      switchTab("achievements");
    });

    setTimeout(() => { if (burst.parentNode) burst.remove(); }, 1800);
  }

  // =========================================================================
  // 3. ACHIEVEMENTS & MASTERY MATRIX VIEW
  // =========================================================================
  function renderAchievementsSummary(ach) {
    const summaryEl = document.getElementById("achievementsSummaryHeader");
    if (!summaryEl) return;
    const aspStats = SIAnalytics.computeAspectStats(getStatsData()).filter(r => !r.isBase);
    const aspectLine = `${aspStats.filter(r => r.gamesPlayed > 0).length} / ${aspStats.length} aspects tried`;
    summaryEl.innerHTML = `
      <div class="panel-card" style="margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:0.65rem;">
          <div>
            <h3 class="serif-title" style="color:var(--accent-gold-light);font-size:1.1rem;">🏆 Island Mastery & Achievement Matrix</h3>
            <p style="font-size:0.82rem;color:var(--text-secondary);">Tracks general milestones, adversary levels, scenarios and aspects for each spirit, plus the teammates you have won with.</p>
          </div>
          <div style="text-align:right;">
            <div class="mono" style="font-size:1.5rem;font-weight:800;color:var(--accent-emerald-light);">${SIAnalytics.formatNum(ach.overallPct, 1)}%</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">${ach.totalUnlocked} / ${ach.totalPossible} Milestones Unlocked</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">${aspectLine}</div>
          </div>
        </div>
        <div class="element-bar-track" style="height:10px;">
          <div class="element-bar-fill" style="width:${ach.overallPct}%;background:linear-gradient(90deg, var(--accent-gold), var(--accent-emerald));"></div>
        </div>
      </div>
    `;
  }

  function renderAchievementsView() {
    const getOwnedOnly = () => document.getElementById("achOwnedOnlyToggle")?.checked ?? true;
    const ach = SIAnalytics.computeAchievements(getStatsData(), { ownedOnly: getOwnedOnly() });
    renderAchievementsSummary(ach);

    document.querySelectorAll("#achSubNav .sub-nav-btn").forEach(btn => {
      btn.onclick = () => {
        currentAchievementSubtab = btn.getAttribute("data-subtab");
        document.querySelectorAll("#achSubNav .sub-nav-btn").forEach(b => b.classList.toggle("active", b === btn));
        renderAchievementMatrixContent(SIAnalytics.computeAchievements(getStatsData(), { ownedOnly: getOwnedOnly() }));
      };
    });

    // Handlers recompute from the live data, so toggles never show a stale snapshot after a game is logged.
    const rerender = () => {
      const nextAch = SIAnalytics.computeAchievements(getStatsData(), { ownedOnly: getOwnedOnly() });
      renderAchievementsSummary(nextAch);
      renderAchievementMatrixContent(nextAch);
    };
    const prefs = readAchPrefs();

    const ownedOnlyToggle = document.getElementById("achOwnedOnlyToggle");
    if (ownedOnlyToggle && !ownedOnlyToggle.dataset.bound) {
      ownedOnlyToggle.dataset.bound = "1";
      ownedOnlyToggle.addEventListener("change", rerender);
    }
    const hideToggle = document.getElementById("achHideEmptyToggle");
    if (hideToggle && !hideToggle.dataset.bound) {
      hideToggle.dataset.bound = "1";
      hideToggle.checked = prefs.hideEmpty;
      hideToggle.addEventListener("change", () => { saveAchPref(ACH_HIDE_KEY, hideToggle.checked ? "1" : "0"); rerender(); });
    }
    const sortSel = document.getElementById("achSortSelect");
    if (sortSel && !sortSel.dataset.bound) {
      sortSel.dataset.bound = "1";
      sortSel.value = prefs.sort;
      sortSel.addEventListener("change", () => { saveAchPref(ACH_SORT_KEY, sortSel.value); rerender(); });
    }
    const expandBtn = document.getElementById("achExpandAllBtn");
    if (expandBtn && !expandBtn.dataset.bound) {
      expandBtn.dataset.bound = "1";
      expandBtn.addEventListener("click", () => {
        const cards = document.querySelectorAll("#achievementsMatrixContainer details.ach-details");
        const openAll = Array.from(cards).some(d => !d.open);
        cards.forEach(d => {
          d.open = openAll;
          const key = d.getAttribute("data-key");
          if (openAll) achOpen.add(key); else achOpen.delete(key);
        });
        updateExpandAllLabel();
      });
    }

    renderAchievementMatrixContent(ach);
  }
