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
    iconOrder: "oblivionHomeIconOrder",
    pinned: "oblivionPinnedScreens",
    tips: "oblivionTipsSeenV1",
  };

  let cursorEnabled = readBool(KEYS.cursor, true);
  let motionPref = readEnum(KEYS.motion, ["1", "0"], null);
  let density = readEnum(KEYS.density, ["comfortable", "compact"], "comfortable");
  let themeProfile = readEnum(KEYS.theme, ["default", "high-contrast", "soft-glow", "minimal"], "default");

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
    applyDensityClass();
    applyThemeClass();
    window.dispatchEvent(
      new CustomEvent("oblivion:cursorchange", { detail: { enabled: cursorEnabled } }),
    );
    window.dispatchEvent(
      new CustomEvent("oblivion:motionchange", { detail: { reduceMotion: reduce } }),
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
        <div class="ux-control-row">
          <div class="ux-control-label">
            command palette
            <span class="ux-control-sub">quick actions and app switcher</span>
          </div>
          <button id="uxOpenPaletteBtn" class="ux-chip">open (ctrl/cmd+k)</button>
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
        "panic key": "Fast emergency exit with one key press.",
        "tab cloak": "Rename tab and icon for safer multitasking.",
        "color scheme": "Pick the accent and base visual direction.",
        interface: "Set density, command tools, and profile style.",
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
      { label: "Safety", titles: ["panic key", "tab cloak"] },
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
    const openPaletteBtn = document.getElementById("uxOpenPaletteBtn");

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

    if (openPaletteBtn) {
      openPaletteBtn.addEventListener("click", () => {
        if (typeof window.openPalette === "function") window.openPalette();
      });
    }

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

    const trailCount = 20;
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

    function animateCursor() {
      if (cursorEnabled) {
        glowX += (cx - glowX) * 0.55;
        glowY += (cy - glowY) * 0.55;
        glowEl.style.transform =
          "translate(calc(" + glowX + "px - 50%), calc(" + glowY + "px - 50%))";
        dotEl.style.transform =
          "translate(calc(" + cx + "px - 50%), calc(" + cy + "px - 50%))";
      }
      requestAnimationFrame(animateCursor);
    }

    function animateTrail() {
      if (cursorEnabled) {
        trailDots[0].x += (cx - trailDots[0].x) * 0.88;
        trailDots[0].y += (cy - trailDots[0].y) * 0.88;
        for (let i = 1; i < trailCount; i++) {
          trailDots[i].x += (trailDots[i - 1].x - trailDots[i].x) * 0.72;
          trailDots[i].y += (trailDots[i - 1].y - trailDots[i].y) * 0.72;
        }
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
      requestAnimationFrame(animateTrail);
    }

    animateCursor();
    animateTrail();
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
    observeFirstRunTips();
    initStatusAndNetworkWatch();
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

