// Spirit Archipelago games -> tracker matches
// Classic script: shares globals with js/core and js/views (appData, persistData, SIAnalytics) and with legacy_import.js.
// The Archipelago companion (../archipelago/) saves its campaign in this browser under ARCH_KEY.
// Each game logged with a game record is added here once, tagged source: "archipelago".
// Games logged before the record sheet existed have no record and are skipped.
// If the record is edited later in the companion's Game log, the tracker game is updated to match.

  const ARCH_KEY = "spirit-archipelago-companion-v1";

  // Archipelago names that the tracker spells differently
  const ARCH_SPIRIT_ALIAS = { "rising heat of sand and stone": "Rising Heat of Stone and Sand", "vengeance as a burning plague": "Vengenace as a Burning Plague" };
  const ARCH_ADV_ALIAS = {
    "France": "The Kingdom of France", "England": "The Kingdom of England", "Sweden": "The Kingdom of Sweden",
    "Scotland": "The Kingdom of Scotland", "Russia": "The Tsardom of Russia", "Brandenburg-Prussia": "The Kingdom of Brandenburg-Prussia",
    "Habsburg": "The Habsburg Monarchy"
  };

  function readArchipelagoCampaign() {
    try {
      const raw = localStorage.getItem(ARCH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // "River Surges in Sunlight (Sunshine aspect)" -> spirit and aspect
  function archSpiritParts(name) {
    const m = /^(.*?)\s*\(([^()]+?) aspect\)\s*$/i.exec(name || "");
    return m ? [m[1], m[2]] : [name || "", ""];
  }

  function archSpiritName(name) {
    const n = legacyNorm(name);
    if (!n) return "";
    if (ARCH_SPIRIT_ALIAS[n]) return ARCH_SPIRIT_ALIAS[n];
    const hit = (appData.spirits || []).find(s => legacyNorm(s.name) === n);
    return hit ? hit.name : name;
  }

  function archAdversary(name) {
    const full = ARCH_ADV_ALIAS[String(name || "").trim()] || name;
    return (appData.adversaries || []).some(a => a.name === full) ? full : "";
  }

  function archScenario(name) {
    const n = legacyNorm(name);
    if (!n) return "";
    const hit = (appData.scenarios || []).find(s => legacyNorm(s.name) === n);
    return hit ? hit.name : "";
  }

  // One Archipelago log entry -> the fields a tracker match needs
  function archipelagoMatchFields(g) {
    const r = g.rec;
    const adversary1 = archAdversary(g.adversary);
    const lv = Number(g.level);
    const adversary1Level = adversary1 && Number.isFinite(lv) ? Math.max(0, Math.min(6, lv)) : null;
    const scenario = archScenario(g.scenario);
    const players = (g.spirits || []).map((sp, i) => {
      const [base, forced] = archSpiritParts(sp);
      const spirit = archSpiritName(base);
      const aspect = (r.aspects && r.aspects[i]) || forced;
      return { spirit, aspect: legacyAspectName(spirit, aspect), player: (r.players && r.players[i]) || "" };
    });
    const playerCount = Math.max(1, players.length);
    const d = SIAnalytics.calculateDifficulty({ thematicMap: false, adversary1, adversary1Level, adversary2: "", adversary2Level: null, scenario,
      adversaries: appData.adversaries, scenarios: appData.scenarios });
    const victory = g.result === "Won";
    const cards = Number(r.cards || 0), dahan = Number(r.dahan || 0), blight = Number(r.blight || 0);
    const score = SIAnalytics.calculateScore({ victory, difficulty: d.totalDifficulty, invaderCardsInDeck: cards, invaderCardsNotInDeck: cards, dahan, blight, playerCount });
    return {
      date: g.date || new Date().toISOString().slice(0, 10),
      victory, players, thematicMap: false,
      adversary1, adversary1Level, adversary2: "", adversary2Level: null, scenario,
      difficulty: d.totalDifficulty, difficultyOverride: null,
      thematicDiff: d.thematicDiff, adversaryDiff: d.adversaryDiff, scenarioDiff: d.scenarioDiff,
      invaderCardsInDeck: victory ? cards : null,
      invaderCardsNotInDeck: victory ? null : cards,
      dahan, blight,
      fearCardsLeft: r.fear === "" || r.fear == null ? null : Number(r.fear),
      lossCondition: victory ? "" : (r.loss || ""),
      score, playerCount,
      notes: r.notes || "",
      source: "archipelago",
      archipelago: {
        id: g.id, scenario: g.n, title: g.title || "", attempt: g.attempt || 1, level: g.level,
        unmatchedAdversary: g.adversary && !adversary1 ? g.adversary : "",
        recRev: r.rev || 0
      }
    };
  }

  // Add new Archipelago games and refresh ones whose record changed. Returns how many changed.
  async function importArchipelagoGames({ quiet = false } = {}) {
    if (!appData || (window.SICloud && SICloud.isViewer && SICloud.isViewer())) return 0;
    const camp = readArchipelagoCampaign();
    const log = (camp && Array.isArray(camp.log)) ? camp.log : [];
    const dismissed = new Set(appData.archipelagoDismissed || []);
    const ready = log.filter(g => g && g.id && g.rec && g.rec.send !== false && !dismissed.has(g.id));
    if (!ready.length) return 0;
    appData.matches = appData.matches || [];
    const byId = new Map(appData.matches.filter(m => m.archipelago && m.archipelago.id).map(m => [m.archipelago.id, m]));
    let added = 0, updated = 0;
    for (const g of ready) {
      const old = byId.get(g.id);
      if (old) {
        if ((old.archipelago.recRev || 0) >= (g.rec.rev || 0)) continue;
        const f = archipelagoMatchFields(g);
        // keep anything edited in the tracker except what came from the Archipelago record
        Object.assign(old, {
          victory: f.victory, invaderCardsInDeck: f.invaderCardsInDeck, invaderCardsNotInDeck: f.invaderCardsNotInDeck,
          dahan: f.dahan, blight: f.blight, fearCardsLeft: f.fearCardsLeft, lossCondition: f.lossCondition, notes: f.notes || old.notes
        });
        (old.players || []).forEach((p, i) => { const n = f.players[i]; if (n) { if (n.player) p.player = n.player; p.aspect = n.aspect; } });
        old.archipelago.recRev = f.archipelago.recRev;
        const d = SIAnalytics.calculateDifficulty({ thematicMap: old.thematicMap, adversary1: old.adversary1, adversary1Level: old.adversary1Level,
          adversary2: old.adversary2, adversary2Level: old.adversary2Level, scenario: old.scenario, adversaries: appData.adversaries, scenarios: appData.scenarios });
        const diff = old.difficultyOverride != null ? old.difficultyOverride : d.totalDifficulty;
        old.score = SIAnalytics.calculateScore({ victory: old.victory, difficulty: diff, invaderCardsInDeck: old.invaderCardsInDeck,
          invaderCardsNotInDeck: old.invaderCardsNotInDeck, dahan: old.dahan, blight: old.blight, playerCount: old.playerCount });
        updated++;
      } else {
        const id = Math.max(0, ...appData.matches.map(m => Number(m.id || 0))) + 1;
        const m = Object.assign({ id }, archipelagoMatchFields(g));
        appData.matches.push(m);
        byId.set(g.id, m);
        added++;
      }
    }
    if (!added && !updated) return 0;
    const parts = [];
    if (added) parts.push(`${added} Archipelago game${added === 1 ? "" : "s"} added`);
    if (updated) parts.push(`${updated} updated`);
    await persistData(quiet ? "" : parts.join(", "));
    return added + updated;
  }

  function findArchipelagoMatch(archId) {
    return (appData?.matches || []).find(m => m.archipelago && m.archipelago.id === archId) || null;
  }

  // Keep importing while the tracker is open: the Archipelago page may be open in another tab.
  function watchArchipelagoGames() {
    window.addEventListener("storage", async e => {
      if (e.key !== ARCH_KEY) return;
      if (await importArchipelagoGames()) { populateGlobalPlayerFilter(); renderAll(); }
    });
  }
