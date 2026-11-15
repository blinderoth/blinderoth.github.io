/**
 * SPIRIT ISLAND: THEMATIC ANIMATIONS & ELEMENTAL PARTICLES ENGINE
 * Brings the island alive with ambient spirit motes, count-up figures,
 * and canonical elemental auras across Dashboard and Codex.
 */

(function () {
  "use strict";

  // =========================================================================
  // 1. SPIRIT MOTES AMBIENT PARTICLE CANVAS
  // =========================================================================
  let motesCanvas = null;
  let motesCtx = null;
  let motesAnimId = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Off by default for people who ask their OS for less motion; an explicit choice still wins.
  const savedMotes = localStorage.getItem("si_motes_enabled");
  let motesEnabled = savedMotes === null ? !reducedMotion.matches : savedMotes !== "false";
  const particles = [];
  // Fewer motes on small screens (phones at the table).
  const PARTICLE_COUNT = window.innerWidth < 700 ? 16 : 30;
  let lastFrame = 0;

  const ELEMENT_PARTICLE_COLORS = [
    { r: 44, g: 94, b: 67 },   // Plant / Fern
    { r: 156, g: 120, b: 52 }, // Sun / Gold
    { r: 41, g: 128, b: 185 }, // Water / Ocean
    { r: 211, g: 84, b: 0 },   // Fire / Ember
    { r: 108, g: 92, b: 231 }, // Moon / Darkness
    { r: 127, g: 140, b: 141 } // Earth / Rock
  ];

  function initMotesCanvas() {
    if (document.getElementById("spiritMotesCanvas")) return;

    motesCanvas = document.createElement("canvas");
    motesCanvas.id = "spiritMotesCanvas";
    document.body.prepend(motesCanvas);
    motesCtx = motesCanvas.getContext("2d");

    function resize() {
      if (!motesCanvas) return;
      motesCanvas.width = window.innerWidth;
      motesCanvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(true));
    }

    if (motesEnabled) {
      startMotesAnimation();
    } else {
      motesCanvas.style.opacity = "0";
    }

    // Stop drawing while the tab is hidden; resume when it comes back.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (motesAnimId) cancelAnimationFrame(motesAnimId);
        motesAnimId = null;
      } else if (motesEnabled) {
        startMotesAnimation();
      }
    });

    addMotesToggleControl();
  }

  function createParticle(randomY) {
    const w = motesCanvas ? motesCanvas.width : window.innerWidth;
    const h = motesCanvas ? motesCanvas.height : window.innerHeight;
    const col = ELEMENT_PARTICLE_COLORS[Math.floor(Math.random() * ELEMENT_PARTICLE_COLORS.length)];
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + Math.random() * 20,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.45 + 0.15,
      speedX: (Math.random() - 0.5) * 0.35,
      color: col,
      alpha: Math.random() * 0.35 + 0.1,
      maxAlpha: Math.random() * 0.4 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.008,
      pulsePhase: Math.random() * Math.PI * 2,
      driftAngle: Math.random() * Math.PI * 2
    };
  }

  function startMotesAnimation() {
    if (motesAnimId) cancelAnimationFrame(motesAnimId);

    function loop(now) {
      if (!motesEnabled || !motesCtx || !motesCanvas || document.hidden) { motesAnimId = null; return; }
      // Cap at ~30 fps: the motes drift slowly, so 60 fps only costs battery.
      if (now - lastFrame < 33) { motesAnimId = requestAnimationFrame(loop); return; }
      lastFrame = now;

      motesCtx.clearRect(0, 0, motesCanvas.width, motesCanvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pulsePhase += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.12;

        p.y -= p.speedY;
        p.x += Math.sin(p.y * 0.01 + p.driftAngle) * 0.4 + p.speedX;

        if (p.y < -20 || p.x < -20 || p.x > motesCanvas.width + 20) {
          particles[i] = createParticle(false);
          continue;
        }

        motesCtx.beginPath();
        motesCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        motesCtx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${Math.max(0.04, currentAlpha)})`;
        motesCtx.fill();
      }

      motesAnimId = requestAnimationFrame(loop);
    }

    motesAnimId = requestAnimationFrame(loop);
  }

  function addMotesToggleControl() {
    const bars = document.querySelectorAll(".mockup-bar, header, .zen-header-actions");
    if (bars.length > 0) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-motes-toggle";
      btn.style.cssText = "background:transparent;border:1.5px solid var(--border-subtle, #526358);color:inherit;font-size:11px;padding:0.25rem 0.55rem;border-radius:4px;cursor:pointer;opacity:0.85;margin-left:0.5rem;";
      btn.setAttribute("aria-pressed", String(motesEnabled));
      btn.innerHTML = mototesButtonText();
      btn.onclick = function () {
        motesEnabled = !motesEnabled;
        localStorage.setItem("si_motes_enabled", String(motesEnabled));
        btn.setAttribute("aria-pressed", String(motesEnabled));
        btn.innerHTML = mototesButtonText();
        if (motesCanvas) {
          motesCanvas.style.opacity = motesEnabled ? "0.65" : "0";
        }
        if (motesEnabled) startMotesAnimation();
        else if (motesAnimId) { cancelAnimationFrame(motesAnimId); motesAnimId = null; if (motesCtx) motesCtx.clearRect(0, 0, motesCanvas.width, motesCanvas.height); }
      };

      const target = document.querySelector(".zen-header-actions") || document.querySelector(".mockup-links") || bars[0];
      if (target) target.appendChild(btn);
    }
  }

  function mototesButtonText() {
    return motesEnabled ? "✨ Spirit Presence: Active" : "✨ Spirit Presence: Paused";
  }

  // =========================================================================
  // 2. ANIMATED HERO KPI ROLL-UP COUNTER
  // =========================================================================
  function animateCounter(el, targetVal, durationMs = 1200, isPercent = false, decimals = 0) {
    if (!el) return;
    const startTime = performance.now();
    const startVal = 0;

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startVal + (targetVal - startVal) * ease;

      el.textContent = (decimals > 0 ? current.toFixed(decimals) : Math.round(current)) + (isPercent ? "%" : "");

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = (decimals > 0 ? targetVal.toFixed(decimals) : targetVal) + (isPercent ? "%" : "");
      }
    }

    requestAnimationFrame(frame);
  }

  function triggerKpiCountUp() {
    if (reducedMotion.matches) return;
    const zfNums = document.querySelectorAll(".zf-num, .kpi-value");
    if (!zfNums || zfNums.length < 4) return;

    zfNums.forEach(numEl => {
      if (numEl.children.length > 0) return;
      const text = numEl.textContent.trim();
      if (!text || numEl.dataset.animated === "1" || !/^\d+(?:\.\d+)?%?$/.test(text)) return;

      const isPercent = text.endsWith("%");
      const cleanNum = parseFloat(text);
      if (isNaN(cleanNum)) return;

      numEl.dataset.animated = "1";
      const decimals = text.includes(".") ? 1 : 0;
      animateCounter(numEl, cleanNum, 1100, isPercent, decimals);
    });
  }

  // =========================================================================
  // 3. COMPLETE 39 SPIRIT ELEMENTAL AURA MAPPING (CODEX & DASHBOARD)
  // =========================================================================
  const SPIRIT_PRIMARY_ELEMENT = {
    // Core Game
    "River Surges in Sunlight": "aura-water",
    "Lightning's Swift Strike": "aura-air",
    "Shadows Flicker like Flame": "aura-moon",
    "Shadows Flicker Like Flame": "aura-moon",
    "Vital Strength of the Earth": "aura-earth",
    "A Spread of Rampant Green": "aura-plant",
    "Thunderspeaker": "aura-air",
    "Ocean's Hungry Grasp": "aura-water",
    "Bringer of Dreams and Nightmares": "aura-moon",

    // Branch and Claw
    "Keeper of the Forbidden Wilds": "aura-plant",
    "Sharp Fangs Behind the Leaves": "aura-animal",

    // Jagged Earth
    "Fractured Days Split the Sky": "aura-sun",
    "Grinning Trickster Stirs Up Trouble": "aura-moon",
    "Lure of the Deep Wilderness": "aura-plant",
    "Many Minds Move as One": "aura-animal",
    "Shifting Memory of Ages": "aura-moon",
    "Shroud of Silent Mist": "aura-water",
    "Starlight Seeks Its Form": "aura-moon",
    "Stone's Unyielding Defiance": "aura-earth",
    "Vengeance as a Burning Plague": "aura-fire",
    "Volcano Looming High": "aura-fire",

    // Promo Packs & Horizons
    "Downpour Drenches the World": "aura-water",
    "Finder of Paths Unseen": "aura-sun",
    "Heart of the Wildfire": "aura-fire",
    "Serpent Slumbering Beneath the Island": "aura-earth",
    "Devouring Teeth Lurk Underfoot": "aura-animal",
    "Eyes Watch From the Trees": "aura-plant",
    "Fathomless Mud of the Swamp": "aura-water",
    "Rising Heat of Stone and Sand": "aura-fire",
    "Sun-Bright Whirlwind": "aura-sun",

    // Nature Incarnate
    "Breath of Darkness Down Your Spine": "aura-moon",
    "Dances Up Earthquakes": "aura-earth",
    "Ember-Eyed Behemoth": "aura-fire",
    "Hearth-Vigil": "aura-sun",
    "Relentless Gaze of the Sun": "aura-sun",
    "Towering Roots of the Jungle": "aura-plant",
    "Wandering Voice Keens Delirium": "aura-air",
    "Wounded Waters Bleeding": "aura-water",

    // Apocrypha
    "Covets Gleaming Shards of Earth": "aura-fire",
    "Spreading Rot Renews the Earth": "aura-plant"
  };

  function applySpiritElementalAuras() {
    // 1. Spirits in Dashboard and Codex Grid
    document.querySelectorAll(".spirit-card, .zen-spirit-card, .rec-spirit-card, .spirit-player-chip").forEach(card => {
      const name = card.getAttribute("data-spirit") ||
                   card.querySelector(".spirit-name, .zen-spirit-name")?.textContent.trim();
      if (name && SPIRIT_PRIMARY_ELEMENT[name]) {
        const auraClass = SPIRIT_PRIMARY_ELEMENT[name];
        card.classList.add("animated-elemental-card");
        card.onmouseenter = () => card.classList.add(auraClass);
        card.onmouseleave = () => card.classList.remove(auraClass);
      }
    });

    // 2. Aspects in Codex Aspects Mastery View
    document.querySelectorAll(".aspect-mastery-card").forEach(ac => {
      const spName = ac.querySelector(".aspect-spirit-label")?.textContent.trim() ||
                     ac.getAttribute("data-spirit");
      if (spName && SPIRIT_PRIMARY_ELEMENT[spName]) {
        const auraClass = SPIRIT_PRIMARY_ELEMENT[spName];
        ac.classList.add("animated-elemental-card");
        ac.onmouseenter = () => ac.classList.add(auraClass);
        ac.onmouseleave = () => ac.classList.remove(auraClass);
      }
    });

    // 3. Adversaries in Codex Adversaries View
    document.querySelectorAll(".adversary-card").forEach(adv => {
      adv.classList.add("animated-adversary-card");
    });
  }

  // =========================================================================
  // 4. LIFECYCLE HOOKS
  // =========================================================================
  window.addEventListener("DOMContentLoaded", () => {
    initMotesCanvas();
    setTimeout(() => {
      triggerKpiCountUp();
      applySpiritElementalAuras();
    }, 250);

    // Re-trigger counter & auras when switching tabs or codex subtabs
    document.querySelectorAll(".nav-tab, .zen-nav-btn, .sub-nav-btn").forEach(tab => {
      tab.addEventListener("click", () => {
        setTimeout(() => {
          document.querySelectorAll(".zf-num, .kpi-value").forEach(el => delete el.dataset.animated);
          triggerKpiCountUp();
          applySpiritElementalAuras();
        }, 150);
      });
    });
  });

  // Export globally
  window.SpiritAnimations = {
    triggerCountUp: triggerKpiCountUp,
    applyAuras: applySpiritElementalAuras
  };
})();
