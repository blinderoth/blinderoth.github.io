// Navigation, themes, tab accessibility and the render master
// Classic script: shares globals with the other files in js/core and js/views.

  // --- Navigation ---
  function bindNavigation() {
    document.querySelectorAll(".nav-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        switchTab(target);
      });
    });

    document.getElementById("openLogMatchBtn")?.addEventListener("click", () => {
      openMatchModal(null);
    });

    document.getElementById("globalRefitArtBtn")?.addEventListener("click", () => {
      const sp = (appData.spirits || []).find(s => s.name === selectedDossierSpirit) || (appData.spirits || [])[0];
      const asp = (selectedDossierAspect && selectedDossierAspect !== "Base")
        ? (appData.aspects || []).find(a => a.spirit === sp?.name && a.name === selectedDossierAspect)
        : null;
      if (sp) openCropModal(sp, asp);
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll(".nav-tab").forEach(b => {
      const on = b.getAttribute("data-tab") === tabId;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === `view-${tabId}`);
    });
    // Shareable, reload-safe tab: index.html#matches
    if (location.hash.slice(1) !== tabId) history.replaceState(null, "", tabId === "dashboard" ? location.pathname + location.search : `#${tabId}`);
  }

  function initThemeSwitcher() {
    const THEME_KEY = "si_color_scheme";
    const THEME_COLORS = { zen: "#F3F5F0", parchment: "#F4EFE6", dark: "#111815" };

    function applyScheme(scheme) {
      const valid = THEME_COLORS[scheme] ? scheme : "zen";
      document.body.setAttribute("data-theme", valid);
      localStorage.setItem(THEME_KEY, valid);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", THEME_COLORS[valid]);
      document.querySelectorAll(".theme-pill").forEach(btn => {
        const active = btn.getAttribute("data-scheme") === valid;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }

    const saved = localStorage.getItem(THEME_KEY) || "zen";
    applyScheme(saved);

    document.querySelectorAll(".theme-pill").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => applyScheme(btn.getAttribute("data-scheme")));
    });
  }

  function initTabsA11y() {
    const tabs = Array.from(document.querySelectorAll(".nav-tab"));
    if (!tabs.length) return;
    const nav = tabs[0].parentElement;
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Tracker sections");
    tabs.forEach(t => {
      const id = t.getAttribute("data-tab");
      t.setAttribute("role", "tab");
      t.id = t.id || `tab-${id}`;
      t.setAttribute("aria-controls", `view-${id}`);
      const panel = document.getElementById(`view-${id}`);
      if (panel) { panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", t.id); }
    });
    nav.addEventListener("keydown", e => {
      const i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      let n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = tabs.length - 1;
      if (n === null) return;
      e.preventDefault();
      tabs[n].focus();
      tabs[n].click();
    });
    const fromHash = location.hash.slice(1);
    switchTab(tabs.some(t => t.getAttribute("data-tab") === fromHash) ? fromHash : currentTab);
    window.addEventListener("hashchange", () => {
      const h = location.hash.slice(1) || "dashboard";
      if (h !== currentTab && tabs.some(t => t.getAttribute("data-tab") === h)) switchTab(h);
    });
  }

  // Links from the Spirit Realm page: index.html#game=12 opens that game, index.html#spirit=Name opens the dossier.
  function handleDeepLink(hash) {
    const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
    const game = h.match(/^game=(.+)$/), spirit = h.match(/^spirit=(.+)$/), log = h.match(/^log=(.+)$/);
    if (log) {
      // A challenge dealt on the Spirit Realm page: open the logging form pre-filled
      let p = null;
      try { p = JSON.parse(log[1]); } catch (e) { p = null; }
      if (p && typeof p === "object") {
        const known = new Set((appData.spirits || []).map(s => s.name));
        const players = (Array.isArray(p.players) ? p.players : []).filter(x => x && known.has(x.spirit)).slice(0, 6)
          .map(x => ({ spirit: x.spirit, aspect: "", player: String(x.player || "") }));
        const adv = (appData.adversaries || []).some(a => a.name === p.adversary1) ? p.adversary1 : "";
        const lvl = adv && Number.isInteger(Number(p.adversary1Level)) ? Math.max(0, Math.min(6, Number(p.adversary1Level))) : null;
        const scn = (appData.scenarios || []).some(s => s.name === p.scenario) ? p.scenario : "";
        openMatchModal({ players, adversary1: adv, adversary1Level: lvl, scenario: scn });
      }
    } else if (game) { switchTab("matches"); if (window.inspectGame) window.inspectGame(Number(game[1])); }
    else if (spirit && window.selectAndShowDossier) window.selectAndShowDossier(spirit[1]);
  }

  function inspectSpiritInDossier(spiritName) {
    selectedDossierSpirit = spiritName;
    openDossier();
  }

  // --- Render Master ---
  function renderAll() {
    populateGlobalPlayerFilter();
    renderDashboard();
    renderMatchesView();
    renderAchievementsView();
    renderCodexView();
    renderSettingsView();
  }
