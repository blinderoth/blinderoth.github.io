// Chapter: The Blight Jars. One jar per lost game, filled to the blight left on the island,
// shelved by how the game was lost.

(() => {
  let current = null;

  const JAR = "M14,6 h32 v8 c0,3 6,5 6,12 v52 c0,8 -6,12 -14,12 h-16 c-8,0 -14,-4 -14,-12 v-52 c0,-7 6,-9 6,-12 z";
  const ORDER = ["Blight Overrun", "Adversary Special Rule", "Invader Deck Depleted", "Presence Destroyed", "Unclassified"];

  function jarSvg(m, max, i) {
    const b = Math.max(0, Number(m.blight || 0));
    const top = 18, bottom = 88, h = (bottom - top) * Math.min(1, b / max);
    const y = bottom - h;
    return `<svg viewBox="0 0 60 96" class="jar-svg" aria-hidden="true">
      <defs><clipPath id="jarC${i}"><path d="${JAR}"/></clipPath></defs>
      <path class="jar-back" d="${JAR}"/>
      <g clip-path="url(#jarC${i})">
        <rect class="jar-sludge" x="0" y="${y.toFixed(1)}" width="60" height="${(h + 10).toFixed(1)}"/>
        ${h > 2 ? `<path class="jar-surface" d="M0,${y.toFixed(1)} q15,-3 30,0 t30,0"/>` : ""}
      </g>
      <path class="jar-glass" d="${JAR}"/>
      <rect class="jar-lid" x="12" y="2" width="36" height="7" rx="2"/>
      <text class="jar-num" x="30" y="60" text-anchor="middle">${b}</text>
    </svg>`;
  }

  function card(ctx, m) {
    if (!m) return `<p class="kicker">The shelf</p><h3>Pick a jar</h3><p class="hint">Each jar holds the blight from one lost game. Hover or focus one to read what happened.</p>`;
    const adv = m.adversary1 ? `${escapeHtml(m.adversary1)}${m.adversary1Level !== null && m.adversary1Level !== "" && m.adversary1Level !== undefined ? " L" + escapeHtml(m.adversary1Level) : ""}` : "Base island";
    return `<p class="kicker">Invasion #${escapeHtml(m.id)} · ${escapeHtml(ctx.fmtDate(m.date))}</p>
      <h3>${escapeHtml(m.lossCondition || "Unclassified loss")}</h3>
      <p class="hint">${(m.players || []).map(p => escapeHtml(p.spirit || "?")).join(", ")}<br>${adv}${m.scenario ? ` · ${escapeHtml(m.scenario)}` : ""}</p>
      <p class="hint">Blight <b>${escapeHtml(m.blight ?? 0)}</b> · Dahan <b>${escapeHtml(m.dahan ?? 0)}</b> · invader cards out <b>${escapeHtml(m.invaderCardsNotInDeck ?? 0)}</b> · score <b>${SIAnalytics.formatNum(m.score, 1)}</b></p>
      ${m.notes ? `<p class="tc-notes">“${escapeHtml(m.notes)}”</p>` : ""}
      <a class="tc-link" href="index.html#game=${encodeURIComponent(m.id)}">Open in the tracker →</a>`;
  }

  function render(ctx) {
    const shelf = document.getElementById("jarsShelf");
    const info = document.getElementById("jarsInfo");
    const sum = document.getElementById("jarsSummary");
    const tableEl = document.getElementById("jarsTable");
    if (!shelf) return;
    const losses = (ctx.data.matches || []).filter(m => !m.victory);
    if (!losses.length) {
      shelf.innerHTML = `<p class="hint">No losses in this stretch. The shelf is empty.</p>`;
      info.innerHTML = ""; if (sum) sum.textContent = ""; if (tableEl) tableEl.innerHTML = "";
      return;
    }
    if (current && !losses.some(m => m.id === current)) current = null;
    const max = Math.max(6, ...losses.map(m => Number(m.blight || 0)));
    const groups = new Map();
    losses.forEach(m => { const k = m.lossCondition || "Unclassified"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
    const keys = Array.from(groups.keys()).sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99 || groups.get(b).length - groups.get(a).length);

    let i = 0;
    shelf.innerHTML = keys.map(k => `
      <div class="jar-row">
        <p class="jar-row-head"><span>${escapeHtml(k)}</span><b>${groups.get(k).length}</b></p>
        <div class="jar-line">${groups.get(k).map(m => `<button type="button" class="jar${current === m.id ? " on" : ""}" data-id="${escapeHtml(m.id)}" aria-label="Game ${escapeHtml(m.id)}, ${escapeHtml(k)}, ${escapeHtml(m.blight ?? 0)} blight">${jarSvg(m, max, i++)}<span class="jar-tag">#${escapeHtml(m.id)}</span></button>`).join("")}</div>
      </div>`).join("");

    const totalBlight = losses.reduce((t, m) => t + Number(m.blight || 0), 0);
    if (sum) sum.innerHTML = `<b>${losses.length}</b> ${losses.length === 1 ? "loss" : "losses"} · <b>${totalBlight}</b> blight left behind · most often <b>${escapeHtml(keys.slice().sort((a, b) => groups.get(b).length - groups.get(a).length)[0])}</b>`;

    const byId = new Map(losses.map(m => [String(m.id), m]));
    const show = id => {
      current = id === null ? null : byId.get(String(id))?.id ?? null;
      shelf.querySelectorAll(".jar").forEach(j => j.classList.toggle("on", String(j.dataset.id) === String(current)));
      info.innerHTML = card(ctx, current === null ? null : byId.get(String(current)));
    };
    shelf.querySelectorAll(".jar").forEach(j => {
      j.addEventListener("pointerenter", () => show(j.dataset.id));
      j.addEventListener("focus", () => show(j.dataset.id));
      j.addEventListener("click", () => show(j.dataset.id));
    });
    show(current);

    if (tableEl) {
      tableEl.innerHTML = `<table><thead><tr><th>#</th><th>Date</th><th>How it was lost</th><th>Blight</th><th>Notes</th></tr></thead><tbody>${losses.map(m => `<tr><td>${escapeHtml(m.id)}</td><td>${escapeHtml(m.date || "")}</td><td>${escapeHtml(m.lossCondition || "Unclassified")}</td><td>${escapeHtml(m.blight ?? 0)}</td><td>${escapeHtml(m.notes || "")}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  Realm.register("jars", render);
})();
