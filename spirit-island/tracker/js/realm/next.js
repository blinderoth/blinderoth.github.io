// Chapter: Your Next Invasion. A roulette that deals a challenge from your gaps, using owned content only:
// spirits you have not won with (and pairs not yet tried), the next adversary level you have not beaten,
// and scenarios you have not won. Uses all games, whatever the time window says.

(() => {
  let players = 2;
  let deal = null;
  let spinning = false;

  const shortAdv = n => String(n).replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "").replace("Brandenburg-Prussia", "Prussia").replace("Habsburg Monarchy", "Habsburg").replace("Habsburg Mining Expedition", "Mining Exp.");
  const family = n => /^(Normal|Large) Surges of Colonization$/.test(n) ? "Surges of Colonization" : n;
  const pick = (list, weight) => {
    const total = list.reduce((t, x) => t + Math.max(0.01, weight(x)), 0);
    let r = Math.random() * total;
    for (const x of list) { r -= Math.max(0.01, weight(x)); if (r <= 0) return x; }
    return list[list.length - 1];
  };

  function gaps(all) {
    const games = all.matches || [];
    const sp = new Map((all.spirits || []).filter(s => s.owned).map(s => [s.name, { name: s.name, plays: 0, wins: 0 }]));
    const pairs = new Set();
    const best = {};
    const scnWon = new Set();
    games.forEach(m => {
      const names = Array.from(new Set((m.players || []).map(p => p.spirit).filter(Boolean))).sort();
      names.forEach(n => { const e = sp.get(n); if (e) { e.plays++; if (m.victory) e.wins++; } });
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.add(names[i] + "|" + names[j]);
      if (m.victory) {
        [[m.adversary1, m.adversary1Level], [m.adversary2, m.adversary2Level]].forEach(([a, l]) => {
          if (!a || l === null || l === "" || l === undefined) return;
          best[a] = Math.max(best[a] ?? -1, Number(l));
        });
        if (m.scenario) scnWon.add(family(m.scenario));
      }
    });
    const advs = (all.adversaries || []).filter(a => a.owned).map(a => ({ name: a.name, next: Math.min(6, (best[a.name] ?? -1) + 1), done: (best[a.name] ?? -1) >= 6 }));
    const scnMap = new Map();
    (all.scenarios || []).filter(s => s.owned).forEach(s => { const f = family(s.name); if (!scnMap.has(f)) scnMap.set(f, s.name); });
    const scns = Array.from(scnMap.entries()).filter(([f]) => !scnWon.has(f)).map(([f, name]) => ({ family: f, name }));
    return { spirits: Array.from(sp.values()), pairs, advs, scns };
  }

  function makeDeal(all) {
    const G = gaps(all);
    if (!G.spirits.length) return null;
    const wSp = s => (s.wins === 0 ? 3 : 0) + (s.plays === 0 ? 2 : 0) + 1 / (1 + s.plays);
    // Several random draws; keep the one that opens the most new ground
    let bestTeam = null, bestScore = -1;
    for (let k = 0; k < 40; k++) {
      const pool = G.spirits.slice(), team = [];
      while (team.length < Math.min(players, pool.length)) { const s = pick(pool, wSp); team.push(s); pool.splice(pool.indexOf(s), 1); }
      let score = team.reduce((t, s) => t + wSp(s), 0);
      for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) if (!G.pairs.has([team[i].name, team[j].name].sort().join("|"))) score += 2;
      if (score > bestScore) { bestScore = score; bestTeam = team; }
    }
    const openAdvs = G.advs.filter(a => !a.done);
    const adv = openAdvs.length ? pick(openAdvs, a => (a.next === 0 ? 3 : 1) + (6 - a.next) * 0.2) : null;
    const scn = G.scns.length && Math.random() < 0.75 ? pick(G.scns, () => 1) : null;
    const prefill = {
      players: bestTeam.map((s, i) => ({ spirit: s.name, aspect: "", player: (all.players?.[i]?.name) || "" })),
      adversary1: adv ? adv.name : "",
      adversary1Level: adv ? adv.next : null,
      scenario: scn ? scn.name : ""
    };
    const diff = SIAnalytics.calculateDifficulty({ thematicMap: false, adversary1: prefill.adversary1, adversary1Level: prefill.adversary1Level, scenario: prefill.scenario, adversaries: all.adversaries, scenarios: all.scenarios });

    // Which campaign achievements a win would move forward
    const camp = SICampaign.compute(all, { ownedOnly: true });
    const labels = new Set(bestTeam.map(s => s.name));
    if (adv) { labels.add(shortAdv(adv.name)); if (adv.next === 6) labels.add(shortAdv(adv.name) + " L6"); }
    if (scn) labels.add(scn.family);
    const toward = camp.items.filter(it => !it.done && (it.missing || []).some(x => labels.has(x))).map(it => it.title);
    const D = diff.totalDifficulty;
    camp.items.filter(i => /^d\d+$/.test(i.id) && !i.done && Number(i.id.slice(1)) <= D).forEach(i => { if (!toward.includes(i.title)) toward.push(i.title); });
    return { team: bestTeam, adv, scn, diff: D, prefill, toward };
  }

  function reel(label, value, sub) {
    return `<div class="reel"><span class="reel-lbl">${label}</span><strong class="reel-val">${value}</strong>${sub ? `<em class="reel-sub">${sub}</em>` : ""}</div>`;
  }

  function show(ctx) {
    const out = document.getElementById("nextDeal");
    if (!out) return;
    const btn = document.getElementById("nextSpin");
    if (btn) btn.textContent = deal ? "Spin again" : "Spin";
    if (!deal) {
      out.innerHTML = `<p class="hint">Choose how many spirits are at the table, then spin. The island deals from what you own and have not yet mastered.</p>`;
      return;
    }
    const link = `index.html#log=${encodeURIComponent(JSON.stringify(deal.prefill))}`;
    out.innerHTML = `
      <div class="reels">
        ${reel(deal.team.length === 1 ? "Spirit" : "Spirits", deal.team.map(s => escapeHtml(s.name)).join("<br>"), deal.team.map(s => s.plays ? `${s.wins}/${s.plays} won` : "never played").join(" · "))}
        ${reel("Adversary", deal.adv ? `${escapeHtml(shortAdv(deal.adv.name))} <span class="reel-lvl">L${deal.adv.next}</span>` : "None", deal.adv ? (deal.adv.next === 0 ? "never beaten" : `beaten up to L${deal.adv.next - 1}`) : "every owned adversary beaten at L6")}
        ${reel("Scenario", deal.scn ? escapeHtml(deal.scn.family) : "None", deal.scn ? "not yet won" : "")}
        ${reel("Difficulty", String(deal.diff), "")}
      </div>
      ${deal.toward.length ? `<p class="hint">A win here counts toward: <b>${deal.toward.map(escapeHtml).join(", ")}</b>.</p>` : ""}
      <a class="deal-go" href="${link}">Log this invasion in the tracker →</a>`;
  }

  function spin(ctx) {
    if (spinning) return;
    const next = makeDeal(ctx.all);
    if (!next) { deal = null; show(ctx); return; }
    const out = document.getElementById("nextDeal");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !out) { deal = next; show(ctx); return; }
    spinning = true;
    const spirits = (ctx.all.spirits || []).filter(s => s.owned).map(s => s.name);
    const advs = (ctx.all.adversaries || []).filter(a => a.owned).map(a => shortAdv(a.name));
    const scns = (ctx.all.scenarios || []).filter(s => s.owned).map(s => family(s.name));
    const rnd = l => l[Math.floor(Math.random() * l.length)] || "…";
    let t = 0;
    const tick = () => {
      t++;
      out.innerHTML = `<div class="reels spinning">
        ${reel("Spirits", Array.from({ length: players }, () => escapeHtml(rnd(spirits))).join("<br>"), "")}
        ${reel("Adversary", `${escapeHtml(rnd(advs))} <span class="reel-lvl">L${Math.floor(Math.random() * 7)}</span>`, "")}
        ${reel("Scenario", escapeHtml(rnd(scns)), "")}
        ${reel("Difficulty", String(Math.floor(Math.random() * 12)), "")}
      </div>`;
      if (t < 14) setTimeout(tick, 40 + t * 9);
      else { spinning = false; deal = next; show(ctx); out.querySelector(".deal-go")?.focus({ preventScroll: true }); }
    };
    tick();
  }

  let lastCtx = null;
  function render(ctx) {
    lastCtx = ctx;
    const pickEl = document.getElementById("nextPlayers");
    if (pickEl && !pickEl.dataset.bound) {
      pickEl.dataset.bound = "1";
      pickEl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { players = Number(b.dataset.n); deal = null; render(lastCtx); }));
      document.getElementById("nextSpin")?.addEventListener("click", () => spin(lastCtx));
    }
    pickEl?.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.n) === players)));
    const btn = document.getElementById("nextSpin");
    if (btn) btn.textContent = deal ? "Spin again" : "Spin";
    if (!spinning) show(ctx);
  }

  Realm.register("next", render);
})();
