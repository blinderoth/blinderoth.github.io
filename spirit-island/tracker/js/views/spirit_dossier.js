// Spirit dossier, art refit tool and aspect ledger
// Classic script: shares globals with the other files in js/core and js/views.

  // --- Artwork Centering & Focal Cropping (Manual Refit Tool) ---
  let activeCropTarget = null;
  let isDraggingCrop = false;
  let dragStartX = 0, dragStartY = 0, startPanX = 0, startPanY = 0;

  function getFocalStyle(obj) {
    const f = obj?.focalPosition;
    if (!f) return "object-fit: cover; object-position: center;";

    const fit = f.fit || "cover";
    let panX = f.panX ?? 0;
    let panY = f.panY ?? 0;
    let scale = f.scale ?? (f.zoom ?? 1);

    // Backward compatibility with legacy {x: 50, y: 50} format
    if (f.panX === undefined && f.x !== undefined) {
      panX = (f.x - 50);
      panY = (f.y - 50);
    }

    return `object-fit: ${fit}; object-position: center; transform: translate(${panX}%, ${panY}%) scale(${scale}); transform-origin: center center;`;
  }

  function openCropModal(spirit, aspect) {
    const modal = document.getElementById("cropArtModal");
    if (!modal) return;

    const spiritsList = appData.spirits || [];
    if (!spiritsList.length) return;

    let curSpirit = spirit || spiritsList.find(s => s.name === selectedDossierSpirit) || spiritsList[0];
    let curAspect = aspect;

    const spiritSelect = document.getElementById("refitSpiritSelect");
    const aspectSelect = document.getElementById("refitAspectSelect");
    const aspectWrapper = document.getElementById("refitAspectWrapper");
    const sliderX = document.getElementById("cropSliderX");
    const sliderY = document.getElementById("cropSliderY");
    const sliderScale = document.getElementById("cropSliderScale");
    const valX = document.getElementById("cropValX");
    const valY = document.getElementById("cropValY");
    const valScale = document.getElementById("cropValScale");
    const btnFitCover = document.getElementById("btnFitCover");
    const btnFitContain = document.getElementById("btnFitContain");
    const previewBox = document.getElementById("cropPreviewBox");
    const imgStage = document.getElementById("cropPreviewImg");
    const microDossier = document.getElementById("cropMicroDossier");
    const microCodex = document.getElementById("cropMicroCodex");

    // Populate Spirit Select
    if (spiritSelect) {
      spiritSelect.innerHTML = spiritsList.map(s => 
        `<option value="${escapeHtml(s.name)}" ${s.name === curSpirit.name ? "selected" : ""}>${escapeHtml(s.name)} (${s.expansion})</option>`
      ).join("");
    }

    function setupAspectsForSpirit(sp, selectedAspName) {
      if (!aspectSelect || !aspectWrapper) return;
      const aspList = (appData.aspects || []).filter(a => a.spirit === sp.name);
      if (aspList.length > 0) {
        aspectWrapper.style.display = "";
        aspectSelect.innerHTML = [
          `<option value="Base">Base Spirit Portrait</option>`,
          ...aspList.map(a => `<option value="${escapeHtml(a.name)}" ${a.name === selectedAspName ? "selected" : ""}>${escapeHtml(a.name)} Aspect${a.image ? " (Custom Art)" : ""}</option>`)
        ].join("");
        if (selectedAspName) aspectSelect.value = selectedAspName;
      } else {
        aspectSelect.innerHTML = `<option value="Base">Base Spirit (No Aspects)</option>`;
        aspectWrapper.style.display = "none";
      }
    }

    function setTarget(sp, asp) {
      curSpirit = sp;
      curAspect = (asp && asp.name !== "Base") ? asp : null;

      const isAsp = !!(curAspect && curAspect.image);
      const targetObj = isAsp ? curAspect : curSpirit;
      const targetImg = targetObj.image || "assets/spirits/volcano_looming_high.png";
      const targetTitle = isAsp ? `${curSpirit.name} (${curAspect.name} Aspect)` : curSpirit.name;

      // Normalize focal position
      const rawF = targetObj.focalPosition || {};
      let panX = rawF.panX ?? (rawF.x !== undefined ? rawF.x - 50 : 0);
      let panY = rawF.panY ?? (rawF.y !== undefined ? rawF.y - 50 : 0);
      let scale = rawF.scale ?? (rawF.zoom ?? 1);
      let fit = rawF.fit || "cover";

      activeCropTarget = {
        spirit: curSpirit,
        aspect: curAspect,
        targetObj,
        title: targetTitle,
        image: targetImg,
        focal: { panX, panY, scale, fit }
      };

      const titleEl = document.getElementById("cropModalTitle");
      if (titleEl) titleEl.textContent = `Refit Artwork: ${targetTitle}`;
      if (imgStage) imgStage.src = targetImg;
      if (microDossier) microDossier.src = targetImg;
      if (microCodex) microCodex.src = targetImg;

      updatePreview();
    }

    function updatePreview() {
      if (!activeCropTarget) return;
      const f = activeCropTarget.focal;

      if (sliderX) sliderX.value = f.panX;
      if (sliderY) sliderY.value = f.panY;
      if (sliderScale) sliderScale.value = Math.round(f.scale * 100);

      if (valX) valX.textContent = `${f.panX > 0 ? "+" : ""}${f.panX}%`;
      if (valY) valY.textContent = `${f.panY > 0 ? "+" : ""}${f.panY}%`;
      if (valScale) valScale.textContent = `${Math.round(f.scale * 100)}%`;

      modal.querySelectorAll(".btn-size-pill").forEach(pill => {
        const sz = Number(pill.getAttribute("data-size"));
        pill.classList.toggle("active", Math.round(f.scale * 100) === sz);
      });

      if (btnFitCover && btnFitContain) {
        btnFitCover.classList.toggle("active", f.fit === "cover");
        btnFitContain.classList.toggle("active", f.fit === "contain");
      }

      const css = `object-fit:${f.fit};object-position:center;transform:translate(${f.panX}%, ${f.panY}%) scale(${f.scale});transform-origin:center center;`;
      if (imgStage) imgStage.style.cssText = css + "width:100%;height:100%;display:block;pointer-events:none;";
      if (microDossier) microDossier.style.cssText = css + "width:100%;height:100%;display:block;";
      if (microCodex) microCodex.style.cssText = css + "width:100%;height:100%;display:block;";
    }

    // Change Spirit Dropdown
    if (spiritSelect) {
      spiritSelect.onchange = () => {
        const sp = spiritsList.find(s => s.name === spiritSelect.value);
        if (sp) {
          setupAspectsForSpirit(sp, "Base");
          setTarget(sp, null);
        }
      };
    }

    // Change Aspect Dropdown
    if (aspectSelect) {
      aspectSelect.onchange = () => {
        const aspName = aspectSelect.value;
        const asp = aspName !== "Base" ? (appData.aspects || []).find(a => a.spirit === curSpirit.name && a.name === aspName) : null;
        setTarget(curSpirit, asp);
      };
    }

    // Prev / Next Spirit buttons
    const prevBtn = document.getElementById("refitPrevSpiritBtn");
    const nextBtn = document.getElementById("refitNextSpiritBtn");
    if (prevBtn) {
      prevBtn.onclick = () => {
        const curIdx = spiritsList.findIndex(s => s.name === curSpirit.name);
        const nextIdx = (curIdx - 1 + spiritsList.length) % spiritsList.length;
        const sp = spiritsList[nextIdx];
        if (spiritSelect) spiritSelect.value = sp.name;
        setupAspectsForSpirit(sp, "Base");
        setTarget(sp, null);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        const curIdx = spiritsList.findIndex(s => s.name === curSpirit.name);
        const nextIdx = (curIdx + 1) % spiritsList.length;
        const sp = spiritsList[nextIdx];
        if (spiritSelect) spiritSelect.value = sp.name;
        setupAspectsForSpirit(sp, "Base");
        setTarget(sp, null);
      };
    }

    // Fit Mode Segmented Toggle
    if (btnFitCover) {
      btnFitCover.onclick = () => {
        activeCropTarget.focal.fit = "cover";
        updatePreview();
      };
    }
    if (btnFitContain) {
      btnFitContain.onclick = () => {
        activeCropTarget.focal.fit = "contain";
        updatePreview();
      };
    }

    // Sliders
    if (sliderX) {
      sliderX.oninput = (e) => {
        activeCropTarget.focal.panX = Number(e.target.value);
        updatePreview();
      };
    }
    if (sliderY) {
      sliderY.oninput = (e) => {
        activeCropTarget.focal.panY = Number(e.target.value);
        updatePreview();
      };
    }
    if (sliderScale) {
      sliderScale.oninput = (e) => {
        activeCropTarget.focal.scale = Number(e.target.value) / 100;
        updatePreview();
      };
    }

    // Step Buttons (+ / - / left / right / up / down)
    const zoomInBtn = document.getElementById("cropStepZoomIn");
    const zoomOutBtn = document.getElementById("cropStepZoomOut");
    const panLeftBtn = document.getElementById("cropStepPanLeft");
    const panRightBtn = document.getElementById("cropStepPanRight");
    const panUpBtn = document.getElementById("cropStepPanUp");
    const panDownBtn = document.getElementById("cropStepPanDown");

    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        activeCropTarget.focal.scale = Math.min(4.0, Math.round((activeCropTarget.focal.scale + 0.10) * 100) / 100);
        updatePreview();
      };
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        activeCropTarget.focal.scale = Math.max(0.25, Math.round((activeCropTarget.focal.scale - 0.10) * 100) / 100);
        updatePreview();
      };
    }
    if (panLeftBtn) {
      panLeftBtn.onclick = () => {
        activeCropTarget.focal.panX = Math.max(-100, activeCropTarget.focal.panX - 5);
        updatePreview();
      };
    }
    if (panRightBtn) {
      panRightBtn.onclick = () => {
        activeCropTarget.focal.panX = Math.min(100, activeCropTarget.focal.panX + 5);
        updatePreview();
      };
    }
    if (panUpBtn) {
      panUpBtn.onclick = () => {
        activeCropTarget.focal.panY = Math.max(-100, activeCropTarget.focal.panY - 5);
        updatePreview();
      };
    }
    if (panDownBtn) {
      panDownBtn.onclick = () => {
        activeCropTarget.focal.panY = Math.min(100, activeCropTarget.focal.panY + 5);
        updatePreview();
      };
    }

    // Quick Size Pills (50%, 75%, 100%, 125%, 150%, 200%, 300%)
    modal.querySelectorAll(".btn-size-pill").forEach(pill => {
      pill.onclick = () => {
        const sz = Number(pill.getAttribute("data-size"));
        if (sz && activeCropTarget) {
          activeCropTarget.focal.scale = sz / 100;
          updatePreview();
        }
      };
    });

    // Presets
    modal.querySelectorAll(".btn-crop-preset").forEach(btn => {
      btn.onclick = () => {
        const p = btn.getAttribute("data-preset");
        if (p === "center") {
          activeCropTarget.focal.panX = 0;
          activeCropTarget.focal.panY = 0;
          activeCropTarget.focal.scale = 1.0;
          activeCropTarget.focal.fit = "cover";
        } else if (p === "head") {
          activeCropTarget.focal.panX = 0;
          activeCropTarget.focal.panY = -18;
          activeCropTarget.focal.scale = 1.15;
          activeCropTarget.focal.fit = "cover";
        } else if (p === "base") {
          activeCropTarget.focal.panX = 0;
          activeCropTarget.focal.panY = 20;
          activeCropTarget.focal.scale = 1.15;
          activeCropTarget.focal.fit = "cover";
        } else if (p === "left") {
          activeCropTarget.focal.panX = -20;
          activeCropTarget.focal.panY = 0;
          activeCropTarget.focal.scale = 1.15;
          activeCropTarget.focal.fit = "cover";
        } else if (p === "right") {
          activeCropTarget.focal.panX = 20;
          activeCropTarget.focal.panY = 0;
          activeCropTarget.focal.scale = 1.15;
          activeCropTarget.focal.fit = "cover";
        } else if (p === "contain") {
          activeCropTarget.focal.panX = 0;
          activeCropTarget.focal.panY = 0;
          activeCropTarget.focal.scale = 1.0;
          activeCropTarget.focal.fit = "contain";
        }
        updatePreview();
      };
    });

    // Reset button
    const resetBtn = document.getElementById("resetCropBtn");
    if (resetBtn) {
      resetBtn.onclick = () => {
        activeCropTarget.focal = { fit: "cover", panX: 0, panY: 0, scale: 1.0 };
        updatePreview();
      };
    }

    // Interactive Drag to Pan & Resize Handles
    let isResizing = false;
    let activeHandle = null;
    let startScale = 1.0;
    let isShiftResize = false;
    let initialPinchDistance = null;

    // Direct resize handles (8 direction handles)
    modal.querySelectorAll(".crop-resize-handle").forEach(handle => {
      const onHandleStart = (clientX, clientY, handleName) => {
        isResizing = true;
        isDraggingCrop = false;
        activeHandle = handleName;
        dragStartX = clientX;
        dragStartY = clientY;
        startScale = activeCropTarget.focal.scale;
        previewBox.classList.add("is-resizing");
        handle.classList.add("active");
      };

      handle.onmousedown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onHandleStart(e.clientX, e.clientY, handle.getAttribute("data-handle"));
      };

      handle.ontouchstart = (e) => {
        if (e.touches.length === 1) {
          e.stopPropagation();
          onHandleStart(e.touches[0].clientX, e.touches[0].clientY, handle.getAttribute("data-handle"));
        }
      };
    });

    if (previewBox) {
      previewBox.onmousedown = (e) => {
        if (e.target.closest(".crop-resize-handle")) return;
        isDraggingCrop = true;
        isResizing = false;
        isShiftResize = e.shiftKey;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startPanX = activeCropTarget.focal.panX;
        startPanY = activeCropTarget.focal.panY;
        startScale = activeCropTarget.focal.scale;
        previewBox.style.cursor = isShiftResize ? "nwse-resize" : "grabbing";
      };

      const handlePointerMove = (clientX, clientY, shiftKey) => {
        if (!activeCropTarget) return;

        if (isResizing && activeHandle) {
          const dx = clientX - dragStartX;
          const dy = clientY - dragStartY;
          let delta = 0;
          if (activeHandle === "se") delta = (dx + dy) / 2;
          else if (activeHandle === "nw") delta = (-dx - dy) / 2;
          else if (activeHandle === "ne") delta = (dx - dy) / 2;
          else if (activeHandle === "sw") delta = (-dx + dy) / 2;
          else if (activeHandle === "e") delta = dx;
          else if (activeHandle === "w") delta = -dx;
          else if (activeHandle === "s") delta = dy;
          else if (activeHandle === "n") delta = -dy;

          const newScale = Math.max(0.25, Math.min(4.0, Math.round((startScale + (delta / 110)) * 100) / 100));
          activeCropTarget.focal.scale = newScale;
          updatePreview();
          return;
        }

        if (isDraggingCrop) {
          const rect = previewBox.getBoundingClientRect();
          if (shiftKey || isShiftResize) {
            // Shift-drag resizes
            const dy = dragStartY - clientY;
            const newScale = Math.max(0.25, Math.min(4.0, Math.round((startScale + (dy / 100)) * 100) / 100));
            activeCropTarget.focal.scale = newScale;
          } else {
            // Standard drag pans
            const deltaX = ((clientX - dragStartX) / rect.width) * 100;
            const deltaY = ((clientY - dragStartY) / rect.height) * 100;
            activeCropTarget.focal.panX = Math.round(Math.max(-100, Math.min(100, startPanX + deltaX)));
            activeCropTarget.focal.panY = Math.round(Math.max(-100, Math.min(100, startPanY + deltaY)));
          }
          updatePreview();
        }
      };

      window.onmousemove = (e) => {
        if (isDraggingCrop || isResizing) handlePointerMove(e.clientX, e.clientY, e.shiftKey);
      };

      window.onmouseup = () => {
        if (isDraggingCrop || isResizing) {
          isDraggingCrop = false;
          isResizing = false;
          activeHandle = null;
          isShiftResize = false;
          previewBox.style.cursor = "grab";
          previewBox.classList.remove("is-resizing");
          modal.querySelectorAll(".crop-resize-handle").forEach(h => h.classList.remove("active"));
        }
      };

      // Touch events for drag & pinch resize
      previewBox.ontouchstart = (e) => {
        if (e.target.closest(".crop-resize-handle")) return;
        if (e.touches.length === 2) {
          isResizing = true;
          isDraggingCrop = false;
          startScale = activeCropTarget.focal.scale;
          initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        } else if (e.touches.length === 1) {
          isDraggingCrop = true;
          isResizing = false;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          startPanX = activeCropTarget.focal.panX;
          startPanY = activeCropTarget.focal.panY;
        }
      };

      previewBox.ontouchmove = (e) => {
        if (e.touches.length === 2 && initialPinchDistance) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = dist / initialPinchDistance;
          activeCropTarget.focal.scale = Math.max(0.25, Math.min(4.0, Math.round(startScale * factor * 100) / 100));
          updatePreview();
        } else if (isDraggingCrop && e.touches.length === 1) {
          e.preventDefault();
          handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, false);
        }
      };

      previewBox.ontouchend = () => {
        isDraggingCrop = false;
        isResizing = false;
        activeHandle = null;
        initialPinchDistance = null;
        previewBox.classList.remove("is-resizing");
      };

      // Mouse wheel zoom over preview box
      previewBox.onwheel = (e) => {
        e.preventDefault();
        const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
        activeCropTarget.focal.scale = Math.round(Math.max(0.25, Math.min(4.0, activeCropTarget.focal.scale + zoomStep)) * 100) / 100;
        updatePreview();
      };
    }

    // Save button - now safely calls persistData without ReferenceError!
    const saveBtn = document.getElementById("saveCropBtn");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        try {
          activeCropTarget.targetObj.focalPosition = { ...activeCropTarget.focal };
          
          // Also sync to appData.aspects or appData.spirits directly
          if (activeCropTarget.aspect) {
            const asp = (appData.aspects || []).find(a => a.spirit === activeCropTarget.spirit.name && a.name === activeCropTarget.aspect.name);
            if (asp) asp.focalPosition = { ...activeCropTarget.focal };
          } else {
            const sp = (appData.spirits || []).find(s => s.name === activeCropTarget.spirit.name);
            if (sp) sp.focalPosition = { ...activeCropTarget.focal };
          }

          await persistData(`Saved artwork refit for ${activeCropTarget.title}`);
          showToast(`Artwork refit saved for ${activeCropTarget.title}`);
          closeCropModal();
          renderDossier();
          renderCodexSpirits();
          renderZenAwakenedStrip();
        } catch (err) {
          console.error("Save refit error:", err);
          showToast(`Failed to save: ${err.message}`);
        }
      };
    }

    // Close & Cancel buttons
    const closeBtn = document.getElementById("closeCropModalBtn");
    const cancelBtn = document.getElementById("cancelCropBtn");
    if (closeBtn) closeBtn.onclick = closeCropModal;
    if (cancelBtn) cancelBtn.onclick = closeCropModal;
    modal.onclick = (e) => { if (e.target === modal) closeCropModal(); };

    // Initialize state
    setupAspectsForSpirit(curSpirit, curAspect?.name || "Base");
    setTarget(curSpirit, curAspect);

    modal.classList.add("open");
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeCropModal() {
    const modal = document.getElementById("cropArtModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.style.display = "none";
    document.body.style.overflow = "";
    isDraggingCrop = false;
  }
  window.openCropModal = openCropModal;

  function renderDossier() {
    initDossierCombobox();
    const spiritStats = SIAnalytics.computeSpiritStats(getStatsData());

    const mostPlayed = spiritStats.slice().sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0))[0];
    const sp = spiritStats.find(s => s.name === selectedDossierSpirit) || mostPlayed || spiritStats[0];
    if (!sp) return;
    selectedDossierSpirit = sp.name;

    // Sync combobox input and hidden select
    const input = document.getElementById("dossierSearchableInput");
    const wrapper = document.getElementById("dossierCombobox");
    if (input && (!wrapper || !wrapper.classList.contains("open"))) {
      input.value = sp.name;
    }
    const hiddenSelect = document.getElementById("dossierSpiritSelect");
    if (hiddenSelect) {
      hiddenSelect.innerHTML = spiritStats.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === sp.name ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
      hiddenSelect.value = sp.name;
    }

    const aspectStatsAll = SIAnalytics.computeAspectStats(getStatsData());
    const aspectRows = SIAnalytics.getSpiritAspectBreakdown(appData, sp.name, aspectStatsAll);
    if (!aspectRows.some(r => r.name === selectedDossierAspect)) selectedDossierAspect = "Base";
    const aspSelectEl = document.getElementById("dossierAspectSelect");
    if (aspSelectEl) {
      if (aspectRows.length > 1) {
        aspSelectEl.style.display = "";
        aspSelectEl.innerHTML = aspectRows.map(r =>
          `<option value="${escapeHtml(r.name)}" ${r.name === selectedDossierAspect ? "selected" : ""}>${r.isBase ? "Base Spirit" : "Aspect: " + escapeHtml(r.name)} (${r.gamesPlayed}g)</option>`
        ).join("");
        aspSelectEl.onchange = e => {
          selectedDossierAspect = e.target.value;
          renderDossier();
        };
      } else {
        aspSelectEl.style.display = "none";
        aspSelectEl.innerHTML = "";
      }
    }
    const curAsp = aspectRows.find(r => r.name === selectedDossierAspect);

    const bodyEl = document.getElementById("dossierBody");
    if (!bodyEl) return;

    const winRateStr = sp.winRate !== null ? `${SIAnalytics.formatNum(sp.winRate, 1)}%` : "—";
    const elementsHtml = Object.keys(ELEMENT_COLORS).map(elName => {
      const count = sp.elements?.[elName] || 0;
      const pct = Math.min(100, (count / 5) * 100);
      const iconUrl = appData.elementIcons?.[elName];
      return `
        <div class="element-pill">
          <div style="width:100%;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="display:flex;align-items:center;gap:0.35rem;font-weight:600;">
                ${iconUrl ? `<img src="${iconUrl}" alt="${elName}" onerror="this.style.display='none'">` : ""}
                ${elName}
              </span>
              <span class="mono" style="font-weight:700;color:${ count > 0 ? ELEMENT_COLORS[elName] : 'var(--text-muted)' }">${count}</span>
            </div>
            <div class="element-bar-track">
              <div class="element-bar-fill" style="width:${pct}%;background:${ELEMENT_COLORS[elName]};"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const uniquePowers = (appData.powers || []).filter(p => p.spirit && p.spirit.toLowerCase() === sp.name.toLowerCase());

    bodyEl.innerHTML = `
      <div class="dossier-hero">
        <div class="spirit-portrait-frame">
          <img id="dossierPortraitImg" src="${escapeHtml((curAsp && curAsp.image) ? curAsp.image : sp.image)}" alt="${escapeHtml(sp.name)}" style="${getFocalStyle((curAsp && curAsp.image) ? curAsp : sp)}" onerror=\"this.onerror=null;this.src='assets/spirits/volcano_looming_high.png'\" title="${curAsp && curAsp.image ? 'Artwork: ' + escapeHtml(curAsp.name) + ' Aspect' : escapeHtml(sp.name)}">
          <button type="button" class="btn-crop-trigger" id="openCropModalBtn" title="Manually Refit & Center Artwork">Refit Art</button>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.65rem;">
            <span class="badge ${getComplexityBadgeClass(sp.complexity)}">${escapeHtml(sp.complexity)} Complexity</span>
            <span class="badge badge-neutral">${escapeHtml(sp.expansion)}</span>
            <span class="badge ${sp.owned ? 'badge-win' : 'badge-unchallenged'}">${sp.owned ? 'Owned in Collection' : 'Unowned Expansion'}</span>
          </div>
          <div class="dossier-stats-grid">
            <div class="mini-stat">
              <div class="mini-stat-label">Games Played</div>
              <div class="mini-stat-val">${sp.gamesPlayed} <span style="font-size:0.75rem;color:var(--text-secondary);">(${sp.gamesWon}W)</span></div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Win Rate</div>
              <div class="mini-stat-val" style="color:var(--accent-emerald-light);">${winRateStr}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Top Guardian</div>
              <div class="mini-stat-val">${escapeHtml(sp.topPlayer)}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Best Aspect</div>
              <div class="mini-stat-val">${escapeHtml(sp.bestAspect)}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Max Diff Won</div>
              <div class="mini-stat-val">Lvl ${sp.maxDifficultyWon}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Record Score</div>
              <div class="mini-stat-val">${sp.recordScore > 0 ? SIAnalytics.formatNum(sp.recordScore, 1) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      ${aspectRows.length > 1 ? renderAspectLedger(sp, aspectRows, curAsp) : ""}

      <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-gold-light);margin-bottom:0.45rem;">
        Growth & Progression Tracks
      </div>
      <div class="tracks-box">
        <div class="mini-stat">
          <div class="mini-stat-label">Energy Track</div>
          <div class="mini-stat-val">Min ${sp.minEnergy} → Max ${sp.maxEnergy}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Card Plays Track</div>
          <div class="mini-stat-val">Min ${sp.minPlays} → Max ${sp.maxPlays}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Starting Hand</div>
          <div class="mini-stat-val">Σ ${sp.startingCost} Energy (${sp.fastCards}F / ${sp.slowCards}S)</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.45rem;">
        <span style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-gold-light);">
          Innate Elemental Affinity Breakdown
        </span>
        <span class="badge badge-neutral">${escapeHtml(sp.affinityProfile || 'Balanced')}</span>
      </div>
      <div class="elements-grid">
        ${elementsHtml}
      </div>

      ${uniquePowers.length > 0 ? `
        <div style="margin-top:0.75rem;display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.73rem;color:var(--text-secondary);font-weight:700;">Unique Powers:</span>
          ${uniquePowers.map(up => `<span class="badge ${up.speed === 'Fast' ? 'badge-loss' : 'badge-neutral'}" title="${escapeHtml(up.description)}">${escapeHtml(up.name)} (${up.cost}${up.speed})</span>`).join("")}
        </div>
      ` : ""}
    `;

    bodyEl.querySelectorAll(".aspect-ledger-row").forEach(row => {
      row.addEventListener("click", () => {
        selectedDossierAspect = row.getAttribute("data-aspect");
        renderDossier();
      });
    });

    bodyEl.querySelector("#openCropModalBtn")?.addEventListener("click", () => {
      const sp = (appData.spirits || []).find(s => s.name === selectedDossierSpirit) || (appData.spirits || [])[0];
      const asp = (selectedDossierAspect && selectedDossierAspect !== "Base")
        ? (appData.aspects || []).find(a => a.spirit === sp?.name && a.name === selectedDossierAspect)
        : null;
      if (sp) openCropModal(sp, asp);
    });

    bodyEl.querySelector(".log-with-aspect-btn")?.addEventListener("click", e => {
      const b = e.currentTarget;
      openMatchModal({ players: [{ spirit: b.getAttribute("data-spirit"), aspect: b.getAttribute("data-aspect"), player: (appData.players?.[0]?.name) || "Benjamin" }] });
    });
  }

  // Aspect stats card + per-aspect comparison table (used in the Dossier)
  function renderAspectLedger(sp, rows, cur) {
    const base = rows.find(r => r.isBase);
    const fmtWr = r => r.winRate !== null ? `${Math.round(r.winRate)}%` : "—";
    const delta = (a, b) => {
      if (a === null || b === null || a === undefined || b === undefined) return "";
      const d = Math.round(a - b);
      if (d === 0) return `<span style="color:var(--text-muted);font-size:0.68rem;"> ±0</span>`;
      return `<span style="font-size:0.68rem;color:${d > 0 ? 'var(--accent-emerald-light)' : 'var(--accent-crimson)'};"> ${d > 0 ? '+' : ''}${d}</span>`;
    };
    const ch = complexityArrowLabel(cur?.complexityChange);
    const curCard = cur ? `
      <div class="mini-stat" style="padding:0.8rem 0.9rem;margin-bottom:0.65rem;border-left:3px solid var(--accent-gold);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:0.65rem;">
            ${cur.image ? `<img src="${escapeHtml(cur.image)}" alt="" style="width:46px;height:46px;border-radius:6px;object-fit:cover;border:1px solid var(--border-subtle);flex-shrink:0;" onerror="this.style.display='none'">` : ""}
            <div>
              <div style="font-family:'Cinzel',serif;font-weight:700;font-size:1rem;">
                ${cur.isBase ? "Base Spirit" : `Aspect of ${escapeHtml(cur.name)}`}
              </div>
              <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.2rem;">
                ${cur.isBase ? "" : `<span class="badge ${ch.cls}">${ch.txt} Complexity</span>`}
                <span class="badge badge-neutral">${escapeHtml(cur.expansion || "—")}</span>
              </div>
            </div>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-secondary);margin:0.5rem 0 0.6rem;line-height:1.45;">${escapeHtml(cur.description || "")}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:0.5rem;">
          <div><div class="mini-stat-label">Games</div><div class="mini-stat-val">${cur.gamesPlayed} <span style="font-size:0.72rem;color:var(--text-secondary);">(${cur.gamesWon}W)</span></div></div>
          <div><div class="mini-stat-label">Win Rate</div><div class="mini-stat-val">${fmtWr(cur)}${!cur.isBase && base ? delta(cur.winRate, base.winRate) : ""}</div></div>
          <div><div class="mini-stat-label">Record Score</div><div class="mini-stat-val">${cur.recordScore > 0 ? SIAnalytics.formatNum(cur.recordScore, 1) : "—"}</div></div>
          <div><div class="mini-stat-label">Max Diff Won</div><div class="mini-stat-val">${cur.gamesWon > 0 ? "Lvl " + cur.maxDifficultyWon : "—"}</div></div>
          <div><div class="mini-stat-label">Top Guardian</div><div class="mini-stat-val">${escapeHtml(cur.topPlayer)}</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:0.6rem;">
          <button type="button" class="btn btn-secondary btn-sm log-with-aspect-btn" data-spirit="${escapeHtml(sp.name)}" data-aspect="${cur.isBase ? "" : escapeHtml(cur.name)}">+ Log a game with ${cur.isBase ? "Base" : escapeHtml(cur.name)}</button>
        </div>
      </div>` : "";

    return `
      <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-gold-light);margin-bottom:0.45rem;">
        Aspects Played (${rows.filter(r => !r.isBase && r.gamesPlayed > 0).length}/${rows.length - 1})
      </div>
      ${curCard}
      <div class="table-wrap" style="margin-bottom:0.9rem;">
        <table class="data-table" style="font-size:0.78rem;">
          <thead><tr><th>Aspect</th><th>Complexity</th><th>Games</th><th>Win %</th><th>Record</th></tr></thead>
          <tbody>
            ${rows.map(r => {
              const c = complexityArrowLabel(r.complexityChange);
              const active = cur && r.name === cur.name;
              return `<tr class="aspect-ledger-row" data-aspect="${escapeHtml(r.name)}" style="cursor:pointer;${active ? 'background:rgba(245,158,11,0.10);' : ''}${r.gamesPlayed === 0 ? 'opacity:0.6;' : ''}">
                <td style="font-weight:700;">${r.isBase ? "Base Spirit" : escapeHtml(r.name)}</td>
                <td>${r.isBase ? '<span class="badge badge-neutral">Base</span>' : `<span class="badge ${c.cls}">${c.txt}</span>`}</td>
                <td class="mono">${r.gamesPlayed}</td>
                <td class="mono">${fmtWr(r)}</td>
                <td class="mono">${r.recordScore > 0 ? SIAnalytics.formatNum(r.recordScore, 1) : "—"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
