// Overview tab
// Classic script: shares globals with the other files in js/core and js/views.

  // =========================================================================
  // 1. DASHBOARD VIEW
  // =========================================================================
  function renderZenAwakenedStrip() {
    const strip = document.getElementById("zenAwakenedStrip");
    if (!strip) return;
    const spiritStats = SIAnalytics.computeSpiritStats(getStatsData());
    const top4 = [...spiritStats].sort((a,b) => b.gamesPlayed - a.gamesPlayed).slice(0, 4);
    strip.innerHTML = top4.map(s => `
      <div class="zen-spirit-card" style="cursor:pointer;" onclick="if(window.selectAndShowDossier) window.selectAndShowDossier('${escapeHtml(s.name).replace(/'/g, "\\'")}');">
        <div class="zen-spirit-top">
          <img src="${s.image}" alt="${escapeHtml(s.name)}" style="${getFocalStyle(s)}" onerror="this.onerror=null;this.src='assets/spirits/volcano_looming_high.png';">
          <div class="zen-spirit-name">${escapeHtml(s.name)}</div>
        </div>
        <div class="zen-spirit-stat">
          <span>${s.gamesPlayed} Sessions</span>
          <strong style="color:var(--accent-emerald);">${SIAnalytics.formatNum(s.winRate, 0)}% Win · ${SIAnalytics.formatNum(s.highScore || 0, 0)} pts</strong>
        </div>
      </div>
    `).join("");
  }

  function renderDashboard() {
    const kpis = SIAnalytics.computeGlobalKPIs(getStatsData());
    const kpiGrid = document.getElementById("heroKpiGrid");
    if (kpiGrid) {
      const isZenPage = document.body.getAttribute("data-theme") === "botanical" || document.body.getAttribute("data-theme") === "botanical-parchment" || !!document.getElementById("zenAwakenedStrip");
      if (isZenPage) {
        kpiGrid.className = "zen-figures";
        kpiGrid.innerHTML = `
          <div onclick="switchTab('matches')" style="cursor:pointer;" title="Click to view Annals of Recorded Reckonings">
            <div class="zf-num">${kpis.totalMatches}</div>
            <div class="zf-label" style="text-decoration:underline;text-underline-offset:3px;">Sessions Played ↗</div>
          </div>
          <div>
            <div class="zf-num" style="color:var(--accent-emerald);">${SIAnalytics.formatNum(kpis.winRate, 1)}%</div>
            <div class="zf-label">Invaders Repelled</div>
          </div>
          <div>
            <div class="zf-num">${SIAnalytics.formatNum(kpis.highScore, 0)}</div>
            <div class="zf-label">Highest Renown</div>
          </div>
          <div>
            <div class="zf-num">${kpis.highestDiffBeaten}</div>
            <div class="zf-label">Peak Difficulty</div>
          </div>
        `;
      } else {
        kpiGrid.innerHTML = `
          <div class="kpi-card" onclick="switchTab('matches')" style="cursor:pointer;" title="Click to view Annals of Recorded Reckonings">
            <div class="kpi-label"><span>Recorded Reckonings ↗</span> <span>I</span></div>
            <div class="kpi-value">${kpis.totalMatches}</div>
            <div class="kpi-sub">
              <span>${kpis.wins} Victories</span>
              <span>·</span>
              <span>${kpis.losses} Defeats</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>Invaders Repelled</span> <span>II</span></div>
            <div class="kpi-value" style="color: var(--accent-emerald);">${SIAnalytics.formatNum(kpis.winRate, 1)}%</div>
            <div class="kpi-sub">
              <span>${kpis.invaderCardsCleared} Invader Cards Cleared</span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>Peak Threat Survived</span> <span>III</span></div>
            <div class="kpi-value" style="color: var(--accent-gold);">Level ${kpis.highestDiffBeaten}</div>
            <div class="kpi-sub">Highest Difficulty Beaten</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>Highest Renown</span> <span>IV</span></div>
            <div class="kpi-value">${SIAnalytics.formatNum(kpis.highScore, 1)}</div>
            <div class="kpi-sub">Mean Score: <strong>${SIAnalytics.formatNum(kpis.avgScore, 1)} pts</strong></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>Island Balance</span> <span>V</span></div>
            <div class="kpi-value">${SIAnalytics.formatNum(kpis.avgDahanWin, 1)} <span style="font-size:1rem;color:var(--text-secondary);">Dahan</span></div>
            <div class="kpi-sub">Avg Blight on Island: ${SIAnalytics.formatNum(kpis.avgBlightWin, 1)}</div>
          </div>
        `;
      }
    }

    renderZenAwakenedStrip();
    renderDossier();
    renderAdversaryThreatMatrix();
    renderCouncilLeaderboard();
    renderAdversaryGauntlet();
    renderRecommender();
    renderLossAutopsy();
  }

    // --- Searchable Dossier Combobox State & Implementation ---
  let comboboxHighlightedIndex = -1;
  let comboboxFilteredSpirits = [];
  let comboboxBound = false;

  function initDossierCombobox() {
    const wrapper = document.getElementById("dossierCombobox");
    const input = document.getElementById("dossierSearchableInput");
    const clearBtn = document.getElementById("dossierComboboxClear");
    const toggleBtn = document.getElementById("dossierComboboxToggle");
    const dropdown = document.getElementById("dossierComboboxDropdown");
    const optionsContainer = document.getElementById("dossierComboboxOptions");
    const hiddenSelect = document.getElementById("dossierSpiritSelect");

    if (!wrapper || !input || comboboxBound) return;
    comboboxBound = true;

    function getSpiritStats() {
      return SIAnalytics.computeSpiritStats(getStatsData());
    }

    function renderOptions(query = "") {
      const allSpirits = getSpiritStats();
      const cleanQ = query.trim().toLowerCase();
      comboboxFilteredSpirits = cleanQ
        ? allSpirits.filter(s => 
            s.name.toLowerCase().includes(cleanQ) || 
            (s.complexity && s.complexity.toLowerCase().includes(cleanQ)) ||
            (s.expansion && s.expansion.toLowerCase().includes(cleanQ))
          )
        : allSpirits;

      comboboxHighlightedIndex = -1;

      if (comboboxFilteredSpirits.length === 0) {
        optionsContainer.innerHTML = `<div class="combobox-empty-message">No spirits match "${escapeHtml(query)}"</div>`;
        return;
      }

      optionsContainer.innerHTML = comboboxFilteredSpirits.map((s, idx) => {
        const isSel = s.name === selectedDossierSpirit;
        const compClass = s.complexity ? `complexity-${s.complexity.toLowerCase().replace(/\s+/g, '-')}` : '';
        const wrText = s.winRate !== null ? `${Math.round(s.winRate)}% WR` : '—';
        return `
          <div class="combobox-option ${isSel ? 'selected' : ''}" data-index="${idx}" data-name="${escapeHtml(s.name)}" role="option">
            <img src="${escapeHtml(s.image)}" alt="" class="combobox-option-thumb" onerror=\"this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'\" />
            <div class="combobox-option-info">
              <div class="combobox-option-name">${escapeHtml(s.name)}</div>
              <div class="combobox-option-meta">
                <span class="combobox-badge ${compClass}">${escapeHtml(s.complexity || 'Spirit')}</span>
                <span class="combobox-meta-stat">${s.gamesPlayed} games (${wrText})</span>
              </div>
            </div>
            ${isSel ? '<span class="combobox-check">✓</span>' : ''}
          </div>
        `;
      }).join("");

      // Bind click on each option
      const optionEls = optionsContainer.querySelectorAll(".combobox-option");
      optionEls.forEach(el => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault(); // prevent blur before selection
          const name = el.getAttribute("data-name");
          selectSpirit(name);
        });
      });

      // Auto-scroll to selected option if no query
      if (!cleanQ) {
        const selectedEl = optionsContainer.querySelector(".combobox-option.selected");
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: "nearest" });
        }
      }
    }

    function openDropdown() {
      wrapper.classList.add("open");
      dropdown.style.display = "block";
      renderOptions(input.value === selectedDossierSpirit ? "" : input.value);
    }

    function closeDropdown() {
      wrapper.classList.remove("open");
      dropdown.style.display = "none";
      input.value = selectedDossierSpirit || "";
      if (clearBtn) clearBtn.style.display = "none";
    }

    function selectSpirit(spiritName) {
      if (!spiritName) return;
      selectedDossierSpirit = spiritName;
      selectedDossierAspect = "Base";
      input.value = spiritName;
      if (hiddenSelect) hiddenSelect.value = spiritName;
      closeDropdown();
      renderDossier();
    }

    function highlightOption(index) {
      const optionEls = optionsContainer.querySelectorAll(".combobox-option");
      optionEls.forEach((el, i) => {
        el.classList.toggle("highlighted", i === index);
        if (i === index) el.scrollIntoView({ block: "nearest" });
      });
      comboboxHighlightedIndex = index;
    }

    // Input interactions
    input.addEventListener("focus", () => {
      openDropdown();
      input.select();
    });

    input.addEventListener("click", () => {
      if (!wrapper.classList.contains("open")) {
        openDropdown();
        input.select();
      }
    });

    input.addEventListener("input", (e) => {
      const q = e.target.value;
      if (clearBtn) clearBtn.style.display = q ? "inline-block" : "none";
      if (!wrapper.classList.contains("open")) {
        wrapper.classList.add("open");
        dropdown.style.display = "block";
      }
      renderOptions(q);
      if (comboboxFilteredSpirits.length > 0) {
        highlightOption(0);
      }
    });

    input.addEventListener("keydown", (e) => {
      if (!wrapper.classList.contains("open")) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (comboboxHighlightedIndex + 1) % comboboxFilteredSpirits.length;
        highlightOption(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = comboboxHighlightedIndex <= 0 ? comboboxFilteredSpirits.length - 1 : comboboxHighlightedIndex - 1;
        highlightOption(prev);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (comboboxHighlightedIndex >= 0 && comboboxHighlightedIndex < comboboxFilteredSpirits.length) {
          selectSpirit(comboboxFilteredSpirits[comboboxHighlightedIndex].name);
        } else if (comboboxFilteredSpirits.length > 0) {
          selectSpirit(comboboxFilteredSpirits[0].name);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
      }
    });

    // Toggle button
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (wrapper.classList.contains("open")) {
          closeDropdown();
        } else {
          openDropdown();
          input.focus();
          input.select();
        }
      });
    }

    // Clear button
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        input.value = "";
        clearBtn.style.display = "none";
        input.focus();
        renderOptions("");
      });
    }

    // Outside click listener
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        if (wrapper.classList.contains("open")) {
          closeDropdown();
        }
      }
    });
  }

  window.selectAndShowDossier = function(spiritName, aspectName) {
    if (!spiritName) return;
    inspectSpiritInDossier(spiritName);
    if (aspectName) {
      selectedDossierAspect = aspectName;
      renderDossier();
    }
  };

  
