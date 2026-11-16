// ==========================================================================
// Achievements: one wide card per spirit on both sub-tabs
// (Mastery = campaign achievements strip + general, adversary levels, scenarios and aspects; Synergy).
// Card effects play when a card scrolls into view, so a milestone is
// celebrated at the moment you can actually see it.
// ==========================================================================
const ACH_SORT_KEY = "si_ach_sort";
const ACH_HIDE_KEY = "si_ach_hide_empty";
const ACH_SEEN_KEY = "si_ach_seen";
const ACH_FALLBACK_ART = "assets/spirits/volcano_looming_high.png";
// Mastery = general + adversary levels + scenarios (one card). Synergy is its own tab.
const ACH_CATEGORY = { mastery: ["g", "a", "s"], synergy: ["t"] };

const achOpen = new Set();      // "tab|Spirit" for cards whose details are open
const achCounted = new Set();   // "tab|Spirit" already revealed this session (no replay on re-sort)
const achFx = new Map();        // card key -> { cur, fresh, prior }
let achObserver = null;

function achReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function readAchPrefs() {
  let sort = "mastery-desc", hideEmpty = false;
  try {
    const sv = localStorage.getItem(ACH_SORT_KEY);
    if (["mastery-desc", "mastery-asc", "name"].includes(sv)) sort = sv;
    hideEmpty = localStorage.getItem(ACH_HIDE_KEY) === "1";
  } catch (e) { /* storage blocked: defaults */ }
  return { sort, hideEmpty };
}
function saveAchPref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

function sortSpiritsForAch(list, ach, mode) {
  const pct = s => ach.spiritCompletion[s.name]?.pct || 0;
  const byName = (a, b) => a.name.localeCompare(b.name);
  return list.slice().sort((a, b) => {
    if (mode === "name") return byName(a, b);
    if (mode === "mastery-asc") return (pct(a) - pct(b)) || byName(a, b);
    return (pct(b) - pct(a)) || byName(a, b);
  });
}

function compactAdvName(name) {
  const short = String(name).replace(/^The (Kingdom|Tsardom) of /, "").replace(/^The /, "");
  if (short === "Brandenburg-Prussia") return "Prussia";
  if (short === "Habsburg Monarchy") return "Habsburg";
  if (short === "Habsburg Mining Expedition") return "Mining Exp.";
  return short;
}

// ---- Which milestones has the user already seen? -------------------------
// Ids: g:win, g:d1..g:d10, g:s40, a:<adversary>:<level>, s:<scenario>, t:<teammate>
function achIdsFor(rec) {
  const ids = [];
  if (rec.wonAny) ids.push("g:win");
  for (let d = 1; d <= 10; d++) if (rec.maxDiffWon >= d) ids.push("g:d" + d);
  if (rec.maxScoreWon >= 40) ids.push("g:s40");
  Object.keys(rec.advMaxLevel).forEach(a => {
    for (let l = 0; l <= rec.advMaxLevel[a]; l++) ids.push(`a:${a}:${l}`);
  });
  rec.scenariosWon.forEach(s => ids.push("s:" + s));
  rec.teammatesWon.forEach(t => ids.push("t:" + t));
  return ids;
}

function achFxKey(id) { return id.startsWith("a:") ? id.slice(0, id.lastIndexOf(":")) : id; }

function achLabel(id) {
  if (id === "g:win") return "First victory";
  if (id === "g:s40") return "Score 40+ win";
  if (id.startsWith("g:d")) return `Difficulty ${id.slice(3)}+ win`;
  if (id.startsWith("a:")) {
    const i = id.lastIndexOf(":");
    return `${compactAdvName(id.slice(2, i))} level ${id.slice(i + 1)}`;
  }
  if (id.startsWith("s:")) return id.slice(2);
  if (id.startsWith("t:")) return "Won with " + id.slice(2);
  return id;
}

function readAchSeen() {
  try {
    const raw = localStorage.getItem(ACH_SEEN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch (e) { return null; }
}
function writeAchSeen(obj) {
  try { localStorage.setItem(ACH_SEEN_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
}
// First ever visit: everything already unlocked counts as seen, so history does not replay.
function ensureAchSeen() {
  let seen = readAchSeen();
  if (seen) return seen;
  seen = {};
  try {
    const all = SIAnalytics.computeAchievements(appData, { ownedOnly: false });
    Object.keys(all.bySpirit).forEach(name => { seen[name] = achIdsFor(all.bySpirit[name]); });
  } catch (e) { seen = {}; }
  writeAchSeen(seen);
  return seen;
}

// ---- Card building blocks --------------------------------------------------
function achRingHtml(comp) {
  const pct = Math.max(0, Math.min(100, comp.pct || 0));
  const shown = Math.round(pct);
  return `
    <div class="ach-ring-wrap">
      <div class="ach-ring" style="--p:${pct.toFixed(1)}" data-pct="${pct.toFixed(1)}" role="img" aria-label="Overall mastery ${shown} percent"><span>${shown}%</span></div>
      <div class="ach-ring-label">Mastery</div>
    </div>`;
}

// Profile picture: the same artwork crop used on the Spirits tab, so it stays sharp.
function achAvatar(s) {
  if (!s || !s.image) return "";
  return `<span class="ach-avatar"><img src="${escapeHtml(s.image)}" alt="" loading="lazy" decoding="async" style="${getFocalStyle(s)}" onerror="this.onerror=null;this.src='${ACH_FALLBACK_ART}'"></span>`;
}

function achHero(s, comp) {
  const asleep = !(comp.unlocked > 0);
  return `
    <header class="ach-hero">
      ${achAvatar(s)}
      <div class="ach-hero-text">
        <h4 class="ach-name">${escapeHtml(s.name)}</h4>
        ${s.expansion ? `<div class="ach-sub">${escapeHtml(s.expansion)}</div>` : ""}
        <div class="ach-sub">${asleep ? "Not yet awakened" : `${comp.unlocked} of ${comp.possible} milestones`}</div>
      </div>
      ${achRingHtml(comp)}
    </header>`;
}

function achDetails(key, inner) {
  return `
    <details class="ach-details" data-key="${escapeHtml(key)}"${achOpen.has(key) ? " open" : ""}>
      <summary>Breakdown</summary>
      <div class="ach-detail"><template>${inner}</template></div>
    </details>`;
}

function achBlock(title, count, inner) {
  return `
    <div class="ach-summary">
      <div class="ach-summary-label"><span>${title}</span><strong>${count}</strong></div>
      ${inner}
    </div>`;
}

function achGeneralPart(rec) {
  const diffs = Array.from({ length: 10 }, (_, i) => rec.maxDiffWon >= i + 1);
  const items = [rec.wonAny, ...diffs, rec.maxScoreWon >= 40];
  const fxKeys = ["g:win", ...diffs.map((_, i) => "g:d" + (i + 1)), "g:s40"];
  const labels = ["Win a game", ...diffs.map((_, i) => `Win a difficulty ${i + 1}+ game`), "Win with a score of 40+"];
  const done = items.filter(Boolean).length;
  const best = rec.maxScoreWon > 0 ? SIAnalytics.formatNum(rec.maxScoreWon, 0) : "none yet";
  const summary = achBlock("General milestones", `${done} / 12`,
    `<div class="ach-pips" aria-hidden="true">${items.map((on, i) => `<span class="ach-pip${on ? " on" : ""}" data-fx="${fxKeys[i]}" title="${escapeHtml(labels[i])}"></span>`).join("")}</div>`);
  const detail = `
    <div class="ach-detail-group">
      <h5 class="ach-detail-h">General</h5>
      <div class="ach-row"><span>Win a game</span><span class="ach-status${rec.wonAny ? " on" : ""}">${rec.wonAny ? "✔ Done" : "Not yet"}</span></div>
      <div class="ach-block">
        <div class="ach-block-label"><span>Highest difficulty won</span><strong>${rec.maxDiffWon > 0 ? rec.maxDiffWon : "none yet"}</strong></div>
        <div class="ach-levels l5" role="list">${diffs.map((on, i) => `<span class="ach-lvl${on ? " on" : ""}" data-fx="g:d${i + 1}" role="listitem" title="Difficulty ${i + 1}+" aria-label="Difficulty ${i + 1}: ${on ? "won" : "not yet"}">${i + 1}</span>`).join("")}</div>
      </div>
      <div class="ach-row"><span>Win with a score of 40+</span><span class="ach-status${items[11] ? " on" : ""}">${items[11] ? "✔ Done" : "Best " + best}</span></div>
    </div>`;
  return { summary, detail };
}

function achAdversaryPart(rec, pool) {
  const advs = pool.advs;
  const cleared = advs.reduce((n, a) => n + Math.max(0, (rec.advMaxLevel[a.name] ?? -1) + 1), 0);
  const grid = advs.map(a => {
    const mx = rec.advMaxLevel[a.name] ?? -1;
    const on = mx >= 0;
    return `<div class="ach-adv${on ? " on" : ""}" data-fx="a:${escapeHtml(a.name)}" title="${escapeHtml(a.name)}: ${on ? "highest level cleared " + mx : "not cleared yet"}">${advIcon(a, 20, 14)}<span class="nm">${escapeHtml(compactAdvName(a.name))}</span><b>${on ? "L" + mx : "—"}</b></div>`;
  }).join("");
  const summary = achBlock("Adversary levels cleared", `${cleared} / ${advs.length * 7}`, `<div class="ach-adv-grid">${grid}</div>`);
  const rows = advs.map(a => {
    const mx = rec.advMaxLevel[a.name] ?? -1;
    const g = rec.advGames[a.name] || 0, w = rec.advWins[a.name] || 0;
    const rate = g ? `${g} ${g === 1 ? "game" : "games"} · ${Math.round((w / g) * 100)}% won` : "No games";
    const cells = Array.from({ length: 7 }, (_, l) => `<span class="ach-lvl${mx >= l ? " on" : ""}" role="listitem" title="Level ${l}" aria-label="Level ${l}: ${mx >= l ? "cleared" : "not yet"}">${l}</span>`).join("");
    return `
      <div class="ach-block">
        <div class="ach-block-label"><span class="ach-block-name">${advIcon(a, 20, 14)}${escapeHtml(compactAdvName(a.name))}</span><span>${rate}</span></div>
        <div class="ach-levels l7" role="list">${cells}</div>
      </div>`;
  }).join("");
  return { summary, detail: `<div class="ach-detail-group"><h5 class="ach-detail-h">Adversary levels (0 to 6)</h5>${rows}</div>` };
}

function achScenarioPart(rec, pool) {
  const scs = pool.scenarios;
  const done = scs.filter(sc => rec.scenariosWon.has(sc.name)).length;
  const strip = scs.map(sc => {
    const on = rec.scenariosWon.has(sc.name);
    return `<span class="ach-scn${on ? " on" : ""}" data-fx="s:${escapeHtml(sc.name)}" title="${escapeHtml(sc.name)}: ${on ? "won" : "not yet"}">${scenIcon(sc, 24)}</span>`;
  }).join("");
  const summary = achBlock("Scenarios won", `${done} / ${scs.length}`, `<div class="ach-scn-strip">${strip}</div>`);
  const rows = scs.map(sc => {
    const on = rec.scenariosWon.has(sc.name);
    return `<div class="ach-row"><span>${escapeHtml(sc.name)} <small>(difficulty ${sc.difficulty >= 0 ? "+" : ""}${sc.difficulty})</small></span><span class="ach-status${on ? " on" : ""}">${on ? "✔ Won" : "Not yet"}</span></div>`;
  }).join("");
  return { summary, detail: `<div class="ach-detail-group"><h5 class="ach-detail-h">Scenarios</h5>${rows || `<p class="ach-empty">No scenarios in your collection.</p>`}</div>` };
}

// Aspects belong to a spirit, so they sit on its card (tried / not tried, with the record).
function achAspectPart(s, pool) {
  const list = (pool.aspectsBySpirit && pool.aspectsBySpirit[s.name]) || [];
  if (!list.length) return { summary: "", detail: "" };
  const tried = list.filter(r => r.gamesPlayed > 0).length;
  const chips = list.map(r => `<span class="ach-asp${r.gamesPlayed > 0 ? " on" : ""}" title="${escapeHtml(r.name)}: ${r.gamesPlayed ? r.gamesPlayed + " games" : "not played yet"}">${r.gamesPlayed > 0 ? "◆" : "◇"} ${escapeHtml(r.name)}</span>`).join("");
  const summary = achBlock("Aspects tried", `${tried} / ${list.length}`, `<div class="ach-asp-strip">${chips}</div>`);
  const rows = list.map(r => `<div class="ach-row"><span>${escapeHtml(r.name)}</span><span class="ach-status${r.gamesPlayed > 0 ? " on" : ""}">${r.gamesPlayed > 0 ? `${r.gamesPlayed}g · ${r.winRate !== null ? Math.round(r.winRate) + "% won" : "no result"}` : "Not played"}</span></div>`).join("");
  return { summary, detail: `<div class="ach-detail-group"><h5 class="ach-detail-h">Aspects</h5>${rows}</div>` };
}

function achMasteryBody(s, rec, pool) {
  const parts = [achGeneralPart(rec), achAdversaryPart(rec, pool), achScenarioPart(rec, pool), achAspectPart(s, pool)];
  return { summary: parts.map(p => p.summary).join(""), detail: parts.map(p => p.detail).join("") };
}

// Spirit synergy grid: rows are the teammate you won WITH, columns are the spirit you played.
function achSynergyGrid(spirits, ach) {
  if (!spirits.length) return `<p class="ach-empty">No spirits to show. Try turning off \u201cHide spirits with nothing unlocked\u201d or \u201cShow owned spirits only\u201d.</p>`;
  const thumb = (sp) => sp && sp.image
    ? `<span class="ach-spirit-thumb"><img src="${escapeHtml(sp.image)}" alt="" loading="lazy" style="${getFocalStyle(sp)}" onerror="this.onerror=null;this.src='${ACH_FALLBACK_ART}'"></span>` : "";
  const head = spirits.map(sp => `
      <th class="rotate-header" title="${escapeHtml(sp.name)}">
        <span class="ach-header-inner">${thumb(sp)}<span>${escapeHtml(sp.name.length > 30 ? sp.name.slice(0, 28) + "\u2026" : sp.name)}</span></span>
      </th>`).join("");
  const rows = spirits.map(rowSp => `
      <tr>
        <td style="font-weight:600;white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:0.45rem;">${thumb(rowSp)} Win with ${escapeHtml(rowSp.name)}</span></td>
        ${spirits.map(colSp => {
          if (rowSp.name === colSp.name) return `<td style="text-align:center;color:var(--text-muted);">\u2014</td>`;
          const done = ach.bySpirit[colSp.name]?.teammatesWon.has(rowSp.name);
          return `<td style="text-align:center;"><span class="ach-cell ${done ? "ach-done" : "ach-todo"}" aria-label="${done ? "won together" : "not yet"}">${done ? "\ud83e\udd1d" : "\u00b7"}</span></td>`;
        }).join("")}
      </tr>`).join("");
  return `
    <p class="ach-count" role="status">Showing ${spirits.length} ${spirits.length === 1 ? "spirit" : "spirits"}</p>
    <div class="table-wrap">
      <table class="data-table matrix-table">
        <thead><tr><th>Teammate spirit combination</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function achCard(s, ach, tab, pool, seen) {
  const rec = ach.bySpirit[s.name];
  if (!rec) return "";
  const comp = ach.spiritCompletion[s.name] || { pct: 0, unlocked: 0, possible: 0 };
  const key = `${tab}|${s.name}`;
  const cats = ACH_CATEGORY[tab] || ACH_CATEGORY.mastery;
  const cur = achIdsFor(rec).filter(id => cats.some(c => id.startsWith(c + ":")));
  const seenList = Array.isArray(seen[s.name]) ? seen[s.name] : [];
  const seenSet = new Set(seenList);
  const fresh = cur.filter(id => !seenSet.has(id));
  achFx.set(key, { name: s.name, cur, fresh, prior: seenList.length });

  const body = achMasteryBody(s, rec, pool);
  const asleep = !(comp.unlocked > 0);
  const pre = !achCounted.has(key) && "IntersectionObserver" in window && !achReducedMotion();
  return `
    <article class="ach-card${asleep ? " asleep" : ""}${pre ? " pre" : ""}" data-spirit="${escapeHtml(s.name)}" data-fxkey="${escapeHtml(key)}">
      ${achHero(s, comp)}
      <div class="ach-newline" role="status" hidden></div>
      ${achDetails(key, body.summary + body.detail)}
    </article>`;
}


// ---- Campaign achievements (Steam-style, across all spirits) ----------------
const ACH_CAMPAIGN_SEEN_KEY = "si_ach_seen_campaign";
// Open on desktop; collapsed on phones so the spirit cards stay in reach.
let campOpen = !(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);

function readCampaignSeen() {
  try {
    const raw = localStorage.getItem(ACH_CAMPAIGN_SEEN_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch (e) { return null; }
}
function writeCampaignSeen(ids) {
  try { localStorage.setItem(ACH_CAMPAIGN_SEEN_KEY, JSON.stringify(Array.from(new Set(ids)))); } catch (e) { /* ignore */ }
}
// First ever visit: everything already unlocked counts as seen, so history does not replay.
function ensureCampaignSeen() {
  let seen = readCampaignSeen();
  if (seen) return seen;
  try { seen = SICampaign.compute(appData, { ownedOnly: false }).items.filter(i => i.done).map(i => i.id); } catch (e) { seen = []; }
  writeCampaignSeen(seen);
  return seen;
}
function markCampaignSeen(ids) { writeCampaignSeen((readCampaignSeen() || []).concat(ids)); }

function campTile(it, isNew) {
  let status;
  if (it.done) status = `<span class="camp-status ok">Unlocked</span>`;
  else if (it.need) {
    const pct = Math.round((it.have / it.need) * 100);
    const names = it.missing.slice(0, 3).map(escapeHtml).join(", ") + (it.missing.length > 3 ? ` +${it.missing.length - 3} more` : "");
    status = `
      <div class="camp-bar" role="img" aria-label="${it.have} of ${it.need}"><span style="width:${pct}%"></span></div>
      <div class="camp-count">${it.have} / ${it.need}</div>
      <div class="camp-missing">Left: ${names}</div>`;
  } else status = `<span class="camp-status">${it.note ? escapeHtml(it.note) : "Not yet"}</span>`;
  return `
    <li class="camp-tile ${it.done ? "done" : "todo"}${isNew ? " is-new" : ""}" data-camp="${it.id}">
      <div class="camp-title">${escapeHtml(it.title)}${isNew ? ` <span class="camp-new-tag" hidden>New</span>` : ""}</div>
      <div class="camp-desc">${escapeHtml(it.desc)}</div>
      ${status}
    </li>`;
}

function achCampaignHtml(ownedOnly) {
  const res = SICampaign.compute(getStatsData(), { ownedOnly });
  if (!res.total) return "";
  const seen = new Set(ensureCampaignSeen());
  // "New" means done even when every expansion counts, so switching the owned-only toggle never fakes an unlock.
  const strictDone = new Set(SICampaign.compute(getStatsData(), { ownedOnly: false }).items.filter(i => i.done).map(i => i.id));
  const fresh = new Set(res.items.filter(i => i.done && strictDone.has(i.id) && !seen.has(i.id)).map(i => i.id));
  // Unlocked first would hide what is left to do, so keep the Steam-like order and let the bar show progress.
  return `
    <details class="ach-campaign" id="achCampaign"${campOpen ? " open" : ""}>
      <summary>
        <span class="camp-head">Campaign achievements</span>
        <span class="camp-total">${res.done} / ${res.total}</span>
      </summary>
      <p class="camp-note">Group goals across every spirit, modeled on the Steam version. They follow the Player Stats filter and the owned-only toggle.</p>
      <ul class="camp-grid">${res.items.map(i => campTile(i, fresh.has(i.id))).join("")}</ul>
    </details>`;
}

function playCampaignNew(box) {
  const tiles = box.querySelectorAll(".camp-tile.is-new");
  if (!tiles.length) return;
  const ids = [];
  tiles.forEach(t => {
    ids.push(t.getAttribute("data-camp"));
    t.classList.remove("is-new");
    t.classList.add("fx-new");
    const tag = t.querySelector(".camp-new-tag"); if (tag) tag.hidden = false;
  });
  markCampaignSeen(ids);
}

function bindCampaign(container) {
  const box = container.querySelector("#achCampaign");
  if (!box) return;
  const hasNew = () => box.querySelector(".camp-tile.is-new");
  let visible = false;
  const tryPlay = () => { if (box.open && visible && hasNew()) playCampaignNew(box); };
  box.addEventListener("toggle", () => { campOpen = box.open; tryPlay(); });
  if (!hasNew()) return;
  if (!("IntersectionObserver" in window)) { visible = true; tryPlay(); return; }
  const io = new IntersectionObserver((entries) => {
    visible = entries.some(e => e.isIntersecting);
    if (visible) tryPlay();
  }, { threshold: 0.3 });
  io.observe(box);
}

function renderAchievementCards(ach, spirits, pool, totalBeforeHide) {
  if (!spirits.length) {
    return `<p class="ach-empty">No spirits to show. Try turning off “Hide spirits with nothing unlocked” or “Show owned spirits only”.</p>`;
  }
  const count = spirits.length === totalBeforeHide
    ? `Showing ${spirits.length} ${spirits.length === 1 ? "spirit" : "spirits"}`
    : `Showing ${spirits.length} of ${totalBeforeHide} spirits`;
  const seen = ensureAchSeen();
  achFx.clear();
  return `
    <p class="ach-count" role="status">${count}</p>
    <div class="ach-grid">${spirits.map(s => achCard(s, ach, currentAchievementSubtab, pool, seen)).join("")}</div>`;
}

function updateExpandAllLabel() {
  const btn = document.getElementById("achExpandAllBtn");
  if (!btn) return;
  const cards = document.querySelectorAll("#achievementsMatrixContainer details.ach-details");
  const allOpen = cards.length > 0 && Array.from(cards).every(d => d.open);
  btn.textContent = allOpen ? "Collapse all" : "Expand all";
}

// ---- Effects -----------------------------------------------------------------
function achCountUp(card) {
  const ring = card.querySelector(".ach-ring");
  const label = ring && ring.querySelector("span");
  if (!ring || !label || achReducedMotion()) return;
  const target = Number(ring.getAttribute("data-pct")) || 0;
  if (target <= 0) return;
  const t0 = performance.now();
  ring.style.setProperty("--p", "0");
  label.textContent = "0%";
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 800);
    const e = 1 - Math.pow(1 - k, 3);
    ring.style.setProperty("--p", (target * e).toFixed(1));
    label.textContent = Math.round(target * e) + "%";
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function playAchNew(card, fx) {
  const keys = new Set(fx.fresh.map(achFxKey));
  card.classList.add("fx-new");
  if (fx.prior === 0) {
    card.classList.remove("asleep");
    card.classList.add("waking");
  }
  card.querySelectorAll("[data-fx]").forEach(el => {
    if (keys.has(el.getAttribute("data-fx"))) el.classList.add("fx-pop");
  });
  const line = card.querySelector(".ach-newline");
  if (line) {
    const labels = fx.fresh.map(achLabel);
    const shown = labels.slice(0, 4).join(" · ");
    line.textContent = `New: ${shown}${labels.length > 4 ? ` · +${labels.length - 4} more` : ""}`;
    line.hidden = false;
  }
  const seen = readAchSeen() || {};
  seen[fx.name] = Array.from(new Set([...(seen[fx.name] || []), ...fx.cur]));
  writeAchSeen(seen);
}

function revealAchCard(card) {
  const key = card.getAttribute("data-fxkey");
  card.classList.remove("pre");
  if (!achCounted.has(key)) { achCounted.add(key); achCountUp(card); }
  const fx = achFx.get(key);
  if (fx && fx.fresh.length) playAchNew(card, fx);
}

function observeAchievementCards(container) {
  if (achObserver) { achObserver.disconnect(); achObserver = null; }
  const cards = container.querySelectorAll(".ach-card");
  if (!("IntersectionObserver" in window)) { cards.forEach(revealAchCard); return; }
  let queued = 0, resetTimer = null;
  achObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      // Reveal once the picture is on screen (cards are taller than the viewport can show at once).
      const seenEnough = en.intersectionRatio >= 0.45 || en.intersectionRect.height >= 150;
      if (!en.isIntersecting || !seenEnough) return;
      achObserver.unobserve(en.target);
      const delay = achReducedMotion() ? 0 : queued++ * 120;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { queued = 0; }, 700);
      setTimeout(() => revealAchCard(en.target), delay);
    });
  }, { threshold: [0.05, 0.2, 0.45, 0.8] });
  cards.forEach(c => achObserver.observe(c));
}

// Slight parallax on the art, mouse only (skipped on touch and with reduced motion).
function fillAchDetails(d) {
  const box = d.querySelector(".ach-detail");
  const tpl = box && box.querySelector("template");
  if (tpl) { box.appendChild(tpl.content.cloneNode(true)); tpl.remove(); }
}

function bindAchievementCards(container) {
  container.querySelectorAll("details.ach-details").forEach(d => {
    if (d.open) fillAchDetails(d);
    d.addEventListener("toggle", () => {
      const key = d.getAttribute("data-key");
      if (d.open) { achOpen.add(key); fillAchDetails(d); } else achOpen.delete(key);
      updateExpandAllLabel();
    });
  });
  updateExpandAllLabel();
  observeAchievementCards(container);
}

function renderAchievementMatrixContent(ach) {
  const container = document.getElementById("achievementsMatrixContainer");
  if (!container) return;

  const ownedOnly = document.getElementById("achOwnedOnlyToggle")?.checked ?? true;
  const prefs = readAchPrefs();
  const pool = {
    spirits: (appData.spirits || []).filter(s => !ownedOnly || s.owned),
    advs: (appData.adversaries || []).filter(a => !ownedOnly || a.owned),
    scenarios: (appData.scenarios || []).filter(sc => !ownedOnly || sc.owned),
    aspectsBySpirit: {}
  };
  SIAnalytics.computeAspectStats(getStatsData()).filter(r => !r.isBase).forEach(r => {
    (pool.aspectsBySpirit[r.spirit] = pool.aspectsBySpirit[r.spirit] || []).push(r);
  });
  let spirits = pool.spirits;
  const totalBeforeHide = spirits.length;
  if (prefs.hideEmpty) spirits = spirits.filter(s => (ach.spiritCompletion[s.name]?.unlocked || 0) > 0);
  spirits = sortSpiritsForAch(spirits, ach, prefs.sort);

  const grid = currentAchievementSubtab === "synergy";
  const expandBtn = document.getElementById("achExpandAllBtn");
  if (expandBtn) expandBtn.hidden = grid;
  container.classList.toggle("ach-flat", !grid);
  if (grid) {
    if (achObserver) { achObserver.disconnect(); achObserver = null; }
    container.innerHTML = achSynergyGrid(spirits, ach);
    return;
  }
  container.innerHTML = achCampaignHtml(ownedOnly) + renderAchievementCards(ach, spirits, pool, totalBeforeHide);
  bindCampaign(container);
  bindAchievementCards(container);
}
