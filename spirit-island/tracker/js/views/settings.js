// Settings tab: players, expansions, backup, import and export
// Classic script: shares globals with the other files in js/core and js/views.

  // =========================================================================
  // 5. SETTINGS, COLLECTION & IMPORT/EXPORT VIEW
  // =========================================================================
  function renderSettingsView() {
    SICloud.bindSettings();
    // Players management
    const playersList = document.getElementById("settingsPlayersList");
    if (playersList) {
      playersList.innerHTML = (appData.players || []).map((p, idx) => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:transparent;border:1px solid var(--border-subtle);padding:0.55rem 0.85rem;border-radius:9px;">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            ${p.isPrimary ? `<span class="badge badge-win" style="margin-left:0.4rem;">Primary Host</span>` : ""}
          </div>
          ${!p.isPrimary ? `<button class="btn btn-danger btn-sm remove-player-btn" data-idx="${idx}">Remove</button>` : ""}
        </div>
      `).join("");

      playersList.querySelectorAll(".remove-player-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const i = Number(btn.getAttribute("data-idx"));
          const removed = appData.players.splice(i, 1);
          await persistData(`Removed player ${removed[0]?.name}`);
          renderAll();
        });
      });
    }

    const addPlayerBtn = document.getElementById("addNewGuardianBtn");
    if (addPlayerBtn && !addPlayerBtn.dataset.bound) {
      addPlayerBtn.dataset.bound = "1";
      addPlayerBtn.addEventListener("click", async () => {
        const input = document.getElementById("newGuardianNameInput");
        const name = (input?.value || "").trim();
        if (!name) return;
        if ((appData.players || []).some(p => p.name.toLowerCase() === name.toLowerCase())) {
          showToast("Guardian already exists in Council");
          return;
        }
        appData.players.push({ name, isPrimary: false, role: "Island Guardian" });
        input.value = "";
        await persistData(`Added Guardian ${name} to the Council`);
        renderAll();
      });
    }

    // Expansions Owned
    const expList = document.getElementById("settingsExpansionsList");
    if (expList) {
      expList.innerHTML = (appData.expansions || []).map((ex, i) => `
        <label style="display:flex;align-items:center;justify-content:space-between;background:transparent;border:1px solid var(--border-subtle);padding:0.6rem 0.85rem;border-radius:9px;cursor:pointer;">
          <span style="font-weight:600;">${escapeHtml(ex.name)}</span>
          <input type="checkbox" class="exp-owned-toggle" data-idx="${i}" ${ex.owned ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent-emerald);">
        </label>
      `).join("");

      expList.querySelectorAll(".exp-owned-toggle").forEach(chk => {
        chk.addEventListener("change", async () => {
          const i = Number(chk.getAttribute("data-idx"));
          const exp = appData.expansions[i];
          exp.owned = chk.checked;
          // Spirits, adversaries and scenarios follow their expansion
          syncOwnershipFromExpansions();
          await persistData(`${exp.name} marked as ${exp.owned ? 'Owned' : 'Unowned'}`);
          renderAll();
        });
      });
    }

    renderBackupStatus();

    // Export / Import bindings
    const printBtn = document.getElementById("printSummaryBtn");
    if (printBtn && !printBtn.dataset.bound) {
      printBtn.dataset.bound = "1";
      printBtn.addEventListener("click", printSummary);
    }

    const exportJsonBtn = document.getElementById("exportJsonBtn");
    if (exportJsonBtn && !exportJsonBtn.dataset.bound) {
      exportJsonBtn.dataset.bound = "1";
      exportJsonBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `spirit_island_campaign_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem("si_last_backup", JSON.stringify({ at: new Date().toISOString(), count: (appData.matches || []).length }));
        renderBackupStatus();
        showToast("Downloaded campaign JSON backup");
      });
    }

    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn && !exportCsvBtn.dataset.bound) {
      exportCsvBtn.dataset.bound = "1";
      exportCsvBtn.addEventListener("click", () => {
        const headers = ["Match ID", "Date", "Victory", "Players & Spirits", "Thematic Map", "Adversary", "Level", "Scenario", "Difficulty", "Invader Cards (Win)", "Invader Cards Out (Loss)", "Dahan", "Blight", "Fear Cards", "Loss Condition", "Score", "Notes"];
        const rows = (appData.matches || []).map(m => [
          m.id,
          m.date,
          m.victory ? "TRUE" : "FALSE",
          (m.players || []).map(p => `${p.spirit}${p.aspect ? ' [' + p.aspect + ']' : ''} (${p.player})`).join(" | "),
          m.thematicMap ? "TRUE" : "FALSE",
          m.adversary1 || "",
          m.adversary1Level ?? "",
          m.scenario || "",
          m.difficulty ?? 0,
          m.invaderCardsInDeck ?? "",
          m.invaderCardsNotInDeck ?? "",
          m.dahan ?? 0,
          m.blight ?? 0,
          m.fearCardsLeft ?? "",
          m.lossCondition || "",
          m.score ?? 0,
          (m.notes || "").replace(/\r?\n/g, " ")
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `spirit_island_matches_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Exported Match Log to CSV");
      });
    }

    const importFileInput = document.getElementById("importJsonFileInput");
    if (importFileInput && !importFileInput.dataset.bound) {
      importFileInput.dataset.bound = "1";
      importFileInput.addEventListener("change", e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
          try {
            const parsed = JSON.parse(ev.target.result);
            if (!parsed.matches || !parsed.spirits) {
              alert("Invalid Spirit Island campaign JSON file.");
              return;
            }
            const current = (appData.matches || []).length;
            if (!confirm(`Replace the ${current} matches in this browser with the ${parsed.matches.length} matches in this file?`)) { e.target.value = ""; return; }
            appData = parsed;
            mergeReferenceData();
            await persistData(`Imported ${appData.matches.length} matches from backup!`);
            renderAll();
          } catch (err) {
            alert("Could not parse JSON file: " + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    const resetBtn = document.getElementById("resetOriginalSheetBtn");
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = "1";
      resetBtn.textContent = "Reset reference data (keeps matches)";
      resetBtn.addEventListener("click", async () => {
        if (!window.DEFAULT_CAMPAIGN_DATA) return;
        if (!confirm("Reset spirits, expansions, adversaries and scenarios to the defaults? Your logged matches and players are kept.")) return;
        const keepMatches = appData.matches || [];
        const keepPlayers = appData.players;
        appData = JSON.parse(JSON.stringify(window.DEFAULT_CAMPAIGN_DATA));
        appData.matches = keepMatches;
        if (keepPlayers) appData.players = keepPlayers;
        mergeReferenceData();
        await persistData(`Reference data reset. ${keepMatches.length} matches kept.`);
        renderAll();
      });
    }
  }

  // Data lives only in this browser, so say plainly how fresh the last backup is.
  function renderBackupStatus() {
    const el = document.getElementById("backupStatus");
    if (!el) return;
    const total = (appData?.matches || []).length;
    let info = null;
    try { info = JSON.parse(localStorage.getItem("si_last_backup") || "null"); } catch (e) { info = null; }
    if (SICloud.mode() !== "local") {
      el.textContent = info ? `Last JSON download: ${new Date(info.at).toLocaleDateString()}.` : "";
      el.dataset.state = "ok";
      return;
    }
    if (!info) {
      el.textContent = `No backup downloaded from this browser yet. ${total} matches are stored only here.`;
      el.dataset.state = "warn";
      return;
    }
    const days = Math.floor((Date.now() - new Date(info.at).getTime()) / 86400000);
    const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    const newer = Math.max(0, total - (info.count || 0));
    el.textContent = `Last backup: ${when}. ${newer === 0 ? "It includes every match." : newer + (newer === 1 ? " match" : " matches") + " logged since then."}`;
    el.dataset.state = newer > 0 ? "warn" : "ok";
  }
