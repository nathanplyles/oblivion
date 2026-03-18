(() => {
  const root = document.documentElement;
  const mediaReduce = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const mediaMobile = window.matchMedia
    ? window.matchMedia("(max-width: 900px)")
    : null;

  const KEYS = {
    cursor: "oblivionCursorEnabled",
    motion: "oblivionReduceMotion",
    density: "oblivionDensity",
    theme: "oblivionThemeProfile",
    bgSpeed: "oblivionBgSpeedV1",
    bgDensity: "oblivionBgDensityV1",
    bgFx: "oblivionBgFxV1",
    iconOrder: "oblivionHomeIconOrder",
    pinned: "oblivionPinnedScreens",
    tips: "oblivionTipsSeenV1",
    onboardingPromptSeen: "oblivionOnboardingPromptSeenV1",
    onboardingEnabled: "oblivionOnboardingEnabledV1",
    onboardingSeenScreens: "oblivionOnboardingSeenScreensV1",
  };

  let cursorEnabled = readBool(KEYS.cursor, true);
  let motionPref = readEnum(KEYS.motion, ["1", "0"], null);
  let density = readEnum(KEYS.density, ["comfortable", "compact"], "comfortable");
  let themeProfile = readEnum(KEYS.theme, ["default", "high-contrast", "soft-glow", "minimal"], "default");
  let bgSpeed = readNumber(KEYS.bgSpeed, 1, 0.6, 1.8);
  let bgDensity = readNumber(KEYS.bgDensity, 1, 0.5, 1.7);
  let bgFx = readNumber(KEYS.bgFx, 1, 0.4, 1.6);

  const statusState = {
    inflight: 0,
    apiLastErr: 0,
    apiLastOk: 0,
  };

  function readBool(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "1";
    } catch {
      return fallback;
    }
  }

  function readEnum(key, allowed, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (allowed.includes(value)) return value;
    } catch {}
    return fallback;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readNumber(key, fallback, min, max) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw === null ? fallback : Number(raw);
      if (!Number.isFinite(value)) return fallback;
      return Math.max(min, Math.min(max, value));
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function reduceMotionActive() {
    if (motionPref === "1") return true;
    if (motionPref === "0") return false;
    return !!(mediaReduce && mediaReduce.matches);
  }

  function isMobile() {
    return !!(mediaMobile && mediaMobile.matches);
  }

  function applyThemeClass() {
    root.classList.remove("theme-high-contrast", "theme-soft-glow", "theme-minimal");
    if (themeProfile === "high-contrast") root.classList.add("theme-high-contrast");
    if (themeProfile === "soft-glow") root.classList.add("theme-soft-glow");
    if (themeProfile === "minimal") root.classList.add("theme-minimal");
  }

  function applyDensityClass() {
    root.classList.remove("density-compact", "density-comfortable");
    root.classList.add(density === "compact" ? "density-compact" : "density-comfortable");
  }

  function applyPrefs() {
    const reduce = reduceMotionActive();
    root.classList.toggle("cursor-native", !cursorEnabled);
    root.classList.toggle("reduce-motion", reduce);
    root.classList.toggle("motion-full", motionPref === "0");
    root.classList.toggle("is-mobile", isMobile());
    root.dataset.motionForced = motionPref === "1" ? "1" : "0";
    applyDensityClass();
    applyThemeClass();
    window.dispatchEvent(
      new CustomEvent("oblivion:cursorchange", { detail: { enabled: cursorEnabled } }),
    );
    window.dispatchEvent(
      new CustomEvent("oblivion:motionchange", {
        detail: { reduceMotion: reduce, forced: motionPref === "1" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("oblivion:bgprefschange", {
        detail: { speed: bgSpeed, density: bgDensity, fx: bgFx },
      }),
    );
  }

  function setCursorEnabled(enabled) {
    cursorEnabled = !!enabled;
    write(KEYS.cursor, cursorEnabled ? "1" : "0");
    applyPrefs();
  }

  function setReduceMotion(enabled) {
    motionPref = enabled ? "1" : "0";
    write(KEYS.motion, motionPref);
    applyPrefs();
  }

  function setDensity(nextDensity) {
    density = nextDensity === "compact" ? "compact" : "comfortable";
    write(KEYS.density, density);
    applyPrefs();
  }

  function setThemeProfile(nextTheme) {
    themeProfile =
      nextTheme === "high-contrast" ||
      nextTheme === "soft-glow" ||
      nextTheme === "minimal"
        ? nextTheme
        : "default";
    write(KEYS.theme, themeProfile);
    applyPrefs();
  }

  function setBgPrefs(next) {
    if (typeof next.speed === "number") bgSpeed = Math.max(0.6, Math.min(1.8, next.speed));
    if (typeof next.density === "number") bgDensity = Math.max(0.5, Math.min(1.7, next.density));
    if (typeof next.fx === "number") bgFx = Math.max(0.4, Math.min(1.6, next.fx));
    write(KEYS.bgSpeed, String(bgSpeed));
    write(KEYS.bgDensity, String(bgDensity));
    write(KEYS.bgFx, String(bgFx));
    applyPrefs();
  }

  function makeKeyboardClickable(selector) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.kbdBound === "1") return;
      el.dataset.kbdBound = "1";
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  function ensureInterfaceSection() {
    const settingsInner = document.querySelector("#screen-settings .settings-inner");
    if (!settingsInner || document.getElementById("uxInterfaceSection")) return;

    const section = document.createElement("div");
    section.className = "settings-section";
    section.id = "uxInterfaceSection";
    section.innerHTML = `
      <div class="settings-section-title">interface</div>
      <div class="ux-inline-controls">
        <div class="ux-control-row">
          <div class="ux-control-label">
            visual profile
            <span class="ux-control-sub">high contrast, soft glow, or minimal chrome</span>
          </div>
          <div class="ux-chip-group" id="uxThemeGroup">
            <button class="ux-chip" data-theme="default">default</button>
            <button class="ux-chip" data-theme="high-contrast">high contrast</button>
            <button class="ux-chip" data-theme="soft-glow">soft glow</button>
            <button class="ux-chip" data-theme="minimal">minimal</button>
          </div>
        </div>
        <div class="ux-control-row">
          <div class="ux-control-label">
            density
            <span class="ux-control-sub">compact tightens spacing, comfortable breathes</span>
          </div>
          <select id="uxDensitySelect" class="ux-select">
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
          </select>
        </div>
      </div>
    `;

    const aboutSection = [...settingsInner.querySelectorAll(".settings-section")].find((s) => {
      const title = s.querySelector(".settings-section-title");
      return title && title.textContent.trim().toLowerCase() === "about";
    });
    if (aboutSection) settingsInner.insertBefore(section, aboutSection);
    else settingsInner.appendChild(section);
  }

  function ensureBackgroundTuningSection() {
    const bgSection = [...document.querySelectorAll("#screen-settings .settings-section")].find((s) => {
      const title = s.querySelector(".settings-section-title");
      return title && title.textContent.trim().toLowerCase() === "background";
    });
    if (!bgSection || document.getElementById("uxBgTuneWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "uxBgTuneWrap";
    wrap.className = "ux-bg-tune-wrap";
    wrap.innerHTML = `
      <div class="ux-control-row ux-range-row">
        <div class="ux-control-label">
          motion speed
          <span class="ux-control-sub">slow it down or make it more alive</span>
        </div>
        <div class="ux-range-wrap">
          <input id="uxBgSpeed" class="ux-range" type="range" min="0.6" max="1.8" step="0.05">
          <span id="uxBgSpeedVal" class="ux-range-val">1.00x</span>
        </div>
      </div>
      <div class="ux-control-row ux-range-row">
        <div class="ux-control-label">
          particle density
          <span class="ux-control-sub">how populated backgrounds feel</span>
        </div>
        <div class="ux-range-wrap">
          <input id="uxBgDensity" class="ux-range" type="range" min="0.5" max="1.7" step="0.05">
          <span id="uxBgDensityVal" class="ux-range-val">1.00x</span>
        </div>
      </div>
      <div class="ux-control-row ux-range-row">
        <div class="ux-control-label">
          visual effects
          <span class="ux-control-sub">glow + highlight intensity</span>
        </div>
        <div class="ux-range-wrap">
          <input id="uxBgFx" class="ux-range" type="range" min="0.4" max="1.6" step="0.05">
          <span id="uxBgFxVal" class="ux-range-val">1.00x</span>
        </div>
      </div>
    `;
    bgSection.appendChild(wrap);
  }

  function organizeSettings() {
    const settingsInner = document.querySelector("#screen-settings .settings-inner");
    if (!settingsInner) return;

    const sections = [...settingsInner.querySelectorAll(".settings-section")];
    sections.forEach((section) => {
      const titleEl = section.querySelector(".settings-section-title");
      if (!titleEl) return;
      const title = titleEl.textContent.trim().toLowerCase();
      section.classList.add("ux-setting-card");
      if (section.dataset.helpBound === "1") return;
      section.dataset.helpBound = "1";

      const helpMap = {
        background: "Choose ambient visuals and animation style.",
        "tab cloak": "Rename tab and icon for safer multitasking.",
        "color scheme": "Pick the accent and base visual direction.",
        interface: "Set spacing and profile style.",
        accessibility: "Cursor and motion controls live here.",
        about: "Project links and identity.",
      };
      const help = helpMap[title];
      if (help) {
        const helpEl = document.createElement("div");
        helpEl.className = "ux-section-help";
        helpEl.textContent = help;
        titleEl.insertAdjacentElement("afterend", helpEl);
      }
    });

    const grouping = [
      { label: "Personalization", titles: ["background", "color scheme", "interface"] },
      { label: "Safety", titles: ["tab cloak"] },
      { label: "Accessibility", titles: ["accessibility"] },
      { label: "Info", titles: ["about"] },
    ];

    grouping.forEach((group) => {
      if (settingsInner.querySelector(`.ux-settings-group[data-group="${group.label}"]`)) return;
      const first = sections.find((s) => {
        const t = s.querySelector(".settings-section-title");
        return t && group.titles.includes(t.textContent.trim().toLowerCase());
      });
      if (!first) return;
      const label = document.createElement("div");
      label.className = "ux-settings-group";
      label.dataset.group = group.label;
      label.textContent = group.label;
      settingsInner.insertBefore(label, first);
    });
  }

  function bindSettings() {
    const nativeCursorToggle = document.getElementById("nativeCursorToggle");
    const reduceMotionToggle = document.getElementById("reduceMotionToggle");
    const densitySelect = document.getElementById("uxDensitySelect");
    const themeGroup = document.getElementById("uxThemeGroup");
    const bgSpeedInput = document.getElementById("uxBgSpeed");
    const bgDensityInput = document.getElementById("uxBgDensity");
    const bgFxInput = document.getElementById("uxBgFx");
    const bgSpeedVal = document.getElementById("uxBgSpeedVal");
    const bgDensityVal = document.getElementById("uxBgDensityVal");
    const bgFxVal = document.getElementById("uxBgFxVal");

    if (nativeCursorToggle) {
      nativeCursorToggle.checked = !cursorEnabled;
      nativeCursorToggle.addEventListener("change", () => {
        setCursorEnabled(!nativeCursorToggle.checked);
      });
    }

    if (reduceMotionToggle) {
      reduceMotionToggle.checked = reduceMotionActive();
      reduceMotionToggle.addEventListener("change", () => {
        setReduceMotion(reduceMotionToggle.checked);
      });
    }

    if (densitySelect) {
      densitySelect.value = density;
      densitySelect.addEventListener("change", () => setDensity(densitySelect.value));
    }

    if (themeGroup) {
      themeGroup.querySelectorAll(".ux-chip[data-theme]").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.theme === themeProfile);
        chip.addEventListener("click", () => {
          setThemeProfile(chip.dataset.theme);
          themeGroup.querySelectorAll(".ux-chip[data-theme]").forEach((c) => {
            c.classList.toggle("active", c.dataset.theme === themeProfile);
          });
        });
      });
    }

    const updateBgLabels = () => {
      if (bgSpeedVal) bgSpeedVal.textContent = `${bgSpeed.toFixed(2)}x`;
      if (bgDensityVal) bgDensityVal.textContent = `${bgDensity.toFixed(2)}x`;
      if (bgFxVal) bgFxVal.textContent = `${bgFx.toFixed(2)}x`;
    };

    if (bgSpeedInput) {
      bgSpeedInput.value = String(bgSpeed);
      bgSpeedInput.addEventListener("input", () => {
        setBgPrefs({ speed: Number(bgSpeedInput.value) });
        updateBgLabels();
      });
    }
    if (bgDensityInput) {
      bgDensityInput.value = String(bgDensity);
      bgDensityInput.addEventListener("input", () => {
        setBgPrefs({ density: Number(bgDensityInput.value) });
        updateBgLabels();
      });
    }
    if (bgFxInput) {
      bgFxInput.value = String(bgFx);
      bgFxInput.addEventListener("input", () => {
        setBgPrefs({ fx: Number(bgFxInput.value) });
        updateBgLabels();
      });
    }
    updateBgLabels();

    makeKeyboardClickable(".app-icon, .bg-option");
  }

  function initCursor() {
    const glowEl = document.getElementById("cursorGlow");
    const dotEl = document.getElementById("cursorDot");
    if (!glowEl || !dotEl) return;

    let cx = -9999;
    let cy = -9999;
    let glowX = -9999;
    let glowY = -9999;
    let cursorVisible = false;
    let trailVisible = false;

    const trailCount = isMobile() || (navigator.hardwareConcurrency || 4) <= 4 ? 10 : 16;
    const trailDots = [];
    for (let i = 0; i < trailCount; i++) {
      const trailEl = document.createElement("div");
      const size = Math.max(2, 7 - i * 0.28);
      trailEl.className = "cursor-trail";
      trailEl.style.width = size + "px";
      trailEl.style.height = size + "px";
      trailEl.style.opacity = "0";
      trailEl.style.transform = "translate(-9999px, -9999px)";
      document.body.appendChild(trailEl);
      trailDots.push({ el: trailEl, x: -9999, y: -9999 });
    }

    function isTyping() {
      const active = document.activeElement && document.activeElement.tagName;
      return active === "INPUT" || active === "TEXTAREA";
    }

    function hideCursorEffects() {
      glowEl.style.opacity = "0";
      dotEl.style.opacity = "0";
      trailVisible = false;
      cursorVisible = false;
      for (let i = 0; i < trailDots.length; i++) trailDots[i].el.style.opacity = "0";
    }

    function onMove(e) {
      if (!cursorEnabled) return;
      if (e.pointerType === "touch") return;
      const nx = e.clientX;
      const ny = e.clientY;
      if (window._bgMouse) {
        window._bgMouse.x = nx;
        window._bgMouse.y = ny;
      }
      if (!cursorVisible) {
        cx = nx;
        cy = ny;
        glowX = nx;
        glowY = ny;
        for (let i = 0; i < trailDots.length; i++) {
          trailDots[i].x = nx;
          trailDots[i].y = ny;
        }
        cursorVisible = true;
        trailVisible = true;
        glowEl.style.opacity = "1";
        if (!isTyping()) dotEl.style.opacity = "1";
      } else {
        cx = nx;
        cy = ny;
        if (!isTyping()) dotEl.style.opacity = "1";
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mouseleave", hideCursorEffects);

    document.addEventListener("focusin", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        dotEl.style.opacity = "0";
        for (let i = 0; i < trailDots.length; i++) trailDots[i].el.style.opacity = "0";
        trailVisible = false;
      }
    });

    document.addEventListener("focusout", (e) => {
      if (!cursorEnabled) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        if (cursorVisible) {
          dotEl.style.opacity = "1";
          trailVisible = true;
        }
      }
    });

    window.addEventListener("oblivion:cursorchange", () => {
      if (!cursorEnabled) hideCursorEffects();
    });

    function animateCursorFrame() {
      if (cursorEnabled) {
        trailDots[0].x += (cx - trailDots[0].x) * 0.88;
        trailDots[0].y += (cy - trailDots[0].y) * 0.88;
        for (let i = 1; i < trailCount; i++) {
          trailDots[i].x += (trailDots[i - 1].x - trailDots[i].x) * 0.72;
          trailDots[i].y += (trailDots[i - 1].y - trailDots[i].y) * 0.72;
        }
        glowX += (cx - glowX) * 0.55;
        glowY += (cy - glowY) * 0.55;
        glowEl.style.transform =
          "translate(calc(" + glowX + "px - 50%), calc(" + glowY + "px - 50%))";
        dotEl.style.transform =
          "translate(calc(" + cx + "px - 50%), calc(" + cy + "px - 50%))";
        for (let i = 0; i < trailCount; i++) {
          trailDots[i].el.style.transform =
            "translate(calc(" + trailDots[i].x + "px - 50%), calc(" + trailDots[i].y + "px - 50%))";
          trailDots[i].el.style.opacity = trailVisible
            ? String((1 - i / trailCount) * 0.9)
            : "0";
        }
      } else {
        for (let i = 0; i < trailDots.length; i++) trailDots[i].el.style.opacity = "0";
      }
      requestAnimationFrame(animateCursorFrame);
    }

    animateCursorFrame();
  }

  function ensureStatusBar() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar || document.getElementById("uxStatusBar")) return;

    const bar = document.createElement("div");
    bar.className = "ux-statusbar";
    bar.id = "uxStatusBar";
    bar.innerHTML = `
      <span class="ux-status-pill" data-kind="network"><span class="ux-status-dot"></span>net</span>
      <span class="ux-status-pill" data-kind="api"><span class="ux-status-dot"></span>api</span>
      <span class="ux-status-pill" data-kind="loading"><span class="ux-status-dot"></span>load</span>
      <span class="ux-status-pill" data-kind="playing"><span class="ux-status-dot"></span>play</span>
    `;

    const settingsBtn = taskbar.querySelector('.taskbar-btn[data-screen="settings"]');
    if (settingsBtn) taskbar.insertBefore(bar, settingsBtn);
    else taskbar.appendChild(bar);
  }

  function setStatus(kind, mode) {
    const pill = document.querySelector(`.ux-status-pill[data-kind="${kind}"]`);
    if (!pill) return;
    pill.classList.remove("ok", "warn", "bad", "active");
    if (mode) pill.classList.add(mode);
  }

  function refreshStatusBar() {
    setStatus("network", navigator.onLine ? "ok" : "bad");
    if (statusState.inflight > 0) setStatus("loading", "active");
    else setStatus("loading", "warn");

    const now = Date.now();
    if (now - statusState.apiLastErr < 8000) setStatus("api", "bad");
    else if (now - statusState.apiLastOk < 8000) setStatus("api", "ok");
    else setStatus("api", "warn");

    const playing = !!document.querySelector("#taskbarMiniPlayer.on");
    setStatus("playing", playing ? "active" : "warn");
  }

  function patchFetchForStatus() {
    if (window.__uxFetchPatched) return;
    if (typeof window.fetch !== "function") return;

    const rawFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const target = args[0];
      const url = typeof target === "string" ? target : target && target.url ? target.url : "";
      statusState.inflight += 1;
      refreshStatusBar();
      try {
        const response = await rawFetch(...args);
        if (String(url).includes("/api/")) {
          if (response.ok) statusState.apiLastOk = Date.now();
          else statusState.apiLastErr = Date.now();
        }
        return response;
      } catch (err) {
        if (String(url).includes("/api/")) statusState.apiLastErr = Date.now();
        throw err;
      } finally {
        statusState.inflight = Math.max(0, statusState.inflight - 1);
        refreshStatusBar();
      }
    };
    window.__uxFetchPatched = true;
  }

  function installActionableToasts() {
    if (window.__uxToastPatched || typeof window.toast !== "function") return;

    const baseToast = window.toast;
    window.toast = function toastWithActions(msg, type = "info", duration = 3000, actions = []) {
      let data = { message: msg, type, duration, actions };
      if (typeof msg === "object" && msg !== null) {
        data = {
          message: msg.message || "",
          type: msg.type || "info",
          duration: msg.duration ?? 3000,
          actions: Array.isArray(msg.actions) ? msg.actions : [],
        };
      }

      if (!Array.isArray(data.actions) || data.actions.length === 0) {
        return baseToast(data.message, data.type, data.duration);
      }

      const el = document.createElement("div");
      el.className = `toast ${data.type}`;
      el.innerHTML = `
        <span class="toast-dot"></span>
        <span class="toast-main"></span>
        <span class="toast-actions"></span>
      `;
      const main = el.querySelector(".toast-main");
      const actionsWrap = el.querySelector(".toast-actions");
      main.textContent = String(data.message);

      data.actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = action.label || "action";
        btn.addEventListener("click", () => {
          try {
            if (typeof action.onClick === "function") action.onClick();
          } finally {
            el.classList.remove("show");
            setTimeout(() => el.remove(), 220);
          }
        });
        actionsWrap.appendChild(btn);
      });

      const host = document.getElementById("toastContainer");
      if (!host) return;
      host.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 220);
      }, data.duration);
    };
    window.__uxToastPatched = true;
  }

  function ensurePaneStates() {
    const browserFrames = document.getElementById("browserFrames");
    if (browserFrames && !browserFrames.querySelector(".browser-frame-slot, iframe, .ux-empty-state")) {
      const empty = document.createElement("div");
      empty.className = "ux-empty-state";
      empty.textContent = "open a tab to start browsing";
      browserFrames.appendChild(empty);
    }

    const musicResults = document.getElementById("musicResults");
    if (musicResults && !musicResults.textContent.trim()) {
      musicResults.innerHTML = '<div class="ux-empty-state">search for a song</div>';
    }

    const musicQueue = document.getElementById("musicQueueList");
    if (musicQueue && !musicQueue.textContent.trim()) {
      musicQueue.innerHTML = '<div class="ux-empty-state">queue is empty</div>';
    }

    const aiMessages = document.getElementById("aiMessages");
    if (aiMessages && !aiMessages.textContent.trim()) {
      aiMessages.innerHTML = '<div class="ux-empty-state">start a conversation</div>';
    }
  }

  function mountSkeletons() {
    const gamesGrid = document.getElementById("gamesGrid");
    if (gamesGrid && /loading/i.test(gamesGrid.textContent || "")) {
      gamesGrid.innerHTML =
        '<div class="ux-skeleton-grid">' +
        Array.from({ length: 8 })
          .map(() => '<div class="ux-skeleton-card"></div>')
          .join("") +
        "</div>";
    }

    const browserFrames = document.getElementById("browserFrames");
    if (browserFrames && !document.getElementById("uxBrowserSkeleton")) {
      const skel = document.createElement("div");
      skel.className = "ux-browser-skeleton";
      skel.id = "uxBrowserSkeleton";
      skel.innerHTML = '<div class="ux-skeleton-card"></div>';
      browserFrames.appendChild(skel);

      const showSkeleton = () => {
        skel.classList.add("show");
        setTimeout(() => skel.classList.remove("show"), 2600);
      };
      document.getElementById("browserGo")?.addEventListener("click", showSkeleton);
      document.getElementById("navRefresh")?.addEventListener("click", showSkeleton);
      document.getElementById("newTabBtn")?.addEventListener("click", showSkeleton);
      document.getElementById("browserAddr")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") showSkeleton();
      });
      const obs = new MutationObserver(() => {
        const frames = browserFrames.querySelectorAll("iframe");
        frames.forEach((frame) => {
          if (frame.dataset.uxLoadBound === "1") return;
          frame.dataset.uxLoadBound = "1";
          frame.addEventListener("load", () => skel.classList.remove("show"));
        });
      });
      obs.observe(browserFrames, { childList: true, subtree: true });
    }
  }

  function patchGamesEmptyState() {
    if (window.__uxRenderGamesPatched || typeof window.renderGames !== "function") return;
    const base = window.renderGames;
    window.renderGames = function patchedRenderGames(zones) {
      base(zones);
      const grid = document.getElementById("gamesGrid");
      if (!grid) return;
      if (Array.isArray(zones) && zones.length === 0) {
        grid.innerHTML = '<div class="ux-empty-state">no games match your search</div>';
      }
    };
    window.__uxRenderGamesPatched = true;
  }

  function getTipsSeen() {
    return readJson(KEYS.tips, {});
  }

  function setTipSeen(id) {
    const seen = getTipsSeen();
    seen[id] = 1;
    writeJson(KEYS.tips, seen);
  }

  function tipSeen(id) {
    const seen = getTipsSeen();
    return !!seen[id];
  }

  function showTip(id, title, body, targetSelector) {
    if (tipSeen(id)) return;
    const target = document.querySelector(targetSelector);
    if (!target) return;
    document.querySelectorAll(".ux-tip").forEach((n) => n.remove());

    const tip = document.createElement("div");
    tip.className = "ux-tip";
    tip.innerHTML = `
      <div class="ux-tip-title">${title}</div>
      <div class="ux-tip-body">${body}</div>
      <div class="ux-tip-actions">
        <button class="ux-tip-btn" data-act="skip">dismiss</button>
        <button class="ux-tip-btn primary" data-act="ok">got it</button>
      </div>
    `;
    document.body.appendChild(tip);

    const rect = target.getBoundingClientRect();
    const maxLeft = window.innerWidth - tip.offsetWidth - 12;
    const left = Math.max(12, Math.min(maxLeft, rect.left));
    const top = rect.bottom + 10;
    tip.style.left = left + "px";
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 16, top) + "px";

    const close = () => {
      setTipSeen(id);
      tip.remove();
    };
    tip.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", close));
  }

  function observeFirstRunTips() {
    const runForScreen = () => {
      const active = document.querySelector(".screen.active");
      if (!active) return;
      const screen = active.id.replace("screen-", "");
      if (screen === "browser") {
        showTip(
          "browser_tabs_tip",
          "Browser Tabs",
          "Use Ctrl/Cmd+K for quick actions and faster app switching.",
          "#browserTabs",
        );
      } else if (screen === "settings") {
        showTip(
          "panic_key_tip",
          "Panic Key",
          "Set one key to instantly jump to your safe URL.",
          "#panicSetBtn",
        );
      } else if (screen === "account") {
        showTip(
          "ai_setup_tip",
          "AI Setup",
          "Add your API key once and start a conversation right away.",
          "#aiKeyInput",
        );
      }
    };

    const observer = new MutationObserver(() => runForScreen());
    document.querySelectorAll(".screen").forEach((screen) => {
      observer.observe(screen, { attributes: true, attributeFilter: ["class"] });
    });
    runForScreen();
  }

  const ONBOARDING_HINTS = {
    home: [
      { selector: ".app-grid", label: "apps", text: "open browser, games, music, ai, and settings here", place: "right" },
      { selector: "#taskbar", label: "taskbar", text: "switch pages from here", place: "above-right" },
    ],
    browser: [
      {
        selector: ".browser-addr-row",
        label: "search + address",
        text: "type urls or search terms here",
        place: "below-right",
        avoid: ["#engineSelect", ".browser-bar"],
      },
    ],
    games: [
      { selector: "#gamesSearch", label: "search", text: "filter the game list quickly", place: "right" },
      { selector: "#gamesGrid", label: "library", text: "choose a game tile to launch", place: "above-right" },
    ],
    music: [
      { selector: "#musicSearch", label: "music search", text: "find tracks and artists", place: "right" },
      { selector: "#musicQueueListRight", label: "up next", text: "queue and next songs", place: "left" },
      { selector: ".music-playbar", label: "play controls", text: "play, seek, skip, and volume", place: "above-left" },
    ],
    account: [
      { selector: "#aiConvoList", label: "chats", text: "open previous conversations", place: "right" },
      { selector: "#aiInput", label: "prompt", text: "type and send your message", place: "above-right" },
    ],
    settings: [
      { selector: "#bgOptions", label: "background mode", text: "switch background style", place: "right" },
      { selector: "#uxBgTuneWrap", label: "background tuning", text: "adjust speed, density, and effects", place: "left" },
      { selector: "#nativeCursorToggle", label: "cursor", text: "toggle system cursor on/off", place: "right" },
      { selector: "#reduceMotionToggle", label: "motion", text: "reduce animation intensity", place: "right" },
    ],
  };

  let coachOpenScreen = null;
  let coachCleanup = null;

  function readOnboardingSeenScreens() {
    const seen = readJson(KEYS.onboardingSeenScreens, {});
    return seen && typeof seen === "object" ? seen : {};
  }

  function markOnboardingSeen(screen) {
    const seen = readOnboardingSeenScreens();
    seen[screen] = 1;
    writeJson(KEYS.onboardingSeenScreens, seen);
  }

  function setBgPause(paused) {
    window.dispatchEvent(
      new CustomEvent("oblivion:bgpause", {
        detail: { paused: !!paused },
      }),
    );
  }

  function closePageCoach() {
    const coach = document.getElementById("uxPageCoach");
    if (coachCleanup) {
      coachCleanup();
      coachCleanup = null;
    }
    document.querySelectorAll(".ux-coach-target").forEach((el) => el.classList.remove("ux-coach-target"));
    if (!coach) return;
    coach.classList.remove("open");
    setTimeout(() => coach.remove(), 90);
    coachOpenScreen = null;
  }

  function showPageCoach(screenId) {
    if (coachOpenScreen === screenId) return;
    closePageCoach();
    const hints = ONBOARDING_HINTS[screenId];
    if (!Array.isArray(hints) || !hints.length) return;

    const targets = hints
      .map((hint) => ({ ...hint, el: document.querySelector(hint.selector), dismissed: false }))
      .filter((hint) => !!hint.el);
    if (!targets.length) return;

    markOnboardingSeen(screenId);
    coachOpenScreen = screenId;

    const coach = document.createElement("div");
    coach.id = "uxPageCoach";
    coach.className = "ux-page-coach";
    coach.innerHTML = `
      <div class="ux-page-coach-layer" id="uxPageCoachLayer"></div>
    `;
    document.body.appendChild(coach);
    requestAnimationFrame(() => coach.classList.add("open"));

    const layer = coach.querySelector("#uxPageCoachLayer");
    const pins = [];

    function overlapArea(a, b) {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    }

    function candidatePos(name, rect, pinW, pinH, gap) {
      if (name === "right") return { x: rect.right + gap, y: rect.top };
      if (name === "left") return { x: rect.left - pinW - gap, y: rect.top };
      if (name === "above") return { x: rect.left, y: rect.top - pinH - gap };
      if (name === "below") return { x: rect.left, y: rect.bottom + gap };
      if (name === "above-right") return { x: rect.right - pinW, y: rect.top - pinH - gap };
      if (name === "above-left") return { x: rect.left, y: rect.top - pinH - gap };
      if (name === "below-right") return { x: rect.right - pinW, y: rect.bottom + gap };
      if (name === "below-left") return { x: rect.left, y: rect.bottom + gap };
      if (name === "bottom-right") return { x: rect.right - pinW, y: rect.bottom - pinH };
      if (name === "bottom-left") return { x: rect.left, y: rect.bottom - pinH };
      return { x: rect.right + gap, y: rect.top };
    }

    function placePin(pin, rect, hint, allTargetRects, occupiedRects, avoidRects) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pinRect = pin.getBoundingClientRect();
      const gap = 8;
      const defaultOrder = [
        "right",
        "below-right",
        "left",
        "above-right",
        "below-left",
        "above-left",
        "below",
        "above",
        "bottom-right",
        "bottom-left",
      ];
      const pref = hint.place && typeof hint.place === "string" ? hint.place : null;
      const order = pref ? [pref, ...defaultOrder.filter((p) => p !== pref)] : defaultOrder;

      let best = null;
      let bestPenalty = Number.POSITIVE_INFINITY;

      order.forEach((slot) => {
        const raw = candidatePos(slot, rect, pinRect.width, pinRect.height, gap);
        const candidate = {
          left: Math.max(8, Math.min(vw - pinRect.width - 8, raw.x)),
          top: Math.max(8, Math.min(vh - pinRect.height - 8, raw.y)),
          right: 0,
          bottom: 0,
        };
        candidate.right = candidate.left + pinRect.width;
        candidate.bottom = candidate.top + pinRect.height;

        let penalty = 0;
        allTargetRects.forEach((t) => {
          penalty += overlapArea(candidate, t.rect) * 6;
        });
        avoidRects.forEach((avoidRect) => {
          penalty += overlapArea(candidate, avoidRect) * 12;
        });
        occupiedRects.forEach((p) => {
          penalty += overlapArea(candidate, p) * 10;
        });

        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          best = candidate;
        }
      });

      const chosen = best || {
        left: Math.max(8, Math.min(vw - pinRect.width - 8, rect.right + gap)),
        top: Math.max(8, Math.min(vh - pinRect.height - 8, rect.top)),
      };
      pin.style.left = chosen.left + "px";
      pin.style.top = chosen.top + "px";
      return {
        left: chosen.left,
        top: chosen.top,
        right: chosen.left + pinRect.width,
        bottom: chosen.top + pinRect.height,
      };
    }

    function renderPins() {
      pins.forEach((pin) => pin.remove());
      pins.length = 0;
      const visibleTargets = targets.filter((t) => !t.dismissed);
      const allTargetRects = visibleTargets.map((t) => ({ selector: t.selector, rect: t.el.getBoundingClientRect() }));
      const occupied = [];
      visibleTargets.forEach((target) => {
        const avoidRects = (target.avoid || [])
          .map((sel) => document.querySelector(sel))
          .filter((el) => !!el)
          .map((el) => el.getBoundingClientRect());
        target.el.classList.add("ux-coach-target");
        const pin = document.createElement("div");
        pin.className = "ux-page-pin";
        pin.innerHTML = `<div class="ux-page-pin-label">${target.label}</div><div class="ux-page-pin-text">${target.text}</div>`;
        layer.appendChild(pin);
        const usedRect = placePin(
          pin,
          target.el.getBoundingClientRect(),
          target,
          allTargetRects,
          occupied,
          avoidRects,
        );
        occupied.push(usedRect);
        pin.addEventListener("click", () => {
          target.dismissed = true;
          target.el.classList.remove("ux-coach-target");
          pin.classList.add("dismiss");
          setTimeout(() => {
            pin.remove();
            if (targets.every((t) => t.dismissed)) closePageCoach();
          }, 90);
        });
        pins.push(pin);
      });
    }

    const onResize = () => renderPins();
    renderPins();
    window.addEventListener("resize", onResize, { passive: true });
    coachCleanup = () => window.removeEventListener("resize", onResize);
  }

  function maybeShowPageCoach() {
    if (!readBool(KEYS.onboardingEnabled, false)) return;
    const active = document.querySelector(".screen.active");
    if (!active) return;
    const screenId = active.id.replace("screen-", "");
    const seen = readOnboardingSeenScreens();
    if (seen[screenId]) return;
    showPageCoach(screenId);
  }

  function initOnboardingObservers() {
    const observer = new MutationObserver(() => {
      const active = document.querySelector(".screen.active");
      const nextScreen = active ? active.id.replace("screen-", "") : null;
      if (!nextScreen) return;
      if (coachOpenScreen && coachOpenScreen !== nextScreen) closePageCoach();
      maybeShowPageCoach();
    });
    document.querySelectorAll(".screen").forEach((screen) => {
      observer.observe(screen, { attributes: true, attributeFilter: ["class"] });
    });
    maybeShowPageCoach();
  }

  function initOnboardingPrompt() {
    if (readBool(KEYS.onboardingPromptSeen, false)) return;
    if (document.getElementById("uxWalkPrompt")) return;

    const prompt = document.createElement("div");
    prompt.id = "uxWalkPrompt";
    prompt.className = "ux-walk-prompt";
    prompt.innerHTML = `
      <div class="ux-walk-prompt-card" role="dialog" aria-label="page tips prompt">
        <div class="ux-walk-kicker">first launch</div>
        <div class="ux-walk-title">enable first-time page tips?</div>
        <div class="ux-walk-body">
          each page shows quick labels once the first time you open it.
        </div>
        <div class="ux-walk-actions">
          <button type="button" class="ux-tip-btn" id="uxWalkPromptSkip">no thanks</button>
          <button type="button" class="ux-tip-btn primary" id="uxWalkPromptStart">enable tips</button>
        </div>
      </div>
    `;
    document.body.appendChild(prompt);
    requestAnimationFrame(() => prompt.classList.add("open"));
    setBgPause(true);

    const closePrompt = () => {
      prompt.classList.remove("open");
      setTimeout(() => prompt.remove(), 140);
      setBgPause(false);
    };

    prompt.querySelector("#uxWalkPromptSkip")?.addEventListener("click", () => {
      write(KEYS.onboardingPromptSeen, "1");
      write(KEYS.onboardingEnabled, "0");
      closePrompt();
    });

    prompt.querySelector("#uxWalkPromptStart")?.addEventListener("click", () => {
      write(KEYS.onboardingPromptSeen, "1");
      write(KEYS.onboardingEnabled, "1");
      closePrompt();
      setTimeout(() => maybeShowPageCoach(), 160);
    });
  }

  function getScreensFromIcons() {
    return [...document.querySelectorAll(".app-icon[data-screen]")].map((icon) => ({
      id: icon.dataset.screen,
      label: icon.querySelector(".icon-label")?.textContent?.trim() || icon.dataset.screen,
    }));
  }

  function initCommandPalette() {
    if (document.getElementById("uxCmdkBackdrop")) return;
    const backdrop = document.createElement("div");
    backdrop.id = "uxCmdkBackdrop";
    backdrop.className = "ux-cmdk-backdrop";
    backdrop.innerHTML = `
      <div class="ux-cmdk" role="dialog" aria-label="Command palette">
        <input class="ux-cmdk-input" id="uxCmdkInput" placeholder="type a command or app..." autocomplete="off" spellcheck="false">
        <div class="ux-cmdk-list" id="uxCmdkList"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector("#uxCmdkInput");
    const list = backdrop.querySelector("#uxCmdkList");
    let activeIndex = 0;
    let actions = [];

    function goTo(screen) {
      if (typeof window.navigate === "function") window.navigate(screen);
      else document.querySelector(`.taskbar-btn[data-screen="${screen}"]`)?.click();
    }

    function buildActions(query) {
      const q = query.trim().toLowerCase();
      const screens = getScreensFromIcons().map((s) => ({
        label: `open ${s.label}`,
        sub: `screen • ${s.id}`,
        run: () => goTo(s.id),
      }));

      const quick = [
        {
          label: "new browser tab",
          sub: "quick action",
          run: () => {
            goTo("browser");
            if (typeof window.createTab === "function") window.createTab();
          },
        },
        {
          label: cursorEnabled ? "disable custom cursor" : "enable custom cursor",
          sub: "accessibility",
          run: () => setCursorEnabled(!cursorEnabled),
        },
        {
          label: reduceMotionActive() ? "disable reduced motion" : "enable reduced motion",
          sub: "accessibility",
          run: () => setReduceMotion(!reduceMotionActive()),
        },
        {
          label: density === "compact" ? "set density comfortable" : "set density compact",
          sub: "layout",
          run: () => setDensity(density === "compact" ? "comfortable" : "compact"),
        },
        {
          label: "open settings",
          sub: "quick action",
          run: () => goTo("settings"),
        },
      ];

      const searchAction =
        q.length > 1
          ? [
              {
                label: `search "${query}"`,
                sub: "web",
                run: () => {
                  goTo("browser");
                  if (typeof window.browserNavigate === "function") window.browserNavigate(null, query);
                },
              },
            ]
          : [];

      return [...screens, ...quick, ...searchAction].filter((a) =>
        !q
          ? true
          : (a.label + " " + (a.sub || "")).toLowerCase().includes(q),
      );
    }

    function render() {
      actions = buildActions(input.value).slice(0, 12);
      activeIndex = Math.max(0, Math.min(activeIndex, actions.length - 1));
      list.innerHTML = "";
      actions.forEach((action, idx) => {
        const btn = document.createElement("button");
        btn.className = "ux-cmdk-item" + (idx === activeIndex ? " active" : "");
        btn.type = "button";
        btn.innerHTML = `${action.label}<span class="ux-cmdk-sub">${action.sub || ""}</span>`;
        btn.addEventListener("click", () => {
          action.run();
          closePalette();
        });
        list.appendChild(btn);
      });
      if (actions.length === 0) {
        list.innerHTML = '<div class="ux-empty-state">no commands found</div>';
      }
    }

    function openPalette() {
      backdrop.classList.add("open");
      input.value = "";
      activeIndex = 0;
      render();
      setTimeout(() => input.focus(), 0);
    }

    function closePalette() {
      backdrop.classList.remove("open");
    }

    window.openPalette = openPalette;

    input.addEventListener("input", () => {
      activeIndex = 0;
      render();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(actions.length - 1, activeIndex + 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        render();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const action = actions[activeIndex];
        if (action) {
          action.run();
          closePalette();
        }
      }
    });

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePalette();
    });

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (backdrop.classList.contains("open")) closePalette();
        else openPalette();
      }
    });
  }

  function initHomeIcons() {
    const grid = document.querySelector(".app-grid");
    if (!grid) return;
    const icons = () => [...grid.querySelectorAll(".app-icon[data-screen]")];

    const storedOrder = readJson(KEYS.iconOrder, []);
    if (Array.isArray(storedOrder) && storedOrder.length) {
      storedOrder.forEach((screenId) => {
        const icon = grid.querySelector(`.app-icon[data-screen="${screenId}"]`);
        if (icon) grid.appendChild(icon);
      });
    }

    function saveOrder() {
      writeJson(
        KEYS.iconOrder,
        icons().map((el) => el.dataset.screen),
      );
    }

    function defaultPinned() {
      return icons().map((el) => el.dataset.screen);
    }

    let pinned = readJson(KEYS.pinned, defaultPinned());
    if (!Array.isArray(pinned) || !pinned.length) pinned = defaultPinned();

    function applyPinned() {
      const activeScreen = document.querySelector(".screen.active")?.id?.replace("screen-", "");
      document.querySelectorAll(".taskbar-btn[data-screen]").forEach((btn) => {
        const screen = btn.dataset.screen;
        if (screen === "home" || screen === "settings") return;
        const shouldShow = pinned.includes(screen) || screen === activeScreen;
        btn.style.display = shouldShow ? "" : "none";
      });
    }

    function togglePin(screen) {
      const wasPinned = pinned.includes(screen);
      if (wasPinned) pinned = pinned.filter((s) => s !== screen);
      else pinned.push(screen);
      writeJson(KEYS.pinned, pinned);
      applyPinned();
      if (typeof window.toast === "function") {
        window.toast(
          wasPinned ? `unpinned ${screen}` : `pinned ${screen}`,
          "info",
          2500,
          [
            {
              label: "undo",
              onClick: () => {
                togglePin(screen);
              },
            },
          ],
        );
      }
    }

    applyPinned();
    window.addEventListener("click", () => applyPinned());

    const menu = document.createElement("div");
    menu.className = "ux-icon-menu";
    menu.id = "uxIconMenu";
    document.body.appendChild(menu);

    let menuScreen = null;

    function closeMenu() {
      menu.classList.remove("open");
      menu.innerHTML = "";
      menuScreen = null;
    }

    function openMenuFor(icon, x, y) {
      menuScreen = icon.dataset.screen;
      const isPinned = pinned.includes(menuScreen);
      menu.innerHTML = `
        <button type="button" data-act="pin">${isPinned ? "unpin from taskbar" : "pin to taskbar"}</button>
        <button type="button" data-act="left">move left</button>
        <button type="button" data-act="right">move right</button>
        <button type="button" data-act="reset">reset icon order</button>
      `;
      menu.style.left = Math.min(x, window.innerWidth - 190) + "px";
      menu.style.top = Math.min(y, window.innerHeight - 210) + "px";
      menu.classList.add("open");
      menu.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!menuScreen) return;
          const iconEl = grid.querySelector(`.app-icon[data-screen="${menuScreen}"]`);
          if (!iconEl) return;
          if (btn.dataset.act === "pin") togglePin(menuScreen);
          if (btn.dataset.act === "left" && iconEl.previousElementSibling)
            grid.insertBefore(iconEl, iconEl.previousElementSibling);
          if (btn.dataset.act === "right" && iconEl.nextElementSibling)
            grid.insertBefore(iconEl.nextElementSibling, iconEl);
          if (btn.dataset.act === "reset") {
            defaultPinned().forEach((id) => {
              const el = grid.querySelector(`.app-icon[data-screen="${id}"]`);
              if (el) grid.appendChild(el);
            });
          }
          saveOrder();
          closeMenu();
        });
      });
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);

    icons().forEach((icon) => {
      icon.setAttribute("draggable", "true");
      icon.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openMenuFor(icon, e.clientX, e.clientY);
      });

      icon.addEventListener("dragstart", () => {
        icon.classList.add("dragging");
      });
      icon.addEventListener("dragend", () => {
        icon.classList.remove("dragging");
        icons().forEach((i) => i.classList.remove("drag-over"));
        saveOrder();
      });
      icon.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = grid.querySelector(".app-icon.dragging");
        if (!dragging || dragging === icon) return;
        icon.classList.add("drag-over");
        const rect = icon.getBoundingClientRect();
        const before = e.clientX < rect.left + rect.width / 2;
        if (before) grid.insertBefore(dragging, icon);
        else grid.insertBefore(dragging, icon.nextElementSibling);
      });
      icon.addEventListener("dragleave", () => icon.classList.remove("drag-over"));
      icon.addEventListener("drop", () => icon.classList.remove("drag-over"));
    });
  }

  function initStatusAndNetworkWatch() {
    ensureStatusBar();
    patchFetchForStatus();
    refreshStatusBar();
    window.addEventListener("online", refreshStatusBar);
    window.addEventListener("offline", refreshStatusBar);
    setInterval(refreshStatusBar, 1200);
  }

  function initLateBindings() {
    installActionableToasts();
    patchGamesEmptyState();
    ensurePaneStates();
    mountSkeletons();
    initStatusAndNetworkWatch();
    initOnboardingObservers();
    setTimeout(() => initOnboardingPrompt(), 180);
  }

  applyPrefs();
  initCursor();

  if (mediaReduce) {
    const syncMotionFromSystem = () => {
      if (motionPref !== null) return;
      applyPrefs();
      const toggle = document.getElementById("reduceMotionToggle");
      if (toggle) toggle.checked = reduceMotionActive();
    };
    if (typeof mediaReduce.addEventListener === "function") {
      mediaReduce.addEventListener("change", syncMotionFromSystem);
    } else if (typeof mediaReduce.addListener === "function") {
      mediaReduce.addListener(syncMotionFromSystem);
    }
  }

  if (mediaMobile) {
    const onMobileChange = () => applyPrefs();
    if (typeof mediaMobile.addEventListener === "function") {
      mediaMobile.addEventListener("change", onMobileChange);
    } else if (typeof mediaMobile.addListener === "function") {
      mediaMobile.addListener(onMobileChange);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    ensureInterfaceSection();
    ensureBackgroundTuningSection();
    organizeSettings();
    bindSettings();
    initCommandPalette();
    initHomeIcons();
    ensurePaneStates();
    mountSkeletons();
  });

  window.addEventListener("load", () => {
    initLateBindings();
  });
})();

