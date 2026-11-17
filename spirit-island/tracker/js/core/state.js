// Shared state and the player filter
// Classic script: shares globals with the other files in js/core and js/views.

  const STORAGE_KEY = "spirit_island_campaign_v2";

  let appData = null;
  let currentTab = "dashboard";
  let selectedDossierSpirit = null;
  let selectedDossierAspect = "Base";
  let currentAchievementSubtab = "mastery";
  let currentCodexSubtab = "spirits";
  let activePowerElements = new Set();
  let currentRecommendation = null;
  let editingMatchId = null;
  let selectedPlayerFilter = "";
  let selectedSourceFilter = "";   // "", "legacy" or "normal"

  function isLegacyMatch(m) { return !!m && m.source === "legacy"; }
  function matchesSourceFilter(m) {
    if (selectedSourceFilter === "legacy") return isLegacyMatch(m);
    if (selectedSourceFilter === "normal") return !isLegacyMatch(m);
    return true;
  }

  function getStatsData({ playerSlotsOnly = true } = {}) {
    if ((!selectedPlayerFilter && !selectedSourceFilter) || !appData) return appData;
    if (!selectedPlayerFilter) return { ...appData, matches: (appData.matches || []).filter(matchesSourceFilter) };
    const filteredMatches = (appData.matches || [])
      .filter(matchesSourceFilter)
      .filter(m => (m.players || []).some(p => (p.player || "").trim() === selectedPlayerFilter))
      .map(m => playerSlotsOnly
        ? { ...m, players: (m.players || []).filter(p => (p.player || "").trim() === selectedPlayerFilter) }
        : m);
    return { ...appData, matches: filteredMatches };
  }

  function populateGlobalPlayerFilter() {
    const sel = document.getElementById("globalPlayerFilter");
    if (!sel || !appData) return;
    const names = new Set();
    (appData.players || []).forEach(p => { if (p?.name?.trim()) names.add(p.name.trim()); });
    (appData.matches || []).forEach(m => (m.players || []).forEach(s => { if (s?.player?.trim()) names.add(s.player.trim()); }));
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));
    if (selectedPlayerFilter && !names.has(selectedPlayerFilter)) selectedPlayerFilter = "";
    sel.innerHTML = `<option value="">All Players</option>` +
      sorted.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    sel.value = selectedPlayerFilter;
  }

  function initGlobalPlayerFilter() {
    const sel = document.getElementById("globalPlayerFilter");
    if (!sel || sel.dataset.bound) return;
    sel.dataset.bound = "1";
    sel.addEventListener("change", () => {
      selectedPlayerFilter = sel.value || "";
      updateSyncBadge();
      renderAll();
    });
    const src = document.getElementById("globalSourceFilter");
    if (src && !src.dataset.bound) {
      src.dataset.bound = "1";
      src.addEventListener("change", () => {
        selectedSourceFilter = src.value || "";
        updateSyncBadge();
        renderAll();
      });
    }
  }

  const ELEMENT_COLORS = {
    Sun: "#fbbf24",
    Moon: "#a78bfa",
    Fire: "#f97316",
    Air: "#38bdf8",
    Water: "#0ea5e9",
    Earth: "#a8a29e",
    Plant: "#22c55e",
    Animal: "#ef4444"
  };
