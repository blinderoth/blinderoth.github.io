// Spirit Realm: the read-only story page. Loads the same campaign data as the tracker,
// keeps the shared time window, the Journal/Night theme, and the chapter list.
// Classic script: uses appData, escapeHtml and mergeReferenceData from js/core.

// This page only reads. mergeReferenceData() normally saves the tracker's local copy; here that is switched off.
saveLocal = function () {};

const Realm = (() => {
  const THEME_KEY = "si_realm_theme";
  const chapters = [];          // { id, render(ctx) }
  let games = [];               // all matches, oldest first
  let range = { from: 0, to: -1 };
  let source = "";
  let queued = false;

  // ---------- data ----------
  function fromPayload(p) {
    const full = JSON.parse(JSON.stringify(window.DEFAULT_CAMPAIGN_DATA));
    full.lastUpdated = p.lastUpdated;
    full.players = p.players || full.players;
    const exp = new Map((p.expansions || []).map(e => [e.name, e]));
    full.expansions = (full.expansions || []).map(e => exp.has(e.name) ? Object.assign({}, e, { owned: exp.get(e.name).owned }) : e);
    full.spirits = p.spirits || [];
    full.adversaries = p.adversaries || [];
    full.scenarios = p.scenarios || [];
    full.aspects = p.aspects || [];
    full.matches = p.matches || [];
    return full;
  }

  async function load() {
    let local = null, remote = null;
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) local = JSON.parse(s); } catch (e) { local = null; }
    try {
      const res = await fetch(`data/save.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) remote = fromPayload(await res.json());
    } catch (e) { remote = null; }

    // The newest copy wins: an editing device may hold games the repo has not received yet.
    const t = d => (d && d.lastUpdated) ? Date.parse(d.lastUpdated) || 0 : 0;
    if (local && (!remote || t(local) >= t(remote))) { appData = local; source = remote ? "this browser (newer than the shared copy)" : "this browser"; }
    else if (remote) { appData = remote; source = "the shared campaign file"; }
    else { appData = JSON.parse(JSON.stringify(window.DEFAULT_CAMPAIGN_DATA)); source = "the starter data"; }
    mergeReferenceData();

    games = (appData.matches || []).slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || (Number(a.id) || 0) - (Number(b.id) || 0));
    range = { from: 0, to: games.length - 1 };
  }

  // ---------- time window ----------
  function windowData() {
    return Object.assign({}, appData, { matches: games.slice(range.from, range.to + 1) });
  }
  function isAllTime() { return range.from === 0 && range.to === games.length - 1; }
  function setRange(from, to) {
    from = Math.max(0, Math.min(from, games.length - 1));
    to = Math.max(from, Math.min(to, games.length - 1));
    if (from === range.from && to === range.to) return;
    range = { from, to };
    schedule();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderAll(); });
  }

  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  function renderChip() {
    const chip = document.getElementById("windowChip");
    if (!chip) return;
    if (!games.length) { chip.textContent = "No games yet"; return; }
    const n = range.to - range.from + 1;
    const a = games[range.from], b = games[range.to];
    chip.innerHTML = isAllTime()
      ? `<span>All time</span><b>${n} ${n === 1 ? "game" : "games"}</b>`
      : `<span>${escapeHtml(fmtDate(a.date))} – ${escapeHtml(fmtDate(b.date))}</span><b>${n} ${n === 1 ? "game" : "games"}</b><button type="button" id="windowReset">All time</button>`;
    document.getElementById("windowReset")?.addEventListener("click", () => setRange(0, games.length - 1));
  }

  // ---------- theme ----------
  function theme() { return document.documentElement.getAttribute("data-realm") === "night" ? "night" : "journal"; }
  function setTheme(t) {
    const apply = () => {
      document.documentElement.setAttribute("data-realm", t);
      try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage blocked */ }
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "night" ? "#0B120D" : "#EADCBD");
      syncToggle();
      renderAll();
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(apply); else apply();
  }
  function syncToggle() {
    document.querySelectorAll(".mode-toggle button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === theme())));
  }

  // Colours come from the active theme's CSS variables, so every chart re-dresses itself on a theme switch.
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hexToRgb(h) { const m = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)); }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }
  // Win rate 0..100 -> loss colour, through the middle colour, to the win colour
  function rateColor(rate) {
    if (rate === null || rate === undefined || isNaN(rate)) return cssVar("--muted");
    const lo = cssVar("--loss"), mid = cssVar("--mid"), hi = cssVar("--win");
    return rate < 50 ? mix(lo, mid, rate / 50) : mix(mid, hi, (rate - 50) / 50);
  }

  // ---------- chapters ----------
  function register(id, render) { chapters.push({ id, render }); }
  function renderAll() {
    renderChip();
    const ctx = { all: appData, games, range, data: windowData(), theme: theme(), rateColor, cssVar, fmtDate, setRange, isAllTime: isAllTime() };
    chapters.forEach(c => { try { c.render(ctx); } catch (e) { console.error(`Chapter ${c.id} failed`, e); } });
  }

  function buildRail() {
    const rail = document.getElementById("chapterRail");
    const secs = Array.from(document.querySelectorAll("section.chapter"));
    secs.forEach((s, i) => { const n = s.querySelector(".chapter-num"); if (n) n.textContent = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][i] || String(i + 1); });
    if (!rail) return;
    rail.innerHTML = secs.map((s, i) => `<a href="#${s.id}" data-for="${s.id}"><i>${["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][i]}</i><span>${escapeHtml(s.dataset.title || s.id)}</span></a>`).join("");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) rail.querySelectorAll("a").forEach(a => a.classList.toggle("on", a.dataset.for === en.target.id)); });
      }, { rootMargin: "-45% 0px -50% 0px" });
      secs.forEach(s => io.observe(s));
    }
  }

  function buildFireflies() {
    const box = document.querySelector(".fireflies");
    if (!box) return;
    box.innerHTML = Array.from({ length: 22 }, (_, k) => {
      const x = (k * 37.7) % 100, y = (k * 61.3) % 100;
      return `<span style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;animation-delay:${(k % 9) * 0.7}s;animation-duration:${5 + (k % 5)}s"></span>`;
    }).join("");
  }

  async function init() {
    syncToggle();
    document.querySelectorAll(".mode-toggle button").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.mode)));
    buildFireflies();
    buildRail();
    await load();

    const won = games.filter(m => m.victory).length;
    const sub = document.getElementById("heroSub");
    if (sub) sub.textContent = games.length
      ? `${games.length} invasions remembered · ${won} turned back · since ${fmtDate(games[0].date)}`
      : "No invasions yet. The island is waiting.";
    const src = document.getElementById("dataSource");
    if (src) src.textContent = `Read from ${source}${appData.lastUpdated ? `, last updated ${fmtDate(String(appData.lastUpdated).slice(0, 10))}` : ""}.`;

    renderAll();
    let w = window.innerWidth;
    window.addEventListener("resize", () => { if (Math.abs(window.innerWidth - w) > 30) { w = window.innerWidth; schedule(); } });
  }

  return { init, register, setRange, renderAll, rateColor, fmtDate, get games() { return games; } };
})();

document.addEventListener("DOMContentLoaded", () => Realm.init());
