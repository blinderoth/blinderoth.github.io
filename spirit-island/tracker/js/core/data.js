// Loading, saving, merging reference data, toast, helpers
// Classic script: shares globals with the other files in js/core and js/views.

  // --- Initialization & Persistence ---
  async function initApp() {
    // Data is saved in this browser (localStorage) and, when a GitHub token is set, in the site's repo (js/core/cloud.js).
    // The seed in js/default_data.js is the fallback.
    let local = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) local = JSON.parse(saved);
    } catch (e) { local = null; }

    let fromRepo = null;
    try { fromRepo = await SICloud.loadOnStart(local); } catch (e) { fromRepo = null; }
    appData = fromRepo || local;

    if (!appData && window.DEFAULT_CAMPAIGN_DATA) {
      appData = JSON.parse(JSON.stringify(window.DEFAULT_CAMPAIGN_DATA));
    }

    mergeReferenceData();

    updateSyncBadge();
    bindNavigation();
    bindMatchModalEvents();
    initGlobalPlayerFilter();
    renderAll();
    initThemeSwitcher();
    initTabsA11y();
    initModalA11y();
  }

  // Escape closes the open dialog, clicking the backdrop closes it, and focus returns to where it was.
  let modalReturnFocus = null;
  function initModalA11y() {
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      const open = Array.from(document.querySelectorAll(".modal-backdrop")).filter(m => m.classList.contains("open") && m.style.display !== "none").pop();
      if (!open) return;
      // Let an open dropdown inside the dialog handle Escape first
      if (document.activeElement && document.activeElement.closest(".dossier-combobox-wrapper.open, .slot-spirit-combobox-wrapper.open")) return;
      if (open.id === "matchLoggerModal") closeMatchModal();
      else { open.classList.remove("open"); open.style.display = "none"; document.body.style.overflow = ""; }
    });
    const mm = document.getElementById("matchLoggerModal");
    if (mm) {
      mm.setAttribute("aria-labelledby", "matchModalTitle");
      mm.addEventListener("mousedown", e => { if (e.target === mm) closeMatchModal(); });
    }
  }

  // Keep reference metadata (spirit art, adversary/scenario icons, aspects) fresh
  // even when a saved campaign exists in localStorage or on the server.
  // User-owned fields (owned flags, miniature links, matches, players) are preserved.
  function mergeReferenceData() {
    const def = window.DEFAULT_CAMPAIGN_DATA;
    if (!appData || !def) return;

    const mergeByName = (savedList, defList, keepFields) => {
      const savedMap = {};
      (savedList || []).forEach(x => { savedMap[x.name] = x; });
      const out = defList.map(d => {
        const s = savedMap[d.name];
        const merged = JSON.parse(JSON.stringify(d));
        if (s) keepFields.forEach(f => { if (s[f] !== undefined) merged[f] = s[f]; });
        return merged;
      });
      // Keep any custom entries the user added that are not in the defaults
      (savedList || []).forEach(s => {
        if (!defList.some(d => d.name === s.name)) out.push(s);
      });
      return out;
    };

    appData.spirits = mergeByName(appData.spirits, def.spirits || [], ["owned", "miniature", "focalPosition"]);
    appData.adversaries = mergeByName(appData.adversaries, def.adversaries || [], ["owned", "focalPosition"]);
    appData.scenarios = mergeByName(appData.scenarios, def.scenarios || [], ["owned", "focalPosition"]);
    
    // Merge aspects while keeping user-saved focalPosition
    const savedAspectsMap = {};
    (appData.aspects || []).forEach(a => {
      if (a.focalPosition) savedAspectsMap[`${a.spirit}||${a.name}`] = a.focalPosition;
    });
    appData.aspects = (def.aspects || []).map(d => {
      const merged = JSON.parse(JSON.stringify(d));
      const savedFocal = savedAspectsMap[`${d.spirit}||${d.name}`];
      if (savedFocal) merged.focalPosition = savedFocal;
      return merged;
    });
    // Element icons ship with the site (assets/elements), so always take them from the defaults.
    appData.elementIcons = def.elementIcons;
    syncOwnershipFromExpansions();

    // Normalize aspect aliases in logged matches (e.g. "Tangle" -> "Tangles")
    (appData.matches || []).forEach(m => {
      (m.players || []).forEach(slot => {
        if (slot.aspect) {
          const resolved = SIAnalytics.resolveAspectName(appData, slot.spirit, slot.aspect);
          if (resolved !== "Base") slot.aspect = resolved;
        }
      });
    });
    (appData.matches || []).forEach(normalizeMatch);
    saveLocal();
  }

  // The local copy is a cache. A view-only visitor never overwrites it with the repo's data.
  function saveLocal() {
    if (SICloud.isViewer()) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch (e) { /* storage full or blocked */ }
  }

  // Ownership is set per expansion in Settings. Every spirit, adversary and scenario follows its expansion.
  function syncOwnershipFromExpansions() {
    const owned = {};
    (appData.expansions || []).forEach(ex => { owned[String(ex.name).trim().toLowerCase()] = !!ex.owned; });
    ["spirits", "adversaries", "scenarios"].forEach(key => {
      (appData[key] || []).forEach(item => {
        const k = String(item.expansion || "").trim().toLowerCase();
        if (k in owned) item.owned = owned[k];
      });
    });
  }

  // Difficulty, score and player count are derived from the match inputs, never trusted as stored.
  // A manual difficulty is kept only as an explicit override (difficultyOverride).
  function normalizeMatch(m) {
    const calc = SIAnalytics.calculateDifficulty({
      thematicMap: m.thematicMap,
      adversary1: m.adversary1,
      adversary1Level: m.adversary1Level,
      adversary2: m.adversary2,
      adversary2Level: m.adversary2Level,
      scenario: m.scenario,
      adversaries: appData.adversaries,
      scenarios: appData.scenarios
    });
    const hasOverride = m.difficultyOverride !== undefined && m.difficultyOverride !== null && m.difficultyOverride !== "";
    m.thematicDiff = calc.thematicDiff;
    m.adversaryDiff = calc.adversaryDiff;
    m.scenarioDiff = calc.scenarioDiff;
    m.difficulty = hasOverride ? Number(m.difficultyOverride) : calc.totalDifficulty;
    m.playerCount = Math.max(1, (m.players || []).length);
    m.score = SIAnalytics.calculateScore({
      victory: m.victory,
      difficulty: m.difficulty,
      invaderCardsInDeck: m.invaderCardsInDeck,
      invaderCardsNotInDeck: m.invaderCardsNotInDeck,
      dahan: m.dahan,
      blight: m.blight,
      playerCount: m.playerCount
    });
    return m;
  }

  // --- Icon helpers (remote wiki image with local SVG fallback) ---
  function iconImg(remote, local, style, alt) {
    const primary = remote || local || "";
    if (!primary) return "";
    const fb = local && local !== primary
      ? `this.onerror=null;this.src='${escapeHtml(local)}'`
      : `this.style.display='none'`;
    return `<img src="${escapeHtml(primary)}" alt="${escapeHtml(alt || "")}" referrerpolicy="no-referrer" loading="lazy" style="${style}" onerror="${fb}">`;
  }
  function getAdv(name) { return (appData.adversaries || []).find(a => a.name === name); }
  function getScen(name) { return (appData.scenarios || []).find(s => s.name === name); }
  function advIcon(advOrName, w = 26, h = 18) {
    const a = typeof advOrName === "string" ? getAdv(advOrName) : advOrName;
    if (!a) return "";
    return iconImg(String(a.flag || a.localIcon || "").replace(/\.svg$/, ".webp"), a.flag || a.localIcon, `width:${w}px;height:${h}px;object-fit:cover;border-radius:3px;border:1px solid var(--border-subtle);flex-shrink:0;`, a.name);
  }
  function elIcon(name, size = 16) {
    const url = appData?.elementIcons?.[name];
    return url ? `<img src="${escapeHtml(url)}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">` : "";
  }
  function scenIcon(scOrName, size = 22) {
    const s = typeof scOrName === "string" ? getScen(scOrName) : scOrName;
    if (!s) return "";
    return iconImg(String(s.image || "").replace(/\.svg$/, ".webp"), s.image || s.localIcon, `width:${size}px;height:${size}px;object-fit:contain;border-radius:5px;flex-shrink:0;`, s.name);
  }
  function complexityArrowLabel(ch) {
    if (ch === "▲") return { cls: "badge-high", txt: "▲ Harder" };
    if (ch === "▼") return { cls: "badge-low", txt: "▼ Easier" };
    return { cls: "badge-neutral", txt: "= Same" };
  }

  function updateSyncBadge() {
    const el = document.getElementById("syncStatusText");
    if (!el) return;
    const count = (appData?.matches || []).length;
    let countText = `${count} matches`;
    if (selectedPlayerFilter) countText = `${getStatsData().matches.length}/${count} matches (${selectedPlayerFilter})`;
    el.textContent = SICloud.label(countText);
  }

  async function persistData(toastMsg) {
    if (SICloud.isViewer()) {
      showToast("View only. Add a GitHub token in Settings to edit.");
      return;
    }
    appData.lastUpdated = new Date().toISOString();
    saveLocal();
    SICloud.afterLocalSave();

    updateSyncBadge();
    renderBackupStatus();
    if (toastMsg) showToast(toastMsg);
  }

  function showToast(msg, opts = {}) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
    const dismiss = () => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    };
    if (opts.actionLabel && typeof opts.onAction === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action";
      btn.textContent = opts.actionLabel;
      btn.addEventListener("click", () => { dismiss(); opts.onAction(); });
      toast.appendChild(btn);
    }
    container.appendChild(toast);
    setTimeout(dismiss, opts.duration || 3200);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getComplexityBadgeClass(comp) {
    switch (comp) {
      case "Low": return "badge-low";
      case "Moderate": return "badge-mod";
      case "High": return "badge-high";
      case "Very High": return "badge-vhigh";
      default: return "badge-neutral";
    }
  }
