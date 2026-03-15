const MUSIC_RECENT_KEY = "os-music-recent";
const MUSIC_PLAYLISTS_KEY = "os-music-playlists";
const MUSIC_VOLUME_KEY = "os-music-volume";
const MUSIC_SHUFFLE_KEY = "os-music-shuffle";
const MUSIC_REPEAT_KEY = "os-music-repeat";

const musicState = {
  audioByWinId: Object.create(null),
  sessionsByWinId: Object.create(null),
  recent: loadMusicJson(MUSIC_RECENT_KEY, []),
  playlists: normalizePlaylists(loadMusicJson(MUSIC_PLAYLISTS_KEY, [])),
  volume: clampNum(parseFloat(localStorage.getItem(MUSIC_VOLUME_KEY) || "0.8"), 0, 1),
  shuffle: localStorage.getItem(MUSIC_SHUFFLE_KEY) === "true",
  repeat: localStorage.getItem(MUSIC_REPEAT_KEY) === "true",
};

function createMusicSession() {
  return {
    queue: [],
    queueIndex: -1,
    current: null,
    results: [],
    activePlaylistId: null,
    searchTimer: null,
    progressDragging: false,
    playToken: 0,
    dragCleanupFns: [],
    activeLyricLine: -1,
    searchQuery: "",
    statusTimer: null,
    lyricsTimed: null,
    lyricsRenderToken: 0,
  };
}

function getFocusedMusicWindowId() {
  const id = String(OS?.focused || "");
  return id.startsWith("music") ? id : "";
}

function resolveMusicWinId(winId = "") {
  const id = String(winId || "").trim();
  if (id.startsWith("music")) return id;
  return getFocusedMusicWindowId();
}

function getOpenMusicWindowIds() {
  return Array.from(document.querySelectorAll(".win[id^='win-music']"))
    .map((el) => String(el.id || "").replace(/^win-/, ""))
    .filter((id) => id.startsWith("music"));
}

function forEachMusicWindow(winId = "", fn) {
  const explicit = String(winId || "").trim();
  const resolved = explicit ? resolveMusicWinId(explicit) : "";
  const ids = resolved ? [resolved] : getOpenMusicWindowIds();
  ids.forEach((id) => {
    const win = getMusicWindow(id);
    if (win) fn(id, win);
  });
}

function getMusicWindow(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return null;
  return document.getElementById(`win-${resolved}`);
}

function getMusicEl(id, winId = "") {
  const win = getMusicWindow(winId);
  if (!win) return null;
  if (window.CSS && typeof window.CSS.escape === "function") return win.querySelector(`#${window.CSS.escape(id)}`);
  return win.querySelector(`#${id}`);
}

function getMusicSession(winId = "", create = true) {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return null;
  let session = musicState.sessionsByWinId[resolved];
  if (!session && create) {
    session = createMusicSession();
    musicState.sessionsByWinId[resolved] = session;
  }
  return session || null;
}

function disposeMusicSession(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return;
  const session = musicState.sessionsByWinId[resolved];
  if (session) {
    if (session.searchTimer) clearTimeout(session.searchTimer);
    if (session.statusTimer) clearTimeout(session.statusTimer);
    (session.dragCleanupFns || []).forEach((cleanup) => {
      try {
        cleanup();
      } catch {}
    });
    delete musicState.sessionsByWinId[resolved];
  }
  const audio = musicState.audioByWinId[resolved];
  if (audio) {
    try {
      audio.pause();
      audio.src = "";
    } catch {}
    delete musicState.audioByWinId[resolved];
  }
}

function stopMusicPlayback(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return;
  const session = getMusicSession(resolved, false);
  const audio = musicState.audioByWinId[resolved] || null;
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }
  if (session) {
    session.playToken += 1;
    session.progressDragging = false;
    session.activeLyricLine = -1;
  }
  updatePlayButton(resolved);
  setProgressUI(0, (audio && Number.isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0, resolved);
  syncMusicLyricsToPlayback(0, resolved, true);
}

function musicEscapeHtml(value) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMusicWinIdFromNode(node) {
  return String(node?.closest?.(".win")?.id || "").replace(/^win-/, "");
}

function getMusicWindowLabel(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return "music";
  return resolved;
}

function setMusicStatus(text, type = "info", winId = "", ttlMs = 2600) {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, false);
  const el = getMusicEl("music-status", resolved);
  if (!session || !el) return;

  if (session.statusTimer) {
    clearTimeout(session.statusTimer);
    session.statusTimer = null;
  }

  const msg = String(text || "").trim();
  if (!msg) {
    el.textContent = "";
    el.className = "music-status";
    return;
  }

  el.textContent = msg;
  el.className = `music-status show ${type}`;
  if (ttlMs > 0) {
    session.statusTimer = setTimeout(() => {
      const live = getMusicSession(resolved, false);
      const host = getMusicEl("music-status", resolved);
      if (!live || !host) return;
      host.textContent = "";
      host.className = "music-status";
      live.statusTimer = null;
    }, ttlMs);
  }
}

function syncMusicLyricsToPlayback(currentSeconds, winId = "", force = false) {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, false);
  if (!session) return;
  const lines = Array.isArray(session.lyricsTimed) ? session.lyricsTimed : null;
  if (!lines || !lines.length) {
    if (force) {
      const root = getMusicEl("music-lyrics", resolved);
      root?.querySelectorAll(".music-lyrics-line.active").forEach((el) => el.classList.remove("active"));
    }
    return;
  }

  const time = Number(currentSeconds || 0);
  let nextIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const t = Number(lines[i]?.time || 0);
    if (time + 0.08 >= t) nextIdx = i;
    else break;
  }

  if (!force && nextIdx === session.activeLyricLine) return;
  session.activeLyricLine = nextIdx;
  const root = getMusicEl("music-lyrics", resolved);
  if (!root) return;
  root.querySelectorAll(".music-lyrics-line.active").forEach((el) => el.classList.remove("active"));
  if (nextIdx < 0) return;
  const next = root.querySelector(`.music-lyrics-line[data-lyric-line="${nextIdx}"]`);
  if (!next) return;
  next.classList.add("active");
  if (force) return;
  try {
    next.scrollIntoView({ block: "nearest" });
  } catch {}
}

function launchMusic() {
  if (window.shouldReuseAppWindow?.('music') && window.focusAnyAppWindow?.('music')) return;

  const html = `
    <div class="music-shell-wrap" id="music-root">
      <div class="music-app-shell">
      <aside class="music-left">
        <div class="music-left-top">
          <div class="music-logo">oblivion music</div>
          <label class="music-search-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round">
              <circle cx="7" cy="7" r="4.5"></circle>
              <path d="M11 11l2.7 2.7"></path>
            </svg>
            <input id="music-search" class="music-search-input" placeholder="what do you want to play?" autocomplete="off" spellcheck="false">
          </label>
        </div>
        <div id="music-status" class="music-status" aria-live="polite"></div>
        <div class="music-tabs">
          <button class="music-tab-btn active" data-mtab="search">search</button>
          <button class="music-tab-btn" data-mtab="queue">queue</button>
        </div>
        <div class="music-tab-panel active" id="music-panel-search">
          <div id="music-results" class="music-list"></div>
        </div>
        <div class="music-tab-panel" id="music-panel-queue">
          <div id="music-queue" class="music-list"></div>
        </div>
        <div class="music-playlists-head">
          <span>playlists</span>
          <button id="music-new-playlist" class="music-mini-btn" title="new playlist">+</button>
        </div>
        <div id="music-playlists" class="music-playlists"></div>
      </aside>

      <main class="music-main">
        <section class="music-hero">
          <div id="music-hero-bg" class="music-hero-bg"></div>
          <div class="music-art-wrap">
            <img id="music-art" class="music-art" src="" alt="">
            <div id="music-art-placeholder" class="music-art-placeholder">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
                <path d="M19 35V17l22-5v18"></path>
                <circle cx="14" cy="35" r="5"></circle>
                <circle cx="36" cy="30" r="5"></circle>
              </svg>
            </div>
          </div>
          <div class="music-hero-info">
            <div class="music-hero-label">now playing</div>
            <div id="music-now-title" class="music-now-title">nothing playing</div>
            <div id="music-now-artist" class="music-now-artist">-</div>
          </div>
        </section>

        <section class="music-main-list-wrap">
          <div class="music-main-list-head">
            <div id="music-main-title">recently played</div>
            <div class="music-main-actions">
              <button id="music-show-recent" class="music-mini-btn">recent</button>
              <button id="music-add-current" class="music-mini-btn">add current</button>
            </div>
          </div>
          <div id="music-main-list" class="music-list"></div>
        </section>
      </main>

      <aside class="music-right">
        <div class="music-right-section">
          <div class="music-right-title">up next</div>
          <div id="music-upnext" class="music-list"></div>
        </div>
        <div class="music-right-section music-lyrics-wrap">
          <div class="music-right-title">lyrics</div>
          <div id="music-lyrics" class="music-lyrics"></div>
        </div>
      </aside>

      <footer class="music-footer">
        <div class="music-controls">
          <button id="music-btn-shuffle" class="music-ctrl-btn" title="shuffle">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h2l9 6h3M14 7h3v2.5M14 13h3v-2.5M3 13h2"></path></svg>
          </button>
          <button id="music-btn-prev" class="music-ctrl-btn" title="previous">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4v12M15 4L8 10l7 6V4z"></path></svg>
          </button>
          <button id="music-btn-play" class="music-ctrl-btn music-ctrl-play" title="play/pause">
            <svg id="music-play-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4l11 6-11 6V4z"></path></svg>
          </button>
          <button id="music-btn-next" class="music-ctrl-btn" title="next">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4v12M5 4l7 6-7 6V4z"></path></svg>
          </button>
          <button id="music-btn-repeat" class="music-ctrl-btn" title="repeat">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h12v3l3-3-3-3v3M16 13H4v-3l-3 3 3 3v-3"></path></svg>
          </button>
        </div>
        <div class="music-progress-wrap">
          <span id="music-time-current" class="music-time">0:00</span>
          <div id="music-progress" class="music-progress-bar">
            <div id="music-progress-fill" class="music-progress-fill"></div>
            <div id="music-progress-thumb" class="music-progress-thumb"></div>
          </div>
          <span id="music-time-total" class="music-time">0:00</span>
        </div>
        <div class="music-volume-wrap">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 5h3l4-3v12l-4-3H2V5zM11 5.5a4 4 0 010 5M13 3a7 7 0 010 10"></path></svg>
          <div id="music-volume" class="music-volume-bar">
            <div id="music-volume-fill" class="music-volume-fill"></div>
            <div id="music-volume-thumb" class="music-volume-thumb"></div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  `;

  const desk = document.getElementById("desktop");
  const deskW = desk?.offsetWidth || window.innerWidth || 1040;
  const deskH = desk?.offsetHeight || Math.max(560, (window.innerHeight || 760) - 54);
  const width = Math.max(760, Math.min(1040, Math.floor(deskW * 0.92)));
  const height = Math.max(520, Math.min(660, Math.floor(deskH * 0.9)));
  const winEl = createWin("music", "oblivion music", width, height, html);
  const winId = String(winEl?.id || "").replace(/^win-/, "");
  setTimeout(() => bindMusicUI(winId), 40);
}

function bindMusicUI(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved || !getMusicWindow(resolved)) return;
  const session = getMusicSession(resolved, true);
  (session.dragCleanupFns || []).forEach((cleanup) => {
    try {
      cleanup();
    } catch {}
  });
  session.dragCleanupFns = [];

  const audio = ensureMusicAudio(resolved);
  setMusicToggleState(resolved);
  setVolumeUI(musicState.volume, resolved);
  setProgressUI(audio.currentTime || 0, audio.duration || 0, resolved);
  updatePlayButton(resolved);

  const searchInput = getMusicEl("music-search", resolved);
  if (searchInput) {
    searchInput.addEventListener("input", (e) => onMusicSearchInput(e, resolved));
  }

  const newPlaylistBtn = getMusicEl("music-new-playlist", resolved);
  if (newPlaylistBtn) newPlaylistBtn.addEventListener("click", () => createMusicPlaylist(null, resolved));

  const showRecentBtn = getMusicEl("music-show-recent", resolved);
  if (showRecentBtn) {
    showRecentBtn.addEventListener("click", () => {
      const s = getMusicSession(resolved, true);
      s.activePlaylistId = null;
      renderMusicMainList(resolved);
      renderMusicPlaylists(resolved);
    });
  }

  const addCurrentBtn = getMusicEl("music-add-current", resolved);
  if (addCurrentBtn) {
    addCurrentBtn.addEventListener("click", (e) => {
      const s = getMusicSession(resolved, true);
      if (!s.current) {
        setMusicStatus("nothing playing", "warn", resolved, 2200);
        return;
      }
      openMusicRowMenu(e, s.current, -1, resolved);
    });
  }

  const rootWin = getMusicWindow(resolved);
  rootWin?.querySelectorAll(".music-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      rootWin?.querySelectorAll(".music-tab-btn").forEach((b) => b.classList.remove("active"));
      rootWin?.querySelectorAll(".music-tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = rootWin?.querySelector(`#music-panel-${btn.dataset.mtab}`);
      if (panel) panel.classList.add("active");
    });
  });

  const playBtn = getMusicEl("music-btn-play", resolved);
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      const audio = ensureMusicAudio(resolved);
      if (!audio.src) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
  }

  const prevBtn = getMusicEl("music-btn-prev", resolved);
  if (prevBtn) prevBtn.addEventListener("click", () => playPreviousTrack(resolved));

  const nextBtn = getMusicEl("music-btn-next", resolved);
  if (nextBtn) nextBtn.addEventListener("click", () => playNextTrack(resolved));

  const shuffleBtn = getMusicEl("music-btn-shuffle", resolved);
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      musicState.shuffle = !musicState.shuffle;
      localStorage.setItem(MUSIC_SHUFFLE_KEY, String(musicState.shuffle));
      setMusicToggleState();
    });
  }

  const repeatBtn = getMusicEl("music-btn-repeat", resolved);
  if (repeatBtn) {
    repeatBtn.addEventListener("click", () => {
      musicState.repeat = !musicState.repeat;
      localStorage.setItem(MUSIC_REPEAT_KEY, String(musicState.repeat));
      setMusicToggleState();
    });
  }

  const progressCleanup = bindMusicBarDrag("music-progress", (value, dragging) => {
    const s = getMusicSession(resolved, true);
    s.progressDragging = dragging;
    const audio = ensureMusicAudio(resolved);
    if (!dragging && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = value * audio.duration;
    }
    if (dragging && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      setProgressUI(value, audio.duration, resolved);
    }
  }, resolved);
  if (typeof progressCleanup === "function") session.dragCleanupFns.push(progressCleanup);

  const volumeCleanup = bindMusicBarDrag("music-volume", (value) => {
    musicState.volume = clampNum(value, 0, 1);
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicState.volume));
    Object.values(musicState.audioByWinId).forEach((a) => { try { a.volume = musicState.volume; } catch {} });
    setVolumeUI(musicState.volume);
  }, resolved);
  if (typeof volumeCleanup === "function") session.dragCleanupFns.push(volumeCleanup);

  const win = getMusicWindow(resolved);
  if (win) win.addEventListener("keydown", (e) => handleMusicShortcuts(e, resolved));
  const lyricsEl = getMusicEl("music-lyrics", resolved);
  if (lyricsEl) {
    lyricsEl.addEventListener("click", (e) => handleMusicLyricsClick(e, resolved));
  }

  renderMusicResultsPlaceholder("search for a song or artist", resolved);
  renderMusicQueue(resolved);
  renderMusicPlaylists(resolved);
  renderMusicMainList(resolved);
  renderMusicNowPlaying(resolved);
  renderMusicLyrics("play a track to load lyrics", resolved);
}

function handleMusicShortcuts(e, winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved || String(OS.focused || "") !== resolved) return;
  const isEditable = !!e.target?.closest?.("input,textarea,select,[contenteditable=\"\"],[contenteditable=\"true\"],[contenteditable]:not([contenteditable=\"false\"])");
  if (!isEditable && (e.code === "Space" || e.key === " ")) {
    const audio = ensureMusicAudio(resolved);
    if (audio?.src) {
      e.preventDefault();
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    }
    return;
  }
  const key = String(e.key || "").toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  if (!e.shiftKey && key === "f") {
    e.preventDefault();
    getMusicEl("music-search", resolved)?.focus();
    return;
  }
  if (!e.shiftKey && key === "n") {
    e.preventDefault();
    createMusicPlaylist(null, resolved);
    return;
  }
  if (!e.shiftKey && key === "s") {
    e.preventDefault();
    saveMusicLibrary();
    setMusicStatus("library saved", "ok", resolved, 1800);
    return;
  }
  if (!e.shiftKey && key === "w") {
    e.preventDefault();
    if (typeof closeWin === "function") closeWin(resolved);
  }
}

function handleMusicLyricsClick(e, winId = "") {
  const inferred = getMusicWinIdFromNode(e?.target);
  const resolved = resolveMusicWinId(winId || inferred);
  const session = getMusicSession(resolved, true);
  if (!session) return;
  const lineEl = e.target.closest(".music-lyrics-line[data-lyric-line]");
  if (!lineEl) return;
  const idx = Number.parseInt(lineEl.dataset.lyricLine || "-1", 10);
  session.activeLyricLine = Number.isInteger(idx) ? idx : -1;
  const timeRaw = lineEl.dataset.lyricTime;
  const timeSec = Number.parseFloat(timeRaw || "");
  if (Number.isFinite(timeSec)) {
    const audio = ensureMusicAudio(resolved);
    if (audio) {
      try {
        audio.currentTime = Math.max(0, timeSec);
      } catch {}
      setProgressUI(audio.currentTime || 0, audio.duration || 0, resolved);
    }
  }
  const lyricsRoot = getMusicEl("music-lyrics", resolved);
  lyricsRoot?.querySelectorAll(".music-lyrics-line.active").forEach((el) => el.classList.remove("active"));
  lineEl.classList.add("active");
  const line = String(lineEl.dataset.lyricText || lineEl.textContent || "").trim();
  if (!line || !navigator?.clipboard?.writeText) return;
  navigator.clipboard.writeText(line).then(() => {
    setMusicStatus("lyric line copied", "ok", resolved, 1400);
  }).catch(() => {});
}

function onMusicSearchInput(e, winId = "") {
  const inferred = getMusicWinIdFromNode(e?.target);
  const resolved = resolveMusicWinId(winId || inferred);
  const session = getMusicSession(resolved, true);
  if (!session) return;
  clearTimeout(session.searchTimer);
  const q = String(e.target.value || "").trim();
  session.searchQuery = q;
  if (!q) {
    session.results = [];
    renderMusicResultsPlaceholder("search for a song or artist", resolved);
    return;
  }
  renderMusicResultsPlaceholder("searching...", resolved);
  session.searchTimer = setTimeout(async () => {
    try {
      const results = await searchMusicTracks(q);
      const live = getMusicSession(resolved, false);
      if (!live) return;
      if (live.searchQuery !== q) return;
      live.results = results;
      if (!live.results.length) {
        renderMusicResultsPlaceholder("no results", resolved);
        return;
      }
      renderMusicResults(resolved);
    } catch (err) {
      setMusicStatus("search request failed", "error", resolved, 3200);
      renderMusicResultsPlaceholder(`search failed: ${err.message || "unknown error"}`, resolved);
    }
  }, 260);
}

async function searchMusicTracks(query) {
  const res = await fetch(`/api/itunes?term=${encodeURIComponent(query)}&entity=song&limit=28`);
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  const data = await res.json();
  const seen = new Set();
  return (data.results || [])
    .map(normalizeItunesTrack)
    .filter((t) => {
      if (!t) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
}

function normalizeItunesTrack(item) {
  if (!item || (!item.trackName && !item.collectionName)) return null;
  const trackId = item.trackId || `${item.artistName || "artist"}|${item.trackName || item.collectionName}`;
  return {
    id: `it-${trackId}`,
    name: item.trackName || item.collectionName || "untitled",
    artist: item.artistName || "unknown artist",
    album: item.collectionName || "",
    durationMs: Number(item.trackTimeMillis || 0) || 0,
    image: proxyArtwork(item.artworkUrl100 || item.artworkUrl60 || ""),
    previewUrl: item.previewUrl || "",
    audioUrl: "",
    videoId: "",
    source: "itunes",
  };
}

function proxyArtwork(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const upscaled = raw.replace(/\/\d+x\d+bb\./, "/600x600bb.");
  return `/api/img/${upscaled.replace(/^https?:\/\//i, "")}`;
}

function renderMusicResults(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const root = getMusicEl("music-results", id);
    const session = getMusicSession(id, false);
    if (!root || !session) return;
    root.innerHTML = "";
    session.results.forEach((track) => {
      root.appendChild(createMusicTrackRow(track, {
        showAdd: true,
        queueIndex: -1,
        winId: id,
        isPlaying: !!(session.current && session.current.id === track.id),
      }));
    });
  });
}

function renderMusicResultsPlaceholder(text, winId = "") {
  forEachMusicWindow(winId, (id) => {
    const root = getMusicEl("music-results", id);
    if (!root) return;
    root.innerHTML = `<div class="music-empty">${escapeMusicHtml(text)}</div>`;
  });
}

function createMusicTrackRow(track, { showAdd, showRemove = false, queueIndex, winId = "", isPlaying = false }) {
  const row = document.createElement("div");
  row.className = "music-row";
  row.tabIndex = 0;
  if (isPlaying) row.classList.add("playing");
  const resolved = resolveMusicWinId(winId);

  const thumb = track.image
    ? `<img class="music-thumb" src="${escapeMusicHtml(track.image)}" alt="" loading="lazy">`
    : `<div class="music-thumb music-thumb-empty"></div>`;

  const dur = track.durationMs ? formatMusicTime(Math.floor(track.durationMs / 1000)) : "";
  row.innerHTML = `
    ${thumb}
    <div class="music-row-info">
      <div class="music-row-title">${escapeMusicHtml(track.name)}</div>
      <div class="music-row-sub">${escapeMusicHtml(track.artist || "")}</div>
    </div>
    <div class="music-row-side">${escapeMusicHtml(dur)}</div>
    ${showAdd ? `<button class="music-row-add" title="add to queue">+</button>` : ""}
    ${showRemove ? `<button class="music-row-remove" title="remove from queue" aria-label="remove from queue">-</button>` : ""}
    <button class="music-row-more" title="more" aria-label="more">
      <svg viewBox="0 0 8 18" fill="currentColor" aria-hidden="true">
        <circle cx="4" cy="3" r="1.2"></circle>
        <circle cx="4" cy="9" r="1.2"></circle>
        <circle cx="4" cy="15" r="1.2"></circle>
      </svg>
    </button>
  `;

  row.addEventListener("click", (e) => {
    if (e.target.closest(".music-row-add,.music-row-more,.music-row-remove")) return;
    const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
    if (queueIndex >= 0) playMusicAtQueueIndex(queueIndex, rowWinId);
    else enqueueTrackAndPlay(track, rowWinId);
  });

  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
      if (queueIndex >= 0) playMusicAtQueueIndex(queueIndex, rowWinId);
      else enqueueTrackAndPlay(track, rowWinId);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && queueIndex >= 0) {
      e.preventDefault();
      const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
      removeMusicQueueTrack(queueIndex, rowWinId);
    }
  });

  const addBtn = row.querySelector(".music-row-add");
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
      enqueueTrack(track, false, rowWinId);
    });
  }

  const removeBtn = row.querySelector(".music-row-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
      removeMusicQueueTrack(queueIndex, rowWinId);
    });
  }

  const moreBtn = row.querySelector(".music-row-more");
  if (moreBtn) {
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
      openMusicRowMenu(e, track, queueIndex, rowWinId);
    });
  }

  row.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rowWinId = getMusicWinIdFromNode(e.currentTarget) || resolved;
    openMusicRowMenu(e, track, queueIndex, rowWinId);
  });

  return row;
}

function openMusicRowMenu(e, track, queueIndex = -1, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const items = [
    {
      label: "play now",
      action: () => {
        if (queueIndex >= 0) playMusicAtQueueIndex(queueIndex, resolved);
        else enqueueTrackAndPlay(track, resolved);
      },
    },
    { label: "add to queue", action: () => enqueueTrack(track, false, resolved) },
  ];
  if (queueIndex >= 0) {
    items.push({ label: "remove from queue", action: () => removeMusicQueueTrack(queueIndex, resolved) });
  }

  if (musicState.playlists.length) {
    items.push("sep");
    musicState.playlists.forEach((pl) => {
      items.push({
        label: `add to ${pl.name}`,
        action: () => addTrackToPlaylist(track, pl.id, resolved),
      });
    });
  } else {
    items.push("sep");
    items.push({
      label: "new playlist",
      action: () => createMusicPlaylist(track, resolved),
    });
  }

  if (typeof showCtx === "function") {
    showCtx(e.clientX, e.clientY, items);
  }
}

function enqueueTrack(track, playNow, winId = "", options = {}) {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, true);
  if (!session) return;
  const opts = options || {};
  const t = normalizeSavedTrack(track);
  session.queue.push(t);
  if (playNow) {
    session.queueIndex = session.queue.length - 1;
    playMusicAtQueueIndex(session.queueIndex, resolved);
  }
  renderMusicQueue(resolved);
  if (opts.feedback !== false) {
    const target = getMusicWindowLabel(resolved);
    const text = playNow ? `playing in ${target}: ${t.name}` : `queued to ${target}: ${t.name}`;
    setMusicStatus(text, "ok", resolved, 2200);
  }
}

function enqueueTrackAndPlay(track, winId = "") {
  enqueueTrack(track, true, winId, { feedback: true });
}

function removeMusicQueueTrack(index, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, true);
  if (!session || index < 0 || index >= session.queue.length) return;
  const removed = session.queue.splice(index, 1)[0] || null;
  if (session.queueIndex > index) session.queueIndex -= 1;
  else if (session.queueIndex === index) {
    if (!session.queue.length) {
      session.queueIndex = -1;
      session.current = null;
      stopMusicPlayback(resolved);
      renderMusicNowPlaying(resolved);
      renderMusicLyrics("play a track to load lyrics", resolved);
    } else {
      const nextIndex = Math.min(index, session.queue.length - 1);
      session.queueIndex = nextIndex;
      playMusicAtQueueIndex(nextIndex, resolved);
    }
  }
  renderMusicQueue(resolved);
  if (removed) setMusicStatus(`removed from queue: ${removed.name}`, "info", resolved, 2000);
}

function playMusicAtQueueIndex(index, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, true);
  if (index < 0 || index >= session.queue.length) return;
  session.queueIndex = index;
  playMusicTrack(session.queue[index], index, resolved);
}

async function playMusicTrack(track, queueIndex = null, winId = "") {
  if (!track) return;
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return;
  const session = getMusicSession(resolved, true);
  const token = ++session.playToken;

  if (queueIndex != null) session.queueIndex = queueIndex;
  session.current = track;
  rememberRecentTrack(track);
  renderMusicNowPlaying(resolved);
  renderMusicQueue(resolved);
  renderMusicMainList();
  fetchMusicLyrics(track, token, resolved);

  const audio = ensureMusicAudio(resolved);
  const src = await resolveMusicAudioSource(track).catch(() => "");
  const live = getMusicSession(resolved, false);
  if (!live || token !== live.playToken) return;
  if (!src) {
    setMusicStatus("no playable source found", "error", resolved, 3200);
    return;
  }

  try {
    if (audio.src !== src) {
      audio.pause();
      audio.src = src;
      audio.load();
      audio.currentTime = 0;
    } else {
      audio.currentTime = 0;
    }
    await audio.play();
  } catch (err) {
    setMusicStatus(`playback failed: ${err.message || "unknown error"}`, "error", resolved, 3600);
  }
}

async function resolveMusicAudioSource(track) {
  if (track.audioUrl) return track.audioUrl;
  if (track.videoId) {
    track.audioUrl = `/api/ytAudio/${track.videoId}`;
    return track.audioUrl;
  }

  const q = `${track.artist || ""} ${track.name || ""} official audio`.trim();
  if (!q) return "";

  const res = await fetch(`/api/ytSearch?q=${encodeURIComponent(q)}`);
  if (!res.ok) return track.previewUrl || "";
  const data = await res.json();
  if (!data.videoId) return track.previewUrl || "";
  track.videoId = data.videoId;
  track.audioUrl = `/api/ytAudio/${data.videoId}`;
  return track.audioUrl;
}

function ensureMusicAudio(winId = "") {
  const resolved = resolveMusicWinId(winId);
  if (!resolved) return null;
  const cached = musicState.audioByWinId[resolved];
  if (cached) return cached;
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = musicState.volume;
  audio.addEventListener("play", () => updatePlayButton(resolved));
  audio.addEventListener("pause", () => updatePlayButton(resolved));
  audio.addEventListener("timeupdate", () => {
    const session = getMusicSession(resolved, false);
    if (session?.progressDragging) return;
    setProgressUI(audio.currentTime || 0, audio.duration || 0, resolved);
    syncMusicLyricsToPlayback(audio.currentTime || 0, resolved);
  });
  audio.addEventListener("loadedmetadata", () => {
    setProgressUI(audio.currentTime || 0, audio.duration || 0, resolved);
  });
  audio.addEventListener("ended", () => onMusicEnded(resolved));
  audio.addEventListener("error", () => {
    setMusicStatus("playback error", "error", resolved, 3200);
  });
  musicState.audioByWinId[resolved] = audio;
  return audio;
}

function onMusicEnded(winId = "") {
  const audio = ensureMusicAudio(winId);
  const session = getMusicSession(winId, true);
  if (musicState.repeat && audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  if (!session) return;
  playNextTrack(winId);
}

function playPreviousTrack(winId = "") {
  const session = getMusicSession(winId, true);
  const audio = ensureMusicAudio(winId);
  if (!audio || !session) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (session.queueIndex > 0) {
    playMusicAtQueueIndex(session.queueIndex - 1, winId);
  }
}

function playNextTrack(winId = "") {
  const session = getMusicSession(winId, true);
  if (!session || !session.queue.length) return;
  if (musicState.shuffle && session.queue.length > 1) {
    const next = Math.floor(Math.random() * session.queue.length);
    playMusicAtQueueIndex(next, winId);
    return;
  }
  if (session.queueIndex < session.queue.length - 1) {
    playMusicAtQueueIndex(session.queueIndex + 1, winId);
  } else if (musicState.repeat) {
    playMusicAtQueueIndex(0, winId);
  }
}

function renderMusicQueue(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const session = getMusicSession(id, true);
    const queueEl = getMusicEl("music-queue", id);
    const upnextEl = getMusicEl("music-upnext", id);

    if (queueEl) {
      queueEl.innerHTML = "";
      if (!session.queue.length) {
        queueEl.innerHTML = `<div class="music-empty">queue is empty</div>`;
      } else {
        session.queue.forEach((track, i) => {
          queueEl.appendChild(createMusicTrackRow(track, {
            showAdd: false,
            showRemove: true,
            queueIndex: i,
            winId: id,
            isPlaying: !!(session.current && session.current.id === track.id && session.queueIndex === i),
          }));
        });
      }
    }

    if (upnextEl) {
      upnextEl.innerHTML = "";
      const upcoming = session.queue.slice(Math.max(0, session.queueIndex + 1));
      if (!upcoming.length) {
        upnextEl.innerHTML = `<div class="music-empty">nothing up next</div>`;
      } else {
        const startIndex = Math.max(0, session.queueIndex + 1);
        upcoming.forEach((track, i) => {
          upnextEl.appendChild(createMusicTrackRow(track, {
            showAdd: false,
            showRemove: true,
            queueIndex: startIndex + i,
            winId: id,
            isPlaying: false,
          }));
        });
      }
    }
  });
}

function renderMusicNowPlaying(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const session = getMusicSession(id, true);
    const title = getMusicEl("music-now-title", id);
    const artist = getMusicEl("music-now-artist", id);
    const art = getMusicEl("music-art", id);
    const artPh = getMusicEl("music-art-placeholder", id);
    const heroBg = getMusicEl("music-hero-bg", id);

    if (!title || !artist || !art || !artPh || !heroBg) return;
    const t = session.current;
    if (!t) {
      title.textContent = "nothing playing";
      artist.textContent = "-";
      art.src = "";
      art.classList.remove("on");
      artPh.classList.remove("hidden");
      heroBg.style.backgroundImage = "";
      heroBg.classList.remove("on");
      return;
    }
    title.textContent = t.name || "untitled";
    artist.textContent = t.artist || "unknown artist";
    if (t.image) {
      art.src = t.image;
      art.classList.add("on");
      art.onload = () => artPh.classList.add("hidden");
      art.onerror = () => artPh.classList.remove("hidden");
      heroBg.style.backgroundImage = `url("${t.image}")`;
      heroBg.classList.add("on");
    } else {
      art.src = "";
      art.classList.remove("on");
      artPh.classList.remove("hidden");
      heroBg.style.backgroundImage = "";
      heroBg.classList.remove("on");
    }
  });
}

function renderMusicMainList(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const session = getMusicSession(id, true);
    const titleEl = getMusicEl("music-main-title", id);
    const listEl = getMusicEl("music-main-list", id);
    if (!titleEl || !listEl) return;

    let tracks = [];
    const active = musicState.playlists.find((p) => p.id === session.activePlaylistId);
    if (active) {
      titleEl.textContent = active.name;
      tracks = active.tracks || [];
    } else {
      titleEl.textContent = "recently played";
      tracks = musicState.recent || [];
    }

    listEl.innerHTML = "";
    if (!tracks.length) {
      listEl.innerHTML = `<div class="music-empty">${active ? "playlist is empty" : "play a song to build history"}</div>`;
      return;
    }
    tracks.forEach((track) => {
      listEl.appendChild(createMusicTrackRow(track, {
        showAdd: true,
        queueIndex: -1,
        winId: id,
        isPlaying: !!(session.current && session.current.id === track.id),
      }));
    });
  });
}

function rememberRecentTrack(track) {
  const snap = normalizeSavedTrack(track);
  musicState.recent = musicState.recent.filter((t) => t.id !== snap.id);
  musicState.recent.unshift(snap);
  if (musicState.recent.length > 40) musicState.recent = musicState.recent.slice(0, 40);
  saveMusicLibrary();
}

function renderMusicPlaylists(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const session = getMusicSession(id, true);
    const el = getMusicEl("music-playlists", id);
    if (!el) return;
    el.innerHTML = "";
    if (!musicState.playlists.length) {
      el.innerHTML = `<div class="music-empty small">no playlists yet</div>`;
      return;
    }
    musicState.playlists.forEach((pl) => {
      const row = document.createElement("div");
      row.className = `music-playlist-row${session.activePlaylistId === pl.id ? " active" : ""}`;
      row.innerHTML = `
        <div class="music-playlist-name">${escapeMusicHtml(pl.name)}</div>
        <div class="music-playlist-count">${(pl.tracks || []).length}</div>
      `;
      row.addEventListener("click", () => {
        const s = getMusicSession(id, true);
        s.activePlaylistId = pl.id;
        renderMusicPlaylists(id);
        renderMusicMainList(id);
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (typeof showCtx !== "function") return;
        showCtx(e.clientX, e.clientY, [
          {
            label: "rename",
            action: () => renameMusicPlaylist(pl.id, id),
          },
          {
            label: "delete",
            action: () => deleteMusicPlaylist(pl.id, id),
            danger: true,
          },
        ]);
      });
      el.appendChild(row);
    });
  });
}

function createMusicPlaylist(seedTrack = null, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const session = getMusicSession(resolved, true);
  const create = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const pl = {
      id: `pl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      name: trimmed,
      tracks: [],
    };
    if (seedTrack) pl.tracks.push(normalizeSavedTrack(seedTrack));
    musicState.playlists.push(pl);
    if (session) session.activePlaylistId = pl.id;
    saveMusicLibrary();
    renderMusicPlaylists();
    renderMusicMainList();
    setMusicStatus(`"${trimmed}" created`, "ok", resolved, 2200);
  };

  if (typeof window.showShellPrompt === "function") {
    window.showShellPrompt({
      title: "new playlist",
      label: "playlist name",
      placeholder: "late night coding",
      value: "new playlist",
      confirmLabel: "create",
    }).then((name) => {
      if (name == null) return;
      create(name);
    });
    return;
  }

  const name = prompt("playlist name");
  if (name == null) return;
  create(name);
}

function renameMusicPlaylist(id, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const pl = musicState.playlists.find((p) => p.id === id);
  if (!pl) return;
  const rename = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    pl.name = trimmed;
    saveMusicLibrary();
    renderMusicPlaylists();
    renderMusicMainList();
    setMusicStatus(`renamed to "${trimmed}"`, "ok", resolved, 2000);
  };

  if (typeof window.showShellPrompt === "function") {
    window.showShellPrompt({
      title: "rename playlist",
      label: "playlist name",
      value: pl.name,
      confirmLabel: "save",
    }).then((name) => {
      if (name == null) return;
      rename(name);
    });
    return;
  }

  const name = prompt("rename playlist", pl.name);
  if (name == null) return;
  rename(name);
}

function deleteMusicPlaylist(id, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const pl = musicState.playlists.find((p) => p.id === id);
  if (!pl) return;
  musicState.playlists = musicState.playlists.filter((p) => p.id !== id);
  Object.values(musicState.sessionsByWinId).forEach((session) => {
    if (session && session.activePlaylistId === id) session.activePlaylistId = null;
  });
  saveMusicLibrary();
  renderMusicPlaylists();
  renderMusicMainList();
  setMusicStatus(`"${pl.name}" deleted`, "info", resolved, 2200);
}

function addTrackToPlaylist(track, playlistId, winId = "") {
  const resolved = resolveMusicWinId(winId);
  const pl = musicState.playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  const snap = normalizeSavedTrack(track);
  if (pl.tracks.some((t) => t.id === snap.id)) {
    setMusicStatus(`already in ${pl.name}`, "warn", resolved, 2200);
    return;
  }
  pl.tracks.push(snap);
  saveMusicLibrary();
  renderMusicMainList();
  renderMusicPlaylists();
  setMusicStatus(`added to ${pl.name}`, "ok", resolved, 2200);
}

async function fetchMusicLyrics(track, token, winId = "") {
  const resolved = resolveMusicWinId(winId);
  renderMusicLyrics("loading lyrics...", resolved);
  try {
    const params = new URLSearchParams();
    params.set("track", track.name || "");
    if (track.artist) params.set("artist", track.artist);
    if (track.album) params.set("album", track.album);
    if (track.durationMs) params.set("duration", String(Math.round(track.durationMs / 1000)));
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const session = getMusicSession(resolved, false);
    if (!session || token !== session.playToken) return;

    if (res.status === 404) {
      renderMusicLyrics("no lyrics found", resolved);
      return;
    }
    if (!res.ok) {
      renderMusicLyrics("lyrics unavailable", resolved);
      return;
    }
    const data = await res.json();
    const live = getMusicSession(resolved, false);
    if (!live || token !== live.playToken) return;
    if (data.instrumental) {
      renderMusicLyrics("instrumental", resolved);
      return;
    }
    const syncedRaw = String(data.synced || "").trim();
    if (syncedRaw) {
      const parsed = parseSyncedLyrics(syncedRaw);
      if (parsed?.length) {
        renderMusicLyrics(parsed, resolved, { timed: true });
        return;
      }
    }

    const raw = String(data.plain || syncedRaw || "").trim();
    if (!raw) {
      renderMusicLyrics("no lyrics found", resolved);
      return;
    }
    const cleaned = raw.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    renderMusicLyrics(cleaned || raw, resolved);
  } catch {
    const session = getMusicSession(resolved, false);
    if (!session || token !== session.playToken) return;
    renderMusicLyrics("lyrics unavailable", resolved);
  }
}

function parseSyncedLyrics(rawLyrics) {
  const out = [];
  const rows = String(rawLyrics || "").split(/\r?\n/);
  rows.forEach((line) => {
    const raw = String(line || "");
    const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const stamps = [...raw.matchAll(re)];
    if (!stamps.length) return;
    const text = raw.replace(re, "").trim();
    stamps.forEach((m) => {
      const mm = Number.parseInt(m[1], 10);
      const ss = Number.parseInt(m[2], 10);
      const fraction = String(m[3] || "0").padEnd(3, "0").slice(0, 3);
      const ms = Number.parseInt(fraction, 10);
      if (!Number.isFinite(mm) || !Number.isFinite(ss) || !Number.isFinite(ms)) return;
      out.push({
        text: text || "(lyric)",
        time: (mm * 60) + ss + (ms / 1000),
      });
    });
  });
  out.sort((a, b) => (a.time - b.time));
  return out.slice(0, 900);
}

function renderMusicLyrics(text, winId = "", opts = {}) {
  forEachMusicWindow(winId, (id) => {
    const session = getMusicSession(id, true);
    const el = getMusicEl("music-lyrics", id);
    if (!el) return;
    session.lyricsRenderToken += 1;
    const renderToken = session.lyricsRenderToken;
    const timed = !!opts?.timed && Array.isArray(text);
    const raw = timed ? "" : String(text || "").replace(/\u0000/g, "").slice(0, 24000);
    const rows = timed
      ? text.map((line, idx) => ({
        idx,
        text: String(line?.text || "").trim(),
        time: Number(line?.time || 0),
      })).filter((line) => line.text).slice(0, 900)
      : raw.split(/\r?\n/).slice(0, 700).map((line, idx) => ({ idx, text: String(line || ""), time: null }));

    session.lyricsTimed = timed ? rows : null;
    if (!timed) session.activeLyricLine = -1;

    if (!timed && rows.length <= 1) {
      el.classList.remove("busy");
      el.textContent = raw;
      return;
    }

    el.textContent = "";
    const hasLargePayload = rows.length > 180;
    if (hasLargePayload) el.classList.add("busy");
    else el.classList.remove("busy");

    const chunkSize = hasLargePayload ? 72 : rows.length;
    let cursor = 0;
    const appendChunk = () => {
      const live = getMusicSession(id, false);
      if (!live || live.lyricsRenderToken !== renderToken || !el.isConnected) return;
      const frag = document.createDocumentFragment();
      const end = Math.min(rows.length, cursor + chunkSize);
      for (let i = cursor; i < end; i += 1) {
        const line = rows[i];
        if (!String(line.text || "").trim()) {
          const gap = document.createElement("div");
          gap.className = "music-lyrics-gap";
          frag.appendChild(gap);
          continue;
        }
        const row = document.createElement("div");
        const active = timed && i === live.activeLyricLine;
        row.className = `music-lyrics-line${active ? " active" : ""}`;
        row.dataset.lyricLine = String(i);
        row.dataset.lyricText = line.text;
        row.title = timed ? "click to jump/copy line" : "click to copy line";
        if (timed && Number.isFinite(line.time)) row.dataset.lyricTime = String(line.time);
        if (timed) {
          const stamp = document.createElement("span");
          stamp.className = "music-lyrics-time";
          stamp.textContent = formatMusicTime(line.time);
          row.appendChild(stamp);
          const txt = document.createElement("span");
          txt.className = "music-lyrics-text";
          txt.textContent = line.text;
          row.appendChild(txt);
        } else {
          row.textContent = line.text;
        }
        frag.appendChild(row);
      }
      el.appendChild(frag);
      cursor = end;
      if (cursor < rows.length) {
        requestAnimationFrame(appendChunk);
        return;
      }
      el.classList.remove("busy");
      if (timed) {
        const audio = ensureMusicAudio(id);
        syncMusicLyricsToPlayback(audio?.currentTime || 0, id, true);
      }
    };
    requestAnimationFrame(appendChunk);
  });
}

function updatePlayButton(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const icon = getMusicEl("music-play-icon", id);
    if (!icon) return;
    const audio = musicState.audioByWinId[id];
    const playing = !!(audio && !audio.paused && audio.src);
    icon.innerHTML = playing
      ? '<rect x="5" y="4" width="4" height="12" rx="1"></rect><rect x="11" y="4" width="4" height="12" rx="1"></rect>'
      : '<path d="M6 4l11 6-11 6V4z"></path>';
  });
}

function setMusicToggleState(winId = "") {
  forEachMusicWindow(winId, (id) => {
    const shuffle = getMusicEl("music-btn-shuffle", id);
    const repeat = getMusicEl("music-btn-repeat", id);
    if (shuffle) shuffle.classList.toggle("on", !!musicState.shuffle);
    if (repeat) repeat.classList.toggle("on", !!musicState.repeat);
  });
}

function setProgressUI(currentSeconds, durationSeconds, winId = "") {
  const cur = Number(currentSeconds || 0);
  const dur = Number(durationSeconds || 0);
  const pct = dur > 0 ? clampNum(cur / dur, 0, 1) : 0;

  forEachMusicWindow(winId, (id) => {
    const fill = getMusicEl("music-progress-fill", id);
    const thumb = getMusicEl("music-progress-thumb", id);
    const curLabel = getMusicEl("music-time-current", id);
    const durLabel = getMusicEl("music-time-total", id);

    if (fill) fill.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
    if (curLabel) curLabel.textContent = formatMusicTime(Math.floor(cur));
    if (durLabel) durLabel.textContent = formatMusicTime(Math.floor(dur));
  });
}

function setVolumeUI(value, winId = "") {
  const v = clampNum(value, 0, 1);
  forEachMusicWindow(winId, (id) => {
    const fill = getMusicEl("music-volume-fill", id);
    const thumb = getMusicEl("music-volume-thumb", id);
    if (fill) fill.style.width = `${v * 100}%`;
    if (thumb) thumb.style.left = `${v * 100}%`;
  });
}

function bindMusicBarDrag(id, onChange, winId = "") {
  const bar = getMusicEl(id, winId);
  if (!bar) return null;
  let dragging = false;

  const getValue = (ev) => {
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return 0;
    return clampNum((ev.clientX - rect.left) / rect.width, 0, 1);
  };

  const onMove = (ev) => {
    if (!dragging) return;
    onChange(getValue(ev), true);
  };

  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    onChange(getValue(ev), false);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", onWindowBlur);
  };

  const onWindowBlur = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", onWindowBlur);
  };

  const onPointerDown = (ev) => {
    dragging = true;
    onChange(getValue(ev), true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onWindowBlur);
  };

  bar.addEventListener("pointerdown", onPointerDown);
  return () => {
    dragging = false;
    bar.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", onWindowBlur);
  };
}

function saveMusicLibrary() {
  localStorage.setItem(MUSIC_RECENT_KEY, JSON.stringify((musicState.recent || []).map(normalizeSavedTrack)));
  localStorage.setItem(MUSIC_PLAYLISTS_KEY, JSON.stringify(normalizePlaylists(musicState.playlists)));
}

function normalizePlaylists(playlists) {
  if (!Array.isArray(playlists)) return [];
  return playlists
    .map((pl) => ({
      id: String(pl.id || `pl-${Date.now()}-${Math.floor(Math.random() * 1e4)}`),
      name: String(pl.name || "playlist").trim() || "playlist",
      tracks: Array.isArray(pl.tracks) ? pl.tracks.map(normalizeSavedTrack) : [],
    }))
    .filter((pl) => pl.name.length > 0);
}

function normalizeSavedTrack(track) {
  const t = track || {};
  return {
    id: String(t.id || `${t.artist || "artist"}|${t.name || "untitled"}`),
    name: String(t.name || "untitled"),
    artist: String(t.artist || ""),
    album: String(t.album || ""),
    durationMs: Number(t.durationMs || t.duration_ms || 0) || 0,
    image: String(t.image || ""),
    previewUrl: String(t.previewUrl || ""),
    audioUrl: String(t.audioUrl || ""),
    videoId: String(t.videoId || ""),
    source: String(t.source || "local"),
  };
}

function loadMusicJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatMusicTime(seconds) {
  const s = Number(seconds || 0);
  const m = Math.floor(s / 60);
  const r = Math.max(0, Math.floor(s % 60));
  return `${m}:${String(r).padStart(2, "0")}`;
}

function escapeMusicHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clampNum(v, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

window.musicReceiveFile = function musicReceiveFile(fileData) {
  launchMusic();
  setTimeout(() => {
    const focusedWinId = getFocusedMusicWindowId();
    const dropUrl = fileData?.url || (typeof fileData?.content === "string" && fileData.content.startsWith("data:audio/") ? fileData.content : "");
    if (!dropUrl) {
      setMusicStatus("dropped file is not playable here", "warn", focusedWinId, 2600);
      return;
    }
    const track = normalizeSavedTrack({
      id: `drop-${Date.now()}`,
      name: fileData.name || "dropped file",
      artist: "local drop",
      previewUrl: dropUrl,
      source: "drop",
    });
    enqueueTrackAndPlay(track, focusedWinId);
  }, 90);
};

{
  const priorCanClose = typeof window.appCanClose === "function" ? window.appCanClose : null;
  window.appCanClose = function appCanClose(id) {
    const winId = String(id || "");
    if (winId.startsWith("music")) {
      stopMusicPlayback(winId);
      disposeMusicSession(winId);
      return true;
    }
    if (priorCanClose) return priorCanClose(id);
    return true;
  };
}
