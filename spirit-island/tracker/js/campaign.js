// Campaign achievements: the ones from the Steam version of Spirit Island that the match log can answer.
// Pure logic, no DOM. Used by the Mastery tab, the new-unlock celebration and the tests.
//
// Rules of thumb:
//  - A "win" is a match with victory = true. Spirit, adversary and scenario achievements count wins only.
//  - Sets follow the expansion label on each spirit, adversary, scenario and aspect in the data.
//  - With "owned only" on, a set only asks for things from expansions you own. A set with nothing owned is hidden.
//  - Not trackable from the log (powers, thresholds, events, board tokens, terror level, no-progression) are left out.
const SICampaign = (() => {
  const EXP = {
    core: ["Core"],
    bc: ["Branch and Claw"],
    promo1: ["Promo 1"],
    horizons: ["Horizons"],
    je: ["Jagged Earth"],
    ni: ["Nature Incarnate"],
    feather: ["Promo 2"],
    featherScn: ["Feather and Flame"]
  };
  const inExp = (x, groups) => groups.some(g => EXP[g].includes(x.expansion));
  const short = n => String(n).replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "").replace("Brandenburg-Prussia", "Prussia").replace("Habsburg Monarchy", "Habsburg").replace("Habsburg Mining Expedition", "Mining Exp.");

  // Each definition says what it needs. kind: "flag" (one yes/no test) or "set" (every item in a list).
  const DEFS = [
    { id: "win", title: "Save Your Island", desc: "Win a game.", kind: "flag", test: c => c.wins.length > 0 },
    { id: "adv", title: "The Real Deal", desc: "Win a game against an adversary.", kind: "flag", test: c => c.wins.some(m => m.adversary1) },
    { id: "d4", title: "Vigor", desc: "Win a game with a difficulty of 4 or higher.", kind: "diff", need: 4 },
    { id: "d6", title: "Puissance", desc: "Win a game with a difficulty of 6 or higher.", kind: "diff", need: 6 },
    { id: "d8", title: "Expertise", desc: "Win a game with a difficulty of 8 or higher.", kind: "diff", need: 8 },
    { id: "d17", title: "Against All Odds", desc: "Win a game with a difficulty of 17 or higher.", kind: "diff", need: 17 },
    { id: "d25", title: "Know not the Odds", desc: "Win a game with a difficulty of 25 or higher.", kind: "diff", need: 25 },
    { id: "thematic", title: "Canonical Geography", desc: "Win a game on the thematic map.", kind: "flag", test: c => c.wins.some(m => m.thematicMap) },
    { id: "thematic6", title: "Plenary Cartography", desc: "Win a game with 6 spirits on the thematic map.", kind: "flag", test: c => c.wins.some(m => m.thematicMap && (m.players || []).length >= 6) },

    { id: "sp-core", title: "The First Spirits Rise", desc: "Win with each core game spirit.", kind: "set", items: (d) => spiritItems(d, ["core"]) },
    { id: "sp-bc", title: "Red in Tooth and Claw", desc: "Win with each spirit from Branch and Claw and Promo Pack 1.", kind: "set", items: (d) => spiritItems(d, ["bc", "promo1"]) },
    { id: "sp-hor", title: "New Beginnings", desc: "Win with each spirit from Horizons.", kind: "set", items: (d) => spiritItems(d, ["horizons"]) },
    { id: "sp-je", title: "Harness Chaos and Danger", desc: "Win with each spirit from Jagged Earth.", kind: "set", items: (d) => spiritItems(d, ["je"]) },
    { id: "sp-ni", title: "Myth and Legend", desc: "Win with each spirit from Nature Incarnate and Promo Pack 2.", kind: "set", items: (d) => spiritItems(d, ["ni", "feather"]) },

    { id: "adv-core", title: "European Repulsion", desc: "Defeat every core game adversary.", kind: "set", items: (d) => advItems(d, ["core"], null) },
    { id: "adv-core6", title: "Empires Rejected", desc: "Defeat every core game adversary on level 6.", kind: "set", items: (d) => advItems(d, ["core"], 6) },
    { id: "adv-bcje6", title: "Colonies Expunged", desc: "Defeat every Branch and Claw and Jagged Earth adversary on level 6.", kind: "set", items: (d) => advItems(d, ["bc", "je"], 6) },
    { id: "adv-nf6", title: "Exploitation Denied", desc: "Defeat both adversaries from Nature Incarnate and Promo Pack 2 on level 6.", kind: "set", items: (d) => advItems(d, ["ni", "feather"], 6) },
    { id: "all-bc", title: "Diversify", desc: "Defeat the adversary and win every scenario in Branch and Claw.", kind: "set", items: (d) => advItems(d, ["bc"], null).concat(scnItems(d, ["bc"])) },
    { id: "all-je", title: "Let us not Falter", desc: "Defeat both adversaries and win every scenario in Jagged Earth.", kind: "set", items: (d) => advItems(d, ["je"], null).concat(scnItems(d, ["je"])) },
    { id: "all-nf", title: "Nature in All Its Forms", desc: "Defeat both adversaries and win every scenario in Nature Incarnate and Promo Pack 2.", kind: "set", items: (d) => advItems(d, ["ni", "feather"], null).concat(scnItems(d, ["ni", "featherScn"])) },
    { id: "scn-core", title: "The Spice of Life", desc: "Win every core game scenario.", kind: "set", items: (d) => scnItems(d, ["core"]) },

    { id: "combo", title: "Partnership Shunned", desc: "Win a game against two adversaries combined.", kind: "flag", test: c => c.wins.some(m => m.adversary1 && m.adversary2) },
    { id: "combo6", title: "Alliance Forsaken", desc: "Win a game against two adversaries, both on level 6.", kind: "flag", test: c => c.wins.some(m => m.adversary1 && m.adversary2 && Number(m.adversary1Level) === 6 && Number(m.adversary2Level) === 6) },

    { id: "asp-je", title: "Everything Old is New Again", desc: "Win with each aspect from Jagged Earth.", kind: "set", items: (d) => aspectItems(d, ["je"]) },
    { id: "asp-feather", title: "Return to the Roots", desc: "Win with each aspect from Promo Pack 2.", kind: "set", items: (d) => aspectItems(d, ["feather"]) },
    { id: "asp-ni", title: "Transformations of Nature", desc: "Win with each aspect from Nature Incarnate.", kind: "set", items: (d) => aspectItems(d, ["ni"]) }
  ];

  // Item lists carry the owned filter. d = { data, ownedOnly }.
  function spiritItems(d, groups) {
    return (d.data.spirits || []).filter(s => inExp(s, groups) && (!d.ownedOnly || s.owned)).map(s => ({ key: "sp:" + s.name, label: s.name }));
  }
  function advItems(d, groups, level) {
    return (d.data.adversaries || []).filter(a => inExp(a, groups) && (!d.ownedOnly || a.owned)).map(a => ({ key: "adv:" + a.name + ":" + (level === null ? "any" : level), label: short(a.name) + (level === null ? "" : " L" + level) }));
  }
  function scnItems(d, groups) {
    return (d.data.scenarios || []).filter(s => inExp(s, groups) && (!d.ownedOnly || s.owned)).map(s => ({ key: "scn:" + s.name, label: s.name }));
  }
  function aspectItems(d, groups) {
    const owned = new Map((d.data.spirits || []).map(s => [s.name, !!s.owned]));
    return (d.data.aspects || []).filter(a => inExp(a, groups) && (!d.ownedOnly || owned.get(a.spirit))).map(a => ({ key: "asp:" + a.spirit + "|" + a.name, label: a.name }));
  }

  function context(data) {
    const wins = (data.matches || []).filter(m => m.victory);
    const got = new Set();
    let maxDiff = 0;
    wins.forEach(m => {
      maxDiff = Math.max(maxDiff, Number(m.difficulty) || 0);
      (m.players || []).forEach(p => {
        if (p.spirit) got.add("sp:" + p.spirit);
        if (p.spirit && p.aspect && p.aspect !== "Base") got.add("asp:" + p.spirit + "|" + p.aspect);
      });
      [[m.adversary1, m.adversary1Level], [m.adversary2, m.adversary2Level]].forEach(([name, lvl]) => {
        if (!name) return;
        got.add("adv:" + name + ":any");
        if (lvl !== null && lvl !== "" && lvl !== undefined) got.add("adv:" + name + ":" + Number(lvl));
      });
      if (m.scenario) got.add("scn:" + m.scenario);
    });
    return { wins, got, maxDiff };
  }

  // Returns { items: [{ id, title, desc, done, have, need, missing[], note }], done, total }
  function compute(data, opts = {}) {
    const ownedOnly = opts.ownedOnly !== false;
    const c = context(data || { matches: [] });
    const d = { data: data || {}, ownedOnly };
    const items = [];
    DEFS.forEach(def => {
      if (def.kind === "flag") {
        items.push({ id: def.id, title: def.title, desc: def.desc, done: !!def.test(c), have: 0, need: 0, missing: [], note: "" });
      } else if (def.kind === "diff") {
        items.push({ id: def.id, title: def.title, desc: def.desc, done: c.maxDiff >= def.need, have: 0, need: 0, missing: [], note: c.maxDiff > 0 ? `Best win: difficulty ${c.maxDiff}` : "" });
      } else {
        const list = def.items(d);
        if (!list.length) return;           // nothing owned for this set
        const missing = list.filter(i => !c.got.has(i.key)).map(i => i.label);
        items.push({ id: def.id, title: def.title, desc: def.desc, done: missing.length === 0, have: list.length - missing.length, need: list.length, missing, note: "" });
      }
    });
    return { items, done: items.filter(i => i.done).length, total: items.length };
  }

  return { compute, DEFS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SICampaign;
