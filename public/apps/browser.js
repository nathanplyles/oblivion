const BROWSER_SEARCH_ENGINE_KEY = "os-browser-search-engine";
const BROWSER_SUGGESTIONS_KEY = "os-browser-suggestions";
const BROWSER_SEARCH_ENGINES = [
  { id: "brave", name: "brave", template: "https://search.brave.com/search?q=%s" },
  { id: "duckduckgo", name: "duckduckgo", template: "https://duckduckgo.com/?q=%s" },
  { id: "google", name: "google", template: "https://www.google.com/search?q=%s" },
  { id: "bing", name: "bing", template: "https://www.bing.com/search?q=%s" },
  { id: "ecosia", name: "ecosia", template: "https://www.ecosia.org/search?q=%s" },
  { id: "startpage", name: "startpage", template: "https://www.startpage.com/search?q=%s" },
  { id: "yahoo", name: "yahoo", template: "https://search.yahoo.com/search?p=%s" },
];
const DEFAULT_BROWSER_SUGGESTIONS = [
  "youtube",
  "gmail",
  "google docs",
  "reddit",
  "discord",
  "github",
  "weather",
  "news",
  "speed test",
  "spotify",
];
const SCRAMJET_RETRY_STATUS_RE = /IDBDatabase|NotFoundError|object stores|transaction|timeout|timed out|not initialized|booting/i;
const SCRAMJET_RECOVERY_RETRY_COOLDOWN_MS = 4000;

function loadBrowserSearchEngine() {
  const saved = String(localStorage.getItem(BROWSER_SEARCH_ENGINE_KEY) || "").toLowerCase();
  if (BROWSER_SEARCH_ENGINES.some((engine) => engine.id === saved)) return saved;
  return "brave";
}

function getBrowserSearchEngine() {
  const engine = BROWSER_SEARCH_ENGINES.find((item) => item.id === browserState.searchEngine);
  return engine || BROWSER_SEARCH_ENGINES[0];
}

function setBrowserSearchEngine(id) {
  const normalized = String(id || "").toLowerCase();
  if (!BROWSER_SEARCH_ENGINES.some((engine) => engine.id === normalized)) return;
  browserState.searchEngine = normalized;
  localStorage.setItem(BROWSER_SEARCH_ENGINE_KEY, normalized);
}

function browserSearchOptionsHtml() {
  return BROWSER_SEARCH_ENGINES.map((engine) => `<option value="${engine.id}">${engine.name}</option>`).join("");
}

function loadBrowserSuggestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(BROWSER_SUGGESTIONS_KEY) || "[]");
    if (!Array.isArray(stored)) return [...DEFAULT_BROWSER_SUGGESTIONS];
    const merged = [...stored.map((item) => String(item || "").trim()).filter(Boolean), ...DEFAULT_BROWSER_SUGGESTIONS];
    return [...new Set(merged)].slice(0, 50);
  } catch {
    return [...DEFAULT_BROWSER_SUGGESTIONS];
  }
}

function saveBrowserSuggestions() {
  localStorage.setItem(BROWSER_SUGGESTIONS_KEY, JSON.stringify((browserState.suggestions || []).slice(0, 50)));
}

function rememberBrowserSuggestion(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value || value.length < 2) return;
  browserState.suggestions = [value, ...(browserState.suggestions || []).filter((item) => item !== value)].slice(0, 50);
  saveBrowserSuggestions();
}

function computeBrowserSuggestions(rawInput) {
  const value = String(rawInput || "").trim().toLowerCase();
  if (!value) return [...DEFAULT_BROWSER_SUGGESTIONS].slice(0, 8);
  const matches = (browserState.suggestions || []).filter((item) => item.includes(value));
  const expanded = [
    ...matches,
    `${value} news`,
    `${value} reddit`,
    `${value} youtube`,
    `${value} lyrics`,
  ];
  return [...new Set(expanded)].slice(0, 10);
}

function updateBrowserSuggestionLists(rawInput = "") {
  const suggestions = computeBrowserSuggestions(rawInput);
  const html = suggestions
    .map((item) => `<option value="${String(item || '').replace(/&/g, '&amp;').replace(/"/g, "&quot;").replace(/</g, '&lt;').replace(/>/g, '&gt;')}"></option>`)
    .join("");
  const topList = document.getElementById("br-suggest");
  if (topList) topList.innerHTML = html;
  const ntList = document.getElementById("br-nt-suggest");
  if (ntList) ntList.innerHTML = html;
}

function createBrowserTabState({
  url = "",
  resolvedUrl = "",
  title = "new tab",
  mode = "newtab",
  frameRef = null,
  favicon = "",
} = {}) {
  const id = ++browserState.counter;
  const tab = {
    id,
    url,
    resolvedUrl,
    title,
    mode,
    frameRef,
    favicon,
    lastVisitedAt: 0,
    opening: true,
  };
  browserState.tabs.push(tab);
  return tab;
}

function renderBrowserTabs() {
  const tabsEl = document.getElementById("browser-tabs");
  const addBtn = document.getElementById("browser-newtab-btn");
  if (!tabsEl || !addBtn) return;

  const existing = new Map(
    [...tabsEl.querySelectorAll(".browser-tab")].map((node) => [node.dataset.tabid || "", node]),
  );

  browserState.tabs.forEach((tab) => {
    const key = String(tab.id);
    let node = existing.get(key);
    if (!node) {
      node = document.createElement("div");
      node.className = "browser-tab";
      node.dataset.tabid = key;
      node.tabIndex = 0;
      node.setAttribute("role", "tab");
      node.innerHTML = `<img src="" style="display:none"><span></span><button class="tab-x" data-xtab="${tab.id}">x</button>`;
      if (tab.opening) {
        node.classList.add("opening");
        setTimeout(() => node.classList.remove("opening"), 180);
      }
      node.addEventListener("click", (e) => {
        const tabId = Number.parseInt(node.dataset.tabid || "0", 10);
        if (!tabId) return;
        if (!e.target.closest(".tab-x")) activateBrowserTab(tabId);
      });
      node.addEventListener("keydown", (e) => {
        const tabId = Number.parseInt(node.dataset.tabid || "0", 10);
        if (!tabId) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateBrowserTab(tabId);
        } else if (e.key === "Delete") {
          e.preventDefault();
          closeBrowserTab(tabId);
        }
      });
      node.querySelector(".tab-x")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const tabId = Number.parseInt(node.dataset.tabid || "0", 10);
        if (!tabId) return;
        closeBrowserTab(tabId);
      });
    } else {
      existing.delete(key);
    }

    const titleEl = node.querySelector("span");
    if (titleEl) titleEl.textContent = (tab.title || "new tab").slice(0, 28);
    const img = node.querySelector("img");
    if (img) {
      if (tab.favicon) {
        img.src = tab.favicon;
        img.style.display = "";
      } else {
        img.style.display = "none";
      }
    }
    node.classList.toggle("active", tab.id === browserState.active);
    tabsEl.insertBefore(node, addBtn);
    tab.opening = false;
  });

  existing.forEach((node) => {
    node.remove();
  });

  updateBrowserTabLayout();
}

let browserState = {
  tabs: [],
  active: null,
  counter: 0,
  progressInterval: null,
  progressTimeout: null,
  notifiedScramjetFallback: false,
  searchEngine: loadBrowserSearchEngine(),
  resizeRaf: 0,
  suggestions: loadBrowserSuggestions(),
  closingTabIds: new Set(),
  boundScramjetRecoveredListener: false,
  lastScramjetRecoveryRetryAt: 0,
};

function bindBrowserScramjetRecoveryListener() {
  if (browserState.boundScramjetRecoveredListener) return;
  window.addEventListener("scramjet:recovered", onBrowserScramjetRecovered);
  browserState.boundScramjetRecoveredListener = true;
}

function onBrowserScramjetRecovered(event) {
  if (!event?.detail?.ok) return;
  if (!hasBrowserWindows()) return;
  const tab = getActiveBrowserTab();
  if (!tab) return;
  const retryInput = String(tab.url || tab.resolvedUrl || "").trim();
  if (!retryInput) return;
  const now = Date.now();
  if (now - browserState.lastScramjetRecoveryRetryAt < SCRAMJET_RECOVERY_RETRY_COOLDOWN_MS) return;
  browserState.lastScramjetRecoveryRetryAt = now;
  void browserNavigate(retryInput);
}

function resetBrowserWindowState() {
  browserState.tabs.forEach((tab) => {
    if (tab?.mode === "scramjet" && typeof tab.frameRef?.destroy === "function") {
      try {
        tab.frameRef.destroy();
      } catch {}
    }
  });
  browserState.tabs = [];
  browserState.active = null;
  browserState.counter = 0;
  browserState.closingTabIds.clear();
  browserState.notifiedScramjetFallback = false;
}

function launchBrowser(options = {}) {
  if (window.shouldReuseAppWindow?.('browser') && window.focusAnyAppWindow?.('browser')) return;
  bindBrowserScramjetRecoveryListener();
  resetBrowserWindowState();
  const skipInitialTab = !!options.skipInitialTab;
  const html = `<div class="app-browser" id="browser-root">
    <div class="browser-tabs sbn" id="browser-tabs">
      <button class="browser-newtab" id="browser-newtab-btn">+</button>
    </div>
    <div class="browser-bar">
      <button class="browser-nav-btn" id="br-back"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M10 4L6 8l4 4"/></svg></button>
      <button class="browser-nav-btn" id="br-fwd"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 4l4 4-4 4"/></svg></button>
      <button class="browser-nav-btn" id="br-reload"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M13 8A5 5 0 102 10"/><path d="M2 6v4H6"/></svg></button>
      <div class="browser-addr-wrap">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" style="width:11px;height:11px;color:#2a2a3a;flex-shrink:0"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l2.5 2.5"/></svg>
        <input class="browser-addr" id="br-addr" placeholder="search or enter url..." autocomplete="off" spellcheck="false" list="br-suggest">
        <select class="browser-engine" id="br-engine" title="search engine" aria-label="search engine">
          ${browserSearchOptionsHtml()}
        </select>
        <button class="browser-go" id="br-go" type="button">go</button>
      </div>
    </div>
    <datalist id="br-suggest"></datalist>
    <datalist id="br-nt-suggest"></datalist>
    <div class="browser-loading"><div class="browser-loading-bar" id="br-lbar"></div></div>
    <div class="browser-frames" id="browser-frames"></div>
  </div>`;

  createWin("browser", "oblivion browser", 860, 580, html);
  setTimeout(() => {
    document.getElementById("browser-newtab-btn").addEventListener("click", () => newBrowserTab());
    const addrInput = document.getElementById("br-addr");
    const addrWrap = document.querySelector(".browser-addr-wrap");
    if (addrWrap && addrInput) {
      addrWrap.addEventListener("mousedown", (e) => {
        if (e.target.closest("#br-engine,#br-go,.browser-addr")) return;
        e.preventDefault();
        addrInput.focus();
      });
    }
    if (addrInput) {
      addrInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") browserNavigate(addrInput.value);
      });
      addrInput.addEventListener("input", (e) => {
        updateBrowserSuggestionLists(e.target.value || "");
      });
      updateBrowserSuggestionLists(addrInput.value || "");
    }
    document.getElementById("br-go").addEventListener("click", () => browserNavigate(document.getElementById("br-addr").value));
    document.getElementById("br-back").addEventListener("click", browserGoBack);
    document.getElementById("br-fwd").addEventListener("click", browserGoForward);
    document.getElementById("br-reload").addEventListener("click", browserReload);
    const engineSelect = document.getElementById("br-engine");
    if (engineSelect) {
      engineSelect.value = browserState.searchEngine;
      engineSelect.addEventListener("change", (event) => {
        setBrowserSearchEngine(event.target.value);
      });
    }
    const tabsWrap = document.getElementById("browser-tabs");
    if (tabsWrap && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => updateBrowserTabLayout());
      ro.observe(tabsWrap);
    }
    const win = document.getElementById("win-browser");
    if (win) win.addEventListener("keydown", handleBrowserShortcuts);
    if (!skipInitialTab) newBrowserTab();
  }, 50);
}

function handleBrowserShortcuts(e) {
  if (!document.getElementById("win-browser") || !String(OS.focused || "").startsWith("browser")) return;
  const key = String(e.key || "").toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "l") {
    e.preventDefault();
    const addr = document.getElementById("br-addr");
    if (addr) {
      addr.focus();
      addr.select();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "t") {
    e.preventDefault();
    newBrowserTab();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "w") {
    e.preventDefault();
    if (browserState.active != null) closeBrowserTab(browserState.active);
    return;
  }
}

function updateBrowserTabLayout() {
  const tabs = [...document.querySelectorAll("#browser-tabs .browser-tab")];
  if (!tabs.length) return;
  const wrap = document.getElementById("browser-tabs");
  if (!wrap) return;
  const previous = new Map(
    tabs.map((tab) => [
      tab.dataset.tabid || "",
      { left: tab.getBoundingClientRect().left },
    ]),
  );
  const wrapW = Math.max(0, wrap.clientWidth - 44);
  const per = Math.max(62, Math.min(182, wrapW / tabs.length - 2));
  const width = `${per.toFixed(2)}px`;
  tabs.forEach((tab) => {
    tab.style.width = width;
    tab.style.maxWidth = width;
    tab.style.flexBasis = width;
  });
  requestAnimationFrame(() => {
    tabs.forEach((tab) => {
      if (tab.classList.contains("opening") || tab.classList.contains("closing")) return;
      const prev = previous.get(tab.dataset.tabid || "");
      if (!prev) return;
      const nowLeft = tab.getBoundingClientRect().left;
      const dx = prev.left - nowLeft;
      if (Math.abs(dx) < 0.5) return;
      tab.style.transition = "none";
      tab.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => {
        tab.style.transition =
          "width .2s cubic-bezier(.22,.61,.36,1),flex-basis .2s cubic-bezier(.22,.61,.36,1),max-width .2s cubic-bezier(.22,.61,.36,1),transform .2s cubic-bezier(.22,.61,.36,1),background-color .16s ease,color .16s ease";
        tab.style.transform = "";
      });
    });
  });
}

function getActiveBrowserTab() {
  return browserState.tabs.find((tab) => tab.id === browserState.active) || null;
}

function beginBrowserLoading() {
  const lbar = document.getElementById("br-lbar");
  if (!lbar) return;
  clearInterval(browserState.progressInterval);
  clearTimeout(browserState.progressTimeout);
  lbar.style.width = "0%";
  lbar.classList.add("on");
  let p = 0;
  browserState.progressInterval = setInterval(() => {
    p = Math.min(p + Math.random() * 14, 85);
    lbar.style.width = `${p}%`;
  }, 200);
  browserState.progressTimeout = setTimeout(() => completeBrowserLoading(), 6000);
}

function completeBrowserLoading() {
  const lbar = document.getElementById("br-lbar");
  clearInterval(browserState.progressInterval);
  clearTimeout(browserState.progressTimeout);
  browserState.progressInterval = null;
  browserState.progressTimeout = null;
  if (!lbar) return;
  lbar.style.width = "100%";
  setTimeout(() => {
    lbar.classList.remove("on");
    lbar.style.width = "0%";
  }, 350);
}

function normalizeBrowserInput(value) {
  let input = value.trim();
  if (!input) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
    const lower = input.toLowerCase();
    if (lower === "about:blank") return "about:blank";
    if (!/^https?:/i.test(lower)) return "";
    try {
      const u = new URL(input);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.toString();
    } catch {
      return "";
    }
  }

  const looksLikeLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?([/?#]|$)/i.test(input);
  const looksLikeIpV4 = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?([/?#]|$)/.test(input);
  const looksLikeDomain = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?([/?#]|$)/i.test(input);
  if (looksLikeLocalHost || looksLikeIpV4) return `http://${input}`;
  if (looksLikeDomain) return `https://${input}`;

  const searchEngine = getBrowserSearchEngine();
  return searchEngine.template.replace("%s", encodeURIComponent(input));
}

function newBrowserTab(url) {
  const tab = createBrowserTabState({
    url: url || "",
    resolvedUrl: "",
    title: "new tab",
    mode: "newtab",
    frameRef: null,
  });
  const id = tab.id;

  const frames = document.getElementById("browser-frames");
  if (!frames) return;
  const slot = document.createElement("div");
  slot.id = `br-frame-${id}`;
  slot.className = "browser-frame-slot";
  slot.innerHTML = `<div class="browser-newtab-page">
    <div class="browser-nt-word">oblivion browser</div>
    <div class="browser-nt-search">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" style="width:12px;height:12px;color:#2a2a3a;flex-shrink:0"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l2.5 2.5"/></svg>
      <input class="browser-nt-input" placeholder="search the void..." autocomplete="off" spellcheck="false" list="br-nt-suggest">
    </div>
    <div class="browser-nt-shortcuts">
      ${[
        ["youtube", "Y", "https://youtube.com"],
        ["google", "G", "https://google.com"],
        ["reddit", "R", "https://reddit.com"],
        ["twitch", "T", "https://twitch.tv"],
        ["discord", "D", "https://discord.com"],
      ]
        .map(
          ([label, letter, u]) => `
      <button class="browser-sc browser-sc-btn" type="button" data-url="${u}">
        <div class="browser-sc-icon"><span class="browser-sc-letter">${letter}</span></div>
        <span>${label}</span>
      </button>`,
        )
        .join("")}
    </div>
  </div>`;
  frames.appendChild(slot);

  const ntSearchWrap = slot.querySelector(".browser-nt-search");
  const ntSearchInput = slot.querySelector(".browser-nt-input");
  if (ntSearchWrap && ntSearchInput) {
    ntSearchWrap.addEventListener("mousedown", (e) => {
      if (e.target.closest(".browser-nt-input")) return;
      e.preventDefault();
      ntSearchInput.focus();
    });
    ntSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") browserNavigate(e.target.value);
    });
    ntSearchInput.addEventListener("input", (e) => {
      updateBrowserSuggestionLists(e.target.value || "");
    });
  }
  slot.querySelectorAll(".browser-sc-btn").forEach((sc) => sc.addEventListener("click", () => browserNavigate(sc.dataset.url)));
  updateBrowserSuggestionLists(ntSearchInput?.value || "");
  browserState.active = id;
  renderBrowserTabs();
  activateBrowserTab(id, { skipRender: true });
  if (url) browserNavigate(url);
}

function activateBrowserTab(id, options = {}) {
  const skipRender = !!options.skipRender;
  browserState.active = id;
  if (!skipRender) renderBrowserTabs();
  document.querySelectorAll("#browser-frames>*").forEach((frame) => {
    frame.style.display = "none";
  });
  const slot = document.getElementById(`br-frame-${id}`);
  if (slot) {
    slot.style.display = "block";
    slot.style.position = "absolute";
    slot.style.inset = "0";
  }
  const tab = browserState.tabs.find((item) => item.id === id);
  if (tab) {
    tab.lastVisitedAt = Date.now();
    const addr = document.getElementById("br-addr");
    if (addr) addr.value = tab.url || "";
  }
}

function pickBrowserNextTabIdAfterClose(closingId, closingIdx) {
  if (!browserState.tabs.length) return null;
  if (closingIdx < browserState.tabs.length) return browserState.tabs[closingIdx].id;
  return browserState.tabs[browserState.tabs.length - 1].id;
}

function closeBrowserTab(id) {
  if (browserState.closingTabIds.has(id)) return;
  const node = document.querySelector(`#browser-tabs .browser-tab[data-tabid="${id}"]`);
  if (node) {
    browserState.closingTabIds.add(id);
    node.classList.add("closing");
    updateBrowserTabLayout();
    setTimeout(() => {
      finalizeBrowserTabClose(id);
    }, 165);
    return;
  }
  finalizeBrowserTabClose(id);
}

function finalizeBrowserTabClose(id) {
  browserState.closingTabIds.delete(id);
  const idx = browserState.tabs.findIndex((item) => item.id === id);
  if (idx < 0) return;
  const wasActive = browserState.active === id;
  const closing = browserState.tabs[idx];
  if (closing?.mode === "scramjet" && typeof closing.frameRef?.destroy === "function") {
    try {
      closing.frameRef.destroy();
    } catch {}
  }

  browserState.tabs.splice(idx, 1);
  const nextTabId = wasActive ? pickBrowserNextTabIdAfterClose(id, idx) : null;
  const staleTabNode = document.querySelector(`#browser-tabs .browser-tab[data-tabid="${id}"]`);
  staleTabNode?.remove();
  const frameEl = document.getElementById(`br-frame-${id}`);
  frameEl?.remove();
  if (wasActive) {
    if (nextTabId != null) {
      browserState.active = nextTabId;
      renderBrowserTabs();
      activateBrowserTab(nextTabId, { skipRender: true });
    }
    else newBrowserTab();
  } else {
    renderBrowserTabs();
  }
}

function activeBrowserFrame() {
  const tab = getActiveBrowserTab();
  if (!tab) return null;
  if (tab.mode === "scramjet") return tab.frameRef?.frame || null;
  if (tab.mode === "iframe") return tab.frameRef || null;
  return document.getElementById(`br-frame-${browserState.active}`)?.querySelector("iframe") || null;
}

async function mountScramjetTab(slot, tab, url) {
  if (typeof window.ensureScramjetTransport !== "function") return false;
  if (window._scramjetReady && typeof window._scramjetReady.then === "function") {
    try {
      await Promise.race([
        window._scramjetReady,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("scramjet init timeout")), 20000);
        }),
      ]);
    } catch {}
  }

  const transportOk = await window.ensureScramjetTransport();
  const runtime =
    (typeof window.resolveScramjetRuntime === "function" && window.resolveScramjetRuntime()) ||
    window._scramjet ||
    window.scramjet;
  if (!transportOk || !runtime || typeof runtime.createFrame !== "function") return false;
  window._scramjet = runtime;

  const sjFrame = runtime.createFrame();
  if (!sjFrame?.frame) return false;
  sjFrame.frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:none;display:block;visibility:visible;opacity:1;";
  slot.appendChild(sjFrame.frame);
  try {
    const navResult = sjFrame.go(url);
    if (navResult && typeof navResult.then === "function") {
      await Promise.race([
        navResult,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("scramjet navigate timeout")), 15000);
        }),
      ]);
    }
  } catch (err) {
    window._scramjetStatusMessage = String(err?.message || err || "scramjet navigate failed");
    try {
      sjFrame.destroy?.();
    } catch {}
    try {
      sjFrame.frame?.remove?.();
    } catch {}
    throw err;
  }
  tab.mode = "scramjet";
  tab.frameRef = sjFrame;

  if (typeof sjFrame.frame.addEventListener === "function") {
    sjFrame.frame.addEventListener("load", completeBrowserLoading, { once: true });
  }
  setTimeout(() => completeBrowserLoading(), 1000);
  return true;
}

function mountFallbackIframe(slot, tab, srcUrl, titleUrl) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:none;";
  iframe.sandbox = "allow-scripts allow-forms allow-pointer-lock allow-popups";
  iframe.src = srcUrl;
  iframe.addEventListener("load", () => {
    completeBrowserLoading();
    try {
      const domain = new URL(titleUrl).hostname;
      updateBrowserTabTitle(browserState.active, domain, titleUrl);
    } catch {}
  });
  slot.appendChild(iframe);
  tab.mode = "iframe";
  tab.frameRef = iframe;
}

async function browserNavigate(val) {
  if (!val || !val.trim()) return;

  const rawInput = val.trim();
  rememberBrowserSuggestion(rawInput);
  const normalizedUrl = normalizeBrowserInput(rawInput);
  if (!normalizedUrl) {
    if (typeof notify === "function") notify("browser", "invalid or blocked url");
    return;
  }
  const tab = getActiveBrowserTab();
  if (!tab) return;

  beginBrowserLoading();
  const addr = document.getElementById("br-addr");
  if (addr) addr.value = rawInput;
  tab.url = rawInput;
  tab.resolvedUrl = normalizedUrl;

  const slot = document.getElementById(`br-frame-${browserState.active}`);
  if (!slot) return;
  if (tab.mode === "scramjet" && typeof tab.frameRef?.destroy === "function") {
    try {
      tab.frameRef.destroy();
    } catch {}
  }
  tab.frameRef = null;
  slot.innerHTML = "";

  let mountedWithScramjet = false;
  if (window._scramjetReady) {
    try {
      mountedWithScramjet = await mountScramjetTab(slot, tab, normalizedUrl);
      if (mountedWithScramjet) browserState.notifiedScramjetFallback = false;
    } catch (err) {
      window._scramjetStatusMessage = String(err?.message || err || "scramjet mount failed");
      console.warn("[browser] scramjet mount failed:", err.message);
    }
  }

  if (!mountedWithScramjet && typeof window.reinitializeScramjet === "function") {
    const status = String(window._scramjetStatusMessage || "");
    const shouldRetry =
      (typeof window.shouldRetryScramjetInit === "function" && window.shouldRetryScramjetInit(status)) ||
      SCRAMJET_RETRY_STATUS_RE.test(status);
    if (shouldRetry) {
      try {
        await window.reinitializeScramjet();
        mountedWithScramjet = await mountScramjetTab(slot, tab, normalizedUrl);
        if (mountedWithScramjet) browserState.notifiedScramjetFallback = false;
      } catch (err) {
        window._scramjetStatusMessage = String(err?.message || err || status);
        console.warn("[browser] scramjet reinit failed:", err.message);
      }
    }
  }

  if (!mountedWithScramjet) {
    const untrustedOrigin = window._scramjetTrustworthyOrigin === false;
    const hasFallbackProxy = !!(OS.browserProxyBase && OS.browserProxyBase.length > 4);
    if (untrustedOrigin && !hasFallbackProxy) {
      slot.innerHTML = `<div class="browser-newtab-page" style="align-items:flex-start;justify-content:flex-start;padding:24px;gap:10px">
        <div class="browser-nt-word" style="font-size:1.2rem;opacity:.82">proxy unavailable on this origin</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.65;max-width:520px">
          scramjet requires <b>https</b> or <b>localhost</b> for service workers.<br>
          open this app at <b>http://localhost:8080</b> (or serve over https), then retry.
        </div>
      </div>`;
      tab.mode = "error";
      tab.frameRef = null;
      completeBrowserLoading();
      if (!browserState.notifiedScramjetFallback && typeof notify === "function") {
        notify("browser", "run on localhost/https for scramjet proxy");
        browserState.notifiedScramjetFallback = true;
      }
      return;
    }

    if (!hasFallbackProxy) {
      const reason = window._scramjetStatusMessage ? ` (${window._scramjetStatusMessage})` : "";
      slot.innerHTML = `<div class="browser-newtab-page" style="align-items:flex-start;justify-content:flex-start;padding:24px;gap:10px">
        <div class="browser-nt-word" style="font-size:1.2rem;opacity:.82">scramjet unavailable</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.65;max-width:520px">
          could not initialize proxy runtime${reason}.<br>
          open settings and use <b>reset scramjet cache</b>, then retry.
        </div>
      </div>`;
      tab.mode = "error";
      tab.frameRef = null;
      completeBrowserLoading();
      if (!browserState.notifiedScramjetFallback && typeof notify === "function") {
        notify("browser", `scramjet unavailable${reason}`);
        browserState.notifiedScramjetFallback = true;
      }
      return;
    }

    let fallbackUrl = normalizedUrl;
    if (hasFallbackProxy) {
      fallbackUrl = OS.browserProxyBase + encodeURIComponent(normalizedUrl);
    }
    mountFallbackIframe(slot, tab, fallbackUrl, normalizedUrl);

    if (!browserState.notifiedScramjetFallback && typeof notify === "function") {
      const reason = window._scramjetStatusMessage ? ` (${window._scramjetStatusMessage})` : "";
      notify("browser", `scramjet unavailable, using fallback${reason}`);
      browserState.notifiedScramjetFallback = true;
    }
  }

  try {
    const domain = new URL(normalizedUrl).hostname;
    updateBrowserTabTitle(browserState.active, domain, normalizedUrl);
  } catch {}
}

function withScramjetHistoryAction(tab, method, historyAction) {
  if (!tab || tab.mode !== "scramjet" || !tab.frameRef) return false;
  try {
    if (typeof tab.frameRef[method] === "function") {
      tab.frameRef[method]();
      return true;
    }
  } catch {}
  try {
    const frame = tab.frameRef.frame;
    if (frame?.contentWindow?.history) {
      historyAction(frame.contentWindow.history);
      return true;
    }
  } catch {}
  return false;
}

function browserGoBack() {
  const tab = getActiveBrowserTab();
  if (!tab) return;
  if (withScramjetHistoryAction(tab, "back", (history) => history.back())) return;
  const frame = activeBrowserFrame();
  if (frame) {
    try {
      frame.contentWindow.history.back();
    } catch {}
  }
}

function browserGoForward() {
  const tab = getActiveBrowserTab();
  if (!tab) return;
  if (withScramjetHistoryAction(tab, "forward", (history) => history.forward())) return;
  const frame = activeBrowserFrame();
  if (frame) {
    try {
      frame.contentWindow.history.forward();
    } catch {}
  }
}

function browserReload() {
  const tab = getActiveBrowserTab();
  if (!tab) return;

  if (tab.mode === "scramjet" && tab.frameRef) {
    try {
      if (typeof tab.frameRef.reload === "function") {
        tab.frameRef.reload();
        return;
      }
    } catch {}
    if (tab.resolvedUrl) {
      browserNavigate(tab.resolvedUrl);
      return;
    }
  }

  const frame = activeBrowserFrame();
  if (frame) frame.src = frame.src;
}

function updateBrowserTabTitle(id, title, url) {
  const tab = browserState.tabs.find((item) => item.id === id);
  if (tab) tab.title = title;
  const tabEl = document.querySelector(`#browser-tabs .browser-tab[data-tabid="${id}"]`);
  if (tabEl) tabEl.querySelector("span").textContent = (title || "new tab").slice(0, 28);
  try {
    const domain = new URL(`https://${url.replace(/^https?:\/\//, "")}`).hostname;
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    if (tab) tab.favicon = favicon;
    if (tabEl) {
      const img = tabEl.querySelector("img");
      img.src = favicon;
      img.style.display = "";
      img.onerror = () => {
        img.style.display = "none";
        if (tab) tab.favicon = "";
      };
    }
  } catch {}
}

function hasBrowserWindows() {
  return Object.keys(OS.wins || {}).some((id) => id === "browser" || String(id).startsWith("browser-"));
}

window.browserReceiveFile = function(fileData) {
  if (fileData?.url && typeof window.browserOpenUrl === "function") {
    window.browserOpenUrl(fileData.url, { newTab: true });
    return;
  }
  const hadBrowser = hasBrowserWindows();
  launchBrowser({ skipInitialTab: true });
  setTimeout(() => {
    if (fileData?.content) {
      const html = `<pre style="padding:16px;white-space:pre-wrap;color:#99a8b8;font-family:var(--font-m);font-size:12px">${String(fileData.content).replace(/</g, "&lt;")}</pre>`;
      const tab = createBrowserTabState({
        url: "",
        resolvedUrl: "",
        title: fileData.name || "file",
        mode: "file",
        frameRef: null,
      });
      const frames = document.getElementById("browser-frames");
      if (!frames) return;
      const slot = document.createElement("div");
      slot.id = `br-frame-${tab.id}`;
      slot.className = "browser-frame-slot";
      slot.innerHTML = html;
      frames.appendChild(slot);
      renderBrowserTabs();
      activateBrowserTab(tab.id);
    } else {
      window.browserOpenUrl(fileData?.url || "", { newTab: true });
    }
  }, hadBrowser ? 0 : 80);
};

window.browserOpenUrl = function browserOpenUrl(rawUrl, options = {}) {
  const target = String(rawUrl || "").trim();
  if (!target) return;
  const newTab = options.newTab !== false;
  const hadBrowser = hasBrowserWindows();
  launchBrowser({ skipInitialTab: true });
  setTimeout(() => {
    if (!browserState.tabs.length || newTab) newBrowserTab();
    browserNavigate(target);
    if (typeof window.focusAnyAppWindow === "function") window.focusAnyAppWindow("browser");
  }, hadBrowser ? 0 : 90);
};

window.addEventListener("resize", () => {
  if (!hasBrowserWindows()) return;
  if (browserState.resizeRaf) cancelAnimationFrame(browserState.resizeRaf);
  browserState.resizeRaf = requestAnimationFrame(() => {
    browserState.resizeRaf = 0;
    updateBrowserTabLayout();
  });
});
