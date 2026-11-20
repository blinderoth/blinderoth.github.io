// Content tab → Match-ups: Red's spirit vs adversary ratings as an interactive grid.
// Unowned spirits (and unowned adversaries) are greyed. Your own record vs each adversary is overlaid.
// Classic script: shares globals with the other files in js/core and js/views.

  const muState = { sort: null, dir: -1, aspects: true, ownedOnly: false, query: "", focus: null };
  const MU_GRADES = ["S", "A", "B", "C", "D", "F"];

  // Chart names differ slightly from the tracker's (case, a typo in the reference data), so match loosely
  function muKey(s) { return String(s || "").toLowerCase().replace(/vengenace/g, "vengeance").replace(/[^a-z]/g, ""); }

  function muRows() {
    const M = window.SI_MATCHUPS || SI_MATCHUPS;
    const spirits = new Map((appData.spirits || []).map(s => [muKey(s.name), s]));
    const advs = M.columns.map(([label, name]) => ({ label, name, adv: (appData.adversaries || []).find(a => a.name === name) }));
    const data = getStatsData();

    // Your record per spirit (+aspect) and adversary: wins and games
    const rec = new Map();
    (data.matches || []).forEach(m => {
      const foes = [m.adversary1, m.adversary2].filter(Boolean);
      (m.players || []).forEach(p => {
        if (!p.spirit) return;
        const asp = p.aspect && p.aspect !== "Base" ? p.aspect : "";
        foes.forEach(f => {
          [muKey(p.spirit) + "|" + muKey(asp), muKey(p.spirit) + "|*"].forEach(k => {
            const key = k + "|" + f;
            const e = rec.get(key) || { w: 0, g: 0 };
            e.g++; if (m.victory) e.w++;
            rec.set(key, e);
          });
        });
      });
    });

    const rows = [];
    M.groups.forEach((g, gi) => g.rows.forEach(([spirit, aspect, grades], ri) => {
      const sp = spirits.get(muKey(spirit));
      const cells = grades.split(/\s+/).map((tok, ci) => {
        const grade = tok[0];
        const r = rec.get(muKey(spirit) + "|" + muKey(aspect) + "|" + advs[ci].name);
        return { grade, star: tok.includes("*"), pts: M.points[grade], rec: r || null };
      });
      rows.push({
        group: gi, order: rows.length, spirit, aspect,
        name: sp ? sp.name : spirit, image: sp ? sp.image : "",
        owned: !!(sp && sp.owned), cells,
        sum: cells.reduce((t, c) => t + c.pts, 0)
      });
    }));
    return { M, advs, rows };
  }

  function muRecText(r) {
    if (!r) return "not played yet";
    return `your record: ${r.w} ${r.w === 1 ? "win" : "wins"} in ${r.g} ${r.g === 1 ? "game" : "games"}`;
  }

  function renderMatchups() {
    const box = document.getElementById("matchupsBody");
    if (!box || !(window.SI_MATCHUPS || typeof SI_MATCHUPS !== "undefined")) return;
    const { M, advs, rows: all } = muRows();
    const q = muState.query.trim().toLowerCase();

    let rows = all.filter(r =>
      (muState.aspects || !r.aspect) &&
      (!muState.ownedOnly || r.owned) &&
      (!q || (r.spirit + " " + r.aspect).toLowerCase().includes(q)));
    const sorted = muState.sort !== null;
    if (sorted) {
      const val = r => muState.sort === "sum" ? r.sum : r.cells[muState.sort].pts;
      rows = rows.slice().sort((a, b) => (muState.dir < 0 ? val(b) - val(a) : val(a) - val(b)) || b.sum - a.sum || a.order - b.order);
    }

    const head = `
      <tr>
        <th class="mu-spirit-h" scope="col">Spirit</th>
        ${advs.map((a, ci) => {
          const owned = !a.adv || a.adv.owned;
          const on = muState.sort === ci;
          return `<th scope="col" class="mu-adv-h${owned ? "" : " unowned"}${muState.focus === ci ? " focus" : ""}">
            <button type="button" class="mu-sort${on ? " on" : ""}" data-sort="${ci}" aria-label="Sort by ${escapeHtml(a.name)}${owned ? "" : " (not owned)"}" title="${escapeHtml(a.name)}${owned ? "" : " · not owned"}">
              ${a.adv ? advIcon(a.adv, 30, 20) : ""}<span>${escapeHtml(a.label)}</span>${on ? `<i aria-hidden="true">${muState.dir < 0 ? "▼" : "▲"}</i>` : ""}
            </button></th>`;
        }).join("")}
        <th scope="col" class="mu-sum-h"><button type="button" class="mu-sort${muState.sort === "sum" ? " on" : ""}" data-sort="sum" aria-label="Sort by total">Total${muState.sort === "sum" ? `<i aria-hidden="true">${muState.dir < 0 ? "▼" : "▲"}</i>` : ""}</button></th>
      </tr>`;

    let lastGroup = -1, lastSpirit = "";
    const body = rows.map(r => {
      let groupRow = "";
      if (!sorted && r.group !== lastGroup) {
        lastGroup = r.group;
        const g = M.groups[r.group];
        groupRow = `<tr class="mu-group"><th colspan="${advs.length + 2}" scope="rowgroup">${escapeHtml(g.label)} <span>${escapeHtml(g.note)}</span></th></tr>`;
      }
      const isAspect = !!r.aspect;
      if (!isAspect) lastSpirit = r.spirit;
      const label = isAspect
        ? `${sorted || r.spirit !== lastSpirit ? `<span class="mu-parent">${escapeHtml(r.name)}</span> ` : ""}<span class="mu-aspect">${escapeHtml(r.aspect)}</span>`
        : `${r.image ? `<img src="${escapeHtml(r.image)}" alt="" loading="lazy">` : ""}<span>${escapeHtml(r.name)}</span>`;
      return groupRow + `
        <tr class="mu-row${isAspect ? " is-aspect" : ""}${r.owned ? "" : " unowned"}">
          <th scope="row" class="mu-name"><button type="button" class="mu-open" data-spirit="${escapeHtml(r.name)}" data-aspect="${escapeHtml(r.aspect)}" title="${r.owned ? "Open the dossier" : "Not owned"}">${label}</button></th>
          ${r.cells.map((c, ci) => {
            const advOwned = !advs[ci].adv || advs[ci].adv.owned;
            const tip = `${r.name}${r.aspect ? ` (${r.aspect})` : ""} vs ${advs[ci].name}: ${c.grade}${c.star ? "*" : ""}, ${M.tiers[c.grade][0].toLowerCase()}${c.star ? " (expect to struggle to reach it)" : ""} · ${muRecText(c.rec)}`;
            return `<td class="mu-cell g-${c.grade}${advOwned ? "" : " adv-unowned"}${muState.focus === ci ? " focus" : ""}" data-c="${ci}" title="${escapeHtml(tip)}">
              <span class="mu-grade">${c.grade}${c.star ? "<sup>*</sup>" : ""}</span>
              ${c.rec ? `<i class="mu-rec ${c.rec.w ? "won" : "lost"}" aria-hidden="true"></i>` : ""}
            </td>`;
          }).join("")}
          <td class="mu-sum s-${r.sum >= 25 ? "hi" : r.sum < 20 ? "lo" : "mid"}" title="${r.sum >= 25 ? "Well rounded (25 or more)" : r.sum < 20 ? "Needs support or the right team (under 20)" : "Between 20 and 25"}"><b>${r.sum}</b><span class="mu-bar"><i style="width:${(r.sum / 40 * 100).toFixed(0)}%"></i></span></td>
        </tr>`;
    }).join("");

    const ownedCount = all.filter(r => !r.aspect && r.owned).length;
    const baseCount = all.filter(r => !r.aspect).length;
    box.innerHTML = `
      <div class="zen-card mu-card">
        <div class="mu-head">
          <div>
            <div class="zen-card-title">Match-ups</div>
            <p class="mu-intro">How well each spirit and aspect handles each adversary, from S (best) to F (worst). Click a flag to rank spirits against that adversary. Dots show your own games: filled if you have won the match-up, hollow if you have only lost it.</p>
          </div>
          <div class="mu-legend" aria-hidden="true">${MU_GRADES.map(g => `<span class="mu-cell g-${g}${g === "C" ? " line" : ""}" title="${g}: ${escapeHtml(M.tiers[g][0])}"><span class="mu-grade">${g}</span></span>`).join("")}</div>
        </div>
        <details class="mu-guide">
          <summary>How to read the ratings</summary>
          <div class="mu-guide-body">
            <dl class="mu-tiers">${MU_GRADES.map(g => `<div${g === "C" ? ' class="line"' : ""}><dt><span class="mu-cell g-${g}"><span class="mu-grade">${g}</span></span>${escapeHtml(M.tiers[g][0])}</dt><dd>${escapeHtml(M.tiers[g][1])}</dd></div>`).join("")}</dl>
            <div class="mu-guide-side">
              <p><b>Star (*):</b> ${escapeHtml(M.star)}</p>
              <p><b>Assumes:</b> ${M.assumptions.map(escapeHtml).join(" · ")}.</p>
              <p><b>Total:</b> S 5 to F 0, summed over 8 adversaries, out of 40. Around 25 means a well-rounded spirit; under 20 means it needs support or the right team.</p>
            </div>
          </div>
        </details>
        <div class="mu-controls">
          <input type="search" id="muSearch" class="text-input" placeholder="Find a spirit or aspect" value="${escapeHtml(muState.query)}" aria-label="Find a spirit or aspect">
          <label class="mu-check"><input type="checkbox" id="muAspects" ${muState.aspects ? "checked" : ""}> Show aspects</label>
          <label class="mu-check"><input type="checkbox" id="muOwned" ${muState.ownedOnly ? "checked" : ""}> Owned spirits only</label>
          ${sorted ? `<button type="button" class="btn-zen btn-zen-secondary" id="muReset">Back to chart order</button>` : ""}
          <span class="mu-count">${ownedCount} of ${baseCount} rated spirits owned</span>
        </div>
        <p class="mu-readout" id="muReadout" aria-live="polite">Hover or tap a grade to read it.</p>
        <div class="mu-scroll">
          <table class="mu-table"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${advs.length + 2}" class="mu-empty">No spirits match.</td></tr>`}</tbody></table>
        </div>
        <p class="mu-credit">Ratings from <a href="${escapeHtml(M.source)}" target="_blank" rel="noopener">Red's Match-up Axis (5 star system)</a> on r/spiritisland. Grades assume level 6 adversaries with no scenario.</p>
      </div>`;

    // ---- interaction ----
    box.querySelectorAll(".mu-sort").forEach(b => b.addEventListener("click", () => {
      const key = b.dataset.sort === "sum" ? "sum" : Number(b.dataset.sort);
      if (muState.sort === key) muState.dir = -muState.dir; else { muState.sort = key; muState.dir = -1; }
      muState.focus = key === "sum" ? null : key;
      renderMatchups();
    }));
    document.getElementById("muReset")?.addEventListener("click", () => { muState.sort = null; muState.focus = null; renderMatchups(); });
    const search = document.getElementById("muSearch");
    search?.addEventListener("input", () => {
      muState.query = search.value;
      const pos = search.selectionStart;
      renderMatchups();
      const s2 = document.getElementById("muSearch");
      s2?.focus(); s2?.setSelectionRange(pos, pos);
    });
    document.getElementById("muAspects")?.addEventListener("change", e => { muState.aspects = e.target.checked; renderMatchups(); });
    document.getElementById("muOwned")?.addEventListener("change", e => { muState.ownedOnly = e.target.checked; renderMatchups(); });
    box.querySelectorAll(".mu-open").forEach(b => b.addEventListener("click", () => {
      if (window.selectAndShowDossier) window.selectAndShowDossier(b.dataset.spirit, b.dataset.aspect || undefined);
    }));

    // Crosshair + readout
    const table = box.querySelector(".mu-table");
    const readout = document.getElementById("muReadout");
    const light = td => {
      table.querySelectorAll(".cross").forEach(x => x.classList.remove("cross"));
      if (!td) return;
      const ci = Number(td.dataset.c);
      td.parentElement.classList.add("cross");
      table.querySelectorAll(`td[data-c="${ci}"]`).forEach(x => x.classList.add("cross"));
      table.querySelectorAll("thead th")[ci + 1]?.classList.add("cross");
      readout.textContent = td.getAttribute("title");
    };
    table.addEventListener("pointerover", e => light(e.target.closest("td.mu-cell")));
    table.addEventListener("click", e => light(e.target.closest("td.mu-cell")));
    table.addEventListener("pointerleave", () => light(null));
  }
