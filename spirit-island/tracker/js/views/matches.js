// Games tab: match log and the logging modal
// Classic script: shares globals with the other files in js/core and js/views.

  // =========================================================================
  // 2. MATCH LOG & INTERACTIVE LOGGER MODAL
  // =========================================================================
  function renderMatchesView() {
    const playerFilter = document.getElementById("filterMatchPlayer");
    const spiritFilter = document.getElementById("filterMatchSpirit");
    const advFilter = document.getElementById("filterMatchAdv");
    const outcomeFilter = document.getElementById("filterMatchOutcome");
    const searchInput = document.getElementById("filterMatchSearch");
    const sortSelect = document.getElementById("filterMatchSort");

    // Populate dropdowns once
    if (playerFilter && playerFilter.options.length <= 1) {
      (appData.players || []).forEach(p => {
        playerFilter.add(new Option(p.name, p.name));
      });
      [playerFilter, spiritFilter, advFilter, outcomeFilter, sortSelect].forEach(el => {
        el?.addEventListener("change", () => renderMatchesTable());
      });
      searchInput?.addEventListener("input", () => renderMatchesTable());
    }
    if (spiritFilter && spiritFilter.options.length <= 1) {
      (appData.spirits || []).forEach(s => {
        spiritFilter.add(new Option(s.name, s.name));
      });
    }
    if (advFilter && advFilter.options.length <= 1) {
      (appData.adversaries || []).forEach(a => {
        advFilter.add(new Option(a.name, a.name));
      });
    }

    renderMatchesTable();
    renderPlayHeatmap();
  }

  // Games list is collapsed to the latest 3 on load. The state is not saved.
  let gamesExpanded = false;
  const GAMES_COLLAPSED_COUNT = 3;

  function renderPlayHeatmap() {
    const grid = document.getElementById("playHeatGrid");
    const sel = document.getElementById("playHeatRange");
    if (!grid || !sel) return;
    const heat = new Map();
    const games = new Map();
    (appData.matches || []).forEach(m => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || "")) return;
      heat.set(m.date, (heat.get(m.date) || 0) + Math.max(1, (m.players || []).length));
      games.set(m.date, (games.get(m.date) || 0) + 1);
    });
    const years = Array.from(new Set(Array.from(heat.keys()).map(d => d.slice(0, 4)))).sort().reverse();
    const prev = sel.value || "last12";
    sel.innerHTML = `<option value="last12">Last 12 months</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
    sel.value = Array.from(sel.options).some(o => o.value === prev) ? prev : "last12";
    if (!sel.dataset.bound) { sel.dataset.bound = "1"; sel.addEventListener("change", renderPlayHeatmap); }

    const DAY = 86400000;
    const utc = (y, m, d) => Date.UTC(y, m, d);
    const now = new Date();
    let start, end;
    if (sel.value === "last12") {
      end = utc(now.getFullYear(), now.getMonth(), now.getDate());
      const s0 = new Date(end); s0.setUTCFullYear(s0.getUTCFullYear() - 1); start = s0.getTime() + DAY;
    } else {
      start = utc(Number(sel.value), 0, 1); end = utc(Number(sel.value), 11, 31);
    }
    const dow = t => (new Date(t).getUTCDay() + 6) % 7;      // Monday = 0
    const gridStart = start - dow(start) * DAY;
    const weeks = Math.floor((end - gridStart) / DAY / 7) + 1;
    const iso = t => new Date(t).toISOString().slice(0, 10);
    let max = 0, totalGames = 0, totalHeat = 0, activeDays = 0;
    for (let t = start; t <= end; t += DAY) {
      const h = heat.get(iso(t)) || 0;
      if (h) { activeDays++; totalHeat += h; totalGames += games.get(iso(t)); }
      if (h > max) max = h;
    }
    const months = [];
    let cells = "";
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const t = gridStart + (w * 7 + d) * DAY;
        if (t < start || t > end) { cells += `<i class="ph-cell ph-out" style="grid-column:${w + 2};grid-row:${d + 2}"></i>`; continue; }
        const key = iso(t), h = heat.get(key) || 0;
        const lvl = h ? Math.max(1, Math.ceil(8 * h / max)) : 0;
        const g = games.get(key) || 0;
        const label = h ? `${key}: ${g} game${g === 1 ? "" : "s"}, heat ${h}` : `${key}: no games`;
        cells += `<i class="ph-cell ph-l${lvl}" style="grid-column:${w + 2};grid-row:${d + 2}" title="${label}" aria-label="${label}"></i>`;
        if (new Date(t).getUTCDate() === 1 || (t === start && new Date(t).getUTCDate() < 22)) months.push([w, new Date(t).toLocaleString("en-US", { month: "short", timeZone: "UTC" })]);
      }
    }
    const dayNames = ["Mon", "", "Wed", "", "Fri", "", ""].map((n, i) => n ? `<span class="ph-day" style="grid-row:${i + 2}">${n}</span>` : "").join("");
    const monthHtml = months.map(([w, n]) => `<span class="ph-month" style="grid-column:${w + 2}">${n}</span>`).join("");
    grid.style.gridTemplateColumns = `auto repeat(${weeks}, var(--ph-size))`;
    grid.innerHTML = monthHtml + dayNames + cells;
    const sum = document.getElementById("playHeatSummary");
    if (sum) sum.textContent = totalGames ? `${totalGames} game${totalGames === 1 ? "" : "s"} on ${activeDays} day${activeDays === 1 ? "" : "s"}` : "No games in this range";
  }

  function renderMatchesTable() {
    const tbody = document.getElementById("matchesHistoryTbody");
    const countLabel = document.getElementById("matchesFilteredCount");
    if (!tbody) return;

    const pVal = document.getElementById("filterMatchPlayer")?.value || "";
    const sVal = document.getElementById("filterMatchSpirit")?.value || "";
    const aVal = document.getElementById("filterMatchAdv")?.value || "";
    const oVal = document.getElementById("filterMatchOutcome")?.value || "";
    const qVal = (document.getElementById("filterMatchSearch")?.value || "").toLowerCase().trim();
    const sortVal = document.getElementById("filterMatchSort")?.value || "newest";

    const spiritsMap = {};
    (appData.spirits || []).forEach(s => { spiritsMap[s.name] = s; });
    const advMap = {};
    (appData.adversaries || []).forEach(a => { advMap[a.name] = a; });
    const aspectMap = {};
    (appData.aspects || []).forEach(a => { aspectMap[`${a.spirit}||${a.name}`] = a; });

    let filtered = (appData.matches || []).filter(m => {
      if (selectedPlayerFilter && !(m.players || []).some(p => p.player?.trim() === selectedPlayerFilter)) return false;
      if (pVal && !(m.players || []).some(p => p.player?.trim() === pVal)) return false;
      if (sVal && !(m.players || []).some(p => p.spirit === sVal)) return false;
      if (aVal && m.adversary1 !== aVal && m.adversary2 !== aVal) return false;
      if (oVal === "win" && !m.victory) return false;
      if (oVal === "loss" && m.victory) return false;
      if (qVal) {
        const hay = [
          m.date,
          m.adversary1,
          m.scenario,
          m.notes,
          ...(m.players || []).map(p => `${p.spirit} ${p.aspect} ${p.player}`)
        ].join(" ").toLowerCase();
        if (!hay.includes(qVal)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortVal === "oldest") return (a.id || 0) - (b.id || 0);
      if (sortVal === "score_desc") return Number(b.score || 0) - Number(a.score || 0);
      if (sortVal === "diff_desc") return Number(b.difficulty || 0) - Number(a.difficulty || 0);
      return (b.id || 0) - (a.id || 0);
    });

    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${(appData.matches || []).length} games`;
    }

    const isDefaultView = !pVal && !sVal && !aVal && !oVal && !qVal && sortVal === "newest";
    const collapse = isDefaultView && !gamesExpanded && filtered.length > GAMES_COLLAPSED_COUNT;
    const toggleBtn = document.getElementById("gamesToggleBtn");
    if (toggleBtn) {
      const canToggle = isDefaultView && filtered.length > GAMES_COLLAPSED_COUNT;
      toggleBtn.hidden = !canToggle;
      toggleBtn.setAttribute("aria-expanded", String(!collapse));
      toggleBtn.textContent = collapse ? `Show all ${filtered.length} games` : `Show only the latest ${GAMES_COLLAPSED_COUNT}`;
      if (!toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = "1";
        toggleBtn.addEventListener("click", () => { gamesExpanded = !gamesExpanded; renderMatchesTable(); });
      }
    }

    tbody.innerHTML = filtered.map((m, rowIdx) => {
      const playersHtml = (m.players || []).map(slot => {
        const spImg = spiritsMap[slot.spirit]?.image || "assets/spirits/volcano_looming_high.png";
        const aspObj = slot.aspect ? aspectMap[`${slot.spirit}||${slot.aspect}`] : null;
        return `
          <span class="spirit-player-chip" data-spirit="${escapeHtml(slot.spirit)}">
            <img src="${escapeHtml(spImg)}" alt="">
            <span><strong>${escapeHtml(slot.spirit)}</strong></span>
            ${slot.aspect ? `
              <span class="aspect-tag" style="display:inline-flex;align-items:center;gap:0.3rem;">
                ${aspObj?.image ? `<img src="${escapeHtml(aspObj.image)}" alt="" style="width:14px;height:14px;border-radius:2px;object-fit:cover;">` : ""}
                ${escapeHtml(slot.aspect)}
              </span>` : ""}
            <span style="color:var(--text-secondary);">(${escapeHtml(slot.player)})</span>
          </span>
        `;
      }).join("");

      const advObj = advMap[m.adversary1];
      const advHtml = m.adversary1
        ? `<div style="display:flex;align-items:center;gap:0.45rem;">
             ${advIcon(advObj, 22, 15)}
             <span><strong>${escapeHtml(m.adversary1)}</strong> ${m.adversary1Level !== null && m.adversary1Level !== "" ? `<span class="badge badge-moderate">Lvl ${m.adversary1Level}</span>` : ""}</span>
           </div>`
        : `<span style="color:var(--text-muted);">Base Island</span>`;

      const scenHtml = [
        m.scenario ? `<span class="badge badge-neutral" style="display:inline-flex;align-items:center;gap:0.3rem;">${scenIcon(m.scenario, 16)} ${escapeHtml(m.scenario)}</span>` : "",
        m.thematicMap ? `<span class="badge badge-vhigh">Thematic Map</span>` : ""
      ].filter(Boolean).join(" ");

      const invStat = m.victory
        ? (m.invaderCardsInDeck !== null && m.invaderCardsInDeck !== "" ? `${m.invaderCardsInDeck} Cards Left` : "")
        : (m.invaderCardsNotInDeck !== null && m.invaderCardsNotInDeck !== "" ? `${m.invaderCardsNotInDeck} Cards Out` : "");

      return `
        <tr class="game-row${collapse && rowIdx >= GAMES_COLLAPSED_COUNT ? " game-extra" : ""}" style="cursor:pointer;" onclick="if(window.inspectGame) window.inspectGame(${m.id})">
          <td class="mono" style="color:var(--text-secondary);font-weight:700;">#${m.id}</td>
          <td class="mono" style="white-space:nowrap;">${escapeHtml(m.date || "—")}</td>
          <td>
            <span class="badge ${m.victory ? 'badge-win' : 'badge-loss'}">
              ${m.victory ? '✔ VICTORY' : '✖ DEFEAT'}
            </span>
            ${!m.victory && m.lossCondition ? `<div style="font-size:0.68rem;color:var(--accent-crimson);margin-top:0.2rem;">${escapeHtml(m.lossCondition)}</div>` : ""}
          </td>
          <td>${playersHtml}</td>
          <td>
            ${advHtml}
            ${scenHtml ? `<div style="margin-top:0.25rem;display:flex;gap:0.3rem;flex-wrap:wrap;">${scenHtml}</div>` : ""}
          </td>
          <td class="mono"><span class="badge badge-neutral">Diff ${m.difficulty ?? 0}</span></td>
          <td style="font-size:0.76rem;color:var(--text-secondary);white-space:nowrap;">
            <div>Dahan: <strong>${m.dahan ?? 0}</strong> • Blight: <strong>${m.blight ?? 0}</strong></div>
            <div>${invStat} ${m.fearCardsLeft !== null && m.fearCardsLeft !== "" && m.fearCardsLeft !== undefined ? `• Fear: ${m.fearCardsLeft}` : ""}</div>
          </td>
          <td class="mono" style="font-size:1rem;font-weight:800;color:var(--accent-gold-light);">
            ${SIAnalytics.formatNum(m.score, 2)}
          </td>
          <td style="max-width:220px;font-size:0.77rem;color:var(--text-secondary);">${escapeHtml(m.notes || "")}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm edit-match-btn" data-id="${m.id}" title="Edit match" aria-label="Edit match">Edit</button>
            <button class="btn btn-danger btn-sm delete-match-btn" data-id="${m.id}" title="Delete match" aria-label="Delete match">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".spirit-player-chip").forEach(chip => {
      chip.addEventListener("click", e => { e.stopPropagation(); inspectSpiritInDossier(chip.getAttribute("data-spirit")); });
    });

    tbody.querySelectorAll(".edit-match-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const id = Number(btn.getAttribute("data-id"));
        const match = (appData.matches || []).find(m => Number(m.id) === id);
        if (match) openMatchModal(match);
      });
    });

    tbody.querySelectorAll(".delete-match-btn").forEach(btn => {
      btn.addEventListener("click", async e => {
        e.stopPropagation();
        const id = Number(btn.getAttribute("data-id"));
        const idx = (appData.matches || []).findIndex(m => Number(m.id) === id);
        if (idx < 0) return;
        const removed = appData.matches[idx];
        appData.matches.splice(idx, 1);
        await persistData();
        renderAll();
        showToast(`Deleted Match #${id}`, {
          actionLabel: "Undo",
          duration: 8000,
          onAction: async () => {
            appData.matches.splice(Math.min(idx, appData.matches.length), 0, removed);
            await persistData(`Match #${id} restored`);
            renderAll();
          }
        });
      });
    });
  }

  // --- Game detail pop-up (read-only) ---
  let gameDetailReturnFocus = null;
  let gameDetailId = null;

  function gameDetailHtml(m) {
    const spiritsMap = {}; (appData.spirits || []).forEach(x => { spiritsMap[x.name] = x; });
    const players = (m.players || []).map(slot => {
      const img = spiritsMap[slot.spirit]?.image;
      return `<li>${img ? `<img src="${escapeHtml(img)}" alt="">` : ""}<span><strong>${escapeHtml(slot.spirit || "—")}</strong>${slot.aspect && slot.aspect !== "Base" ? ` <em>${escapeHtml(slot.aspect)}</em>` : ""}</span><span class="gm-dim">${escapeHtml(slot.player || "")}</span></li>`;
    }).join("");
    const advLine = (name, lvl) => name ? `<div class="gm-line">${advIcon(name, 22, 15)}<span>${escapeHtml(name)}${lvl !== null && lvl !== "" && lvl !== undefined ? ` <b>L${escapeHtml(lvl)}</b>` : ""}</span></div>` : "";
    const has = v => v !== null && v !== undefined && v !== "";
    const stat = (label, val) => has(val) ? `<div class="gm-stat"><span>${label}</span><strong>${escapeHtml(val)}</strong></div>` : "";
    return `
      <div class="gm-result">
        <span class="badge ${m.victory ? "badge-win" : "badge-loss"}">${m.victory ? "VICTORY" : "DEFEAT"}</span>
        ${!m.victory && m.lossCondition ? `<span class="gm-loss">${escapeHtml(m.lossCondition)}</span>` : ""}
        ${m.thematicMap ? `<span class="badge badge-vhigh">Thematic map</span>` : ""}
      </div>
      <ul class="gm-players">${players}</ul>
      <div class="gm-block">
        ${advLine(m.adversary1, m.adversary1Level) || `<div class="gm-line gm-dim">Base island</div>`}
        ${advLine(m.adversary2, m.adversary2Level)}
        ${m.scenario ? `<div class="gm-line">${scenIcon(m.scenario, 22)}<span>${escapeHtml(m.scenario)}</span></div>` : ""}
      </div>
      <div class="gm-stats">
        ${stat("Score", SIAnalytics.formatNum(m.score, 2))}${stat("Difficulty", m.difficulty ?? 0)}
        ${stat("Dahan", m.dahan)}${stat("Blight", m.blight)}
        ${m.victory ? stat("Invader cards left", m.invaderCardsInDeck) : stat("Invader cards out", m.invaderCardsNotInDeck)}
        ${stat("Fear cards left", m.fearCardsLeft)}
      </div>
      ${m.notes ? `<div class="gm-notes">${escapeHtml(m.notes)}</div>` : ""}`;
  }

  function openGameDetail(id) {
    const m = (appData.matches || []).find(x => Number(x.id) === Number(id));
    const modal = document.getElementById("gameDetailModal");
    if (!m || !modal) return;
    gameDetailId = m.id;
    gameDetailReturnFocus = document.activeElement;
    document.getElementById("gameDetailTitle").textContent = `Game #${m.id} · ${m.date || ""}`;
    document.getElementById("gameDetailBody").innerHTML = gameDetailHtml(m);
    document.getElementById("gameDetailEdit").hidden = SICloud.isViewer();
    modal.classList.add("open");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("gameDetailClose").focus();
  }

  function closeGameDetail() {
    const modal = document.getElementById("gameDetailModal");
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.style.display = "none";
    document.body.style.overflow = "";
    if (gameDetailReturnFocus && document.contains(gameDetailReturnFocus)) gameDetailReturnFocus.focus();
  }

  window.inspectGame = openGameDetail;

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("gameDetailClose")?.addEventListener("click", closeGameDetail);
    document.getElementById("gameDetailModal")?.addEventListener("click", e => { if (e.target.id === "gameDetailModal") closeGameDetail(); });
    document.getElementById("gameDetailEdit")?.addEventListener("click", () => {
      const m = (appData.matches || []).find(x => Number(x.id) === Number(gameDetailId));
      closeGameDetail();
      if (m) openMatchModal(m);
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeGameDetail(); });
  });

  // --- Match Modal Logic ---
  function bindMatchModalEvents() {
    document.getElementById("closeMatchModalBtn")?.addEventListener("click", closeMatchModal);
    document.getElementById("cancelMatchModalBtn")?.addEventListener("click", closeMatchModal);
    document.getElementById("addPlayerSlotBtn")?.addEventListener("click", () => {
      addPlayerSlotRow({ spirit: "River Surges in Sunlight", aspect: "", player: "Benjamin" });
      recalcModalLiveScore();
    });

    const liveInputs = [
      "modalVictory",
      "modalThematic",
      "modalAdversary1",
      "modalAdversary1Level",
      "modalScenario",
      "modalManualDifficulty",
      "modalInvaderCardsWin",
      "modalInvaderCardsLoss",
      "modalDahan",
      "modalBlight",
      "modalFearCards"
    ];
    liveInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          if (id === "modalVictory") toggleModalOutcomeFields();
          recalcModalLiveScore();
        });
        el.addEventListener("input", recalcModalLiveScore);
      }
    });

    document.getElementById("matchLoggerForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      await saveMatchFromModal();
    });
  }

  function openMatchModal(prefill) {
    if (SICloud.isViewer()) { showToast("View only. Add a GitHub token in Settings to edit."); return; }
    const modal = document.getElementById("matchLoggerModal");
    if (!modal) return;
    modalReturnFocus = document.activeElement;

    // Populate Adversary & Scenario selects
    const advSelect = document.getElementById("modalAdversary1");
    if (advSelect) {
      advSelect.innerHTML = `<option value="">None (Base Island)</option>` +
        (appData.adversaries || []).map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join("");
    }
    const scenSelect = document.getElementById("modalScenario");
    if (scenSelect) {
      scenSelect.innerHTML = `<option value="">None</option>` +
        (appData.scenarios || []).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} (Diff ${s.difficulty >= 0 ? '+' + s.difficulty : s.difficulty})</option>`).join("");
    }

    const isEditing = prefill && prefill.id !== undefined;
    editingMatchId = isEditing ? prefill.id : null;
    document.getElementById("matchModalTitle").textContent = isEditing ? `Edit Match #${prefill.id}` : "Log Spirit Island Session";

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("modalDate").value = prefill?.date || today;
    document.getElementById("modalVictory").value = prefill?.victory === false ? "false" : "true";
    document.getElementById("modalThematic").checked = !!prefill?.thematicMap;
    document.getElementById("modalAdversary1").value = prefill?.adversary1 || "";
    document.getElementById("modalAdversary1Level").value = prefill?.adversary1Level !== null && prefill?.adversary1Level !== undefined ? String(prefill.adversary1Level) : "0";
    document.getElementById("modalScenario").value = prefill?.scenario || "";
    const manualDiffEl = document.getElementById("modalManualDifficulty");
    const prefillOverride = prefill?.difficultyOverride;
    manualDiffEl.dataset.override = (prefillOverride !== undefined && prefillOverride !== null && prefillOverride !== "") ? "1" : "";
    manualDiffEl.value = manualDiffEl.dataset.override ? prefillOverride : "";
    if (!manualDiffEl.dataset.overrideBound) {
      manualDiffEl.dataset.overrideBound = "1";
      manualDiffEl.addEventListener("input", () => {
        manualDiffEl.dataset.override = manualDiffEl.value === "" ? "" : "1";
      });
    }
    document.getElementById("modalInvaderCardsWin").value = prefill?.invaderCardsInDeck ?? 3;
    document.getElementById("modalInvaderCardsLoss").value = prefill?.invaderCardsNotInDeck ?? 5;
    document.getElementById("modalDahan").value = prefill?.dahan ?? 6;
    document.getElementById("modalBlight").value = prefill?.blight ?? 3;
    document.getElementById("modalFearCards").value = prefill?.fearCardsLeft ?? "";
    document.getElementById("modalLossCondition").value = prefill?.lossCondition || "";
    document.getElementById("modalLossCondition").setAttribute("aria-invalid", "false");
    document.getElementById("modalNotes").value = prefill?.notes || "";

    const slotsContainer = document.getElementById("modalPlayerSlots");
    slotsContainer.innerHTML = "";
    const initialPlayers = prefill?.players && prefill.players.length > 0
      ? prefill.players
      : [{ spirit: "River Surges in Sunlight", aspect: "", player: "Benjamin" }];

    initialPlayers.forEach(slot => addPlayerSlotRow(slot));
    toggleModalOutcomeFields();
    recalcModalLiveScore();
    modal.classList.add("open");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    const dialog = modal.querySelector(".modal-dialog, .modal-zen");
    if (dialog) dialog.scrollTop = 0;
    // Keyboard users land in the form; skip on touch so the phone keyboard does not pop up
    if (!window.matchMedia("(pointer: coarse)").matches) document.getElementById("modalDate")?.focus();
  }

  function closeMatchModal() {
    const modal = document.getElementById("matchLoggerModal");
    if (modal) {
      modal.classList.remove("open");
      modal.style.display = "none";
    }
    document.body.style.overflow = "";
    editingMatchId = null;
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  function addPlayerSlotRow(slot) {
    const container = document.getElementById("modalPlayerSlots");
    if (!container) return;
    if (container.children.length >= 6) {
      showToast("Maximum 6 Guardians per match");
      return;
    }

    const idx = container.children.length + 1;
    const row = document.createElement("div");
    row.className = "player-slot-row";

    const allSpirits = (appData.spirits || []);
    const initialSpiritName = slot?.spirit || allSpirits[0]?.name || "River Surges in Sunlight";
    const initialSpirit = allSpirits.find(s => s.name === initialSpiritName) || allSpirits[0];

    const playerOpts = (appData.players || [])
      .map(p => `<option value="${escapeHtml(p.name)}" ${p.name.trim() === (slot.player || "").trim() ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
      .join("");

    row.innerHTML = `
      <div class="mono slot-player-badge">P${idx}</div>
      <div class="slot-spirit-combobox-wrapper">
        <div class="slot-spirit-control" title="Search or select spirit">
          <img src="${escapeHtml(initialSpirit?.image || '')}" alt="" class="slot-spirit-thumb" onerror=\"this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'\" />
          <input 
            type="text" 
            class="slot-spirit-search-input" 
            value="${escapeHtml(initialSpiritName)}" 
            placeholder="Search spirit..." 
            autocomplete="off" 
            spellcheck="false" 
            aria-label="Search spirit"
          />
          <button type="button" class="slot-spirit-toggle-btn" tabindex="-1">▾</button>
        </div>
        <div class="slot-spirit-dropdown" style="display:none;" role="listbox">
          <div class="slot-spirit-list"></div>
        </div>
        <input type="hidden" class="slot-spirit slot-spirit-value" value="${escapeHtml(initialSpiritName)}" />
      </div>
      <select class="select-input slot-aspect" aria-label="Aspect"></select>
      <select class="select-input slot-player" aria-label="Player">${playerOpts}</select>
      <button type="button" class="btn btn-danger btn-sm remove-slot-btn" title="Remove Player">✖</button>
    `;

    const wrapper = row.querySelector(".slot-spirit-combobox-wrapper");
    const searchInput = row.querySelector(".slot-spirit-search-input");
    const toggleBtn = row.querySelector(".slot-spirit-toggle-btn");
    const dropdown = row.querySelector(".slot-spirit-dropdown");
    const listEl = row.querySelector(".slot-spirit-list");
    const hiddenVal = row.querySelector(".slot-spirit-value");
    const thumbImg = row.querySelector(".slot-spirit-thumb");
    const aspectSel = row.querySelector(".slot-aspect");

    function updateAspectOptions() {
      const chosenSpirit = hiddenVal.value;
      const validAspects = (appData.aspects || []).filter(a => a.spirit.toLowerCase() === chosenSpirit.toLowerCase());
      aspectSel.innerHTML = `<option value="">Base Spirit</option>` +
        validAspects.map(a => `<option value="${escapeHtml(a.name)}" ${a.name === slot.aspect ? "selected" : ""}>${escapeHtml(a.name)} (${a.complexityChange})</option>`).join("");
    }

    function renderSlotSpiritOptions(query = "") {
      const cleanQ = query.trim().toLowerCase();
      const filtered = cleanQ
        ? allSpirits.filter(s => s.name.toLowerCase().includes(cleanQ) || (s.complexity && s.complexity.toLowerCase().includes(cleanQ)))
        : allSpirits;

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="padding:0.6rem;font-size:0.75rem;color:var(--text-muted);text-align:center;">No spirits found</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(s => {
        const isSel = s.name === hiddenVal.value;
        const compClass = s.complexity ? `complexity-${s.complexity.toLowerCase().replace(/\\s+/g, '-')}` : '';
        return `
          <div class="slot-spirit-option ${isSel ? 'selected' : ''}" data-name="${escapeHtml(s.name)}" data-img="${escapeHtml(s.image)}">
            <img src="${escapeHtml(s.image)}" alt="" style="width:20px;height:20px;border-radius:3px;object-fit:cover;" onerror=\"this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'\" />
            <span class="slot-spirit-option-name">${escapeHtml(s.name)}</span>
            <span class="combobox-badge ${compClass}" style="font-size:0.6rem;padding:0 0.25rem;">${escapeHtml(s.complexity || '')}</span>
          </div>
        `;
      }).join("");

      listEl.querySelectorAll(".slot-spirit-option").forEach(opt => {
        opt.onmousedown = (e) => {
          e.preventDefault();
          selectSpiritSlot(opt.getAttribute("data-name"), opt.getAttribute("data-img"));
        };
      });
    }

    function openSlotDropdown() {
      dropdown.style.display = "block";
      wrapper.classList.add("open");
      renderSlotSpiritOptions(searchInput.value === hiddenVal.value ? "" : searchInput.value);
    }

    function closeSlotDropdown() {
      dropdown.style.display = "none";
      wrapper.classList.remove("open");
      searchInput.value = hiddenVal.value;
    }

    function selectSpiritSlot(name, img) {
      hiddenVal.value = name;
      searchInput.value = name;
      if (img) thumbImg.src = img;
      closeSlotDropdown();
      updateAspectOptions();
    }

    searchInput.addEventListener("focus", () => {
      openSlotDropdown();
      searchInput.select();
    });
    searchInput.addEventListener("click", () => {
      if (!wrapper.classList.contains("open")) {
        openSlotDropdown();
        searchInput.select();
      }
    });
    searchInput.addEventListener("input", (e) => {
      if (!wrapper.classList.contains("open")) openSlotDropdown();
      renderSlotSpiritOptions(e.target.value);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = listEl.querySelector(".slot-spirit-option");
        if (first) {
          selectSpiritSlot(first.getAttribute("data-name"), first.getAttribute("data-img"));
        } else {
          closeSlotDropdown();
        }
      } else if (e.key === "Escape") {
        closeSlotDropdown();
      }
    });

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (wrapper.classList.contains("open")) {
        closeSlotDropdown();
      } else {
        openSlotDropdown();
        searchInput.focus();
        searchInput.select();
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target) && wrapper.classList.contains("open")) {
        closeSlotDropdown();
      }
    });

    updateAspectOptions();

    row.querySelector(".remove-slot-btn").addEventListener("click", () => {
      if (container.children.length <= 1) {
        showToast("At least 1 Guardian is required");
        return;
      }
      row.remove();
      Array.from(container.children).forEach((ch, i) => {
        ch.querySelector(".slot-player-badge").textContent = `P${i + 1}`;
      });
      recalcModalLiveScore();
    });

    container.appendChild(row);
  }

  function toggleModalOutcomeFields() {
    const isWin = document.getElementById("modalVictory")?.value === "true";
    const winGroup = document.getElementById("groupInvaderWin");
    const lossGroup = document.getElementById("groupInvaderLoss");
    const lossCondGroup = document.getElementById("groupLossCondition");

    if (winGroup) winGroup.style.display = isWin ? "flex" : "none";
    if (lossGroup) lossGroup.style.display = isWin ? "none" : "flex";
    if (lossCondGroup) lossCondGroup.style.display = isWin ? "none" : "flex";
  }

  function recalcModalLiveScore() {
    const victory = document.getElementById("modalVictory")?.value === "true";
    const thematicMap = document.getElementById("modalThematic")?.checked;
    const adversary1 = document.getElementById("modalAdversary1")?.value || "";
    const adversary1Level = adversary1 ? Number(document.getElementById("modalAdversary1Level")?.value || 0) : null;
    const scenario = document.getElementById("modalScenario")?.value || "";

    const advPrev = document.getElementById("modalAdvIconPreview");
    if (advPrev) advPrev.innerHTML = adversary1 ? advIcon(adversary1, 30, 20) : "";
    const scenPrev = document.getElementById("modalScenIconPreview");
    if (scenPrev) scenPrev.innerHTML = scenario ? scenIcon(scenario, 26) : "";

    const diffCalc = SIAnalytics.calculateDifficulty({
      thematicMap,
      adversary1,
      adversary1Level,
      scenario,
      adversaries: appData.adversaries,
      scenarios: appData.scenarios
    });

    const manualDiffInput = document.getElementById("modalManualDifficulty");
    const isOverride = !!(manualDiffInput && manualDiffInput.dataset.override && manualDiffInput.value !== "");
    const difficulty = isOverride ? Number(manualDiffInput.value) : diffCalc.totalDifficulty;

    if (manualDiffInput && !isOverride) {
      manualDiffInput.value = diffCalc.totalDifficulty;
    }

    const playerCount = document.getElementById("modalPlayerSlots")?.children.length || 1;
    const invaderCardsInDeck = Number(document.getElementById("modalInvaderCardsWin")?.value || 0);
    const invaderCardsNotInDeck = Number(document.getElementById("modalInvaderCardsLoss")?.value || 0);
    const dahan = Number(document.getElementById("modalDahan")?.value || 0);
    const blight = Number(document.getElementById("modalBlight")?.value || 0);

    const score = SIAnalytics.calculateScore({
      victory,
      difficulty,
      invaderCardsInDeck,
      invaderCardsNotInDeck,
      dahan,
      blight,
      playerCount
    });

    const diffPreview = document.getElementById("liveDifficultyPreview");
    const scorePreview = document.getElementById("liveScorePreview");
    if (diffPreview) {
      diffPreview.textContent = `Difficulty ${difficulty} (Thematic +${diffCalc.thematicDiff}, Adversary +${diffCalc.adversaryDiff}, Scenario +${diffCalc.scenarioDiff})`;
    }
    if (scorePreview) {
      scorePreview.textContent = `${SIAnalytics.formatNum(score, 2)} pts`;
    }
    return { diffCalc, difficulty, score, playerCount };
  }

  async function saveMatchFromModal() {
    const victory = document.getElementById("modalVictory")?.value === "true";
    const thematicMap = document.getElementById("modalThematic")?.checked;
    const adversary1 = document.getElementById("modalAdversary1")?.value || "";
    const adversary1Level = adversary1 ? Number(document.getElementById("modalAdversary1Level")?.value || 0) : null;
    const scenario = document.getElementById("modalScenario")?.value || "";

    // Loss type is required for new losses. An old loss saved without one may stay blank.
    const lossSel = document.getElementById("modalLossCondition");
    if (!victory && lossSel && !lossSel.value) {
      const old = editingMatchId !== null ? (appData.matches || []).find(m => Number(m.id) === Number(editingMatchId)) : null;
      const legacyBlank = !!old && !old.victory && !old.lossCondition;
      if (!legacyBlank) {
        lossSel.setAttribute("aria-invalid", "true");
        lossSel.focus();
        showToast("Choose how the game was lost before saving");
        return;
      }
    }

    const { diffCalc, difficulty: finalDiff, playerCount } = recalcModalLiveScore();
    const diffOverride = finalDiff !== diffCalc.totalDifficulty ? finalDiff : null;

    const players = Array.from(document.querySelectorAll("#modalPlayerSlots .player-slot-row")).map(row => ({
      spirit: row.querySelector(".slot-spirit").value,
      aspect: row.querySelector(".slot-aspect").value,
      player: row.querySelector(".slot-player").value
    }));

    const finalScore = SIAnalytics.calculateScore({
      victory,
      difficulty: finalDiff,
      invaderCardsInDeck: Number(document.getElementById("modalInvaderCardsWin")?.value || 0),
      invaderCardsNotInDeck: Number(document.getElementById("modalInvaderCardsLoss")?.value || 0),
      dahan: Number(document.getElementById("modalDahan")?.value || 0),
      blight: Number(document.getElementById("modalBlight")?.value || 0),
      playerCount
    });

    const fearVal = document.getElementById("modalFearCards")?.value;
    const matchObj = {
      id: editingMatchId || (Math.max(0, ...(appData.matches || []).map(m => Number(m.id || 0))) + 1),
      date: document.getElementById("modalDate")?.value || new Date().toISOString().slice(0, 10),
      victory,
      players,
      thematicMap,
      adversary1,
      adversary1Level,
      adversary2: "",
      adversary2Level: null,
      scenario,
      difficulty: finalDiff,
      difficultyOverride: diffOverride,
      thematicDiff: diffCalc.thematicDiff,
      adversaryDiff: diffCalc.adversaryDiff,
      scenarioDiff: diffCalc.scenarioDiff,
      invaderCardsInDeck: victory ? Number(document.getElementById("modalInvaderCardsWin")?.value || 0) : null,
      invaderCardsNotInDeck: !victory ? Number(document.getElementById("modalInvaderCardsLoss")?.value || 0) : null,
      dahan: Number(document.getElementById("modalDahan")?.value || 0),
      blight: Number(document.getElementById("modalBlight")?.value || 0),
      fearCardsLeft: fearVal !== "" ? Number(fearVal) : null,
      lossCondition: !victory ? (document.getElementById("modalLossCondition")?.value || "") : "",
      score: finalScore,
      playerCount,
      notes: document.getElementById("modalNotes")?.value || ""
    };

    let newlyUnlocked = [];
    if (editingMatchId !== null) {
      const idx = (appData.matches || []).findIndex(m => Number(m.id) === Number(editingMatchId));
      if (idx !== -1) appData.matches[idx] = matchObj;
      await persistData(`Updated Match #${matchObj.id} (${finalScore} pts)`);
    } else {
      const prevAch = SIAnalytics.computeAchievements(appData, { ownedOnly: false });
      const prevCamp = SICampaign.compute(appData, { ownedOnly: false });
      appData.matches.push(matchObj);
      const nextAch = SIAnalytics.computeAchievements(appData, { ownedOnly: false });
      newlyUnlocked = collectNewMilestones(prevAch, nextAch, matchObj);
      const doneBefore = new Set(prevCamp.items.filter(i => i.done).map(i => i.id));
      const newCamp = SICampaign.compute(appData, { ownedOnly: false }).items.filter(i => i.done && !doneBefore.has(i.id));
      if (newCamp.length) {
        newlyUnlocked.push({ spirit: { name: "Campaign achievements", image: "" }, items: newCamp.map(i => i.title) });
        markCampaignSeen(newCamp.map(i => i.id));
      }
      await persistData(`Logged Match #${matchObj.id} — ${victory ? 'Victory!' : 'Defeat'} (${finalScore} pts)`);
    }

    closeMatchModal();
    renderAll();
    if (newlyUnlocked.length > 0) {
      celebrateNewMilestones(newlyUnlocked);
    }
  }

window.setOutcomeFilter = function(val) {
  const sel = document.getElementById("filterMatchOutcome");
  if (sel) {
    sel.value = val;
    sel.dispatchEvent(new Event("change"));
  }
  document.querySelectorAll(".filter-outcome-pill").forEach(p => {
    const isAct = p.getAttribute("data-outcome") === val;
    p.classList.toggle("active", isAct);
    if (isAct) {
      p.style.borderColor = "var(--fern-accent, #2C5E43)";
      p.style.fontWeight = "700";
    } else {
      p.style.borderColor = "var(--border-subtle, #CDD5C8)";
      p.style.fontWeight = "400";
    }
  });
};
