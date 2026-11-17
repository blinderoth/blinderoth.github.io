// Spirit Island: Legacy games -> tracker matches
// Classic script: shares globals with js/core and js/views (appData, persistData, SIAnalytics).
// The Legacy companion (../legacy/) saves its campaign in this browser under LEGACY_KEY.
// Each finished Legacy game with a game record is added here once, tagged source: "legacy".
// If the record is edited later in the Legacy Chronicle, the tracker game is updated to match.

  const LEGACY_KEY = "si-legacy-companion-v1";

  // Legacy names that the tracker spells differently
  const LEGACY_SPIRIT_ALIAS = { "vengeance as a burning plague": "Vengenace as a Burning Plague" };
  const LEGACY_ADV_ALIAS = {
    "France": "The Kingdom of France", "England": "The Kingdom of England", "Sweden": "The Kingdom of Sweden",
    "Scotland": "The Kingdom of Scotland", "Russia": "The Tsardom of Russia", "Brandenburg-Prussia": "The Kingdom of Brandenburg-Prussia",
    "Habsburg Livestock Colony": "The Habsburg Monarchy"
  };

  function legacyNorm(s) { return String(s || "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }

  function readLegacyCampaign() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function legacySpiritName(name) {
    const n = legacyNorm(name);
    if (!n) return "";
    if (LEGACY_SPIRIT_ALIAS[n]) return LEGACY_SPIRIT_ALIAS[n];
    const hit = (appData.spirits || []).find(s => legacyNorm(s.name) === n);
    return hit ? hit.name : name;
  }

  function legacyAspectName(spirit, aspect) {
    if (!aspect || /^no aspect$/i.test(aspect)) return "Base";
    const hit = (appData.aspects || []).find(a => legacyNorm(a.name) === legacyNorm(aspect) && (!a.spirit || a.spirit === spirit));
    return hit ? hit.name : aspect;
  }

  function legacyAdversary(name) {
    const full = LEGACY_ADV_ALIAS[name] || name;
    return (appData.adversaries || []).some(a => a.name === full) ? full : "";
  }

  // One Legacy log entry -> the fields a tracker match needs
  function legacyMatchFields(lg) {
    const r = lg.rec;
    const advs = Array.isArray(lg.advs) ? lg.advs : [];
    const a1 = advs[0] ? legacyAdversary(advs[0].name) : "", a2 = advs[1] ? legacyAdversary(advs[1].name) : "";
    const lvl = (a, x) => (a && x && x.level != null && x.level !== "") ? Number(x.level) : null;
    const adversary1 = a1, adversary1Level = lvl(a1, advs[0]), adversary2 = a2, adversary2Level = lvl(a2, advs[1]);
    const scenario = (appData.scenarios || []).some(s => s.name === lg.scName) ? lg.scName : "";
    const players = (lg.slots || []).map(s => {
      const spirit = legacySpiritName(s.spirit);
      return { spirit, aspect: legacyAspectName(spirit, s.aspect), player: s.player || "" };
    });
    const playerCount = Math.max(1, players.length);
    const d = SIAnalytics.calculateDifficulty({ thematicMap: false, adversary1, adversary1Level, adversary2, adversary2Level, scenario,
      adversaries: appData.adversaries, scenarios: appData.scenarios });
    const victory = !!lg.win;
    const cards = Number(r.cards || 0), dahan = Number(r.dahan || 0), blight = Number(r.blight || 0);
    const score = SIAnalytics.calculateScore({ victory, difficulty: d.totalDifficulty, invaderCardsInDeck: cards, invaderCardsNotInDeck: cards, dahan, blight, playerCount });
    const unknownAdv = advs.filter(x => !legacyAdversary(x.name)).map(x => `${x.name}${x.level != null ? " " + x.level : ""}`);
    return {
      date: lg.date || new Date(lg.ts || Date.now()).toISOString().slice(0, 10),
      victory, players, thematicMap: false,
      adversary1, adversary1Level, adversary2, adversary2Level, scenario,
      difficulty: d.totalDifficulty, difficultyOverride: null,
      thematicDiff: d.thematicDiff, adversaryDiff: d.adversaryDiff, scenarioDiff: d.scenarioDiff,
      invaderCardsInDeck: victory ? cards : null,
      invaderCardsNotInDeck: victory ? null : cards,
      dahan, blight,
      fearCardsLeft: r.fear === "" || r.fear == null ? null : Number(r.fear),
      lossCondition: victory ? "" : (r.loss || ""),
      score, playerCount,
      notes: r.notes || "",
      source: "legacy",
      legacy: {
        id: lg.id, scenario: lg.n, title: lg.t || "", attempt: lg.attempt || 1,
        invaderStrength: lg.is ?? null, invaderCards: (lg.inv || []).slice(), heirlooms: (lg.heir || []).slice(),
        ruleCards: (lg.rules || []).slice(), unmatchedAdversary: unknownAdv.join(", "),
        recRev: r.rev || 0
      }
    };
  }

  // Add new Legacy games and refresh ones whose record changed. Returns how many changed.
  async function importLegacyGames({ quiet = false } = {}) {
    if (!appData || (window.SICloud && SICloud.isViewer && SICloud.isViewer())) return 0;
    const camp = readLegacyCampaign();
    const log = (camp && Array.isArray(camp.log)) ? camp.log : [];
    const dismissed = new Set(appData.legacyDismissed || []);
    const ready = log.filter(lg => lg && lg.id && lg.rec && lg.rec.send !== false && !dismissed.has(lg.id));
    if (!ready.length) return 0;
    appData.matches = appData.matches || [];
    const byId = new Map(appData.matches.filter(m => m.legacy && m.legacy.id).map(m => [m.legacy.id, m]));
    let added = 0, updated = 0;
    for (const lg of ready) {
      const old = byId.get(lg.id);
      if (old) {
        if ((old.legacy.recRev || 0) >= (lg.rec.rev || 0)) continue;
        const f = legacyMatchFields(lg);
        // keep anything edited in the tracker except the counts that came from the Legacy record
        Object.assign(old, {
          victory: f.victory, invaderCardsInDeck: f.invaderCardsInDeck, invaderCardsNotInDeck: f.invaderCardsNotInDeck,
          dahan: f.dahan, blight: f.blight, fearCardsLeft: f.fearCardsLeft, lossCondition: f.lossCondition, notes: f.notes || old.notes
        });
        if (f.legacy.recRev) old.legacy.recRev = f.legacy.recRev;
        if (lg.scName && f.scenario && !old.scenario) old.scenario = f.scenario;
        const d = SIAnalytics.calculateDifficulty({ thematicMap: old.thematicMap, adversary1: old.adversary1, adversary1Level: old.adversary1Level,
          adversary2: old.adversary2, adversary2Level: old.adversary2Level, scenario: old.scenario, adversaries: appData.adversaries, scenarios: appData.scenarios });
        const diff = old.difficultyOverride != null ? old.difficultyOverride : d.totalDifficulty;
        old.score = SIAnalytics.calculateScore({ victory: old.victory, difficulty: diff, invaderCardsInDeck: old.invaderCardsInDeck,
          invaderCardsNotInDeck: old.invaderCardsNotInDeck, dahan: old.dahan, blight: old.blight, playerCount: old.playerCount });
        updated++;
      } else {
        const id = Math.max(0, ...appData.matches.map(m => Number(m.id || 0))) + 1;
        const m = Object.assign({ id }, legacyMatchFields(lg));
        appData.matches.push(m);
        byId.set(lg.id, m);
        added++;
      }
    }
    if (!added && !updated) return 0;
    const parts = [];
    if (added) parts.push(`${added} Legacy game${added === 1 ? "" : "s"} added`);
    if (updated) parts.push(`${updated} updated`);
    await persistData(quiet ? "" : parts.join(", "));
    return added + updated;
  }

  function findLegacyMatch(legacyId) {
    return (appData?.matches || []).find(m => m.legacy && m.legacy.id === legacyId) || null;
  }

  // Keep importing while the tracker is open: the Legacy page may be open in another tab.
  function watchLegacyGames() {
    window.addEventListener("storage", async e => {
      if (e.key !== LEGACY_KEY) return;
      if (await importLegacyGames()) { populateGlobalPlayerFilter(); renderAll(); }
    });
  }
