// GitHub sync: keeps the campaign in the site's own repository, so every device sees the same data.
// Classic script: shares globals with the other files. Loaded before main.js.
//
// Three modes:
//   "editor": a GitHub token is saved on this device. Changes are committed to the repo automatically.
//   "viewer": no token, but the repo has a save file. Visitors see that data and cannot change it.
//   "local" : no token and no save file in the repo yet. The tracker works from this browser only.
//
// The token lives only in this browser (localStorage). It is never written to the repo.

const SICloud = (() => {
  const OWNER = "blinderoth";
  const REPO = "blinderoth.github.io";
  const BRANCH = "main";
  const PATH = "spirit-island/tracker/data/save.json";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const TOKEN_KEY = "si_gh_token";
  const META_KEY = "si_sync_meta";
  const PUSH_DELAY_MS = 4000;
  const RECHECK_MS = 30000;

  let mode = "local";          // "editor" | "viewer" | "local"
  let state = "idle";          // "idle" | "saving" | "dirty" | "error" | "offline"
  let message = "";
  let timer = null;
  let pushing = false;
  let lastCheck = 0;

  // ---- small helpers -------------------------------------------------------
  const getToken = () => { try { return (localStorage.getItem(TOKEN_KEY) || "").trim(); } catch (e) { return ""; } };
  const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; } catch (e) { return {}; } };
  const writeMeta = (patch) => {
    try { localStorage.setItem(META_KEY, JSON.stringify(Object.assign(readMeta(), patch))); } catch (e) { /* storage blocked */ }
  };

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function headers(withToken) {
    const h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (withToken && getToken()) h["Authorization"] = `Bearer ${getToken()}`;
    return h;
  }

  // ---- what gets stored ----------------------------------------------------
  // Only what you change: matches, players, ownership, artwork crops. Reference data ships with the site.
  function buildPayload() {
    const pick = (list, fields) => (list || []).map(x => {
      const o = { name: x.name };
      fields.forEach(f => { if (x[f] !== undefined) o[f] = x[f]; });
      return o;
    });
    return {
      schema: 1,
      lastUpdated: appData.lastUpdated || new Date().toISOString(),
      players: appData.players || [],
      expansions: pick(appData.expansions, ["owned"]),
      spirits: pick(appData.spirits, ["owned", "miniature", "focalPosition"]),
      adversaries: pick(appData.adversaries, ["owned", "focalPosition"]),
      scenarios: pick(appData.scenarios, ["owned", "focalPosition"]),
      aspects: (appData.aspects || []).filter(a => a.focalPosition).map(a => ({ spirit: a.spirit, name: a.name, focalPosition: a.focalPosition })),
      matches: appData.matches || []
    };
  }

  // One entry per line, so commits in GitHub show readable diffs.
  function serialize(p) {
    const keys = Object.keys(p);
    const body = keys.map(k => {
      const v = p[k];
      if (Array.isArray(v) && v.length) return `"${k}": [\n` + v.map(x => "  " + JSON.stringify(x)).join(",\n") + "\n]";
      return `"${k}": ${JSON.stringify(v)}`;
    }).join(",\n");
    return "{\n" + body + "\n}\n";
  }

  // Compare two payloads ignoring the timestamp.
  function samePayload(a, b) {
    const strip = p => { const c = Object.assign({}, p); delete c.lastUpdated; return JSON.stringify(c); };
    return strip(a) === strip(b);
  }

  // Turn a stored payload back into a full appData (defaults + your changes).
  function applyPayload(p) {
    const def = window.DEFAULT_CAMPAIGN_DATA;
    const full = JSON.parse(JSON.stringify(def));
    full.lastUpdated = p.lastUpdated;
    full.players = p.players || full.players;
    const exp = new Map((p.expansions || []).map(e => [e.name, e]));
    full.expansions = (full.expansions || []).map(e => exp.has(e.name) ? Object.assign({}, e, { owned: exp.get(e.name).owned }) : e);
    (p.expansions || []).forEach(e => { if (!full.expansions.some(x => x.name === e.name)) full.expansions.push(e); });
    full.spirits = p.spirits || [];
    full.adversaries = p.adversaries || [];
    full.scenarios = p.scenarios || [];
    full.aspects = p.aspects || [];
    full.matches = p.matches || [];
    return full;
  }

  // ---- talking to GitHub ---------------------------------------------------
  async function fetchRemote() {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers(true), cache: "no-store", signal: ctl.signal });
      if (res.status === 404) return { ok: true, missing: true };
      if (res.status === 401 || res.status === 403) {
        // A bad token also blocks reads. Retry once without it so the data is still visible.
        if (getToken()) {
          const res2 = await fetch(`${API}?ref=${BRANCH}&t=${Date.now()}`, { headers: headers(false), cache: "no-store", signal: ctl.signal });
          if (res2.ok) { const j2 = await res2.json(); return { ok: true, sha: j2.sha, payload: JSON.parse(fromBase64(j2.content)), tokenRejected: true }; }
          if (res2.status === 404) return { ok: true, missing: true, tokenRejected: true };
        }
        return { ok: false, error: res.status === 403 ? "GitHub rate limit or access denied" : "Token rejected", tokenRejected: res.status === 401 };
      }
      if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}` };
      const j = await res.json();
      return { ok: true, sha: j.sha, payload: JSON.parse(fromBase64(j.content)) };
    } catch (e) {
      return { ok: false, error: e.name === "AbortError" ? "GitHub did not answer in time" : "Offline" };
    } finally { clearTimeout(to); }
  }

  async function putRemote(sha, keepalive) {
    const payload = buildPayload();
    const n = payload.matches.length;
    const body = {
      message: `Tracker: save campaign data (${n} ${n === 1 ? "match" : "matches"})`,
      content: toBase64(serialize(payload)),
      branch: BRANCH
    };
    if (sha) body.sha = sha;
    const res = await fetch(API, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers(true)), body: JSON.stringify(body), keepalive: !!keepalive });
    return res;
  }

  // ---- status shown in the header and Settings ----------------------------
  function label(countText) {
    const count = countText || `${(appData?.matches || []).length} matches`;
    if (mode === "viewer") return `View only • data from GitHub • ${count}`;
    if (mode === "editor") {
      if (state === "saving") return "Saving to GitHub…";
      if (state === "dirty") return "Unsynced changes • will save to GitHub";
      if (state === "error") return `Not synced: ${message}`;
      if (state === "offline") return "Offline • changes kept on this device";
      return `Synced to GitHub • ${count}`;
    }
    return `Saved in this browser • ${count}`;
  }

  function refreshUi() {
    document.body.classList.toggle("si-viewer", mode === "viewer");
    if (typeof updateSyncBadge === "function") updateSyncBadge();
    const line = document.getElementById("syncStatusLine");
    if (line) {
      const m = readMeta();
      const when = m.syncedAt ? ` Last saved ${new Date(m.syncedAt).toLocaleString()}.` : "";
      let txt;
      if (mode === "editor") txt = state === "error" ? `Not synced: ${message}.` : state === "saving" ? "Saving to GitHub…" : state === "dirty" ? "Changes waiting to be saved to GitHub." : `Connected. Every change is saved to GitHub automatically.${when}`;
      else if (mode === "viewer") txt = "View only. This page shows the data saved in GitHub. Add a token below to edit on this device.";
      else txt = "Not connected. Data is saved in this browser only. Add a token below to save it to GitHub.";
      line.textContent = txt;
      line.dataset.state = (mode === "editor" && state === "error") ? "warn" : mode === "editor" ? "ok" : "";
    }
    const input = document.getElementById("ghTokenInput");
    if (input && !input.value && getToken()) input.placeholder = "Token saved on this device";
    const rm = document.getElementById("ghTokenRemoveBtn");
    if (rm) rm.hidden = !getToken();
    const now = document.getElementById("ghSyncNowBtn");
    if (now) now.hidden = mode !== "editor";
  }

  function setState(s, msg) { state = s; message = msg || ""; refreshUi(); }

  // ---- conflict dialog -----------------------------------------------------
  function askConflict(remoteCount, localCount) {
    return new Promise(resolve => {
      const wrap = document.createElement("div");
      wrap.className = "modal-backdrop open";
      wrap.style.display = "flex";
      wrap.setAttribute("role", "alertdialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.setAttribute("aria-labelledby", "syncConflictTitle");
      wrap.innerHTML = `
        <div class="modal-panel" style="max-width:480px;padding:1.4rem;">
          <h3 id="syncConflictTitle" style="margin:0 0 0.5rem;font-family:'Newsreader',serif;">Two versions of the campaign</h3>
          <p style="margin:0 0 1rem;font-size:0.9rem;color:var(--text-secondary);">GitHub has ${remoteCount} matches. This device has ${localCount} matches with changes GitHub has not seen. Which one should win? The other version is replaced.</p>
          <div style="display:flex;gap:0.6rem;flex-wrap:wrap;justify-content:flex-end;">
            <button type="button" class="btn-zen btn-zen-secondary" data-pick="remote">Use GitHub's version</button>
            <button type="button" class="btn-zen btn-zen-primary" data-pick="local">Use this device's version</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => { wrap.remove(); resolve(b.getAttribute("data-pick")); }));
      wrap.querySelector("[data-pick='remote']").focus();
    });
  }

  // ---- loading -------------------------------------------------------------
  // Called once from initApp. localData is the parsed localStorage copy (or null).
  // Returns the appData to use, or null to fall back to the local/default copy.
  async function loadOnStart(localData) {
    const remote = await fetchRemote();
    lastCheck = Date.now();
    const token = getToken();
    mode = token ? "editor" : "local";

    if (!remote.ok) {
      if (token) setState(remote.tokenRejected ? "error" : "offline", remote.tokenRejected ? "token rejected, check Settings" : "");
      return null;
    }
    if (remote.tokenRejected) setState("error", "token rejected, check Settings");

    if (remote.missing) {
      // Nothing in the repo yet. With a token, the first change (or "Sync now") creates the file.
      if (token && localData && (localData.matches || []).length) markDirty();
      return null;
    }

    if (!token) {
      mode = "viewer";
      return applyPayload(remote.payload);
    }

    const meta = readMeta();
    if (meta.sha === remote.sha) return null;   // repo unchanged since this device last synced

    // The repo changed since this device last synced.
    let localPayload = null;
    if (localData) {
      const keep = appData; appData = localData; localPayload = buildPayload(); appData = keep;
    }
    const localHasChanges = !!localData && (meta.dirty || !meta.sha) && !samePayload(localPayload, remote.payload);
    if (!localHasChanges) {
      writeMeta({ sha: remote.sha, dirty: false, syncedAt: new Date().toISOString() });
      return applyPayload(remote.payload);
    }
    const pick = await askConflict((remote.payload.matches || []).length, (localData.matches || []).length);
    if (pick === "remote") {
      writeMeta({ sha: remote.sha, dirty: false, syncedAt: new Date().toISOString() });
      return applyPayload(remote.payload);
    }
    writeMeta({ sha: remote.sha, dirty: true });   // keep local; the next push overwrites the repo
    state = "dirty";
    schedulePush(500);
    return null;
  }

  // ---- saving --------------------------------------------------------------
  function markDirty() {
    writeMeta({ dirty: true });
    setState("dirty");
    schedulePush(PUSH_DELAY_MS);
  }

  function afterLocalSave() {
    if (mode === "viewer") return;
    if (mode === "editor") markDirty();
    else setState("idle");
  }

  function schedulePush(delay) {
    clearTimeout(timer);
    timer = setTimeout(() => push(false), delay);
  }

  async function push(keepalive) {
    if (mode !== "editor" || pushing) return;
    if (!navigator.onLine) { setState("offline"); return; }
    pushing = true; setState("saving");
    try {
      let res = await putRemote(readMeta().sha, keepalive);
      if (res.status === 409 || res.status === 422) {
        // Someone else saved first (or the file did not exist when we thought it did). Look again.
        const remote = await fetchRemote();
        if (remote.ok && remote.missing) res = await putRemote(null, keepalive);
        else if (remote.ok && samePayload(remote.payload, buildPayload())) { writeMeta({ sha: remote.sha, dirty: false, syncedAt: new Date().toISOString() }); setState("idle"); return; }
        else if (remote.ok) {
          const pick = await askConflict((remote.payload.matches || []).length, (appData.matches || []).length);
          if (pick === "remote") { adoptRemote(remote); return; }
          res = await putRemote(remote.sha, keepalive);
        }
      }
      if (res.ok) {
        const j = await res.json();
        writeMeta({ sha: j.content && j.content.sha, dirty: false, syncedAt: new Date().toISOString() });
        setState("idle");
      } else if (res.status === 401) setState("error", "token rejected, check Settings");
      else if (res.status === 403 || res.status === 404) setState("error", "token has no write access to the repo");
      else setState("error", `GitHub answered ${res.status}`);
    } catch (e) {
      setState(navigator.onLine ? "error" : "offline", navigator.onLine ? "could not reach GitHub" : "");
    } finally { pushing = false; }
  }

  function adoptRemote(remote) {
    appData = applyPayload(remote.payload);
    mergeReferenceData();
    writeMeta({ sha: remote.sha, dirty: false, syncedAt: new Date().toISOString() });
    setState("idle");
    if (typeof renderAll === "function") renderAll();
  }

  // Pick up changes made on another device when the tab comes back into view.
  async function recheck() {
    if (mode === "local" || pushing || Date.now() - lastCheck < RECHECK_MS) return;
    if (mode === "editor" && (readMeta().dirty || timer)) return;
    lastCheck = Date.now();
    const remote = await fetchRemote();
    if (!remote.ok || remote.missing) return;
    if (mode === "editor" && readMeta().sha === remote.sha) return;
    if (mode === "viewer" && samePayload(buildPayload(), remote.payload)) return;
    adoptRemote(remote);
    if (typeof showToast === "function") showToast("Updated from GitHub");
  }

  // ---- token handling (Settings) -------------------------------------------
  async function setToken(value) {
    const t = (value || "").trim();
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { showToast("Could not store the token in this browser"); return; }
    mode = "editor";
    setState("saving");
    const remote = await fetchRemote();
    if (!remote.ok && remote.tokenRejected) { setState("error", "token rejected"); return; }
    if (remote.ok && !remote.missing && !remote.tokenRejected) {
      const meta = readMeta();
      if (meta.sha !== remote.sha && !samePayload(buildPayload(), remote.payload)) {
        const pick = await askConflict((remote.payload.matches || []).length, (appData.matches || []).length);
        if (pick === "remote") { adoptRemote(remote); showToast("Connected. Using GitHub's data."); return; }
      }
      writeMeta({ sha: remote.sha });
    }
    markDirty();
    clearTimeout(timer);
    await push(false);
    if (state === "idle") showToast("Connected. Saved to GitHub.");
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    clearTimeout(timer);
    mode = "local";
    setState("idle");
    showToast("Token removed from this device");
  }

  function bindSettings() {
    const input = document.getElementById("ghTokenInput");
    const save = document.getElementById("ghTokenSaveBtn");
    if (!save || save.dataset.bound) { refreshUi(); return; }
    save.dataset.bound = "1";
    save.addEventListener("click", async () => { const v = input.value; input.value = ""; await setToken(v); });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save.click(); } });
    document.getElementById("ghTokenRemoveBtn")?.addEventListener("click", clearToken);
    document.getElementById("ghSyncNowBtn")?.addEventListener("click", async () => { clearTimeout(timer); writeMeta({ dirty: true }); await push(false); });
    refreshUi();
  }

  // ---- page lifecycle ------------------------------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (mode === "editor" && readMeta().dirty) { clearTimeout(timer); push(true); }
    } else recheck();
  });
  window.addEventListener("online", () => { if (mode === "editor" && readMeta().dirty) schedulePush(500); });

  return {
    loadOnStart, afterLocalSave, bindSettings, refreshUi, label, push,
    isViewer: () => mode === "viewer",
    mode: () => mode
  };
})();
