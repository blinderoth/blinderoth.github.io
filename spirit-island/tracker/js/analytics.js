// Spirit Island Analytics, Scoring, Gauntlet & Achievement Engine

window.SIAnalytics = (function () {
  function formatNum(n, decimals = 1) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const val = Number(n);
    if (Number.isInteger(val)) return String(val);
    return Number(val.toFixed(decimals)).toString();
  }

  function calculateDifficulty( {
    thematicMap,
    adversary1,
    adversary1Level,
    adversary2,
    adversary2Level,
    scenario,
    adversaries,
    scenarios
  }) {
    const thematicDiff = thematicMap ? 1 : 0;
    let adversaryDiff = 0;

    if (adversary1 && adversary1Level !== null && adversary1Level !== "" && adversary1Level !== undefined) {
      const advObj = (adversaries || []).find(a => a.name === adversary1);
      const lvl = Number(adversary1Level);
      if (advObj && advObj.levels && advObj.levels[lvl] !== undefined) {
        adversaryDiff += advObj.levels[lvl];
      }
    }

    if (adversary2 && adversary2Level !== null && adversary2Level !== "" && adversary2Level !== undefined) {
      const adv2Obj = (adversaries || []).find(a => a.name === adversary2);
      const lvl2 = Number(adversary2Level);
      if (adv2Obj && adv2Obj.levels && adv2Obj.levels[lvl2] !== undefined) {
        adversaryDiff += Math.round(adv2Obj.levels[lvl2] * 0.6);
      }
    }

    let scenarioDiff = 0;
    if (scenario) {
      const scenObj = (scenarios || []).find(s => s.name === scenario);
      if (scenObj) {
        scenarioDiff = Number(scenObj.difficulty || 0);
      }
    }

    return {
      thematicDiff,
      adversaryDiff,
      scenarioDiff,
      totalDifficulty: thematicDiff + adversaryDiff + scenarioDiff
    };
  }

  function calculateScore({
    victory,
    difficulty,
    invaderCardsInDeck,
    invaderCardsNotInDeck,
    dahan,
    blight,
    playerCount
  }) {
    const diff = Number(difficulty || 0);
    const pCount = Math.max(1, Number(playerCount || 1));
    const dahanCount = Number(dahan || 0);
    const blightCount = Number(blight || 0);
    const islandModifier = (dahanCount - blightCount) / pCount;

    let rawScore = 0;
    if (victory) {
      const cardsLeft = Number(invaderCardsInDeck || 0);
      rawScore = (5 * diff) + 10 + (2 * cardsLeft) + islandModifier;
    } else {
      const cardsOut = Number(invaderCardsNotInDeck || 0);
      rawScore = (2 * diff) + (1 * cardsOut) + islandModifier;
    }
    return Math.round(rawScore * 100) / 100;
  }

  function computeGlobalKPIs(data) {
    const matches = data.matches || [];
    const totalMatches = matches.length;
    const wins = matches.filter(m => m.victory).length;
    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    let highestDiffBeaten = 0;
    let highScore = 0;
    let totalScore = 0;

    let winBlightSum = 0;
    let winBlightCount = 0;
    let winDahanSum = 0;
    let winDahanCount = 0;
    let invaderCardsCleared = 0;

    matches.forEach(m => {
      const s = Number(m.score || 0);
      if (s > highScore) highScore = s;
      totalScore += s;

      if (m.victory) {
        if (Number(m.difficulty || 0) > highestDiffBeaten) {
          highestDiffBeaten = Number(m.difficulty || 0);
        }
        if (m.blight !== null && m.blight !== undefined && m.blight !== "" && !(m.dahan === 0 && m.blight === 0 && m.id === 1)) {
          if (m.blight > 0) {
            winBlightSum += Number(m.blight);
            winBlightCount++;
          }
        }
        if (m.dahan !== null && m.dahan !== undefined && m.dahan !== "" && m.dahan > 0) {
          winDahanSum += Number(m.dahan);
          winDahanCount++;
        }
        invaderCardsCleared += Number(m.invaderCardsInDeck || 0);
      }
    });

    const avgScore = totalMatches > 0 ? totalScore / totalMatches : 0;
    const avgBlightWin = winBlightCount > 0 ? winBlightSum / winBlightCount : 0;
    const avgDahanWin = winDahanCount > 0 ? winDahanSum / winDahanCount : 0;

    return {
      totalMatches,
      wins,
      losses,
      winRate,
      highestDiffBeaten,
      highScore,
      avgScore,
      avgBlightWin,
      avgDahanWin,
      invaderCardsCleared
    };
  }

  function computeSpiritStats(data) {
    const matches = data.matches || [];
    const spirits = data.spirits || [];
    const map = {};

    spirits.forEach(sp => {
      map[sp.name] = {
        ...sp,
        gamesPlayed: 0,
        gamesWon: 0,
        winRate: null,
        maxDifficultyWon: 0,
        recordScore: 0,
        aspectCounts: {},
        aspectWins: {},
        playerCounts: {},
        playerWins: {},
        recentMatches: []
      };
    });

    matches.forEach(m => {
      (m.players || []).forEach(slot => {
        if (!slot.spirit) return;
        if (!map[slot.spirit]) {
          map[slot.spirit] = {
            name: slot.spirit,
            owned: true,
            expansion: "Custom",
            image: "https://i.imgur.com/5ZQZ6lB.png",
            complexityScore: 2,
            complexity: "Moderate",
            minEnergy: 1, maxEnergy: 4, minPlays: 1, maxPlays: 4,
            startingCost: 4, fastCards: 2, slowCards: 2,
            primaryElements: [], affinityProfile: "—",
            elements: { Sun: 0, Moon: 0, Fire: 0, Air: 0, Water: 0, Earth: 0, Plant: 0, Animal: 0 },
            setup: [],
            gamesPlayed: 0, gamesWon: 0, winRate: null,
            maxDifficultyWon: 0, recordScore: 0,
            aspectCounts: {}, aspectWins: {},
            playerCounts: {}, playerWins: {},
            recentMatches: []
          };
        }

        const st = map[slot.spirit];
        st.gamesPlayed++;
        if (m.victory) {
          st.gamesWon++;
          if (Number(m.difficulty || 0) > st.maxDifficultyWon) {
            st.maxDifficultyWon = Number(m.difficulty || 0);
          }
        }
        if (Number(m.score || 0) > st.recordScore) {
          st.recordScore = Number(m.score || 0);
        }

        const asp = resolveAspectName(data, slot.spirit, slot.aspect);
        st.aspectCounts[asp] = (st.aspectCounts[asp] || 0) + 1;
        if (m.victory) {
          st.aspectWins[asp] = (st.aspectWins[asp] || 0) + 1;
        }

        const pl = slot.player ? slot.player.trim() : "Unknown";
        st.playerCounts[pl] = (st.playerCounts[pl] || 0) + 1;
        if (m.victory) {
          st.playerWins[pl] = (st.playerWins[pl] || 0) + 1;
        }

        st.recentMatches.push(m);
      });
    });

    return Object.values(map).map(st => {
      st.winRate = st.gamesPlayed > 0 ? (st.gamesWon / st.gamesPlayed) * 100 : null;

      // Determine Best Aspect (prefer named aspect if won, else Base)
      let bestAspect = "—";
      if (st.gamesPlayed > 0) {
        const namedAspects = Object.keys(st.aspectCounts).filter(a => a !== "Base");
        if (namedAspects.length > 0) {
          bestAspect = namedAspects.sort((a, b) => (st.aspectWins[b] || 0) - (st.aspectWins[a] || 0))[0];
        } else {
          bestAspect = "Base";
        }
      }
      st.bestAspect = bestAspect;

      // Determine Top Player
      let topPlayer = "Unclaimed";
      if (st.gamesPlayed > 0) {
        topPlayer = Object.keys(st.playerCounts).sort((a, b) => {
          const diffWins = (st.playerWins[b] || 0) - (st.playerWins[a] || 0);
          if (diffWins !== 0) return diffWins;
          return (st.playerCounts[b] || 0) - (st.playerCounts[a] || 0);
        })[0] || "Unclaimed";
      }
      st.topPlayer = topPlayer;

      return st;
    });
  }

  function computeAdversaryStats(data) {
    const matches = data.matches || [];
    const adversaries = data.adversaries || [];

    return adversaries.map(adv => {
      const advMatches = matches.filter(m => m.adversary1 === adv.name || m.adversary2 === adv.name);
      const games = advMatches.length;
      const wins = advMatches.filter(m => m.victory).length;
      const winRate = games > 0 ? (wins / games) * 100 : null;

      let maxLevelDefeated = null;
      const gauntlet = [0, 1, 2, 3, 4, 5, 6].map(lvl => {
        const tierMatches = advMatches.filter(m => {
          const mLvl = m.adversary1 === adv.name ? m.adversary1Level : m.adversary2Level;
          return Number(mLvl) === lvl && mLvl !== null && mLvl !== "";
        });

        const tierWins = tierMatches.filter(m => m.victory);
        if (tierWins.length > 0) {
          if (maxLevelDefeated === null || lvl > maxLevelDefeated) {
            maxLevelDefeated = lvl;
          }
          const bestScore = Math.max(...tierWins.map(m => Number(m.score || 0)));
          return {
            level: lvl,
            status: "WIN",
            score: bestScore,
            matches: tierMatches
          };
        } else if (tierMatches.length > 0) {
          return {
            level: lvl,
            status: "LOSS",
            score: null,
            matches: tierMatches
          };
        } else {
          return {
            level: lvl,
            status: "EMPTY",
            score: null,
            matches: []
          };
        }
      });

      let threatLevel = "Unchallenged";
      if (games > 0) {
        if (winRate >= 75) threatLevel = "Contained";
        else if (winRate >= 50) threatLevel = "Moderate Threat";
        else threatLevel = "High Threat";
      }

      return {
        ...adv,
        games,
        wins,
        winRate,
        maxLevelDefeated,
        threatLevel,
        gauntlet
      };
    });
  }

  // Per scenario: games, wins and best winning score. The two Surges of Colonization variants are one scenario.
  function computeScenarioStats(data) {
    const family = n => /^(Normal|Large) Surges of Colonization$/.test(n) ? "Surges of Colonization" : n;
    const order = [], by = {};
    (data.scenarios || []).forEach(sc => {
      const key = family(sc.name);
      if (!by[key]) { by[key] = { name: key, scenario: sc, expansion: sc.expansion, owned: !!sc.owned, games: 0, wins: 0, bestScore: null, gameId: null }; order.push(key); }
    });
    (data.matches || []).forEach(m => {
      if (!m.scenario) return;
      const e = by[family(m.scenario)];
      if (!e) return;
      e.games++;
      if (m.victory) {
        e.wins++;
        const sc = Number(m.score || 0);
        if (e.bestScore === null || sc > e.bestScore) { e.bestScore = sc; e.gameId = m.id; }
      } else if (e.bestScore === null && (e.gameId === null || Number(m.id) > Number(e.gameId))) {
        e.gameId = m.id;          // no win yet: point at the latest loss
      }
    });
    return order.map(k => by[k]);
  }

  function computePlayerStats(data) {
    const matches = data.matches || [];
    const players = data.players || [];
    const spiritsMap = {};
    (data.spirits || []).forEach(s => { spiritsMap[s.name] = s; });

    const statsByName = {};
    players.forEach(p => {
      statsByName[p.name.trim()] = {
        name: p.name.trim(),
        role: p.role || "Island Guardian",
        isPrimary: !!p.isPrimary,
        deployments: 0,
        uniqueMatches: 0,
        victories: 0,
        winRate: 0,
        highScore: 0,
        maxDifficultyWon: 0,
        spiritCounts: {},
        spiritWins: {}
      };
    });

    matches.forEach(m => {
      const seenInMatch = new Set();
      (m.players || []).forEach(slot => {
        if (!slot.player) return;
        const pName = slot.player.trim();
        if (!statsByName[pName]) {
          statsByName[pName] = {
            name: pName,
            role: "Island Guardian",
            isPrimary: false,
            deployments: 0,
            uniqueMatches: 0,
            victories: 0,
            winRate: 0,
            highScore: 0,
            maxDifficultyWon: 0,
            spiritCounts: {},
            spiritWins: {}
          };
        }
        const st = statsByName[pName];
        st.deployments++;
        if (!seenInMatch.has(pName)) {
          st.uniqueMatches++;
          seenInMatch.add(pName);
        }
        if (m.victory) {
          st.victories++;
          if (Number(m.difficulty || 0) > st.maxDifficultyWon) {
            st.maxDifficultyWon = Number(m.difficulty || 0);
          }
        }
        if (Number(m.score || 0) > st.highScore) {
          st.highScore = Number(m.score || 0);
        }
        if (slot.spirit) {
          st.spiritCounts[slot.spirit] = (st.spiritCounts[slot.spirit] || 0) + 1;
          if (m.victory) {
            st.spiritWins[slot.spirit] = (st.spiritWins[slot.spirit] || 0) + 1;
          }
        }
      });
    });

    const list = Object.values(statsByName).map(st => {
      st.winRate = st.deployments > 0 ? (st.victories / st.deployments) * 100 : 0;
      let sigSpirit = "—";
      const spNames = Object.keys(st.spiritCounts);
      if (spNames.length > 0) {
        sigSpirit = spNames.sort((a, b) => {
          const diffCount = st.spiritCounts[b] - st.spiritCounts[a];
          if (diffCount !== 0) return diffCount;
          return (st.spiritWins[b] || 0) - (st.spiritWins[a] || 0);
        })[0];
      }
      st.signatureSpirit = sigSpirit;
      st.signatureSpiritImg = spiritsMap[sigSpirit]?.image || "https://i.imgur.com/5ZQZ6lB.png";
      return st;
    });

    const totalDeployments = list.reduce((acc, p) => acc + p.deployments, 0);
    const totalVictories = list.reduce((acc, p) => acc + p.victories, 0);
    const councilWinRate = totalDeployments > 0 ? (totalVictories / totalDeployments) * 100 : 0;
    const councilHighScore = Math.max(0, ...list.map(p => p.highScore));

    return {
      guardians: list,
      totals: {
        deployments: totalDeployments,
        victories: totalVictories,
        winRate: councilWinRate,
        activeGuardians: list.filter(p => p.deployments > 0).length,
        highScore: councilHighScore
      }
    };
  }

  // One guardian's profile: record, spirits, aspects, adversary levels, scenarios.
  // "Games" counts matches the guardian was in; a game with 2 spirits is still one game.
  function computeGuardianProfile(data, name) {
    const want = String(name || "").trim();
    const games = [];
    (data.matches || []).forEach(m => {
      const slots = (m.players || []).filter(p => (p.player || "").trim() === want);
      if (slots.length) games.push({ m, slots });
    });
    games.sort((a, b) => (Number(b.m.id) || 0) - (Number(a.m.id) || 0));   // newest first

    const wins = games.filter(g => g.m.victory);
    const r = {
      name: want, games: games.length, wins: wins.length, losses: games.length - wins.length,
      winRate: games.length ? (wins.length / games.length) * 100 : null,
      highScore: Math.max(0, ...games.map(g => Number(g.m.score || 0))),
      avgScore: games.length ? games.reduce((a, g) => a + Number(g.m.score || 0), 0) / games.length : null,
      maxDifficultyWon: Math.max(0, ...wins.map(g => Number(g.m.difficulty || 0))),
      streak: 0,
      spiritCount: { byCount: {}, max: 1 },
      spirits: [], aspects: [], aspectsTried: 0, aspectsAvailable: 0,
      adversaries: [], scenariosWon: 0, scenariosTotal: 0, scenarioNames: []
    };
    for (const g of games) { if (g.m.victory) r.streak++; else break; }

    games.forEach(g => {
      const k = g.slots.length;
      const b = (r.spiritCount.byCount[k] = r.spiritCount.byCount[k] || { games: 0, wins: 0 });
      b.games++; if (g.m.victory) b.wins++;
      r.spiritCount.max = Math.max(r.spiritCount.max, k);
    });

    const sp = {}, asp = {};
    games.forEach(g => g.slots.forEach(slot => {
      if (!slot.spirit) return;
      const e = (sp[slot.spirit] = sp[slot.spirit] || { name: slot.spirit, plays: 0, wins: 0 });
      e.plays++; if (g.m.victory) e.wins++;
      const a = slot.aspect && slot.aspect !== "Base" ? resolveAspectName(data, slot.spirit, slot.aspect) : "";
      if (a && a !== "Base") {
        const key = slot.spirit + "|" + a;
        const x = (asp[key] = asp[key] || { spirit: slot.spirit, name: a, plays: 0, wins: 0 });
        x.plays++; if (g.m.victory) x.wins++;
      }
    }));
    const spiritsMap = {};
    (data.spirits || []).forEach(x => { spiritsMap[x.name] = x; });
    r.spirits = Object.values(sp).map(e => ({ ...e, winRate: (e.wins / e.plays) * 100, image: spiritsMap[e.name]?.image || "" }))
      .sort((a, b) => b.plays - a.plays || b.wins - a.wins || a.name.localeCompare(b.name));
    r.aspects = Object.values(asp).sort((a, b) => b.plays - a.plays || b.wins - a.wins || a.name.localeCompare(b.name));
    r.aspectsTried = r.aspects.length;
    r.aspectsAvailable = (data.aspects || []).filter(a => spiritsMap[a.spirit]?.owned).length;

    const best = {};
    wins.forEach(g => {
      [[g.m.adversary1, g.m.adversary1Level], [g.m.adversary2, g.m.adversary2Level]].forEach(([n, l]) => {
        if (!n) return;
        const lv = (l === null || l === "" || l === undefined) ? 0 : Number(l);
        if (best[n] === undefined || lv > best[n]) best[n] = lv;
      });
    });
    r.adversaries = (data.adversaries || []).filter(a => a.owned).map(a => ({ name: a.name, level: best[a.name] === undefined ? null : best[a.name] }));

    const family = n => /^(Normal|Large) Surges of Colonization$/.test(n) ? "Surges of Colonization" : n;
    const won = new Set(wins.map(g => g.m.scenario).filter(Boolean).map(family));
    const all = new Set((data.scenarios || []).filter(x => x.owned).map(x => family(x.name)));
    r.scenariosTotal = all.size;
    r.scenarioNames = Array.from(all).filter(n => won.has(n));
    r.scenariosWon = r.scenarioNames.length;
    return r;
  }

  function computeLossAutopsy(data) {
    const losses = (data.matches || []).filter(m => !m.victory);
    const counts = {
      "Blight Overrun": 0,
      "Invader Deck Depleted": 0,
      "Presence Destroyed": 0,
      "Adversary Special Rule": 0
    };

    losses.forEach(m => {
      const cond = m.lossCondition || "Blight Overrun";
      if (counts[cond] !== undefined) {
        counts[cond]++;
      } else {
        counts["Blight Overrun"]++;
      }
    });

    return {
      totalLosses: losses.length,
      breakdown: [
        {
          type: "Blight Overrun",
          count: counts["Blight Overrun"],
          riskTier: counts["Blight Overrun"] >= 3 ? "CRITICAL" : "MONITORED"
        },
        {
          type: "Adversary Special Rule",
          count: counts["Adversary Special Rule"],
          riskTier: counts["Adversary Special Rule"] >= 2 ? "HIGH" : "MONITORED"
        },
        {
          type: "Invader Deck Depleted",
          count: counts["Invader Deck Depleted"],
          riskTier: counts["Invader Deck Depleted"] >= 2 ? "ELEVATED" : "MONITORED"
        },
        {
          type: "Presence Destroyed",
          count: counts["Presence Destroyed"],
          riskTier: "MONITORED"
        }
      ]
    };
  }

  function computeAchievements(data, opts = {}) {
    const ownedOnly = opts.ownedOnly ?? true;
    const allSpirits = data.spirits || [];
    const spirits = ownedOnly ? allSpirits.filter(s => s.owned) : allSpirits;
    const matches = data.matches || [];
    const adversaries = (data.adversaries || []).filter(a => !ownedOnly || a.owned);
    const scenarios = (data.scenarios || []).filter(sc => !ownedOnly || sc.owned);

    const spiritNames = allSpirits.map(s => s.name);
    const countedSpiritNames = spirits.map(s => s.name);

    // Per-spirit tracking
    const bySpirit = {};
    spiritNames.forEach(sp => {
      bySpirit[sp] = {
        wonAny: false,
        maxDiffWon: -1,
        maxScoreWon: 0,
        advMaxLevel: {},
        teammatesWon: new Set(),
        scenariosWon: new Set(),
        advGames: {},
        advWins: {}
      };
      adversaries.forEach(a => {
        bySpirit[sp].advMaxLevel[a.name] = -1;
        bySpirit[sp].advGames[a.name] = 0;
        bySpirit[sp].advWins[a.name] = 0;
      });
    });

    matches.forEach(m => {
      const mSpirits = (m.players || []).map(p => p.spirit).filter(Boolean);
      mSpirits.forEach(sp => {
        if (!bySpirit[sp]) return;
        const rec = bySpirit[sp];

        if (m.adversary1 && rec.advGames[m.adversary1] !== undefined) {
          rec.advGames[m.adversary1]++;
          if (m.victory) rec.advWins[m.adversary1]++;
        }

        if (m.victory) {
          rec.wonAny = true;
          const diff = Number(m.difficulty || 0);
          if (diff > rec.maxDiffWon) rec.maxDiffWon = diff;
          const sc = Number(m.score || 0);
          if (sc > rec.maxScoreWon) rec.maxScoreWon = sc;

          if (m.adversary1 && rec.advMaxLevel[m.adversary1] !== undefined) {
            const lvl = Number(m.adversary1Level ?? 0);
            if (lvl > rec.advMaxLevel[m.adversary1]) {
              rec.advMaxLevel[m.adversary1] = lvl;
            }
          }

          if (m.scenario) {
            rec.scenariosWon.add(m.scenario);
          }

          mSpirits.forEach(other => {
            if (other !== sp) rec.teammatesWon.add(other);
          });
        }
      });
    });

    // Calculate total achievements unlocked per spirit (scoped to owned content when ownedOnly is true)
    const spiritCompletion = {};
    let totalUnlocked = 0;
    let totalPossible = 0;

    countedSpiritNames.forEach(sp => {
      const rec = bySpirit[sp];
      let unlocked = 0;
      let possible = 0;

      // 12 General milestones (Win, Diff 1..10, Score 40+)
      possible += 12;
      if (rec.wonAny) unlocked++;
      for (let d = 1; d <= 10; d++) {
        if (rec.maxDiffWon >= d) unlocked++;
      }
      if (rec.maxScoreWon >= 40) unlocked++;

      // 7 Adversaries * 7 Levels = 49
      adversaries.forEach(a => {
        for (let l = 0; l <= 6; l++) {
          possible++;
          if (rec.advMaxLevel[a.name] >= l) unlocked++;
        }
      });

      // 13 Scenarios
      scenarios.forEach(sc => {
        possible++;
        if (rec.scenariosWon.has(sc.name)) unlocked++;
      });

      spiritCompletion[sp] = {
        unlocked,
        possible,
        pct: possible > 0 ? (unlocked / possible) * 100 : 0
      };
      totalUnlocked += unlocked;
      totalPossible += possible;
    });

    return {
      bySpirit,
      spiritCompletion,
      totalUnlocked,
      totalPossible,
      overallPct: totalPossible > 0 ? (totalUnlocked / totalPossible) * 100 : 0
    };
  }

  function resolveAspectName(data, spiritName, aspectName) {
    const raw = (aspectName || "").trim();
    if (!raw) return "Base";
    const list = (data.aspects || []).filter(a => (a.spirit || "").toLowerCase() === (spiritName || "").toLowerCase());
    const hit = list.find(a => a.name.toLowerCase() === raw.toLowerCase() ||
      (a.aliases || []).some(al => al.toLowerCase() === raw.toLowerCase()));
    return hit ? hit.name : raw;
  }

  function emptyAspectRec(extra) {
    return Object.assign({
      gamesPlayed: 0, gamesWon: 0, winRate: null,
      maxDifficultyWon: 0, recordScore: 0, totalScore: 0, avgScore: null,
      players: {}, topPlayer: "—", lastPlayed: null, adversariesBeaten: new Set()
    }, extra || {});
  }

  // Per-aspect (and per-spirit Base) stats across the whole campaign
  function computeAspectStats(data) {
    const matches = data.matches || [];
    const spiritsMap = {};
    (data.spirits || []).forEach(s => { spiritsMap[s.name] = s; });

    const map = {}; // key: spirit||aspect
    const key = (sp, asp) => `${sp}||${asp}`;

    (data.aspects || []).forEach(a => {
      map[key(a.spirit, a.name)] = emptyAspectRec({ ...a, isBase: false });
    });
    (data.spirits || []).forEach(s => {
      map[key(s.name, "Base")] = emptyAspectRec({ name: "Base", spirit: s.name, complexityChange: "=", expansion: s.expansion, isBase: true, description: "The Spirit as printed on its standard panel, with no Aspect applied." });
    });

    matches.forEach(m => {
      (m.players || []).forEach(slot => {
        if (!slot.spirit) return;
        const asp = resolveAspectName(data, slot.spirit, slot.aspect);
        const k = key(slot.spirit, asp);
        if (!map[k]) map[k] = emptyAspectRec({ name: asp, spirit: slot.spirit, complexityChange: "=", expansion: "Custom", isBase: asp === "Base", description: "" });
        const r = map[k];
        const sc = Number(m.score || 0);
        r.gamesPlayed++;
        r.totalScore += sc;
        if (sc > r.recordScore) r.recordScore = sc;
        if (m.victory) {
          r.gamesWon++;
          const d = Number(m.difficulty || 0);
          if (d > r.maxDifficultyWon) r.maxDifficultyWon = d;
          if (m.adversary1) r.adversariesBeaten.add(m.adversary1);
        }
        const pl = (slot.player || "Unknown").trim();
        r.players[pl] = (r.players[pl] || 0) + 1;
        if (!r.lastPlayed || (m.date || "") > r.lastPlayed) r.lastPlayed = m.date || r.lastPlayed;
      });
    });

    return Object.values(map).map(r => {
      r.winRate = r.gamesPlayed > 0 ? (r.gamesWon / r.gamesPlayed) * 100 : null;
      r.avgScore = r.gamesPlayed > 0 ? r.totalScore / r.gamesPlayed : null;
      const pls = Object.keys(r.players).sort((a, b) => r.players[b] - r.players[a]);
      r.topPlayer = pls[0] || "—";
      r.adversariesBeaten = Array.from(r.adversariesBeaten);
      r.spiritImage = spiritsMap[r.spirit]?.image || "";
      r.spiritOwned = !!spiritsMap[r.spirit]?.owned;
      return r;
    });
  }

  // Aspect breakdown for a single spirit: [Base, ...aspects]
  function getSpiritAspectBreakdown(data, spiritName, aspectStats) {
    const all = aspectStats || computeAspectStats(data);
    const rows = all.filter(r => r.spirit === spiritName);
    rows.sort((a, b) => (a.isBase ? -1 : b.isBase ? 1 : a.name.localeCompare(b.name)));
    return rows;
  }

  return {
    formatNum,
    resolveAspectName,
    computeAspectStats,
    getSpiritAspectBreakdown,
    calculateDifficulty,
    calculateScore,
    computeGlobalKPIs,
    computeSpiritStats,
    computeAdversaryStats,
    computeScenarioStats,
    computePlayerStats,
    computeLossAutopsy,
    computeGuardianProfile,
    computeAchievements,
  };
})();
