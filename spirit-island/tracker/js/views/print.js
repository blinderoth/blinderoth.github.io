// ==========================================================================
// Print summary: one or two A4 pages built from the current data.
// It is built on demand (button or Ctrl+P) and hidden on screen.
// ==========================================================================
function buildPrintSheet() {
  const sheet = document.getElementById("printSheet");
  if (!sheet || !appData) return;
  const data = getStatsData();
  const kpi = SIAnalytics.computeGlobalKPIs(data);
  const ach = SIAnalytics.computeAchievements(data, { ownedOnly: true });
  const council = SIAnalytics.computePlayerStats(data).guardians || [];
  const spirits = SIAnalytics.computeSpiritStats(data).filter(s => s.gamesPlayed > 0)
    .sort((a, b) => (b.gamesPlayed - a.gamesPlayed) || (b.winRate - a.winRate) || a.name.localeCompare(b.name));
  const advs = SIAnalytics.computeAdversaryStats(data).filter(a => a.games > 0)
    .sort((a, b) => (b.games - a.games) || a.name.localeCompare(b.name));
  const recent = (data.matches || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id).slice(0, 10);

  const pct = v => (v === null || v === undefined || Number.isNaN(v)) ? "–" : Math.round(v) + "%";
  const num = (v, d = 0) => (v === null || v === undefined) ? "–" : SIAnalytics.formatNum(v, d);
  const rows = (items, cols) => items.map(it => `<tr>${cols.map(c => `<td${c.cls ? ` class="${c.cls}"` : ""}>${c.fn(it)}</td>`).join("")}</tr>`).join("");
  const head = cols => `<thead><tr>${cols.map(c => `<th${c.cls ? ` class="${c.cls}"` : ""}>${c.h}</th>`).join("")}</tr></thead>`;

  const playerCols = [
    { h: "Player", fn: p => escapeHtml(p.name) },
    { h: "Games", cls: "n", fn: p => p.uniqueMatches },
    { h: "Wins", cls: "n", fn: p => p.victories },
    { h: "Win rate", cls: "n", fn: p => pct(p.winRate) },
    { h: "Best diff won", cls: "n", fn: p => p.maxDifficultyWon ?? "–" },
    { h: "High score", cls: "n", fn: p => num(p.highScore, 0) }
  ];
  const spiritCols = [
    { h: "Spirit", fn: s => escapeHtml(s.name) },
    { h: "Games", cls: "n", fn: s => s.gamesPlayed },
    { h: "Wins", cls: "n", fn: s => s.gamesWon },
    { h: "Win rate", cls: "n", fn: s => pct(s.winRate) },
    { h: "Best diff", cls: "n", fn: s => s.maxDifficultyWon ?? "–" }
  ];
  const advCols = [
    { h: "Adversary", fn: a => escapeHtml(a.name.replace(/^The /, "")) },
    { h: "Games", cls: "n", fn: a => a.games },
    { h: "Wins", cls: "n", fn: a => a.wins },
    { h: "Win rate", cls: "n", fn: a => pct(a.winRate) },
    { h: "Top level won", cls: "n", fn: a => a.maxLevelDefeated ?? "–" }
  ];
  const matchCols = [
    { h: "#", cls: "n", fn: m => m.id },
    { h: "Date", cls: "nw", fn: m => escapeHtml(m.date || "") },
    { h: "Result", fn: m => m.victory ? "Victory" : "Defeat" },
    { h: "Spirits", fn: m => escapeHtml((m.players || []).map(p => p.spirit).filter(Boolean).join(", ")) },
    { h: "Adversary", fn: m => escapeHtml(m.adversary1 ? m.adversary1.replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "") + (m.adversary1Level !== null && m.adversary1Level !== undefined ? " L" + m.adversary1Level : "") : "–") },
    { h: "Scenario", fn: m => escapeHtml(m.scenario || "–") },
    { h: "Diff", cls: "n", fn: m => m.difficulty ?? "–" },
    { h: "Score", cls: "n", fn: m => num(m.score, 1) }
  ];

  const filterNote = selectedPlayerFilter ? ` · Player: ${escapeHtml(selectedPlayerFilter)}` : "";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  sheet.innerHTML = `
    <header class="ps-head">
      <h1>Spirit Island campaign summary</h1>
      <p>${today} · ${kpi.totalMatches} games${filterNote}</p>
    </header>
    <section class="ps-kpis" aria-label="Totals">
      <div><b>${kpi.totalMatches}</b><span>Games</span></div>
      <div><b>${kpi.wins}–${kpi.losses}</b><span>Wins–losses</span></div>
      <div><b>${pct(kpi.winRate)}</b><span>Win rate</span></div>
      <div><b>${kpi.highestDiffBeaten ?? "–"}</b><span>Highest difficulty won</span></div>
      <div><b>${num(kpi.highScore, 0)}</b><span>High score</span></div>
      <div><b>${num(kpi.avgScore, 1)}</b><span>Average score</span></div>
      <div><b>${ach.totalUnlocked} / ${ach.totalPossible}</b><span>Milestones (${num(ach.overallPct, 1)}%)</span></div>
    </section>
    <section><h2>Players</h2><table>${head(playerCols)}<tbody>${rows(council, playerCols)}</tbody></table></section>
    <div class="ps-cols">
      <section><h2>Spirits played</h2><table>${head(spiritCols)}<tbody>${rows(spirits.slice(0, 24), spiritCols)}</tbody></table>${spirits.length > 24 ? `<p class="ps-note">${spirits.length - 24} more spirits not shown.</p>` : ""}</section>
      <section><h2>Adversaries faced</h2><table>${head(advCols)}<tbody>${rows(advs, advCols)}</tbody></table></section>
    </div>
    <section><h2>Latest 10 games</h2><table>${head(matchCols)}<tbody>${rows(recent, matchCols)}</tbody></table></section>
    <footer class="ps-foot">Spirit Island Memoir · printed from your browser data</footer>`;
}

function printSummary() {
  buildPrintSheet();
  window.print();
}

window.addEventListener("beforeprint", buildPrintSheet);
