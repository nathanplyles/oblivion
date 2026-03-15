window.onerror = function(msg,src,line,col,err){
  const b=document.getElementById('boot');
  if(b){const log=document.getElementById('boot-log');const e=document.createElement('div');e.className='err';e.textContent='[ FATAL ] '+msg+' (line '+line+')';if(log)log.appendChild(e);}
  console.error('OS ERROR:',msg,src,line,col,err);return false;
};

const OS = {
  accent: localStorage.getItem('os-accent')||'#c8f0a0',
  accentRgb: localStorage.getItem('os-accent-rgb')||'200,240,160',
  username: localStorage.getItem('os-username')||'void',
  avatar: localStorage.getItem('os-avatar')||'',
  installedApps: (()=>{try{return JSON.parse(localStorage.getItem('os-installed')||'[]');}catch(e){return [];}})(),
  appVersions: (()=>{try{return JSON.parse(localStorage.getItem('os-app-versions')||'{}');}catch(e){return {};}})(),
  taskbarHidden: (()=>{try{return JSON.parse(localStorage.getItem('os-taskbar-hidden')||'[]');}catch(e){return [];}})(),
  focusMode: localStorage.getItem('os-focus-mode')==='true',
  timeTintEnabled: localStorage.getItem('os-time-tint')==='true',
  bgIntensity: Math.min(1.2, Math.max(.2, parseFloat(localStorage.getItem('os-bg-intensity')||'1'))),
  bgVignette: Math.min(1.6, Math.max(0, parseFloat(localStorage.getItem('os-bg-vignette')||'1.15'))),
  bgSettings: (()=>{try{return JSON.parse(localStorage.getItem('os-bg-settings')||'{}');}catch(e){return {};}})(),
  desktopSettings: (()=>{try{return JSON.parse(localStorage.getItem('os-desktop-settings')||'{}');}catch(e){return {};}})(),
  notifHistory: (()=>{try{return JSON.parse(localStorage.getItem('os-notif-history')||'[]');}catch(e){return [];}})(),
  recentApps: (()=>{try{return JSON.parse(localStorage.getItem('os-recent-apps')||'[]');}catch(e){return [];}})(),
  workspaceCount: Math.max(1, Math.min(6, parseInt(localStorage.getItem('os-workspace-count')||'3',10) || 3)),
  currentWorkspace: Math.max(1, Math.min(6, parseInt(localStorage.getItem('os-workspace-current')||'1',10) || 1)),
  tintId: localStorage.getItem('os-tint-id')||'',
  soundscapeEnabled: localStorage.getItem('os-soundscape-enabled')==='true',
  soundscapeProfile: localStorage.getItem('os-soundscape-profile')||'void',
  soundscapeVolume: Math.min(1, Math.max(0, parseFloat(localStorage.getItem('os-soundscape-volume')||'.32'))),
  cursorPerformanceMode: localStorage.getItem('os-cursor-perf')==='true',
  narrativeEnabled: false,
  wins:{},
  zBase:100,
  focused:null,
  termHistory:[],
  termHistIdx:-1,
  files:(()=>{try{return JSON.parse(localStorage.getItem('os-files'))||null;}catch(e){return null;}})() || {
    home:[
      {name:'desktop',type:'dir',color:'#f4c674'},
      {name:'apps',type:'dir',color:'#8faef8'},
      {name:'documents',type:'dir',color:'#c8f0a0'},
      {name:'downloads',type:'dir',color:'#7dd3fc'},
      {name:'pictures',type:'dir',color:'#c4b5fd'},
      {name:'config.json',type:'file',ext:'json'},
      {name:'notes.txt',type:'file',ext:'txt'},
      {name:'readme.md',type:'file',ext:'md'},
    ],
    desktop:[
      {name:'browser.exe',type:'app',appId:'browser'},
      {name:'music.exe',type:'app',appId:'music'},
      {name:'files.exe',type:'app',appId:'files'},
    ],
    apps:[],
    documents:[],
    downloads:[],
    pictures:[],
  },
  filesCwd:'home',
  filesShowEmpty: true,
  recycleBin: (()=>{try{return JSON.parse(localStorage.getItem('os-recycle-bin')||'[]');}catch(e){return [];}})(),
  browserProxyBase: localStorage.getItem('os-proxy-url')||'',
};

// Desktop state must be initialized before any early boot saveOS() call can trigger renderDesktopIcons().
let desktopSelectedIdx = -1;
let desktopDragState = null;
let desktopDragSuppressClickUntil = 0;

// When multiple windows of the same app exist, app UIs may reuse the same element IDs.
// Scope global document queries to the focused window first so each instance can bind/load correctly.
(() => {
  if (Document.prototype.__oblivionScopedDomPatched) return;
  const nativeGetById = Document.prototype.getElementById;
  const nativeQuery = Document.prototype.querySelector;
  const nativeQueryAll = Document.prototype.querySelectorAll;

  function getFocusedWindowEl() {
    const focusedId = String((window.OS && window.OS.focused) || OS?.focused || '');
    if (!focusedId) return null;
    const win = (window.OS && window.OS.wins && window.OS.wins[focusedId]) || (OS?.wins && OS.wins[focusedId]);
    if (!win || !win.el || !win.el.isConnected) return null;
    return win.el;
  }

  function escapeCssId(id) {
    const raw = String(id || '');
    if (!raw) return raw;
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(raw);
    return raw.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  Document.prototype.getElementById = function patchedGetElementById(id) {
    if (this === document) {
      const root = getFocusedWindowEl();
      if (root && id != null) {
        try {
          const scoped = root.querySelector(`#${escapeCssId(id)}`);
          if (scoped) return scoped;
        } catch {}
      }
    }
    return nativeGetById.call(this, id);
  };

  Document.prototype.querySelector = function patchedQuerySelector(selector) {
    if (this === document && selector) {
      const root = getFocusedWindowEl();
      if (root) {
        try {
          const scoped = root.querySelector(selector);
          if (scoped) return scoped;
        } catch {}
      }
    }
    return nativeQuery.call(this, selector);
  };

  Document.prototype.querySelectorAll = function patchedQuerySelectorAll(selector) {
    if (this === document && selector) {
      const root = getFocusedWindowEl();
      if (root) {
        try {
          const scoped = root.querySelectorAll(selector);
          if (scoped && scoped.length) return scoped;
        } catch {}
      }
    }
    return nativeQueryAll.call(this, selector);
  };

  Document.prototype.__oblivionScopedDomPatched = true;
})();

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

let shellPromptState = null;
function closeShellPrompt(value = null){
  if(!shellPromptState) return;
  const { host, resolver, onKeyDown } = shellPromptState;
  shellPromptState = null;
  document.removeEventListener('keydown', onKeyDown, true);
  host.classList.remove('show');
  setTimeout(()=>host.remove(), 120);
  resolver(value);
}

function showShellPrompt({
  title = 'new folder',
  label = 'name',
  placeholder = '',
  value = '',
  confirmLabel = 'create',
} = {}){
  if(shellPromptState) closeShellPrompt(null);
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'os-prompt-backdrop';
    host.innerHTML = `
      <div class="os-prompt" role="dialog" aria-modal="true">
        <div class="os-prompt-title">${escapeHtml(title)}</div>
        <label class="os-prompt-label">${escapeHtml(label)}</label>
        <input class="os-prompt-input" autocomplete="off" spellcheck="false" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">
        <div class="os-prompt-actions">
          <button type="button" class="btn btn-dim os-prompt-cancel">cancel</button>
          <button type="button" class="btn os-prompt-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(host);
    const inp = host.querySelector('.os-prompt-input');
    const confirmBtn = host.querySelector('.os-prompt-confirm');
    const cancelBtn = host.querySelector('.os-prompt-cancel');
    const submit = () => closeShellPrompt(String(inp?.value || ''));
    const cancel = () => closeShellPrompt(null);
    const onKeyDown = (e) => {
      if(!shellPromptState || shellPromptState.host !== host) return;
      if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
      if(e.key === 'Enter'){ e.preventDefault(); submit(); }
    };
    shellPromptState = { host, resolver: resolve, onKeyDown };
    document.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('mousedown', (e) => {
      if(e.target === host) cancel();
    });
    confirmBtn?.addEventListener('click', submit);
    cancelBtn?.addEventListener('click', cancel);
    requestAnimationFrame(() => {
      host.classList.add('show');
      inp?.focus();
      inp?.select();
    });
  });
}
window.showShellPrompt = showShellPrompt;

function normalizeSafeHttpUrl(raw){
  const value = String(raw || '').trim();
  if(!value) return '';
  try{
    const u = new URL(value);
    if(u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  }catch{
    return '';
  }
}

const APP_SHORTCUT_EXT = '.exe';
const DEFAULT_TAB_TITLE = 'oblivionOS';
const DEFAULT_TAB_FAVICON = '/favicon-blackhole.svg';

function stripAppShortcutExt(rawName){
  return String(rawName || '').replace(/\.exe$/i, '');
}

function toAppShortcutName(rawName, fallbackId='app'){
  const base = stripAppShortcutExt(String(rawName || fallbackId || 'app').trim()).trim();
  const safeBase = base || String(fallbackId || 'app').trim() || 'app';
  return `${safeBase}${APP_SHORTCUT_EXT}`;
}

function resolveShortcutAppId(entry){
  if(!entry || typeof entry !== 'object') return '';
  const fromId = String(entry.appId || '').trim().toLowerCase();
  if(fromId) return fromId;
  return stripAppShortcutExt(entry.name || '').trim().toLowerCase();
}

function getEntryDisplayName(entry){
  if(!entry || typeof entry !== 'object') return '';
  if(entry.type === 'app'){
    const base = stripAppShortcutExt(entry.name || '');
    if(base) return base;
    return String(entry.appId || '').trim();
  }
  return String(entry.name || '');
}

function normalizeTabCloakFavicon(raw){
  const value = String(raw || '').trim();
  if(!value) return '';
  if(value.startsWith('/')) return value;
  return normalizeSafeHttpUrl(value);
}

function getFaviconMimeType(raw){
  const value = String(raw || '').trim().toLowerCase().split('#')[0].split('?')[0];
  if(value.endsWith('.ico')) return 'image/x-icon';
  if(value.endsWith('.png')) return 'image/png';
  if(value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/svg+xml';
}

function ensureFaviconTag(){
  let link = document.querySelector('head link[rel="icon"]');
  if(!link){
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if(!link.type) link.type = getFaviconMimeType(DEFAULT_TAB_FAVICON);
  return link;
}

function applyStoredTabCloak(){
  const title = String(localStorage.getItem('os-cloak-title') || '').trim();
  const favicon = normalizeTabCloakFavicon(localStorage.getItem('os-cloak-favicon') || '');
  const nextFavicon = favicon || DEFAULT_TAB_FAVICON;
  document.title = title || DEFAULT_TAB_TITLE;
  const iconLink = ensureFaviconTag();
  iconLink.type = getFaviconMimeType(nextFavicon);
  iconLink.href = nextFavicon;
}

window.setTabCloakConfig = function setTabCloakConfig(config = {}){
  const title = String(config.title || '').trim();
  const favicon = normalizeTabCloakFavicon(config.favicon || '');
  if(title) localStorage.setItem('os-cloak-title', title);
  else localStorage.removeItem('os-cloak-title');
  if(favicon) localStorage.setItem('os-cloak-favicon', favicon);
  else localStorage.removeItem('os-cloak-favicon');
  applyStoredTabCloak();
};

window.getTabCloakConfig = function getTabCloakConfig(){
  return {
    title: String(localStorage.getItem('os-cloak-title') || '').trim(),
    favicon: normalizeTabCloakFavicon(localStorage.getItem('os-cloak-favicon') || ''),
    defaultTitle: DEFAULT_TAB_TITLE,
    defaultFavicon: DEFAULT_TAB_FAVICON,
  };
};

window.resolveShortcutAppId = resolveShortcutAppId;
window.getEntryDisplayName = getEntryDisplayName;

applyStoredTabCloak();

function saveOS(){
  syncAppShortcutDedup();
  localStorage.setItem('os-username',OS.username);
  localStorage.setItem('os-avatar',OS.avatar);
  localStorage.setItem('os-installed',JSON.stringify(OS.installedApps));
  localStorage.setItem('os-app-versions',JSON.stringify(OS.appVersions||{}));
  localStorage.setItem('os-files',JSON.stringify(OS.files));
  localStorage.setItem('os-recycle-bin',JSON.stringify(OS.recycleBin));
  localStorage.setItem('os-accent',OS.accent);
  localStorage.setItem('os-accent-rgb',OS.accentRgb);
  localStorage.setItem('os-files-show-empty','true');
  localStorage.setItem('os-taskbar-hidden',JSON.stringify(OS.taskbarHidden));
  localStorage.setItem('os-focus-mode',OS.focusMode);
  localStorage.setItem('os-time-tint',OS.timeTintEnabled);
  localStorage.setItem('os-bg-intensity',OS.bgIntensity);
  localStorage.setItem('os-bg-settings',JSON.stringify(OS.bgSettings||{}));
  localStorage.setItem('os-desktop-settings',JSON.stringify(OS.desktopSettings||{}));
  localStorage.setItem('os-bg-vignette',OS.bgVignette);
  localStorage.removeItem('os-bg-noise');
  localStorage.setItem('os-notif-history',JSON.stringify(OS.notifHistory.slice(0,120)));
  localStorage.setItem('os-recent-apps',JSON.stringify(OS.recentApps.slice(0,30)));
  localStorage.setItem('os-proxy-url',OS.browserProxyBase||'');
  localStorage.setItem('os-workspace-count',String(OS.workspaceCount||3));
  localStorage.setItem('os-workspace-current',String(OS.currentWorkspace||1));
  localStorage.setItem('os-tint-id',OS.tintId||'void-green');
  localStorage.removeItem('os-theme-id');
  localStorage.removeItem('os-theme-custom');
  localStorage.setItem('os-soundscape-enabled',String(!!OS.soundscapeEnabled));
  localStorage.setItem('os-soundscape-profile',OS.soundscapeProfile||'void');
  localStorage.setItem('os-soundscape-volume',String(OS.soundscapeVolume ?? .32));
  localStorage.setItem('os-cursor-perf',String(!!OS.cursorPerformanceMode));
  localStorage.setItem('os-narrative-enabled',String(!!OS.narrativeEnabled));
  if(typeof window.renderDesktopIcons === 'function') window.renderDesktopIcons();
}

const OS_SCHEMA_VERSION = 6;
const TINT_PRESETS = {
  'void-green': {
    name: 'void green',
    accent: '#c8f0a0',
    accentRgb: '200,240,160',
    vars: {
      '--bg':'#010103','--surface':'rgba(6,10,8,0.94)','--surface2':'rgba(10,16,12,0.97)',
      '--border':'rgba(200,240,160,0.17)','--border2':'rgba(200,240,160,0.09)',
      '--text':'#d8e4d3','--text2':'#8c9b86','--text3':'#55604f','--taskbar-bg':'rgba(4,8,6,.94)'
    }
  },
  'sky-blue': {
    name: 'sky blue',
    accent: '#7dd3fc',
    accentRgb: '125,211,252',
    vars: {
      '--bg':'#02050a','--surface':'rgba(8,12,18,0.93)','--surface2':'rgba(10,16,24,0.97)',
      '--border':'rgba(125,211,252,0.2)','--border2':'rgba(125,211,252,0.1)',
      '--text':'#d7f4ff','--text2':'#7cb4c4','--text3':'#4f6d79','--taskbar-bg':'rgba(6,10,16,.93)'
    }
  },
  'lavender': {
    name: 'lavender',
    accent: '#c4b5fd',
    accentRgb: '196,181,253',
    vars: {
      '--bg':'#05040a','--surface':'rgba(13,11,21,0.93)','--surface2':'rgba(18,15,29,0.97)',
      '--border':'rgba(196,181,253,0.2)','--border2':'rgba(196,181,253,0.1)',
      '--text':'#e8e1ff','--text2':'#aa9ed6','--text3':'#6f658f','--taskbar-bg':'rgba(10,8,18,.93)'
    }
  },
  'amber': {
    name: 'amber',
    accent: '#fcd34d',
    accentRgb: '252,211,77',
    vars: {
      '--bg':'#090602','--surface':'rgba(18,13,8,0.93)','--surface2':'rgba(24,18,11,0.97)',
      '--border':'rgba(252,211,77,0.2)','--border2':'rgba(252,211,77,0.1)',
      '--text':'#f4e7c0','--text2':'#c6ad67','--text3':'#7f6c3f','--taskbar-bg':'rgba(15,11,7,.93)'
    }
  },
  'rose': {
    name: 'rose',
    accent: '#f9a8d4',
    accentRgb: '249,168,212',
    vars: {
      '--bg':'#080406','--surface':'rgba(19,10,15,0.93)','--surface2':'rgba(25,13,20,0.97)',
      '--border':'rgba(249,168,212,0.2)','--border2':'rgba(249,168,212,0.1)',
      '--text':'#f6dce9','--text2':'#c39ab0','--text3':'#7e5f70','--taskbar-bg':'rgba(14,8,12,.93)'
    }
  },
  'mint': {
    name: 'mint',
    accent: '#86efac',
    accentRgb: '134,239,172',
    vars: {
      '--bg':'#030805','--surface':'rgba(9,18,13,0.93)','--surface2':'rgba(12,24,17,0.97)',
      '--border':'rgba(134,239,172,0.2)','--border2':'rgba(134,239,172,0.1)',
      '--text':'#d6f2df','--text2':'#8ab59a','--text3':'#5a7564','--taskbar-bg':'rgba(7,14,10,.93)'
    }
  },
  'peach': {
    name: 'peach',
    accent: '#fdba74',
    accentRgb: '253,186,116',
    vars: {
      '--bg':'#0b0504','--surface':'rgba(18,10,8,0.93)','--surface2':'rgba(24,14,10,0.97)',
      '--border':'rgba(253,186,116,0.2)','--border2':'rgba(253,186,116,0.1)',
      '--text':'#f1ddd3','--text2':'#b08f82','--text3':'#755d56','--taskbar-bg':'rgba(16,10,8,.93)'
    }
  },
  'silver': {
    name: 'silver',
    accent: '#e5e7eb',
    accentRgb: '229,231,235',
    vars: {
      '--bg':'#07090d','--surface':'rgba(10,12,18,0.93)','--surface2':'rgba(14,16,24,0.97)',
      '--border':'rgba(176,189,215,0.18)','--border2':'rgba(176,189,215,0.09)',
      '--text':'#dde4f2','--text2':'#8f9bb4','--text3':'#5d677d','--taskbar-bg':'rgba(8,10,16,.93)'
    }
  }
};
const LEGACY_THEME_TO_TINT = {
  'void-nocturne': 'void-green',
  'ashen-dusk': 'silver',
  'neon-rain': 'sky-blue',
  'ember-static': 'amber',
};
const BG_SETTINGS_DEFAULTS = {
  rain: { density: 1.0, speed: 1.0, wind: 0.7 },
  particles: { density: 1.55, drift: 0.55, linkDist: 120 },
  aurora: { bands: 5, speed: 1.0, intensity: 1.0 },
  dots: { spacing: 38, repelRadius: 110, drift: 0.55, bulge: 32, linkDist: 44 },
  lines: { density: 1.15, flow: 1.0, wander: 0.7 },
  void: { density: 1.25, pulse: 1.0, darkness: 1.2, glow: 0.85 },
};
const BG_SETTINGS_LIMITS = {
  rain: { density: [0.5, 2.4], speed: [0.4, 2.5], wind: [0, 1.6] },
  particles: { density: [0.6, 2.8], drift: [0.1, 1.4], linkDist: [70, 180] },
  aurora: { bands: [2, 8], speed: [0.4, 2], intensity: [0.35, 1.8] },
  dots: { spacing: [24, 72], repelRadius: [70, 230], drift: [0, 1.4], bulge: [0, 90], linkDist: [20, 120] },
  lines: { density: [0.5, 2.4], flow: [0.2, 2.1], wander: [0, 1.2] },
  void: { density: [0.5, 2.3], pulse: [0.3, 2.3], darkness: [0.45, 1.5], glow: [0, 1.6] },
};
const BG_SETTINGS_REINIT_KEYS = {
  rain: new Set(['density']),
  particles: new Set(['density']),
  aurora: new Set([]),
  dots: new Set(['spacing']),
  lines: new Set(['density']),
  void: new Set(['density']),
};
const DESKTOP_SETTINGS_DEFAULTS = {
  showIcons: true,
  showLabels: true,
  iconSize: 54,
  gridGap: 12,
};
const DEFAULT_HOME_DIRS = [
  { name: 'desktop', color: '#f4c674' },
  { name: 'apps', color: '#8faef8' },
  { name: 'documents', color: '#c8f0a0' },
  { name: 'downloads', color: '#7dd3fc' },
  { name: 'pictures', color: '#c4b5fd' },
];
const DEFAULT_DESKTOP_SHORTCUTS = [
  { name: 'browser.exe', type: 'app', appId: 'browser' },
  { name: 'music.exe', type: 'app', appId: 'music' },
  { name: 'files.exe', type: 'app', appId: 'files' },
];

function getDefaultAppsDirectoryShortcuts(){
  const apps = (typeof CORE_APPS !== 'undefined' && Array.isArray(CORE_APPS)) ? CORE_APPS : [];
  return apps
    .slice()
    .sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
    .map((app) => ({ name: toAppShortcutName(app.id, app.id), type: 'app', appId: app.id }));
}

function normalizeAppShortcutEntries(items){
  if(!Array.isArray(items)) return [];
  return items.map((item) => {
    if(!item || typeof item !== 'object') return item;
    if(item.type !== 'app') return item;
    const appId = resolveShortcutAppId(item);
    if(!appId) return item;
    const existingName = String(item.name || '').trim();
    const nextName = existingName
      ? (/\.[a-z0-9]+$/i.test(existingName) ? existingName : toAppShortcutName(existingName, appId))
      : toAppShortcutName(appId, appId);
    return { ...item, appId, name: nextName };
  });
}

function ensureAppsDirectoryShortcuts(seedShortcuts = false){
  if(!Array.isArray(OS.files.apps)) OS.files.apps = [];
  OS.files.apps = normalizeAppShortcutEntries(OS.files.apps);
  const existingIds = new Set(OS.files.apps.filter((item) => item && item.type === 'app').map((item) => resolveShortcutAppId(item)).filter(Boolean));
  const defaults = getDefaultAppsDirectoryShortcuts();
  const shouldSeed = seedShortcuts || OS.files.apps.length === 0;
  defaults.forEach((item) => {
    if(shouldSeed || !existingIds.has(item.appId)){
      if(!existingIds.has(item.appId)){
        OS.files.apps.push({ ...item });
        existingIds.add(item.appId);
      }
    }
  });
}

function clampBgSetting(mode, key, raw){
  const [min, max] = BG_SETTINGS_LIMITS?.[mode]?.[key] || [0, 1];
  const n = Number(raw);
  if(!Number.isFinite(n)) return BG_SETTINGS_DEFAULTS?.[mode]?.[key];
  return Math.min(max, Math.max(min, n));
}

function normalizeBgSettings(raw){
  const out = {};
  const source = (raw && typeof raw === 'object') ? raw : {};
  Object.entries(BG_SETTINGS_DEFAULTS).forEach(([mode, defaults]) => {
    const modeSrc = (source[mode] && typeof source[mode] === 'object') ? source[mode] : {};
    out[mode] = {};
    Object.keys(defaults).forEach((key) => {
      out[mode][key] = clampBgSetting(mode, key, modeSrc[key] ?? defaults[key]);
    });
  });
  return out;
}

function normalizeDesktopSettings(raw){
  const src = (raw && typeof raw === 'object') ? raw : {};
  const iconSize = Math.max(42, Math.min(88, Number(src.iconSize) || DESKTOP_SETTINGS_DEFAULTS.iconSize));
  const gridGap = Math.max(6, Math.min(26, Number(src.gridGap) || DESKTOP_SETTINGS_DEFAULTS.gridGap));
  return {
    showIcons: src.showIcons !== false,
    showLabels: src.showLabels !== false,
    iconSize: Math.round(iconSize),
    gridGap: Math.round(gridGap),
  };
}

function ensureHomeFolderEntry(name, color){
  if(!Array.isArray(OS.files.home)) OS.files.home = [];
  const has = OS.files.home.some((item) => item && item.type === 'dir' && String(item.name || '').toLowerCase() === name.toLowerCase());
  if(has) return;
  OS.files.home.unshift({ name, type: 'dir', color });
}

function ensureDesktopFileSystem(seedShortcuts = false){
  if(!OS.files || typeof OS.files !== 'object') OS.files = {};
  if(!Array.isArray(OS.files.home)) OS.files.home = [];
  if(!Array.isArray(OS.files.documents)) OS.files.documents = [];
  if(!Array.isArray(OS.files.downloads)) OS.files.downloads = [];
  if(!Array.isArray(OS.files.pictures)) OS.files.pictures = [];
  if(!Array.isArray(OS.files.desktop)) OS.files.desktop = [];
  if(!Array.isArray(OS.files.apps)) OS.files.apps = [];
  DEFAULT_HOME_DIRS.forEach((dir) => ensureHomeFolderEntry(dir.name, dir.color));
  if(seedShortcuts && OS.files.desktop.length === 0){
    OS.files.desktop = DEFAULT_DESKTOP_SHORTCUTS.map((item) => ({ ...item }));
  }
  OS.files.desktop = normalizeAppShortcutEntries(OS.files.desktop);
  ensureAppsDirectoryShortcuts(seedShortcuts);
  syncAppShortcutDedup();
}

function getBgSettings(mode){
  if(!OS.bgSettings || typeof OS.bgSettings !== 'object') OS.bgSettings = {};
  OS.bgSettings = normalizeBgSettings(OS.bgSettings);
  if(!mode) return JSON.parse(JSON.stringify(OS.bgSettings));
  return { ...(OS.bgSettings[mode] || BG_SETTINGS_DEFAULTS[mode] || {}) };
}

function resolveTintIdFromState(){
  if(TINT_PRESETS[OS.tintId]) return OS.tintId;
  const accent = String(OS.accent || '').toLowerCase();
  const found = Object.entries(TINT_PRESETS).find(([,p]) => p.accent.toLowerCase() === accent);
  if(found) return found[0];
  const legacyTheme = localStorage.getItem('os-theme-id') || '';
  if(LEGACY_THEME_TO_TINT[legacyTheme]) return LEGACY_THEME_TO_TINT[legacyTheme];
  return 'void-green';
}

function runSchemaMigrations(){
  let ver = parseInt(localStorage.getItem('os-schema-version')||'0',10) || 0;
  const repaired = [];
  const validateJsonKey = (key, fallback) => {
    const raw = localStorage.getItem(key);
    if(raw==null) return;
    try{ JSON.parse(raw); }catch(err){
      localStorage.setItem(`os-corrupt-${key}-${Date.now()}`, raw);
      localStorage.setItem(key, JSON.stringify(fallback));
      repaired.push(key);
    }
  };
  validateJsonKey('os-installed', []);
  validateJsonKey('os-taskbar-hidden', []);
  validateJsonKey('os-files', {});
  validateJsonKey('os-recycle-bin', []);
  validateJsonKey('os-app-versions', {});
  validateJsonKey('os-bg-settings', {});
  validateJsonKey('os-notif-history', []);
  validateJsonKey('os-recent-apps', []);
  validateJsonKey('os-desktop-settings', {});

  const hadDesktopFolder = !!(OS.files && Array.isArray(OS.files.desktop));

  if(ver < 1){
    if(typeof OS.installedApps === 'string'){
      OS.installedApps = OS.installedApps.split(',').map(s=>s.trim()).filter(Boolean);
      repaired.push('os-installed');
    }
    ver = 1;
  }
  if(ver < 2){
    if(!OS.appVersions || typeof OS.appVersions !== 'object') OS.appVersions = {};
    OS.installedApps.forEach(id=>{
      if(!OS.appVersions[id]) OS.appVersions[id] = '1.0.0';
    });
    ver = 2;
  }
  if(ver < 3){
    if(!localStorage.getItem('os-tint-id')){
      const legacyTheme = localStorage.getItem('os-theme-id') || '';
      const migratedTint = LEGACY_THEME_TO_TINT[legacyTheme] || resolveTintIdFromState();
      OS.tintId = migratedTint;
      repaired.push('os-tint-id');
    }
    localStorage.removeItem('os-theme-id');
    localStorage.removeItem('os-theme-custom');
    ver = 3;
  }
  if(ver < 4){
    OS.filesShowEmpty = true;
    OS.bgSettings = normalizeBgSettings(OS.bgSettings);
    localStorage.removeItem('os-bg-noise');
    repaired.push('os-bg-settings');
    ver = 4;
  }
  if(ver < 5){
    OS.desktopSettings = normalizeDesktopSettings(OS.desktopSettings);
    ensureDesktopFileSystem(!hadDesktopFolder);
    repaired.push('os-desktop-settings');
    ver = 5;
  }
  if(ver < 6){
    ensureDesktopFileSystem(!hadDesktopFolder);
    repaired.push('os-files');
    ver = 6;
  }

  if(!OS.files || typeof OS.files!=='object'){
    OS.files = { home:[], desktop:[], apps:[], documents:[], downloads:[], pictures:[] };
    repaired.push('os-files');
  }
  ['home','desktop','apps','documents','downloads','pictures'].forEach(k=>{
    if(!Array.isArray(OS.files[k])) OS.files[k] = [];
  });
  ensureDesktopFileSystem(!hadDesktopFolder);
  if(!Array.isArray(OS.recycleBin)) { OS.recycleBin = []; repaired.push('os-recycle-bin'); }
  if(!Array.isArray(OS.installedApps)) { OS.installedApps = []; repaired.push('os-installed'); }
  if(!Array.isArray(OS.taskbarHidden)) { OS.taskbarHidden = []; repaired.push('os-taskbar-hidden'); }
  if(!OS.appVersions || typeof OS.appVersions!=='object') { OS.appVersions = {}; repaired.push('os-app-versions'); }
  OS.filesShowEmpty = true;
  OS.bgSettings = normalizeBgSettings(OS.bgSettings);
  OS.desktopSettings = normalizeDesktopSettings(OS.desktopSettings);
  OS.tintId = resolveTintIdFromState();
  const activeTint = TINT_PRESETS[OS.tintId] || TINT_PRESETS['void-green'];
  OS.accent = activeTint.accent;
  OS.accentRgb = activeTint.accentRgb;
  OS.soundscapeVolume = Math.min(1, Math.max(0, Number(OS.soundscapeVolume)||.32));

  localStorage.setItem('os-schema-version', String(OS_SCHEMA_VERSION));
  if(repaired.length) saveOS();
  return repaired;
}

function applyTintTheme(){
  OS.tintId = resolveTintIdFromState();
  const base = TINT_PRESETS[OS.tintId] || TINT_PRESETS['void-green'];
  OS.accent = base.accent;
  OS.accentRgb = base.accentRgb;
  const vars = { '--accent': OS.accent, '--accent-rgb': OS.accentRgb, ...(base.vars||{}) };
  Object.entries(vars).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));
}

window.getColorTints = () => Object.entries(TINT_PRESETS).map(([id, val]) => ({ id, name: val.name, hex: val.accent, rgb: val.accentRgb, vars: { ...val.vars } }));
window.getThemePacks = window.getColorTints;
window.applyTintTheme = applyTintTheme;
window.applyTheme = applyTintTheme;
window.setColorTint = function(id){
  if(!TINT_PRESETS[id]) return false;
  OS.tintId = id;
  applyTintTheme();
  saveOS();
  return true;
};
window.setThemePack = function(id){ return window.setColorTint(LEGACY_THEME_TO_TINT[id] || id); };
window.setThemeCustomVar = function(k,v){
  return false;
};
window.getBgSettings = getBgSettings;
window.setBgSetting = function(mode, key, value){
  if(!BG_SETTINGS_DEFAULTS[mode] || !Object.prototype.hasOwnProperty.call(BG_SETTINGS_DEFAULTS[mode], key)) return false;
  OS.bgSettings = getBgSettings();
  OS.bgSettings[mode][key] = clampBgSetting(mode, key, value);
  if(mode === bgMode && BG_SETTINGS_REINIT_KEYS?.[mode]?.has(key) && typeof initBg === 'function'){
    initBg();
  }
  return true;
};

const SOUND_PROFILES = {
  void: { tone1:38, tone2:57, noise:0.045, wobble:0.008 },
  rain: { tone1:72, tone2:104, noise:0.12, wobble:0.015 },
  dusk: { tone1:50, tone2:76, noise:0.06, wobble:0.01 },
};
let audioCtx = null;
let audioNodes = null;
let narrativeTimer = null;
const NARRATIVE_LINES = [
  'the night hums back.',
  'empty streets, warm phosphor.',
  'signals drift through static rain.',
  'everything pauses for a breath.',
  'between windows, a small echo.',
];

function ensureAudioCtx(){
  if(audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function stopSoundscape(){
  if(audioNodes){
    [audioNodes.osc1,audioNodes.osc2,audioNodes.noise,audioNodes.lfo].forEach(n=>{ try{ n.stop(); }catch(e){} });
    audioNodes.master.disconnect();
    audioNodes = null;
  }
}

function startSoundscape(){
  const ctx = ensureAudioCtx();
  if(!ctx) return false;
  if(ctx.state === 'suspended') ctx.resume();
  stopSoundscape();
  const prof = SOUND_PROFILES[OS.soundscapeProfile] || SOUND_PROFILES.void;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(.36, OS.soundscapeVolume * .22));
  master.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type='sine'; osc1.frequency.value = prof.tone1; g1.gain.value = 0.18;
  osc1.connect(g1); g1.connect(master); osc1.start();

  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type='triangle'; osc2.frequency.value = prof.tone2; g2.gain.value = 0.08;
  osc2.connect(g2); g2.connect(master); osc2.start();

  const lfo = ctx.createOscillator();
  const lfoGain1 = ctx.createGain();
  const lfoGain2 = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12;
  lfoGain1.gain.value = prof.tone1 * (prof.wobble || 0.01);
  lfoGain2.gain.value = prof.tone2 * (prof.wobble || 0.01);
  lfo.connect(lfoGain1); lfo.connect(lfoGain2);
  lfoGain1.connect(osc1.frequency); lfoGain2.connect(osc2.frequency);
  lfo.start();

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer; noise.loop = true;
  const nFilter = ctx.createBiquadFilter();
  nFilter.type='lowpass'; nFilter.frequency.value = 1200;
  const nGain = ctx.createGain(); nGain.gain.value = prof.noise;
  noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(master); noise.start();

  audioNodes = { master, osc1, osc2, noise, lfo };
  return true;
}

function applySoundscapeState(){
  if(OS.soundscapeEnabled) startSoundscape();
  else stopSoundscape();
  if(audioNodes?.master) audioNodes.master.gain.value = Math.max(0, Math.min(.36, OS.soundscapeVolume * .22));
}

function scheduleNarrative(){
  if(narrativeTimer){ clearTimeout(narrativeTimer); narrativeTimer = null; }
  return;
}

window.applySoundscapeState = applySoundscapeState;
window.scheduleNarrative = scheduleNarrative;

// ═══════════════════════════════════
// BACKGROUND
// ═══════════════════════════════════
const bgc = document.getElementById('bgc');
const bgCtx = bgc.getContext('2d');
const timeTintEl = document.getElementById('time-tint');
const vignetteEl = document.getElementById('vignette');
const scanlinesEl = document.getElementById('scanlines');
const TIME_TINT_GEO_CACHE_KEY = 'os-time-tint-geo';
const timeTintGeo = { lat:null, lon:null, ready:false, attempted:false };
let bgW, bgH;
let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
let bgMode = localStorage.getItem('os-bg-mode')||'rain';

document.addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY;});

function bgResize(){
  bgW=bgc.width=window.innerWidth;
  bgH=bgc.height=window.innerHeight;
  initBg();
}
function initBg(){
  if(bgMode==='rain')      initRain(bgW,bgH,getBgSettings('rain'));
  if(bgMode==='particles') initParticles(bgW,bgH,getBgSettings('particles'));
  if(bgMode==='dots')      initDots(bgW,bgH,getBgSettings('dots'));
  if(bgMode==='lines')     initLines(bgW,bgH,getBgSettings('lines'));
  if(bgMode==='void')      initVoid(bgW,bgH,getBgSettings('void'));
}
function drawBg(){
  bgCtx.clearRect(0,0,bgW,bgH);
  bgCtx.save();
  bgCtx.globalAlpha = OS.bgIntensity;
  const rgb=OS.accentRgb;
  if(bgMode==='rain')           drawRain(bgCtx,bgW,bgH,rgb,getBgSettings('rain'));
  else if(bgMode==='particles') drawParticles(bgCtx,bgW,bgH,rgb,mouseX,mouseY,getBgSettings('particles'));
  else if(bgMode==='aurora')    drawAurora(bgCtx,bgW,bgH,rgb,getBgSettings('aurora'));
  else if(bgMode==='dots')      drawDots(bgCtx,bgW,bgH,rgb,mouseX,mouseY,getBgSettings('dots'));
  else if(bgMode==='lines')     drawLines(bgCtx,bgW,bgH,rgb,mouseX,mouseY,getBgSettings('lines'));
  else if(bgMode==='void')      drawVoid(bgCtx,bgW,bgH,rgb,getBgSettings('void'));
  bgCtx.restore();
  requestAnimationFrame(drawBg);
}
function setBgMode(mode){
  bgMode=mode;
  localStorage.setItem('os-bg-mode',mode);
  initBg();
  if(OS.soundscapeProfile==='rain' || OS.soundscapeProfile==='void' || OS.soundscapeProfile==='dusk'){
    if(mode==='rain') OS.soundscapeProfile='rain';
    else if(mode==='void') OS.soundscapeProfile='void';
    else if(mode==='aurora') OS.soundscapeProfile='dusk';
    saveOS();
    applySoundscapeState();
  }
}

function applyBackgroundTuning(){
  if(scanlinesEl) scanlinesEl.style.opacity = '0';
  if(vignetteEl){
    const vignette = Math.min(1.6, Math.max(0, Number(OS.bgVignette)||0));
    const inner = Math.max(30, 56 - vignette * 16);
    const outerAlpha = Math.min(0.92, 0.22 + vignette * 0.46);
    const midAlpha = Math.min(0.52, vignette * 0.2);
    vignetteEl.style.opacity = '1';
    vignetteEl.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) ${inner}%, rgba(0,0,0,${midAlpha.toFixed(3)}) ${Math.min(92, inner + 24)}%, rgba(0,0,0,${outerAlpha.toFixed(3)}) 100%)`;
  }
}

function applyFocusMode(){
  document.body.classList.toggle('focus-mode', !!OS.focusMode);
}

function requestTimeTintGeolocation(){
  if(timeTintGeo.attempted) return;
  timeTintGeo.attempted = true;
  try{
    const cached = JSON.parse(localStorage.getItem(TIME_TINT_GEO_CACHE_KEY) || 'null');
    if(cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lon)){
      timeTintGeo.lat = cached.lat;
      timeTintGeo.lon = cached.lon;
      timeTintGeo.ready = true;
    }
  }catch{}
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos)=>{
    timeTintGeo.lat = pos.coords.latitude;
    timeTintGeo.lon = pos.coords.longitude;
    timeTintGeo.ready = true;
    localStorage.setItem(TIME_TINT_GEO_CACHE_KEY, JSON.stringify({
      lat: Number(timeTintGeo.lat.toFixed(4)),
      lon: Number(timeTintGeo.lon.toFixed(4)),
      at: Date.now(),
    }));
    applyTimeTint();
  },()=>{}, { maximumAge: 86400000, timeout: 5000, enableHighAccuracy: false });
}

function getApproxSolarWindow(date){
  const lat = Number.isFinite(timeTintGeo.lat) ? timeTintGeo.lat : 0;
  const nowHour = date.getHours() + (date.getMinutes() / 60);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const decl = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const latRad = lat * Math.PI / 180;
  const declRad = decl * Math.PI / 180;
  const cosH = -Math.tan(latRad) * Math.tan(declRad);
  if(cosH >= 1) return { isDay: false, sunrise: 12, sunset: 12, hour: nowHour };
  if(cosH <= -1) return { isDay: true, sunrise: 0, sunset: 24, hour: nowHour };
  const h = Math.acos(Math.min(1, Math.max(-1, cosH)));
  const daylight = (2 * h * 180 / Math.PI) / 15;
  const sunrise = 12 - daylight / 2;
  const sunset = 12 + daylight / 2;
  return { isDay: nowHour >= sunrise && nowHour < sunset, sunrise, sunset, hour: nowHour };
}

function applyTimeTint(){
  if(!timeTintEl) return;
  if(!OS.timeTintEnabled){
    timeTintEl.style.opacity='0';
    return;
  }
  const now = new Date();
  const solar = getApproxSolarWindow(now);
  let centerRgb = '92,108,148';
  let centerOpacity = 0.15;
  let orbRgb = '255,208,122';
  let orbOpacity = 0.3;
  let orbX = 50;
  let orbY = 22;

  if(solar.isDay){
    const daySpan = Math.max(0.01, solar.sunset - solar.sunrise);
    const p = Math.min(1, Math.max(0, (solar.hour - solar.sunrise) / daySpan));
    const warm = Math.sin(p * Math.PI);
    centerRgb = (p < 0.25 || p > 0.75) ? '188,132,94' : '128,154,194';
    centerOpacity = 0.12 + warm * 0.05;
    orbRgb = (p < 0.25 || p > 0.75) ? '255,184,124' : '255,222,163';
    orbOpacity = 0.24 + warm * 0.1;
    orbX = 16 + p * 68;
    orbY = 30 - Math.sin(p * Math.PI) * 9;
  }else{
    const nightStart = solar.sunset;
    const nightEnd = solar.sunrise + 24;
    const hour = solar.hour < solar.sunrise ? solar.hour + 24 : solar.hour;
    const nightSpan = Math.max(0.01, nightEnd - nightStart);
    const p = Math.min(1, Math.max(0, (hour - nightStart) / nightSpan));
    centerRgb = '84,102,146';
    centerOpacity = 0.18;
    orbRgb = '204,220,255';
    orbOpacity = 0.2;
    orbX = 84 - p * 68;
    orbY = 28 - Math.sin(p * Math.PI) * 6;
  }

  timeTintEl.style.background = `
    radial-gradient(circle at ${orbX.toFixed(2)}% ${orbY.toFixed(2)}%, rgba(${orbRgb},${orbOpacity.toFixed(3)}) 0%, rgba(${orbRgb},${(orbOpacity*0.55).toFixed(3)}) 11%, rgba(${orbRgb},0) 24%),
    radial-gradient(ellipse at 50% 52%, rgba(${centerRgb},${centerOpacity.toFixed(3)}) 0%, rgba(${centerRgb},${(centerOpacity*0.52).toFixed(3)}) 34%, rgba(${centerRgb},0) 74%),
    radial-gradient(ellipse at 50% 100%, rgba(0,0,0,${solar.isDay ? 0.08 : 0.16}) 0%, rgba(0,0,0,0) 50%)
  `;
  timeTintEl.style.opacity = '1';
}

window.addEventListener('resize',bgResize);
bgResize();
drawBg();
applyBackgroundTuning();
applyFocusMode();
applyCursorPerformanceMode();
requestTimeTintGeolocation();
applyTimeTint();
setInterval(applyTimeTint,60000);

// ═══════════════════════════════════
// CURSOR + TRAIL
// ═══════════════════════════════════
const curDot  = document.getElementById('cur-dot');
const curRing = document.getElementById('cur-ring');
const curGlow = document.getElementById('cur-glow');
const curIbeam = document.getElementById('cur-ibeam');
const curResize = document.getElementById('cur-resize');
const curMove = document.getElementById('cur-move');
let curX=window.innerWidth/2, curY=window.innerHeight/2, glowX=window.innerWidth/2, glowY=window.innerHeight/2;
let cursorResizeLocked = false;
let cursorMode = 'default';
let cursorResizeDir = 'se';

function isTextCursorTarget(target){
  if(!target || target.nodeType !== 1) return false;
  if(target.closest('[data-force-pointer]')) return false;
  return !!target.closest('input,textarea,[contenteditable=""],[contenteditable="true"],[contenteditable]:not([contenteditable="false"])');
}

function isButtonCursorTarget(target){
  if(!target || target.nodeType !== 1) return false;
  return !!target.closest('button,.tb-btn,.file-item,.store-card,.browser-sc-btn,.toggle,.swatch,.wbtn,.app-sidebar-item,.music-row,.music-playlist-row,.ctx-item');
}

function isMoveCursorTarget(target){
  if(!target || target.nodeType !== 1) return false;
  const bar = target.closest('.win-bar');
  if(!bar) return false;
  if(target.closest('.win-btns,.wbtn')) return false;
  return true;
}

function getCursorTargetWindowId(target){
  if(!target || target.nodeType !== 1) return '';
  const win = target.closest('.win');
  if(!win) return '';
  return String(win.id || '').replace(/^win-/,'');
}

function isCursorTargetInFocusedWindow(target){
  const targetWinId = getCursorTargetWindowId(target);
  if(!targetWinId) return true;
  const focused = String(OS.focused || '');
  if(!focused) return true;
  return targetWinId === focused;
}

function setCursorMode(mode='default',{dir='se',lock=false,unlock=false}={}){
  if(unlock) cursorResizeLocked = false;
  if(cursorResizeLocked && mode!=='resize' && mode!=='move' && !unlock) return;
  if(lock) cursorResizeLocked = true;

  if(mode==='resize'){
    cursorMode = 'resize';
    cursorResizeDir = dir || cursorResizeDir || 'se';
    if(curResize) curResize.dataset.dir = cursorResizeDir;
    document.body.classList.add('cursor-resize');
    document.body.classList.remove('cursor-text');
    return;
  }

  if(mode==='move'){
    cursorMode = 'move';
    document.body.classList.add('cursor-move');
    document.body.classList.remove('cursor-resize');
    document.body.classList.remove('cursor-text');
    return;
  }

  if(mode==='text'){
    cursorMode = 'text';
    document.body.classList.add('cursor-text');
    document.body.classList.remove('cursor-resize');
    document.body.classList.remove('cursor-move');
    return;
  }

  cursorMode = 'default';
  document.body.classList.remove('cursor-resize');
  document.body.classList.remove('cursor-text');
  document.body.classList.remove('cursor-move');
}

function updateCursorModeFromTarget(target){
  if(cursorResizeLocked) return;
  if(!isCursorTargetInFocusedWindow(target)){
    setCursorMode('default');
    document.body.classList.remove('on-btn');
    return;
  }
  if(target && target.closest('.win-rz')){
    const dir = target.closest('.win-rz')?.dataset?.rzDir || 'se';
    document.body.classList.remove('on-btn');
    setCursorMode('resize',{dir});
    return;
  }
  if(isMoveCursorTarget(target)){
    document.body.classList.remove('on-btn');
    setCursorMode('move');
    return;
  }
  if(isTextCursorTarget(target)){
    document.body.classList.remove('on-btn');
    setCursorMode('text');
    return;
  }
  setCursorMode('default');
  document.body.classList.toggle('on-btn', isButtonCursorTarget(target));
}

window.__setCursorMode = setCursorMode;

function applyCursorPerformanceMode(){
  document.body.classList.toggle('cursor-perf', !!OS.cursorPerformanceMode);
}
window.applyCursorPerformanceMode = applyCursorPerformanceMode;

// Trail
const TRAIL_LEN = 18;
const trail = [];
for(let i=0;i<TRAIL_LEN;i++){
  const d=document.createElement('div');
  d.className='cur-trail';
  d.style.cssText=`position:fixed;border-radius:50%;pointer-events:none;z-index:999995;transform:translate(-50%,-50%);transition:none;`;
  document.body.appendChild(d);
  trail.push({el:d,x:curX,y:curY});
}

document.addEventListener('mousemove',e=>{
  curX=e.clientX; curY=e.clientY;
  curDot.style.left=curX+'px'; curDot.style.top=curY+'px';
  if(curIbeam){ curIbeam.style.left=curX+'px'; curIbeam.style.top=curY+'px'; }
  if(curResize){ curResize.style.left=curX+'px'; curResize.style.top=curY+'px'; }
  if(curMove){ curMove.style.left=curX+'px'; curMove.style.top=curY+'px'; }
  updateCursorModeFromTarget(e.target);
});
document.addEventListener('mouseover',e=>updateCursorModeFromTarget(e.target));
document.addEventListener('focusin',e=>updateCursorModeFromTarget(e.target));
document.addEventListener('focusout',()=>setTimeout(()=>updateCursorModeFromTarget(document.activeElement),0));
document.addEventListener('dragstart',e=>{
  const t = e.target;
  if(t && t.closest && t.closest('#win-files .file-item')) return;
  e.preventDefault();
},true);
document.addEventListener('dragend',()=>{
  setTimeout(()=>updateCursorModeFromTarget(document.elementFromPoint(curX, curY)),0);
},true);
document.addEventListener('mousedown',e=>{
  if(isTextCursorTarget(e.target)) setCursorMode('text');
});
document.addEventListener('mouseup',()=>{
  if(cursorResizeLocked) return;
  updateCursorModeFromTarget(document.elementFromPoint(curX, curY));
});

// Ring snaps fast — uses lerp only slightly for smoothness, not lag
let ringX=curX, ringY=curY;
(function animCursor(){
  // ring: very fast lerp — feels snappy not floaty
  ringX+=(curX-ringX)*.17;
  ringY+=(curY-ringY)*.17;
  curRing.style.left=ringX+'px';
  curRing.style.top=ringY+'px';

  if(!OS.cursorPerformanceMode){
    // glow: slow ambient follow
    glowX+=(curX-glowX)*.055;
    glowY+=(curY-glowY)*.055;
    curGlow.style.left=glowX+'px';
    curGlow.style.top=glowY+'px';

    // trail: each dot follows the one ahead
    trail[0].x+=(curX-trail[0].x)*.24;
    trail[0].y+=(curY-trail[0].y)*.24;
    for(let i=1;i<TRAIL_LEN;i++){
      trail[i].x+=(trail[i-1].x-trail[i].x)*.42;
      trail[i].y+=(trail[i-1].y-trail[i].y)*.42;
    }
    const rgb=OS.accentRgb;
    for(let i=0;i<TRAIL_LEN;i++){
      const t=trail[i];
      const frac=1-(i/TRAIL_LEN);
      const size=Math.max(0.5,4*frac*frac);
      const op=frac*frac*0.45;
      t.el.style.left=t.x+'px';
      t.el.style.top=t.y+'px';
      t.el.style.width=size+'px';
      t.el.style.height=size+'px';
      t.el.style.background=`rgba(${rgb},${op})`;
      t.el.style.boxShadow=`0 0 ${size*2}px rgba(${rgb},${op*0.6})`;
    }
  }
  requestAnimationFrame(animCursor);
})();

// ═══════════════════════════════════
// CLOCK
// ═══════════════════════════════════
function tickClock(){
  document.getElementById('tb-clock').textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
tickClock(); setInterval(tickClock,15000);

// ═══════════════════════════════════
// GLITCH
// ═══════════════════════════════════
const glitchLine    = document.getElementById('glitch-line');
const glitchFlicker = document.getElementById('glitch-flicker');
const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let glitchTimer = 0;
function queueGlitch(){
  clearTimeout(glitchTimer);
  if(reducedMotionQuery && reducedMotionQuery.matches) return;
  glitchTimer = setTimeout(doGlitch,22000+Math.random()*50000);
}
function doGlitch(){
  if(Math.random()<.55){
    glitchLine.style.top=Math.random()*100+'vh';
    glitchLine.style.opacity='1';
    setTimeout(()=>glitchLine.style.opacity='0',70+Math.random()*130);
  } else {
    glitchFlicker.style.opacity='.14';
    setTimeout(()=>glitchFlicker.style.opacity='0',35+Math.random()*55);
  }
  if(Math.random()<.25&&OS.focused){
    const el=document.getElementById('tb-active-title');
    const orig=el.textContent;
    el.textContent='█▓▒░ ERR'; el.style.color='rgba(var(--accent-rgb),.3)';
    setTimeout(()=>{el.textContent=orig; el.style.color='';},110);
  }
  queueGlitch();
}
if(reducedMotionQuery && typeof reducedMotionQuery.addEventListener === 'function'){
  reducedMotionQuery.addEventListener('change', queueGlitch);
}
queueGlitch();

// ═══════════════════════════════════
// NOTIFICATIONS (system + OS)
// ═══════════════════════════════════
function requestNotifPerms(){
  if('Notification' in window && Notification.permission==='default'){
    Notification.requestPermission();
  }
}

function notify(title,msg,duration=4000){
  const stack=document.getElementById('notif-stack');
  const el=document.createElement('div'); el.className='notif';
  const nid = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const titleEl = document.createElement('div');
  titleEl.className = 'notif-title';
  titleEl.textContent = String(title ?? '');
  const msgEl = document.createElement('div');
  msgEl.className = 'notif-msg';
  msgEl.textContent = String(msg ?? '');
  el.appendChild(titleEl);
  el.appendChild(msgEl);
  stack.appendChild(el);
  OS.notifHistory.unshift({id:nid,title,msg,at:Date.now()});
  saveOS();
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
  el.addEventListener('click',()=>{
    el.classList.remove('show');
    setTimeout(()=>el.remove(),220);
  });
  const dot=document.getElementById('tb-notif-dot');
  dot.style.opacity='1'; setTimeout(()=>dot.style.opacity='0',3000);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),400);},duration);
}

function sysNotify(title,msg){
  notify(title,msg);
  if('Notification' in window && Notification.permission==='granted'){
    new Notification(title,{body:msg,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23010103"/><text x="16" y="21" text-anchor="middle" font-size="14" fill="%23c8f0a0">O</text></svg>'});
  }
}

// Taskbar pinning + start menu
const CORE_APPS = [
  { id:'account',  name:'account',   type:'core' },
  { id:'browser',  name:'browser',   type:'core' },
  { id:'calculator', name:'calculator', type:'core' },
  { id:'calendar', name:'calendar',  type:'core' },
  { id:'clock', name:'clock', type:'core' },
  { id:'draw', name:'draw', type:'core' },
  { id:'files',    name:'files',     type:'core' },
  { id:'music',    name:'music',     type:'core' },
  { id:'notes',    name:'notes',     type:'core' },
  { id:'photos',   name:'photos',    type:'core' },
  { id:'settings', name:'settings',  type:'core' },
  { id:'terminal', name:'terminal',  type:'core' },
  { id:'weather', name:'weather', type:'core' },
];
const CORE_TASKBAR_SVG = {
  account: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`,
  browser: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a9 9 0 010 12M8 2a9 9 0 000 12"/></svg>`,
  calculator: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="3" y="1.5" width="10" height="13" rx="1.5"/><path d="M5 4h6M5 7h2M9 7h2M5 10h2M9 10h2M5 13h2M9 13h2"/></svg>`,
  calendar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/></svg>`,
  clock: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>`,
  draw: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 13l5-5 2 2-5 5H8v-2z"/><path d="M10 6l1-4-6-1 1 6 3 1"/></svg>`,
  files: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><path d="M2 5.2c0-.7.5-1.2 1.2-1.2h3L7.7 5.2h5.1c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H3.2c-.7 0-1.2-.5-1.2-1.2V5.2z"/><path d="M2 7h12"/><path d="M5 10.2h3.8"/></svg>`,
  music: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 12a2 2 0 11-2-2 2 2 0 012 2zm0 0V5.2l7-1.7V10a2 2 0 11-2-2 2 2 0 012 2"/></svg>`,
  notes: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M5 8h6M5 10h6M5 12h4"/></svg>`,
  photos: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M4.5 10l2.5-2.5 2 2 1.5-1.5L12 10M5 6h.01"/></svg>`,
  settings: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><path d="M2 4.2h12M2 8h12M2 11.8h12"/><circle cx="5" cy="4.2" r="1.1"/><circle cx="10.5" cy="8" r="1.1"/><circle cx="7" cy="11.8" r="1.1"/></svg>`,
  terminal: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7l2 2-2 2M9 11h2"/></svg>`,
  weather: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M11.5 13H5a4 4 0 110-8c.3 0 .6.03.9.1A3.5 3.5 0 1111.5 13z"/></svg>`,
};
const DEFAULT_UNPINNED_CORE_APPS = new Set(['notes', 'calculator', 'clock', 'weather', 'draw']);
if (Array.isArray(OS.installedApps) && OS.installedApps.length) {
  OS.installedApps = [];
  OS.appVersions = {};
  saveOS();
}
(() => {
  const hidden = Array.isArray(OS.taskbarHidden) ? OS.taskbarHidden : [];
  let changed = false;
  DEFAULT_UNPINNED_CORE_APPS.forEach((id) => {
    if (!hidden.includes(id)) {
      hidden.push(id);
      changed = true;
    }
  });
  if (changed) {
    OS.taskbarHidden = [...new Set(hidden)];
    saveOS();
  }
})();

function getAppWindowIds(appId){
  const id = String(appId || '');
  return Object.entries(OS.wins)
    .filter(([winId, win]) => String(win?.appId || winId.split('-')[0]) === id)
    .map(([winId]) => winId);
}

function getPreferredAppWindowId(appId){
  const ids = getAppWindowIds(appId);
  if(!ids.length) return '';
  if(OS.focused && ids.includes(OS.focused)) return OS.focused;
  if(ids.includes(appId)) return appId;
  return ids[ids.length - 1] || '';
}

window.shouldReuseAppWindow = function shouldReuseAppWindow(appId){
  return String(window.__forceNewWindowAppId || '') !== String(appId || '');
};

window.focusAnyAppWindow = function focusAnyAppWindow(appId){
  const id = getPreferredAppWindowId(appId);
  if(!id) return false;
  focusWin(id);
  return true;
};

let tbWinPreviewEl = null;
let tbWinPreviewApp = '';

function hideTaskbarWindowPreviews(){
  if(!tbWinPreviewEl) return;
  tbWinPreviewEl.remove();
  tbWinPreviewEl = null;
  tbWinPreviewApp = '';
}

function showTaskbarWindowPreviews(appId, anchorBtn){
  if(!anchorBtn) return;
  const ids = getAppWindowIds(appId);
  if(ids.length < 2){
    hideTaskbarWindowPreviews();
    return;
  }
  if(tbWinPreviewEl && tbWinPreviewApp === appId){
    hideTaskbarWindowPreviews();
    return;
  }
  hideTaskbarWindowPreviews();
  const panel = document.createElement('div');
  panel.id = 'tb-win-preview';
  panel.className = 'tb-win-preview';
  ids.forEach((winId, idx) => {
    const win = OS.wins[winId];
    if(!win?.el) return;
    const appRef = String(win.appId || winId.replace(/-\d+$/, '') || appId);
    const icon = CORE_TASKBAR_SVG[appRef] || `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`;
    const srcW = Math.max(320, win.el.offsetWidth || 320);
    const srcH = Math.max(180, win.el.offsetHeight || 180);
    const ws = Math.max(1, Number(win.workspace || 1));
    const card = document.createElement('button');
    card.className = 'tb-win-card';
    card.type = 'button';
    card.dataset.win = winId;
    card.innerHTML = `
      <div class="tb-win-head">${escapeHtml(String(win.title || appId))}${ids.length > 1 ? ` <small>${idx + 1}</small>` : ''}</div>
      <div class="tb-win-shot">
        <div class="tb-win-meta">
          <span class="tb-win-icon">${icon}</span>
          <span class="tb-win-sub">${escapeHtml(appRef)}</span>
          <span class="tb-win-sub">${srcW}x${srcH} - desk ${ws}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      hideTaskbarWindowPreviews();
      focusWin(winId);
    });
    panel.appendChild(card);
  });
  if(!panel.childElementCount) return;
  document.body.appendChild(panel);
  const r = anchorBtn.getBoundingClientRect();
  const w = panel.offsetWidth || 260;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + (r.width/2) - (w/2)));
  const bottom = Math.round(window.innerHeight - r.top + 8);
  panel.style.left = `${left}px`;
  panel.style.bottom = `${bottom}px`;
  tbWinPreviewEl = panel;
  tbWinPreviewApp = appId;
}

window.onTaskbarAppClick = function onTaskbarAppClick(appId){
  const id = String(appId || '');
  const ids = getAppWindowIds(id);
  if(!ids.length){
    hideTaskbarWindowPreviews();
    launchApp(id);
    return;
  }
  if(ids.length === 1){
    hideTaskbarWindowPreviews();
    focusWin(ids[0]);
    return;
  }
  const btn = document.querySelector(`.tb-btn[data-app="${id}"]`);
  if(btn) showTaskbarWindowPreviews(id, btn);
};
window.addEventListener('resize', hideTaskbarWindowPreviews);
const startBtn = document.getElementById('tb-start');
const startMenu = document.getElementById('start-menu');
const cmdkEl = document.getElementById('cmdk');
const bellEl = document.getElementById('tb-bell');
const notifCenter = document.getElementById('notif-center');
let startOpen = false;
let notifCenterOpen = false;
let cmdkOpen = false;
let cmdkSelectedIdx = 0;
let cmdkItems = [];
let sessionRestoreInProgress = false;
let workspaceUIInit = false;
const snapOverlay = document.createElement('div');
snapOverlay.id = 'snap-overlay';
document.body.appendChild(snapOverlay);

function syncWorkspaceUI(){
  const label = document.getElementById('tb-workspace-label');
  if(label) label.textContent = `desk ${OS.currentWorkspace}`;
}

function applyWorkspaceVisibility(){
  Object.values(OS.wins).forEach(w=>{
    const same = (w.workspace || 1) === OS.currentWorkspace;
    w.el.classList.toggle('ws-hidden', !same);
    if(!same){
      w.el.style.display='none';
      return;
    }
    if(!w.minimized) w.el.style.display='flex';
  });
  if(OS.focused && OS.wins[OS.focused] && (OS.wins[OS.focused].workspace||1)!==OS.currentWorkspace){
    OS.focused = null;
    const t=document.getElementById('tb-active-title');
    if(t){ t.textContent=''; t.classList.remove('lit'); }
    document.querySelectorAll('.tb-btn').forEach(b=>b.classList.remove('active'));
  }
  syncWorkspaceUI();
}

function switchWorkspace(next, silent=false){
  const n = Math.max(1, Math.min(OS.workspaceCount, Number(next)||1));
  if(n===OS.currentWorkspace) return;
  const desk = document.getElementById('desktop');
  if(desk){
    const dirCls = n > OS.currentWorkspace ? 'ws-next' : 'ws-prev';
    desk.classList.remove('ws-swap','ws-next','ws-prev');
    void desk.offsetWidth;
    desk.classList.add('ws-swap', dirCls);
    setTimeout(()=>desk.classList.remove('ws-swap','ws-next','ws-prev'),290);
  }
  OS.currentWorkspace = n;
  saveOS();
  applyWorkspaceVisibility();
  if(!silent) notify('workspace', `desk ${n}`);
}

function initWorkspaceUI(){
  if(workspaceUIInit) return;
  const right = document.getElementById('tb-right');
  if(!right) return;
  const wrap = document.createElement('div');
  wrap.id = 'tb-workspaces';
  wrap.innerHTML = `
    <button id="tb-ws-prev" class="tb-ws-btn" title="previous desktop" aria-label="previous desktop">&#8249;</button>
    <span id="tb-workspace-label">desk ${OS.currentWorkspace}</span>
    <button id="tb-ws-next" class="tb-ws-btn" title="next desktop" aria-label="next desktop">&#8250;</button>
  `;
  right.prepend(wrap);
  document.getElementById('tb-ws-prev')?.addEventListener('click',()=>switchWorkspace(Math.max(1, OS.currentWorkspace-1)));
  document.getElementById('tb-ws-next')?.addEventListener('click',()=>switchWorkspace(Math.min(OS.workspaceCount, OS.currentWorkspace+1)));
  workspaceUIInit = true;
}

function getPaletteItems() {
  const appItems = getStartApps().map(a => ({ key:`open:${a.id}`, label:`open ${a.name}`, sub:'app', run:()=>launchFromStart(a) }));
  const actionItems = [
    { key:'close-focused', label:'close focused window', sub:'action', run:()=>{ if(OS.focused) closeWin(OS.focused); } },
    { key:'toggle-focus', label:'toggle focus mode', sub:'action', run:()=>{ OS.focusMode=!OS.focusMode; saveOS(); applyFocusMode(); } },
    { key:'toggle-soundscape', label:'toggle soundscape', sub:'action', run:()=>{ OS.soundscapeEnabled=!OS.soundscapeEnabled; saveOS(); applySoundscapeState(); } },
    { key:'open-settings', label:'open settings', sub:'action', run:()=>launchApp('settings') },
    { key:'workspace-prev', label:'switch to previous desktop', sub:'workspace', run:()=>switchWorkspace(Math.max(1, OS.currentWorkspace-1)) },
    { key:'workspace-next', label:'switch to next desktop', sub:'workspace', run:()=>switchWorkspace(Math.min(OS.workspaceCount, OS.currentWorkspace+1)) },
  ];
  return [...appItems, ...actionItems];
}

function renderCmdk(query='') {
  if(!cmdkEl) return;
  const q = query.trim().toLowerCase();
  cmdkItems = getPaletteItems().filter(i => !q || i.label.includes(q) || i.sub.includes(q));
  if(cmdkSelectedIdx >= cmdkItems.length) cmdkSelectedIdx = Math.max(0, cmdkItems.length-1);
  const listHtml = cmdkItems.length
    ? cmdkItems.map((it,idx)=>`<button class="cmdk-item${idx===cmdkSelectedIdx?' sel':''}" data-cmdk="${idx}"><span>${it.label}</span><small>${it.sub}</small></button>`).join('')
    : `<div class="cmdk-empty">no results</div>`;
  cmdkEl.innerHTML = `<div class="cmdk-wrap">
    <input id="cmdk-input" class="cmdk-input" placeholder="type a command or app...">
    <div class="cmdk-list">${listHtml}</div>
  </div>`;
  const inp = document.getElementById('cmdk-input');
  inp.value = query;
  setTimeout(()=>inp.focus(), 10);
  inp.setSelectionRange(inp.value.length, inp.value.length);
}

function openCmdk() {
  if(!cmdkEl) return;
  hideStartMenu();
  hideNotifCenter();
  hideCtx();
  cmdkSelectedIdx = 0;
  renderCmdk('');
  cmdkEl.classList.add('show');
  cmdkOpen = true;
}

function closeCmdk() {
  if(!cmdkEl) return;
  cmdkEl.classList.remove('show');
  cmdkOpen = false;
}

function runCmdkSelected() {
  const item = cmdkItems[cmdkSelectedIdx];
  if(!item) return;
  closeCmdk();
  item.run();
}

function saveSessionWindows() {
  if(sessionRestoreInProgress) return;
  const rec = Object.entries(OS.wins).map(([id,w]) => {
    const left = parseInt(w.el.style.left) || 0;
    const top = parseInt(w.el.style.top) || 0;
    const width = w.el.offsetWidth || parseInt(w.el.style.width) || 0;
    const height = w.el.offsetHeight || parseInt(w.el.style.height) || 0;
    return {
      id,left,top,width,height,
      minimized:!!w.minimized,
      maximized:!!w.maximized,
      prevRect:w.prevRect||null,
      workspace:w.workspace||1,
    };
  });
  localStorage.setItem('os-session-windows', JSON.stringify(rec));
}

function applyRestoredWindowState(rec){
  const winId = String(rec?.id || '');
  if(!winId) return true;
  const win = OS.wins[winId];
  if(!win) return false;
  win.workspace = Math.max(1, Math.min(OS.workspaceCount, rec.workspace||1));
  if(rec.prevRect) win.prevRect = rec.prevRect;
  if(rec.maximized){
    const desk = document.getElementById('desktop');
    win.el.style.left = '0';
    win.el.style.top = '0';
    win.el.style.width = desk.offsetWidth + 'px';
    win.el.style.height = desk.offsetHeight + 'px';
    win.maximized = true;
  } else {
    win.el.style.left = (rec.left||40) + 'px';
    win.el.style.top = (rec.top||40) + 'px';
    win.el.style.width = Math.max(300, rec.width||640) + 'px';
    win.el.style.height = Math.max(200, rec.height||420) + 'px';
    win.maximized = false;
  }
  if(rec.minimized){
    win.el.style.display = 'none';
    win.minimized = true;
  }
  return true;
}

function restoreSessionWindows() {
  let rec = [];
  try { rec = JSON.parse(localStorage.getItem('os-session-windows')||'[]'); } catch(e) { rec=[]; }
  if(!rec.length) return;
  sessionRestoreInProgress = true;
  rec.forEach((w) => {
    const winId = String(w?.id || '');
    const appId = winId.replace(/-\d+$/, '');
    if(!appId) return;
    const isCore = CORE_APPS.some(a=>a.id===appId);
    if(isCore) launchApp(appId);
    else if(typeof launchInstalledApp === 'function') launchInstalledApp(appId);
  });
  const pending = rec.slice();
  let attempts = 0;
  const settle = () => {
    attempts++;
    for(let i=pending.length - 1; i>=0; i--){
      if(applyRestoredWindowState(pending[i])) pending.splice(i, 1);
    }
    if(!pending.length || attempts >= 160){
      sessionRestoreInProgress = false;
      applyWorkspaceVisibility();
      saveSessionWindows();
      return;
    }
    requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);
}

function markRecentApp(id,type='core'){
  const app = (type==='installed' && typeof STORE_APPS!=='undefined')
    ? STORE_APPS.find(a=>a.id===id)
    : CORE_APPS.find(a=>a.id===id);
  const name = app?.name || id;
  OS.recentApps = OS.recentApps.filter(a=>a.id!==id);
  OS.recentApps.unshift({id,name,type,at:Date.now()});
  saveOS();
}

function renderNotifCenter(){
  if(!notifCenter) return;
  const items = OS.notifHistory.slice(0,30);
  notifCenter.innerHTML = `
    <div class="nc-head">notification center</div>
    <div class="nc-list">
      ${items.length ? items.map(n => `
        <div class="nc-item">
          <div class="nc-title">${escapeHtml(n.title)}</div>
          <div class="nc-msg">${escapeHtml(n.msg)}</div>
          <div class="nc-time">${new Date(n.at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
          <button class="nc-dismiss" data-dismiss="${n.id||''}">dismiss</button>
        </div>
      `).join('') : `<div class="nc-empty">no notifications yet</div>`}
    </div>
  `;
}

function showNotifCenter(){
  if(!notifCenter) return;
  renderNotifCenter();
  notifCenter.classList.add('show');
  notifCenterOpen=true;
}
function hideNotifCenter(){
  if(!notifCenter) return;
  notifCenter.classList.remove('show');
  notifCenterOpen=false;
}
function toggleNotifCenter(){
  if(notifCenterOpen) hideNotifCenter();
  else showNotifCenter();
}

function syncTaskbarButtonState(btn,id){
  if(!btn || !id) return;
  if(btn.classList.contains('tb-temp')) return;
  btn.classList.toggle('tb-hidden', OS.taskbarHidden.includes(id) && !btn.classList.contains('running'));
}

function applyTaskbarVisibility(){
  document.querySelectorAll('.tb-btn[data-app]').forEach(btn => syncTaskbarButtonState(btn, btn.dataset.app));
}

function pinApp(id){
  const idx = OS.taskbarHidden.indexOf(id);
  if(idx > -1){
    OS.taskbarHidden.splice(idx,1);
    saveOS();
  }
  let btn = document.querySelector(`.tb-btn[data-app="${id}"]`);
  if(!btn && CORE_APPS.some((a)=>a.id===id)){
    const host = document.getElementById('tb-apps');
    if(host){
      btn = document.createElement('button');
      btn.className = 'tb-btn tb-dynamic';
      btn.dataset.app = id;
      btn.setAttribute('aria-label', `open ${id}`);
      btn.onclick = () => window.onTaskbarAppClick?.(id);
      const icon = CORE_TASKBAR_SVG[id] || `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`;
      btn.innerHTML = `${icon}<div class="tb-dot"></div><div class="tb-tip">${id}</div>`;
      const sep = host.querySelector('.tb-sep');
      if(sep) host.insertBefore(btn, sep);
      else host.appendChild(btn);
    }
  }
  if(btn) syncTaskbarButtonState(btn,id);
}
window.pinApp = pinApp;

function unpinApp(id, options = {}){
  const forceHide = !!options.forceHide;
  if(!document.querySelector(`.tb-btn[data-app="${id}"]`)) return;
  if(!OS.taskbarHidden.includes(id)){
    OS.taskbarHidden.push(id);
    saveOS();
  }
  const btn = document.querySelector(`.tb-btn[data-app="${id}"]`);
  if(btn){
    if(btn.classList.contains('tb-dynamic') && (!btn.classList.contains('running') || forceHide)){
      btn.remove();
      return;
    }
    syncTaskbarButtonState(btn,id);
    if(forceHide) btn.classList.add('tb-hidden');
  }
}
window.unpinApp = unpinApp;

function getStartApps(){
  const installed = (typeof STORE_APPS!=='undefined' ? STORE_APPS : [])
    .filter(a => OS.installedApps.includes(a.id))
    .map(a => ({ id:a.id, name:a.name, type:'installed' }));
  return [...CORE_APPS, ...installed].sort((a,b)=>a.name.localeCompare(b.name));
}

function getStartAppIconSvg(app){
  if(app && app.type === 'core' && CORE_TASKBAR_SVG[app.id]) return CORE_TASKBAR_SVG[app.id];
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`;
}

function launchFromStart(app){
  hideStartMenu();
  if(app.type === 'installed' && typeof launchInstalledApp === 'function'){
    markRecentApp(app.id,'installed');
    launchInstalledApp(app.id);
    return;
  }
  launchApp(app.id);
}

function getStartActionForApp(app){
  if(!app || app.type !== 'core') return 'open';
  const inDesktop = hasAppShortcutInDir('desktop', app.id);
  const inApps = hasAppShortcutInDir('apps', app.id);
  return (!inDesktop && !inApps) ? 'install' : 'open';
}

function installFromStart(appId){
  const result = installAppShortcutToApps(appId);
  if(!result.ok){
    notify('apps', `unable to install: ${appId}`);
    return;
  }
  if(result.installed){
    notify('apps', `installed ${appId} to apps folder`);
  }else if(result.reason === 'exists-desktop'){
    notify('apps', `${appId} is already on desktop`);
  }else{
    notify('apps', `${appId} already installed`);
  }
}

function getAppFallbackIconSvg(){
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`;
}

function findLaunchableApp(appId){
  const id = String(appId || '').trim();
  if(!id) return null;
  return getStartApps().find((app) => String(app.id) === id) || null;
}

function getLaunchableApps(){
  return getStartApps().map((app) => ({ id: app.id, name: app.name, type: app.type }));
}

function getShortcutItems(dir){
  if(!OS.files || typeof OS.files !== 'object') OS.files = {};
  if(!Array.isArray(OS.files[dir])) OS.files[dir] = [];
  return OS.files[dir];
}

function hasAppShortcutInDir(dir, appId){
  const id = String(appId || '').trim().toLowerCase();
  if(!id) return false;
  return getShortcutItems(dir).some((item) => item && item.type === 'app' && resolveShortcutAppId(item) === id);
}

function syncAppShortcutDedup(){
  const desktopIds = new Set(
    getShortcutItems('desktop')
      .filter((item) => item && item.type === 'app')
      .map((item) => resolveShortcutAppId(item))
      .filter(Boolean),
  );
  if(!desktopIds.size) return false;
  const before = getShortcutItems('apps').length;
  OS.files.apps = getShortcutItems('apps').filter((item) => {
    if(!item || item.type !== 'app') return true;
    const id = resolveShortcutAppId(item);
    return !desktopIds.has(id);
  });
  return OS.files.apps.length !== before;
}

function installAppShortcutToApps(appId){
  const id = String(appId || '').trim().toLowerCase();
  const app = findLaunchableApp(id);
  if(!app) return { ok:false, reason:'unknown' };
  if(hasAppShortcutInDir('apps', app.id)) return { ok:true, installed:false, reason:'exists-apps' };
  if(hasAppShortcutInDir('desktop', app.id)) return { ok:true, installed:false, reason:'exists-desktop' };
  const items = getShortcutItems('apps');
  const name = desktopUniqueName(items, toAppShortcutName(app.id, app.id));
  items.push({ name, type:'app', appId: app.id });
  saveOS();
  return { ok:true, installed:true };
}

function getAppIconSvg(appId){
  const app = findLaunchableApp(stripAppShortcutExt(appId).toLowerCase());
  if(app && app.type === 'core' && CORE_TASKBAR_SVG[app.id]) return CORE_TASKBAR_SVG[app.id];
  return getAppFallbackIconSvg();
}

function launchShortcutApp(appId){
  const normalizedId = stripAppShortcutExt(appId).toLowerCase();
  const app = findLaunchableApp(normalizedId);
  if(!app){
    notify('desktop', `app unavailable: ${normalizedId || appId}`);
    return false;
  }
  if(app.type === 'installed' && typeof launchInstalledApp === 'function'){
    markRecentApp(app.id,'installed');
    launchInstalledApp(app.id);
    return true;
  }
  launchApp(app.id);
  return true;
}

window.getLaunchableApps = getLaunchableApps;
window.getAppIconSvg = getAppIconSvg;
window.launchShortcutApp = launchShortcutApp;
window.installAppShortcutToApps = installAppShortcutToApps;

const DESKTOP_EXT_COLORS = {
  js:'#f7df1e', json:'#7dd3fc', md:'#c4b5fd', txt:'#a3a3a3', html:'#f97316', css:'#38bdf8',
  png:'#f9a8d4', jpg:'#f9a8d4', jpeg:'#f9a8d4', gif:'#f9a8d4', webp:'#f9a8d4', svg:'#f9a8d4',
};

function isTextInputTarget(target){
  if(!target || !target.closest) return false;
  return !!target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable]:not([contenteditable="false"])');
}

function getDesktopLayoutMetrics(settings){
  const showLabels = settings?.showLabels !== false;
  return {
    width: showLabels ? settings.iconSize + 34 : settings.iconSize + 22,
    height: showLabels ? settings.iconSize + 30 : settings.iconSize + 16,
  };
}

function clampDesktopPosition(layer, x, y, settings){
  const metrics = getDesktopLayoutMetrics(settings);
  const maxX = Math.max(6, layer.clientWidth - metrics.width - 6);
  const maxY = Math.max(6, layer.clientHeight - metrics.height - 6);
  return {
    x: Math.max(6, Math.min(maxX, Math.round(Number(x) || 0))),
    y: Math.max(6, Math.min(maxY, Math.round(Number(y) || 0))),
  };
}

function getDesktopGridPosition(idx, layer, settings){
  const metrics = getDesktopLayoutMetrics(settings);
  const gap = Number(settings?.gridGap || 12);
  const rows = Math.max(1, Math.floor((layer.clientHeight - 10 + gap) / (metrics.height + gap)));
  const col = Math.floor(idx / rows);
  const row = idx % rows;
  const x = 6 + col * (metrics.width + gap);
  const y = 6 + row * (metrics.height + gap);
  return clampDesktopPosition(layer, x, y, settings);
}

function desktopPositionsOverlap(a, b, settings){
  if(!a || !b) return false;
  const metrics = getDesktopLayoutMetrics(settings);
  const pad = 4;
  return Math.abs(a.x - b.x) < (metrics.width + pad) && Math.abs(a.y - b.y) < (metrics.height + pad);
}

function findDesktopOpenPosition(layer, settings, desired, placed){
  const target = clampDesktopPosition(layer, desired?.x, desired?.y, settings);
  if(!placed.some((p)=>desktopPositionsOverlap(target, p, settings))) return target;
  const metrics = getDesktopLayoutMetrics(settings);
  const gap = Math.max(6, Number(settings?.gridGap || 12));
  const stepX = Math.max(12, metrics.width + gap);
  const stepY = Math.max(12, metrics.height + gap);
  for(let ring=1; ring<=26; ring++){
    for(let dx=-ring; dx<=ring; dx++){
      for(let dy=-ring; dy<=ring; dy++){
        if(Math.abs(dx)!==ring && Math.abs(dy)!==ring) continue;
        const probe = clampDesktopPosition(layer, target.x + dx*stepX, target.y + dy*stepY, settings);
        if(!placed.some((p)=>desktopPositionsOverlap(probe, p, settings))) return probe;
      }
    }
  }
  for(let i=0; i<240; i++){
    const probe = getDesktopGridPosition(i, layer, settings);
    if(!placed.some((p)=>desktopPositionsOverlap(probe, p, settings))) return probe;
  }
  return target;
}

function computeDesktopPositions(items, layer, settings, overrideIdx = -1, overridePos = null){
  const out = [];
  const placed = [];
  items.forEach((item, idx) => {
    const hasPos = item && item._deskPos && Number.isFinite(item._deskPos.x) && Number.isFinite(item._deskPos.y);
    const desired = (idx === overrideIdx && overridePos)
      ? overridePos
      : (hasPos ? item._deskPos : getDesktopGridPosition(idx, layer, settings));
    const pos = findDesktopOpenPosition(layer, settings, desired, placed);
    out[idx] = pos;
    placed.push(pos);
  });
  return out;
}

function getDesktopItems(){
  if(!Array.isArray(OS.files.desktop)) OS.files.desktop = [];
  return OS.files.desktop;
}

function ensureDesktopLayer(){
  const desk = document.getElementById('desktop');
  if(!desk) return null;
  let layer = document.getElementById('desktop-icons');
  if(!layer){
    layer = document.createElement('div');
    layer.id = 'desktop-icons';
    desk.insertBefore(layer, desk.firstChild || null);
    const finishDesktopDrag = (pointerId = null) => {
      const state = desktopDragState;
      if(!state) return;
      if(pointerId !== null && state.pointerId !== pointerId) return;
      state.node.classList.remove('dragging');
      if(state.dragging){
        desktopDragSuppressClickUntil = Date.now() + 220;
        const items = getDesktopItems();
        const item = items[state.idx];
        if(item){
          item._deskPos = { x: Math.round(state.x), y: Math.round(state.y) };
          saveOS();
        }
      }
      if(state.node.releasePointerCapture && state.pointerId != null){
        try{ state.node.releasePointerCapture(state.pointerId); }catch{}
      }
      desktopDragState = null;
    };

    layer.addEventListener('pointerdown', (e) => {
      if(e.button !== 0) return;
      const itemEl = e.target.closest('.desk-item');
      if(!itemEl) return;
      const idx = Number.parseInt(itemEl.dataset.idx || '', 10);
      if(!Number.isInteger(idx)) return;
      const nodeRect = itemEl.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      desktopSelectedIdx = idx;
      syncDesktopSelection();
      desktopDragState = {
        pointerId: e.pointerId,
        idx,
        node: itemEl,
        startX: e.clientX,
        startY: e.clientY,
        baseX: nodeRect.left - layerRect.left,
        baseY: nodeRect.top - layerRect.top,
        x: nodeRect.left - layerRect.left,
        y: nodeRect.top - layerRect.top,
        dragging: false,
      };
      if(itemEl.setPointerCapture){
        try{ itemEl.setPointerCapture(e.pointerId); }catch{}
      }
    });

    layer.addEventListener('pointermove', (e) => {
      const state = desktopDragState;
      if(!state || state.pointerId !== e.pointerId) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if(!state.dragging && Math.hypot(dx, dy) < 4) return;
      if(!state.dragging){
        state.dragging = true;
        state.node.classList.add('dragging');
      }
      const settings = normalizeDesktopSettings(OS.desktopSettings);
      const desired = clampDesktopPosition(layer, state.baseX + dx, state.baseY + dy, settings);
      const items = getDesktopItems();
      const positions = computeDesktopPositions(items, layer, settings, state.idx, desired);
      const next = positions[state.idx] || desired;
      state.x = next.x;
      state.y = next.y;
      state.node.style.left = `${next.x}px`;
      state.node.style.top = `${next.y}px`;
      e.preventDefault();
    });

    layer.addEventListener('pointerup', (e) => finishDesktopDrag(e.pointerId));
    layer.addEventListener('pointercancel', (e) => finishDesktopDrag(e.pointerId));

    layer.addEventListener('click', (e) => {
      if(Date.now() < desktopDragSuppressClickUntil) return;
      const itemEl = e.target.closest('.desk-item');
      if(!itemEl) return;
      const idx = Number.parseInt(itemEl.dataset.idx || '', 10);
      if(!Number.isInteger(idx)) return;
      desktopSelectedIdx = idx;
      syncDesktopSelection();
    });
    layer.addEventListener('dblclick', (e) => {
      if(Date.now() < desktopDragSuppressClickUntil) return;
      const itemEl = e.target.closest('.desk-item');
      if(!itemEl) return;
      const idx = Number.parseInt(itemEl.dataset.idx || '', 10);
      if(!Number.isInteger(idx)) return;
      desktopOpenItem(idx);
    });
  }
  return layer;
}

function syncDesktopSelection(){
  document.querySelectorAll('#desktop-icons .desk-item').forEach((node) => {
    const idx = Number.parseInt(node.dataset.idx || '', 10);
    node.classList.toggle('selected', idx === desktopSelectedIdx);
  });
}

function clearDesktopSelection(){
  desktopSelectedIdx = -1;
  syncDesktopSelection();
}

function desktopUniqueName(items, baseName){
  const used = new Set(items.map((item) => String(item?.name || '').toLowerCase()));
  if(!used.has(String(baseName).toLowerCase())) return String(baseName);
  let n = 2;
  while(used.has(`${baseName} ${n}`.toLowerCase())) n++;
  return `${baseName} ${n}`;
}

function splitEntryName(name){
  const str = String(name || '');
  const idx = str.lastIndexOf('.');
  if(idx < 1) return { base: str, ext: '' };
  return { base: str.slice(0, idx), ext: str.slice(idx) };
}

function remapDirTree(oldPath, newPath){
  if(!oldPath || !newPath || oldPath === newPath) return;
  const keys = Object.keys(OS.files).filter((k) => k === oldPath || k.startsWith(`${oldPath}/`));
  keys.sort((a,b) => a.length - b.length);
  keys.forEach((key) => {
    const suffix = key === oldPath ? '' : key.slice(oldPath.length);
    const nextKey = `${newPath}${suffix}`;
    OS.files[nextKey] = OS.files[key];
    if(nextKey !== key) delete OS.files[key];
  });
}

function openDirInFiles(dir){
  if(typeof launchFiles !== 'function') return;
  launchFiles();
  setTimeout(() => {
    if(typeof renderFiles === 'function') renderFiles(dir);
  }, 70);
}

function desktopOpenItem(idx){
  const items = getDesktopItems();
  const item = items[idx];
  if(!item) return;
  desktopSelectedIdx = idx;
  syncDesktopSelection();
  if(item.type === 'app'){
    launchShortcutApp(resolveShortcutAppId(item));
    return;
  }
  if(item.type === 'dir'){
    const subKey = `desktop/${item.name}`;
    if(!Array.isArray(OS.files[subKey])) OS.files[subKey] = [];
    openDirInFiles(subKey);
    return;
  }
  const ext = String(item.ext || '').toLowerCase();
  if(window.IMAGE_EXTS?.has(ext) && typeof window.photosOpenFile === 'function'){
    window.photosOpenFile(item);
    return;
  }
  if(window.TEXT_EXTS?.has(ext) && typeof window.notesOpenFile === 'function'){
    window.notesOpenFile(item);
    return;
  }
  notify('desktop', `opened ${getEntryDisplayName(item)}`);
}

async function desktopCreateFolder(){
  const items = getDesktopItems();
  const rawValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: 'new desktop folder',
      label: 'folder name',
      value: 'new folder',
      placeholder: 'folder name',
      confirmLabel: 'create',
    })
    : prompt('new desktop folder name:', 'new folder');
  const raw = String(rawValue || '').trim();
  if(!raw) return;
  const name = desktopUniqueName(items, raw);
  items.push({ name, type: 'dir', color: '#c8f0a0' });
  const subKey = `desktop/${name}`;
  if(!Array.isArray(OS.files[subKey])) OS.files[subKey] = [];
  saveOS();
}

async function desktopCreateTextFile(ext='txt'){
  const items = getDesktopItems();
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: `new desktop .${ext} file`,
      label: 'file name',
      value: `untitled.${ext}`,
      placeholder: `name.${ext}`,
      confirmLabel: 'create',
    })
    : prompt(`new desktop .${ext} file name:`, `untitled.${ext}`);
  const raw = String(inputValue || '').trim();
  if(!raw) return;
  const name = desktopUniqueName(items, raw.includes('.') ? raw : `${raw}.${ext}`);
  items.push({ name, type: 'file', ext, content: '' });
  saveOS();
}

async function desktopCreateAppShortcut(){
  const apps = getLaunchableApps();
  if(!apps.length){
    notify('desktop', 'no launchable apps');
    return;
  }
  const appHint = apps.map((app) => app.id).join(', ');
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: 'new desktop app shortcut',
      label: `app id (${appHint})`,
      value: 'browser',
      placeholder: 'browser',
      confirmLabel: 'create',
    })
    : prompt(`new desktop app shortcut (id):\n${appHint}`, 'browser');
  const raw = String(inputValue || '').trim().toLowerCase();
  if(!raw) return;
  const app = apps.find((entry) => entry.id.toLowerCase() === raw || String(entry.name || '').toLowerCase() === raw);
  if(!app){
    notify('desktop', `unknown app id: ${raw}`);
    return;
  }
  const items = getDesktopItems();
  const name = desktopUniqueName(items, toAppShortcutName(app.id, app.id));
  items.push({ name, type: 'app', appId: app.id });
  saveOS();
}

function desktopRenameItem(idx){
  const items = getDesktopItems();
  const item = items[idx];
  if(!item) return;
  const prevName = String(item.name || '').trim();
  let next = (prompt('rename to:', getEntryDisplayName(item) || prevName) || '').trim();
  if(item.type === 'app' && next){
    next = toAppShortcutName(next, resolveShortcutAppId(item) || next);
  }
  if(!next || next === prevName) return;
  const exists = items.some((entry, entryIdx) => entryIdx !== idx && String(entry?.name || '').toLowerCase() === next.toLowerCase());
  if(exists){
    notify('desktop', 'name already exists');
    return;
  }
  item.name = next;
  if(item.type === 'dir'){
    remapDirTree(`desktop/${prevName}`, `desktop/${next}`);
  }
  saveOS();
}

function desktopDuplicateItem(idx){
  const items = getDesktopItems();
  const item = items[idx];
  if(!item) return;
  const copy = JSON.parse(JSON.stringify(item));
  const nameParts = splitEntryName(String(item.name || 'item'));
  copy.name = desktopUniqueName(items, nameParts.ext ? `${nameParts.base} copy${nameParts.ext}` : `${nameParts.base} copy`);
  if(copy && copy._deskPos && Number.isFinite(copy._deskPos.x) && Number.isFinite(copy._deskPos.y)){
    copy._deskPos = { x: copy._deskPos.x + 18, y: copy._deskPos.y + 18 };
  }
  items.push(copy);
  if(copy.type === 'dir'){
    const srcPath = `desktop/${item.name}`;
    const dstPath = `desktop/${copy.name}`;
    const subtree = Object.keys(OS.files).filter((k) => k === srcPath || k.startsWith(`${srcPath}/`));
    subtree.forEach((key) => {
      const suffix = key === srcPath ? '' : key.slice(srcPath.length);
      OS.files[`${dstPath}${suffix}`] = JSON.parse(JSON.stringify(OS.files[key]));
    });
  }
  saveOS();
}

function desktopDeleteItem(idx){
  const items = getDesktopItems();
  const removed = items.splice(idx, 1)[0];
  if(!removed) return;
  const originalPath = `desktop/${removed.name}`;
  OS.recycleBin.unshift({
    ...JSON.parse(JSON.stringify(removed)),
    _trashId: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    _fromDir: 'desktop',
    _originalPath: originalPath,
    _deletedAt: Date.now(),
  });
  if(removed.type === 'app'){
    const appId = resolveShortcutAppId(removed);
    if(appId) unpinApp(appId, { forceHide:true });
  }
  desktopSelectedIdx = -1;
  saveOS();
  notify('desktop', `${getEntryDisplayName(removed)} moved to recycle`);
}

function buildDesktopItemFromDrop(fileData){
  const rawName = String(fileData?.name || '').trim();
  const rawType = String(fileData?.type || 'file').toLowerCase();
  const type = rawType === 'dir' || rawType === 'app' ? rawType : 'file';
  const item = { type };
  if(type === 'app'){
    const appId = resolveShortcutAppId(fileData) || stripAppShortcutExt(rawName || 'app');
    item.appId = appId;
    item.name = toAppShortcutName(rawName || appId, appId || 'app');
    return item;
  }
  if(type === 'dir'){
    item.name = rawName || 'new folder';
    item.color = String(fileData?.color || '#c8f0a0');
    return item;
  }
  const extFromName = (() => {
    const idx = rawName.lastIndexOf('.');
    if(idx < 1) return '';
    return rawName.slice(idx + 1).toLowerCase();
  })();
  item.ext = String(fileData?.ext || extFromName || 'txt').toLowerCase();
  item.name = rawName || `untitled.${item.ext}`;
  if(!item.name.includes('.')) item.name = `${item.name}.${item.ext}`;
  if(typeof fileData?.content === 'string') item.content = fileData.content;
  if(typeof fileData?.dataUrl === 'string') item.dataUrl = fileData.dataUrl;
  return item;
}

function copyDirTreeIntoDesktop(fromDir, srcName, dstName){
  if(!fromDir || !srcName || !dstName) return;
  const srcBase = fromDir === 'home' ? srcName : `${fromDir}/${srcName}`;
  const dstBase = `desktop/${dstName}`;
  const subtree = Object.keys(OS.files).filter((k) => k === srcBase || k.startsWith(`${srcBase}/`));
  subtree.forEach((key) => {
    const suffix = key === srcBase ? '' : key.slice(srcBase.length);
    OS.files[`${dstBase}${suffix}`] = JSON.parse(JSON.stringify(OS.files[key]));
  });
}

function desktopReceiveExternalFile(fileData, point){
  if(!fileData) return;
  const layer = ensureDesktopLayer();
  if(!layer) return;
  const items = getDesktopItems();
  const incoming = buildDesktopItemFromDrop(fileData);
  incoming.name = desktopUniqueName(items, incoming.name || 'item');
  const idx = items.push(incoming) - 1;
  if(incoming.type === 'dir'){
    const targetKey = `desktop/${incoming.name}`;
    if(!Array.isArray(OS.files[targetKey])) OS.files[targetKey] = [];
    const fromDir = String(fileData?.fromDir || '').trim();
    if(fromDir && fromDir !== 'recycle'){
      copyDirTreeIntoDesktop(fromDir, String(fileData?.name || incoming.name), incoming.name);
    }
  }
  const settings = normalizeDesktopSettings(OS.desktopSettings);
  const metrics = getDesktopLayoutMetrics(settings);
  const layerRect = layer.getBoundingClientRect();
  const desired = point
    ? {
      x: (Number(point.clientX) || 0) - layerRect.left - (metrics.width / 2),
      y: (Number(point.clientY) || 0) - layerRect.top - 12,
    }
    : getDesktopGridPosition(idx, layer, settings);
  const positions = computeDesktopPositions(items, layer, settings, idx, desired);
  incoming._deskPos = positions[idx] || clampDesktopPosition(layer, desired.x, desired.y, settings);
  saveOS();
  notify('desktop', `${getEntryDisplayName(incoming)} added to desktop`);
  const hasFilesWindow = Object.keys(OS.wins || {}).some((id) => id === 'files' || String(id).startsWith('files-'));
  if(hasFilesWindow && typeof window.renderFiles === 'function'){
    window.renderFiles(OS.filesCwd || 'home');
  }
}
window.desktopReceiveExternalFile = desktopReceiveExternalFile;

function setDesktopSetting(key, value){
  OS.desktopSettings = normalizeDesktopSettings({
    ...(OS.desktopSettings || {}),
    [key]: value,
  });
  renderDesktopIcons();
}

window.setDesktopSetting = setDesktopSetting;

function renderDesktopIcons(){
  const layer = ensureDesktopLayer();
  if(!layer) return;
  OS.desktopSettings = normalizeDesktopSettings(OS.desktopSettings);
  const settings = OS.desktopSettings;
  layer.style.setProperty('--desk-icon-size', `${settings.iconSize}px`);
  layer.style.setProperty('--desk-grid-gap', `${settings.gridGap}px`);
  layer.classList.toggle('hide-labels', !settings.showLabels);
  layer.classList.toggle('hidden', !settings.showIcons);
  if(!settings.showIcons){
    layer.innerHTML = '';
    desktopSelectedIdx = -1;
    return;
  }
  const items = getDesktopItems();
  const positions = computeDesktopPositions(items, layer, settings);
  layer.innerHTML = items.map((item, idx) => {
    const ext = String(item?.ext || '').toLowerCase();
    const color = item.type === 'dir'
      ? String(item.color || '#c8f0a0')
      : (item.type === 'app' ? '#7dd3fc' : (DESKTOP_EXT_COLORS[ext] || '#8c8c8c'));
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8c8c8c';
    const rgb = hexToRgb(safeColor);
    const kind = item.type === 'dir' ? 'dir' : (item.type === 'app' ? 'app' : 'file');
    const icon = item.type === 'dir'
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 4c0-.6.4-1 1-1h3l1 1h6a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/></svg>`
      : (item.type === 'app'
        ? getAppIconSvg(resolveShortcutAppId(item))
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3"/></svg>`);
    const displayName = getEntryDisplayName(item);
    const pos = positions[idx] || getDesktopGridPosition(idx, layer, settings);
    return `<button class="desk-item desk-item-${kind}" data-idx="${idx}" title="${escapeHtml(displayName)}" style="left:${pos.x}px;top:${pos.y}px;--desk-accent:${safeColor};--desk-item-rgb:${rgb}">
      <span class="desk-item-icon">${icon}</span>
      <span class="desk-item-label">${escapeHtml(displayName)}</span>
    </button>`;
  }).join('');
  if(desktopSelectedIdx >= items.length) desktopSelectedIdx = -1;
  syncDesktopSelection();
}

window.renderDesktopIcons = renderDesktopIcons;

function renderStartMenu(){
  if(!startMenu) return;
  const apps = getStartApps();
  startMenu.innerHTML = `
    <div class="start-head">all apps</div>
    <div class="start-search-wrap">
      <input id="start-search" class="start-search" placeholder="search apps..." autocomplete="off" spellcheck="false">
    </div>
    <div class="start-list">
      ${apps.map(app => {
        const action = getStartActionForApp(app);
        const badge = action === 'install'
          ? `<span style="margin-left:auto;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);opacity:.88">install</span>`
          : '';
        return `
        <div class="start-row" data-launch="${app.id}" data-type="${app.type}" data-name="${app.name.toLowerCase()}" data-action="${action}">
          <button class="start-app-btn" title="${escapeHtml(app.name)}" aria-label="open ${escapeHtml(app.name)}">
            <span class="start-app-icon">${getStartAppIconSvg(app)}</span>
            <span class="start-app-name">${escapeHtml(app.name)}</span>
            ${badge}
          </button>
        </div>
      `;
      }).join('')}
    </div>
  `;
  const rows=[...startMenu.querySelectorAll('.start-row[data-launch]')];
  if(rows[0]) rows[0].classList.add('selected');
}

function showStartMenu(){
  renderStartMenu();
  if(startMenu && startBtn){
    const menuW = startMenu.offsetWidth || 270;
    const btnRect = startBtn.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - menuW - margin, btnRect.left + ((btnRect.width - menuW) / 2)));
    const bottom = Math.round(window.innerHeight - btnRect.top + 8);
    startMenu.style.left = `${Math.round(left)}px`;
    startMenu.style.bottom = `${bottom}px`;
  }
  startMenu.classList.add('show');
  startOpen = true;
  const inp = document.getElementById('start-search');
  if(inp) setTimeout(()=>inp.focus(),10);
}

function hideStartMenu(){
  if(!startMenu) return;
  startMenu.classList.remove('show');
  startOpen = false;
}

function toggleStartMenu(){
  if(startOpen) hideStartMenu();
  else showStartMenu();
}

// ═══════════════════════════════════
// RIGHT CLICK MENU
// ═══════════════════════════════════
const ctxMenu = document.getElementById('ctx-menu');

function showCtx(x,y,items){
  ctxMenu.innerHTML='';
  items.forEach(item=>{
    if(item==='sep'){
      const s=document.createElement('div'); s.className='ctx-sep'; ctxMenu.appendChild(s); return;
    }
    const btn=document.createElement('button'); btn.className='ctx-item';
    if(item.iconSvg){
      const icon = document.createElement('span');
      icon.className = 'ctx-icon';
      icon.innerHTML = String(item.iconSvg);
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(String(item.label || '')));
    } else if(item.icon){
      const icon = document.createElement('span');
      icon.className = 'ctx-icon';
      icon.textContent = String(item.icon);
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(String(item.label || '')));
    } else btn.textContent=String(item.label || '');
    if(item.danger) btn.classList.add('danger');
    btn.addEventListener('click',()=>{hideCtx();item.action();});
    ctxMenu.appendChild(btn);
  });
  ctxMenu.style.display='block';
  const mw=ctxMenu.offsetWidth, mh=ctxMenu.offsetHeight;
  ctxMenu.style.left=Math.min(x,window.innerWidth-mw-8)+'px';
  ctxMenu.style.top=Math.min(y,window.innerHeight-mh-8)+'px';
  ctxMenu.classList.add('show');
}

function openNewWindowForApp(appId){
  if(!appId) return;
  launchApp(appId, { forceNew:true });
}

function closeAppWindows(appId){
  const ids = getAppWindowIds(appId);
  if(!ids.length) return;
  ids.forEach((id) => closeWin(id));
}

function hideCtx(){
  ctxMenu.classList.remove('show');
  setTimeout(()=>ctxMenu.style.display='none',120);
}

function openDesktopSettings(){
  launchApp('settings');
  setTimeout(() => {
    const appearanceTab = document.querySelector('#win-settings .app-sidebar-item[data-panel="appearance"]');
    appearanceTab?.click();
    const search = document.querySelector('#win-settings #settings-search');
    if(search){
      search.value = 'desktop';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 150);
}

document.addEventListener('contextmenu',e=>{
  const target = e.target;
  hideTaskbarWindowPreviews();
  if(target && target.closest && target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable]:not([contenteditable="false"])')){
    return;
  }
  if(e.target.closest('#win-files') && typeof window.filesHandleContextMenu === 'function') return;
  e.preventDefault();
  const tbBtn=e.target.closest('.tb-btn[data-app]');
  const win=e.target.closest('.win');
  const deskItem = e.target.closest('#desktop-icons .desk-item');
  const desktopSurface = e.target.closest('#desktop');

  if(tbBtn){
    const id=tbBtn.dataset.app;
    const windowIds = getAppWindowIds(id);
    const isOpen = windowIds.length > 0;
    const isPinned=!OS.taskbarHidden.includes(id);
    const app = findLaunchableApp(id);
    const label = app?.name || id;
    showCtx(e.clientX,e.clientY,[
      {label, iconSvg:getAppIconSvg(id), action:()=>openNewWindowForApp(id)},
      'sep',
      isOpen ? {label:windowIds.length > 1 ? 'close all windows' : 'close',action:()=>closeAppWindows(id),danger:true} : null,
      isOpen ? 'sep' : null,
      isPinned ? {label:'unpin from taskbar',action:()=>unpinApp(id)} : {label:'pin to taskbar',action:()=>pinApp(id)},
    ].filter(Boolean));
    return;
  }

  if(deskItem){
    const idx = Number.parseInt(deskItem.dataset.idx || '', 10);
    const item = getDesktopItems()[idx];
    if(!item) return;
    desktopSelectedIdx = idx;
    syncDesktopSelection();
    const ext = String(item.ext || '').toLowerCase();
    showCtx(e.clientX,e.clientY,[
      {label:'open', action:()=>desktopOpenItem(idx)},
      item.type === 'dir' ? {label:'open in files', action:()=>desktopOpenItem(idx)} : null,
      item.type === 'file' && window.TEXT_EXTS?.has(ext) ? {label:'open in notes', action:()=>window.notesOpenFile?.(item)} : null,
      item.type === 'file' && window.IMAGE_EXTS?.has(ext) ? {label:'open in photos', action:()=>window.photosOpenFile?.(item)} : null,
      'sep',
      {label:'rename', action:()=>desktopRenameItem(idx)},
      {label:'duplicate', action:()=>desktopDuplicateItem(idx)},
      {label:'delete', action:()=>desktopDeleteItem(idx), danger:true},
    ].filter(Boolean));
    return;
  }

  if(desktopSurface && !win){
    showCtx(e.clientX,e.clientY,[
      {label:'new folder', action:desktopCreateFolder},
      {label:'new text file', action:()=>desktopCreateTextFile('txt')},
      {label:'new app shortcut', action:desktopCreateAppShortcut},
      'sep',
      {label:'open desktop folder', action:()=>openDirInFiles('desktop')},
      {label:'refresh desktop', action:renderDesktopIcons},
      'sep',
      {label:'desktop settings', action:openDesktopSettings},
      {label:'terminal',action:()=>launchApp('terminal')},
      {label:'files',action:()=>launchApp('files')},
      {label:'settings',action:()=>launchApp('settings')},
    ]);
    return;
  }

  if(win){
    const id=win.id.replace('win-','');
    showCtx(e.clientX,e.clientY,[
      {label:'minimize',action:()=>minWin(id)},
      {label:'maximize',action:()=>maxWin(id)},
      {label:'snap left',action:()=>snapWin(id,'left')},
      {label:'snap right',action:()=>snapWin(id,'right')},
      'sep',
      {label:'close',action:()=>closeWin(id),danger:true},
    ]); return;
  }

  showCtx(e.clientX,e.clientY,[
    {label:'terminal',action:()=>launchApp('terminal')},
    {label:'files',action:()=>launchApp('files')},
    'sep',
    {label:'settings',action:()=>launchApp('settings')},
  ]);
});

document.addEventListener('click',e=>{
  if(!ctxMenu.contains(e.target)) hideCtx();
  if(startOpen && startMenu && startBtn && !startMenu.contains(e.target) && !startBtn.contains(e.target)) hideStartMenu();
  if(notifCenterOpen && notifCenter && bellEl && !notifCenter.contains(e.target) && !bellEl.contains(e.target)) hideNotifCenter();
  if(cmdkOpen && cmdkEl && !cmdkEl.contains(e.target)) closeCmdk();
  if(tbWinPreviewEl && !tbWinPreviewEl.contains(e.target) && !e.target.closest('.tb-btn[data-app]')) hideTaskbarWindowPreviews();
  if(e.target.closest('#desktop') && !e.target.closest('.win') && !e.target.closest('#desktop-icons .desk-item')) clearDesktopSelection();
});
document.addEventListener('keydown',e=>{
  if((e.key === 'Delete' || e.key === 'Backspace') && !isTextInputTarget(e.target) && !e.target.closest('.win') && desktopSelectedIdx > -1){
    e.preventDefault();
    desktopDeleteItem(desktopSelectedIdx);
    return;
  }
  if(e.key==='Escape'){
    hideCtx();
    hideTaskbarWindowPreviews();
    if(notifCenterOpen) hideNotifCenter();
    if(cmdkOpen) closeCmdk();
  }
});

if(startBtn && startMenu){
  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleStartMenu();
  });

  startMenu.addEventListener('click', e => {
    const row = e.target.closest('[data-launch]');
    if(!row) return;
    const app = { id:row.dataset.launch, type:row.dataset.type };
    if(row.dataset.action === 'install'){
      installFromStart(app.id);
      renderStartMenu();
      return;
    }
    launchFromStart(app);
  });

  startMenu.addEventListener('contextmenu', e => {
    const row = e.target.closest('.start-row[data-launch]');
    if(!row) return;
    e.preventDefault();
    e.stopPropagation();
    const app = { id: row.dataset.launch, type: row.dataset.type || 'core', name: row.dataset.name || row.dataset.launch };
    const rowAction = row.dataset.action || 'open';
    const isCore = app.type === 'core';
    const hasTaskbarEntry = !!document.querySelector(`.tb-btn[data-app="${app.id}"]`) || isCore;
    const isPinned = !OS.taskbarHidden.includes(app.id);
    showCtx(e.clientX, e.clientY, [
      rowAction === 'install'
        ? {label:'install', action:()=>{ installFromStart(app.id); renderStartMenu(); }}
        : {label:'open', action:()=>launchFromStart(app)},
      hasTaskbarEntry ? (isPinned
        ? {label:'unpin from taskbar', action:()=>{ unpinApp(app.id); renderStartMenu(); }}
        : {label:'pin to taskbar', action:()=>{ pinApp(app.id); renderStartMenu(); }}) : null,
    ].filter(Boolean));
  });

  startMenu.addEventListener('input', e => {
    if(e.target.id !== 'start-search') return;
    const q = e.target.value.trim().toLowerCase();
    startMenu.querySelectorAll('.start-row[data-name]').forEach(row => {
      row.style.display = row.dataset.name.includes(q) ? 'flex' : 'none';
    });
    const visibleRows = [...startMenu.querySelectorAll('.start-row[data-launch]')].filter(r=>r.style.display!=='none');
    startMenu.querySelectorAll('.start-row.selected').forEach(r=>r.classList.remove('selected'));
    if(visibleRows[0]) visibleRows[0].classList.add('selected');
  });

  startMenu.addEventListener('keydown', e => {
    const rows = [...startMenu.querySelectorAll('.start-row[data-launch]')].filter(r=>r.style.display!=='none');
    if(!rows.length) return;
    let idx = rows.findIndex(r=>r.classList.contains('selected'));
    if(e.key==='ArrowDown'){
      e.preventDefault();
      idx = Math.min(rows.length-1, idx<0?0:idx+1);
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      idx = Math.max(0, idx<0?0:idx-1);
    } else if(e.key==='Enter'){
      e.preventDefault();
      if(idx<0) idx=0;
      rows[idx].click();
      return;
    } else if(e.key==='Escape'){
      hideStartMenu();
      return;
    } else return;
    rows.forEach(r=>r.classList.remove('selected'));
    rows[idx].classList.add('selected');
  });
}

if(bellEl && notifCenter){
  bellEl.addEventListener('click',e=>{
    e.stopPropagation();
    toggleNotifCenter();
  });
  notifCenter.addEventListener('click',e=>{
    const btn = e.target.closest('[data-dismiss]');
    if(!btn) return;
    const id = btn.dataset.dismiss;
    OS.notifHistory = OS.notifHistory.filter(n => String(n.id||'') !== String(id));
    saveOS();
    renderNotifCenter();
  });
}
if(cmdkEl){
  cmdkEl.addEventListener('input',e=>{
    if(!cmdkOpen || e.target.id!=='cmdk-input') return;
    cmdkSelectedIdx = 0;
    renderCmdk(e.target.value || '');
  });
  cmdkEl.addEventListener('click',e=>{
    const row = e.target.closest('[data-cmdk]');
    if(!row) return;
    cmdkSelectedIdx = parseInt(row.dataset.cmdk,10) || 0;
    runCmdkSelected();
  });
}

// ═══════════════════════════════════
// WINDOW MANAGER
// ═══════════════════════════════════
function createWin(id,title,width,height,content,{x,y}={}){
  const baseId = String(id || '').split('-')[0];
  let winId = String(id || baseId || 'win');
  if(OS.wins[winId]){
    let n = 2;
    while(OS.wins[`${baseId}-${n}`]) n++;
    winId = `${baseId}-${n}`;
  }
  const desk=document.getElementById('desktop');
  const dw=desk.offsetWidth, dh=desk.offsetHeight;
  const wx=x??Math.max(20,Math.min(dw-width-20,80+Math.random()*120));
  const wy=y??Math.max(10,Math.min(dh-height-20,40+Math.random()*80));
  const el=document.createElement('div');
  el.className='win'; el.id='win-'+winId;
  el.style.cssText=`width:${width}px;height:${height}px;left:${wx}px;top:${wy}px;opacity:0;transform:scale(.93) translateY(10px);z-index:${++OS.zBase}`;
  el.innerHTML=`
    <div class="win-bar">
      <div class="win-title">${title}</div>
      <div class="win-btns">
        <button class="wbtn mx" data-max="${winId}"></button>
        <button class="wbtn mn" data-min="${winId}"></button>
        <button class="wbtn cl" data-close="${winId}"></button>
      </div>
    </div>
    <div class="win-body">${content}</div>
    <div class="win-rz win-rz-n" data-rz-dir="n"></div>
    <div class="win-rz win-rz-s" data-rz-dir="s"></div>
    <div class="win-rz win-rz-e" data-rz-dir="e"></div>
    <div class="win-rz win-rz-w" data-rz-dir="w"></div>
    <div class="win-rz win-rz-ne" data-rz-dir="ne"></div>
    <div class="win-rz win-rz-nw" data-rz-dir="nw"></div>
    <div class="win-rz win-rz-se" data-rz-dir="se"></div>
    <div class="win-rz win-rz-sw" data-rz-dir="sw"></div>`;
  desk.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.transition='transform .22s cubic-bezier(.34,1.3,.64,1),opacity .18s';
    el.style.opacity='1'; el.style.transform='scale(1) translateY(0)';
  }));
  setTimeout(()=>{el.style.transition='';},240);
  makeDraggable(el);
  makeResizable(el);
  el.addEventListener('mousedown',()=>focusWin(winId),true);
  el.querySelector('[data-close]').addEventListener('click',e=>{e.stopPropagation();closeWin(winId);});
  el.querySelector('[data-min]').addEventListener('click',e=>{e.stopPropagation();minWin(winId);});
  el.querySelector('[data-max]').addEventListener('click',e=>{e.stopPropagation();maxWin(winId);});
  OS.wins[winId]={el,title,minimized:false,maximized:false,prevRect:null,workspace:OS.currentWorkspace,appId:baseId};
  el.dataset.workspace = String(OS.currentWorkspace);
  el.dataset.appId = baseId;
  focusWin(winId);
  updateTbBtn(winId,true);
  saveSessionWindows();
  return el;
}

function focusWin(id){
  if(!OS.wins[id])return;
  if((OS.wins[id].workspace||1)!==OS.currentWorkspace){
    switchWorkspace(OS.wins[id].workspace||1,true);
  }
  document.querySelectorAll('.win').forEach(w=>w.classList.remove('focused'));
  const w=OS.wins[id];
  w.el.style.zIndex=++OS.zBase;
  w.el.classList.add('focused');
  if(w.minimized){
    w.el.style.display='flex';
    w.el.style.transition='transform .2s cubic-bezier(.34,1.4,.64,1),opacity .18s';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{w.el.style.transform='translate(0,0) scale(1)';w.el.style.opacity='1';}));
    setTimeout(()=>{w.el.style.transition='';},200);
    w.minimized=false;
  }
  OS.focused=id;
  const titleEl=document.getElementById('tb-active-title');
  titleEl.textContent=w.title.toLowerCase();
  titleEl.classList.add('lit');
  document.querySelectorAll('.tb-btn').forEach(b=>{
    const a=b.dataset.app; if(!a)return;
    b.classList.toggle('active',a===id||id.startsWith(a));
  });
}

function closeWin(id){
  const w=OS.wins[id]; if(!w)return;
  if(typeof window.appCanClose === 'function'){
    try{
      const canClose = window.appCanClose(id);
      if(canClose === false) return;
    }catch{}
  }
  w.el.style.transition='transform .15s ease,opacity .15s ease';
  w.el.style.transform='scale(.92) translateY(8px)'; w.el.style.opacity='0';
  setTimeout(()=>{
    w.el.remove(); delete OS.wins[id]; updateTbBtn(id,false);
    if(OS.focused===id){
      OS.focused=null;
      const t=document.getElementById('tb-active-title');
      t.textContent=''; t.classList.remove('lit');
      document.querySelectorAll('.tb-btn').forEach(b=>b.classList.remove('active'));
    }
    saveSessionWindows();
  },150);
}

function minWin(id){
  const w=OS.wins[id]; if(!w||w.minimized)return;
  const wr = w.el.getBoundingClientRect();
  const btn = document.querySelector(`.tb-btn[data-app="${id}"]`) || document.querySelector(`.tb-btn[data-app="${id.split('-')[0]}"]`);
  const tr = btn ? btn.getBoundingClientRect() : {left:window.innerWidth/2, top:window.innerHeight-14, width:0, height:0};
  const wx = wr.left + wr.width/2, wy = wr.top + wr.height/2;
  const tx = tr.left + tr.width/2, ty = tr.top + tr.height/2;
  const dx = tx-wx, dy = ty-wy;
  w.el.style.transition='transform .34s cubic-bezier(.12,.78,.18,1),opacity .34s ease,filter .34s ease';
  w.el.style.transform=`translate(${dx}px,${dy}px) scale(.06)`;
  w.el.style.opacity='0';
  w.el.style.filter='blur(1px)';
  setTimeout(()=>{
    w.el.style.display='none';
    w.el.style.transition='';
    w.el.style.transform='translate(0,0) scale(1)';
    w.el.style.opacity='1';
    w.el.style.filter='';
    w.minimized=true;
    saveSessionWindows();
  },340);
  if(OS.focused===id){OS.focused=null; document.getElementById('tb-active-title').textContent='';}
}

function maxWin(id){
  const w=OS.wins[id]; if(!w)return;
  const desk=document.getElementById('desktop');
  w.el.style.transition='left .26s cubic-bezier(.22,.61,.36,1),top .26s cubic-bezier(.22,.61,.36,1),width .26s cubic-bezier(.22,.61,.36,1),height .26s cubic-bezier(.22,.61,.36,1),transform .2s cubic-bezier(.22,.61,.36,1),opacity .2s ease';
  w.el.style.transform='translate(0,0) scale(1)';
  w.el.style.opacity='1';
  if(w.maximized){
    const r=w.prevRect;
    w.el.style.left=r.left+'px'; w.el.style.top=r.top+'px';
    w.el.style.width=r.width+'px'; w.el.style.height=r.height+'px';
    w.maximized=false;
  } else {
    w.prevRect={left:parseInt(w.el.style.left),top:parseInt(w.el.style.top),width:w.el.offsetWidth,height:w.el.offsetHeight};
    w.el.style.left='0'; w.el.style.top='0';
    w.el.style.width=desk.offsetWidth+'px'; w.el.style.height=desk.offsetHeight+'px';
    w.maximized=true;
  }
  setTimeout(()=>{
    if(OS.wins[id]) w.el.style.transition='';
    saveSessionWindows();
  },280);
}

function snapWin(id,zone){
  const w=OS.wins[id]; if(!w) return;
  const desk=document.getElementById('desktop');
  w.el.style.transition='left .22s cubic-bezier(.22,.61,.36,1),top .22s cubic-bezier(.22,.61,.36,1),width .22s cubic-bezier(.22,.61,.36,1),height .22s cubic-bezier(.22,.61,.36,1)';
  if(!w.maximized){
    w.prevRect={left:parseInt(w.el.style.left)||0,top:parseInt(w.el.style.top)||0,width:w.el.offsetWidth,height:w.el.offsetHeight};
  }
  if(zone==='left'){
    w.el.style.left='0';
    w.el.style.top='0';
    w.el.style.width=Math.floor(desk.offsetWidth/2)+'px';
    w.el.style.height=desk.offsetHeight+'px';
    w.maximized=false;
  } else if(zone==='right'){
    w.el.style.left=Math.floor(desk.offsetWidth/2)+'px';
    w.el.style.top='0';
    w.el.style.width=Math.floor(desk.offsetWidth/2)+'px';
    w.el.style.height=desk.offsetHeight+'px';
    w.maximized=false;
  } else if(zone==='top'){
    w.el.style.left='0';
    w.el.style.top='0';
    w.el.style.width=desk.offsetWidth+'px';
    w.el.style.height=desk.offsetHeight+'px';
    w.maximized=true;
  } else if(zone==='top-left' || zone==='top-right' || zone==='bottom-left' || zone==='bottom-right'){
    const halfW = Math.floor(desk.offsetWidth/2);
    const halfH = Math.floor(desk.offsetHeight/2);
    const left = zone.includes('right') ? halfW : 0;
    const top = zone.includes('bottom') ? halfH : 0;
    w.el.style.left=left+'px';
    w.el.style.top=top+'px';
    w.el.style.width=halfW+'px';
    w.el.style.height=halfH+'px';
    w.maximized=false;
  }
  setTimeout(()=>{
    if(OS.wins[id]) w.el.style.transition='';
    saveSessionWindows();
  },240);
}

function updateTbBtn(id,running){
  const appId = id.split('-')[0];
  let btn=document.querySelector(`.tb-btn[data-app="${id}"]`)||document.querySelector(`.tb-btn[data-app="${appId}"]`);
  if(!btn && running && CORE_APPS.some((a)=>a.id===appId)){
    const host = document.getElementById('tb-apps');
    if(host){
      btn = document.createElement('button');
      btn.className = 'tb-btn tb-temp';
      btn.dataset.app = appId;
      btn.setAttribute('aria-label', `open ${appId}`);
      btn.onclick = () => window.onTaskbarAppClick?.(appId);
      const icon = CORE_TASKBAR_SVG[appId] || `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`;
      btn.innerHTML = `${icon}<div class="tb-dot"></div><div class="tb-tip">${appId}</div>`;
      const sep = host.querySelector('.tb-sep');
      if(sep) host.insertBefore(btn, sep);
      else host.appendChild(btn);
    }
  }
  const stillRunning = running || getAppWindowIds(appId).length > 0;
  if(btn){
    btn.classList.toggle('running',stillRunning);
    syncTaskbarButtonState(btn, appId);
    if(!stillRunning && btn.classList.contains('tb-temp')) btn.remove();
  }
}

function makeDraggable(win){
  const bar=win.querySelector('.win-bar');
  if(!bar) return;
  let ox,oy,sx,sy,dragging=false,snapZone='';
  bar.addEventListener('mousedown',e=>{
    if(e.target.closest('.win-btns,.wbtn'))return;
    dragging=true; ox=parseInt(win.style.left)||0; oy=parseInt(win.style.top)||0;
    sx=e.clientX; sy=e.clientY; win.style.transition='none'; e.preventDefault();
    if(typeof window.__setCursorMode === 'function') window.__setCursorMode('move',{lock:true});
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const desk=document.getElementById('desktop');
    win.style.left=Math.max(-win.offsetWidth+60,ox+(e.clientX-sx))+'px';
    win.style.top=Math.max(0,Math.min(desk.offsetHeight-30,oy+(e.clientY-sy)))+'px';
    const edge=34;
    if(e.clientX < edge && e.clientY < edge) snapZone='top-left';
    else if(e.clientX > window.innerWidth-edge && e.clientY < edge) snapZone='top-right';
    else if(e.clientX < edge && e.clientY > window.innerHeight-edge-56) snapZone='bottom-left';
    else if(e.clientX > window.innerWidth-edge && e.clientY > window.innerHeight-edge-56) snapZone='bottom-right';
    else if(e.clientY < edge) snapZone='top';
    else if(e.clientX < edge) snapZone='left';
    else if(e.clientX > window.innerWidth-edge) snapZone='right';
    else snapZone='';
    snapOverlay.className = snapZone ? `show ${snapZone}` : '';
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging) return;
    dragging=false;
    if(snapZone){
      const id = win.id.replace('win-','');
      snapWin(id,snapZone);
    }
    snapZone='';
    snapOverlay.className='';
    if(typeof window.__setCursorMode === 'function') window.__setCursorMode('default',{unlock:true});
    saveSessionWindows();
  });
}

function makeResizable(win){
  if(!win) return;
  let state = null;
  const handles = win.querySelectorAll('.win-rz');
  handles.forEach(handle=>{
    const dir = handle.dataset.rzDir || 'se';
    handle.addEventListener('mouseenter',()=>{
      if(state) return;
      if(typeof window.__setCursorMode === 'function') window.__setCursorMode('resize',{dir});
    });
    handle.addEventListener('mouseleave',()=>{
      if(state) return;
      if(typeof window.__setCursorMode === 'function') window.__setCursorMode('default');
    });
  });
  win.addEventListener('mousedown',e=>{
    const handle = e.target.closest('.win-rz');
    if(!handle || !win.contains(handle)) return;
    const dir = handle.dataset.rzDir || 'se';
    state = {
      dir,
      sx:e.clientX,
      sy:e.clientY,
      left:parseInt(win.style.left,10) || 0,
      top:parseInt(win.style.top,10) || 0,
      width:win.offsetWidth,
      height:win.offsetHeight,
    };
    const id = win.id.replace('win-','');
    if(OS.wins[id]) OS.wins[id].maximized = false;
    win.style.transition='none';
    if(typeof window.__setCursorMode === 'function') window.__setCursorMode('resize',{dir,lock:true});
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('mousemove',e=>{
    if(!state) return;
    const minW = 340, minH = 220;
    const dx = e.clientX - state.sx;
    const dy = e.clientY - state.sy;
    let w = state.width;
    let h = state.height;
    let l = state.left;
    let t = state.top;

    if(state.dir.includes('e')) w = state.width + dx;
    if(state.dir.includes('s')) h = state.height + dy;
    if(state.dir.includes('w')){
      w = state.width - dx;
      l = state.left + dx;
      if(w < minW){ l -= (minW - w); w = minW; }
    }
    if(state.dir.includes('n')){
      h = state.height - dy;
      t = state.top + dy;
      if(h < minH){ t -= (minH - h); h = minH; }
      if(t < 0){ h += t; t = 0; if(h < minH) h = minH; }
    }
    w = Math.max(minW,w);
    h = Math.max(minH,h);

    win.style.left = l+'px';
    win.style.top = t+'px';
    win.style.width = w+'px';
    win.style.height = h+'px';
  });
  document.addEventListener('mouseup',()=>{
    if(!state) return;
    state = null;
    if(typeof window.__setCursorMode === 'function') window.__setCursorMode('default',{unlock:true});
    saveSessionWindows();
  });
}

function routeDroppedFileToApp(appId, fileData){
  if(!appId || !fileData) return;
  if(appId==='notes' && typeof window.notesReceiveFile==='function'){ window.notesReceiveFile(fileData); return; }
  if(appId==='photos' && typeof window.photosReceiveFile==='function'){ window.photosReceiveFile(fileData); return; }
  if(appId==='music' && typeof window.musicReceiveFile==='function'){ window.musicReceiveFile(fileData); return; }
  if(appId==='browser' && typeof window.browserReceiveFile==='function'){ window.browserReceiveFile(fileData); return; }
  if(appId==='terminal' && typeof window.terminalReceiveFile==='function'){ window.terminalReceiveFile(fileData); return; }
  if(appId==='files' && typeof window.filesReceiveExternalFile==='function'){ window.filesReceiveExternalFile(fileData); return; }
  if(appId==='draw' && typeof window.drawReceiveFile==='function'){ window.drawReceiveFile(fileData); return; }
  if(CORE_APPS.some(a=>a.id===appId)) launchApp(appId);
  else if(typeof launchInstalledApp==='function') launchInstalledApp(appId);
  notify('drag drop', `${fileData.name} -> ${appId}`);
}

document.addEventListener('dragover',e=>{
  const tb = e.target.closest('.tb-btn[data-app]');
  const win = e.target.closest('.win');
  const desktopSurface = e.target.closest('#desktop');
  if(!tb && !win && !desktopSurface) return;
  const has = e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('application/x-oblivion-file');
  if(!has) return;
  e.preventDefault();
  if(desktopSurface && !tb && !win) return;
  document.querySelectorAll('.tb-btn.drop-ready').forEach(el=>el.classList.remove('drop-ready'));
  if(tb) tb.classList.add('drop-ready');
  if(win) win.classList.add('drop-ready');
});
document.addEventListener('dragleave',e=>{
  const t = e.target.closest('.tb-btn.drop-ready,.win.drop-ready');
  if(t) t.classList.remove('drop-ready');
});
document.addEventListener('drop',e=>{
  const raw = e.dataTransfer?.getData('application/x-oblivion-file');
  if(!raw) return;
  const tb = e.target.closest('.tb-btn[data-app]');
  const win = e.target.closest('.win');
  const desktopSurface = e.target.closest('#desktop');
  if(!tb && !win && !desktopSurface) return;
  e.preventDefault();
  document.querySelectorAll('.tb-btn.drop-ready,.win.drop-ready').forEach(el=>el.classList.remove('drop-ready'));
  let data=null;
  try{ data=JSON.parse(raw); }catch(err){ data=null; }
  if(!data) return;
  if(tb) routeDroppedFileToApp(tb.dataset.app, data);
  else if(win){
    const id = win.id.replace('win-','');
    routeDroppedFileToApp(id, data);
  } else if(desktopSurface && typeof desktopReceiveExternalFile === 'function'){
    desktopReceiveExternalFile(data, { clientX:e.clientX, clientY:e.clientY });
  }
});

// ═══════════════════════════════════
// APP LAUNCHER
// ═══════════════════════════════════
function launchApp(id, options = {}){
  hideStartMenu();
  hideTaskbarWindowPreviews();
  markRecentApp(id,'core');
  const appId = String(id || '');
  const forceNew = !!options.forceNew;
  const prevForce = window.__forceNewWindowAppId;
  if(forceNew) window.__forceNewWindowAppId = appId;
  if(!forceNew && window.focusAnyAppWindow?.(appId)) return;
  try{
  switch(id){
    case 'calculator': launchCalculator(); break;
    case 'browser':  launchBrowser();  break;
    case 'clock': launchClock(); break;
    case 'draw': launchDraw(); break;
    case 'terminal': launchTerminal(); break;
    case 'files':    launchFiles();    break;
    case 'music':    launchMusic();    break;
    case 'notes':    launchNotes();    break;
    case 'photos':   launchPhotos();   break;
    case 'account':  launchAccount();  break;
    case 'settings': launchSettings(); break;
    case 'calendar': launchCalendar(); break;
    case 'weather': launchWeather(); break;
  }
  } finally {
    window.__forceNewWindowAppId = prevForce || '';
  }
}

// ═══════════════════════════════════
// UTILS
// ═══════════════════════════════════
function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);
const TEXT_EXTS = new Set(['txt','md','json','js','css','html','csv','log']);

function addFileToDir(dir, file){
  if(!OS.files[dir]) OS.files[dir] = [];
  const used = new Set((OS.files[dir]||[]).map(i=>String(i.name||'').toLowerCase()));
  let name = file.name || `untitled.${file.ext||'txt'}`;
  if(used.has(name.toLowerCase())){
    const dot = name.lastIndexOf('.');
    const base = dot>0 ? name.slice(0,dot) : name;
    const ext = dot>0 ? name.slice(dot) : '';
    let n=2;
    while(used.has(`${base} ${n}${ext}`.toLowerCase())) n++;
    name = `${base} ${n}${ext}`;
  }
  const item = { ...file, name };
  OS.files[dir].push(item);
  saveOS();
  return item;
}

function resolveOSFileRef(fileData){
  const name = String(fileData?.name || '');
  const fromDir = String(fileData?.fromDir || fileData?.dir || '');
  if(!name || !fromDir || !Array.isArray(OS.files[fromDir])) return null;
  return OS.files[fromDir].find((item)=>item && item.type==='file' && String(item.name)===name) || null;
}

function downloadTextFile(filename, text, mime='text/plain'){
  const blob = new Blob([text], { type:mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },120);
}

window.addFileToDir = addFileToDir;
window.downloadTextFile = downloadTextFile;
window.IMAGE_EXTS = IMAGE_EXTS;
window.TEXT_EXTS = TEXT_EXTS;
window.resolveOSFileRef = resolveOSFileRef;
window.escapeHtml = escapeHtml;
window.normalizeSafeHttpUrl = normalizeSafeHttpUrl;

function createSystemSnapshot(){
  return {
    schema: 'oblivion-snapshot-v1',
    exportedAt: new Date().toISOString(),
    os: {
      accent: OS.accent,
      accentRgb: OS.accentRgb,
      tintId: OS.tintId,
      username: OS.username,
      avatar: OS.avatar,
      installedApps: [...OS.installedApps],
      appVersions: { ...(OS.appVersions||{}) },
      taskbarHidden: [...OS.taskbarHidden],
      focusMode: !!OS.focusMode,
      timeTintEnabled: !!OS.timeTintEnabled,
      bgIntensity: OS.bgIntensity,
      bgVignette: OS.bgVignette,
      bgSettings: JSON.parse(JSON.stringify(OS.bgSettings || {})),
      desktopSettings: JSON.parse(JSON.stringify(OS.desktopSettings || {})),
      filesShowEmpty: true,
      filesCwd: OS.filesCwd,
      browserProxyBase: OS.browserProxyBase || '',
      workspaceCount: OS.workspaceCount,
      currentWorkspace: OS.currentWorkspace,
      soundscapeEnabled: !!OS.soundscapeEnabled,
      soundscapeProfile: OS.soundscapeProfile || 'void',
      soundscapeVolume: OS.soundscapeVolume,
      cursorPerformanceMode: !!OS.cursorPerformanceMode,
      narrativeEnabled: !!OS.narrativeEnabled,
    },
    files: JSON.parse(JSON.stringify(OS.files||{})),
    recycleBin: JSON.parse(JSON.stringify(OS.recycleBin||[])),
  };
}

function exportSystemSnapshot(){
  const data = JSON.stringify(createSystemSnapshot(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `oblivion-snapshot-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 120);
}

function importSystemSnapshotObject(snap){
  if(!snap || snap.schema!=='oblivion-snapshot-v1') throw new Error('invalid snapshot schema');
  const s = snap.os || {};
  const tintFromSnapshot = (
    (typeof s.tintId === 'string' && TINT_PRESETS[s.tintId] && s.tintId)
    || (typeof s.themeId === 'string' && LEGACY_THEME_TO_TINT[s.themeId])
    || (typeof s.accent === 'string' && Object.entries(TINT_PRESETS).find(([,p]) => p.accent.toLowerCase() === s.accent.toLowerCase())?.[0])
    || ''
  );
  if(tintFromSnapshot) OS.tintId = tintFromSnapshot;
  if(typeof s.username === 'string') OS.username = s.username;
  if(typeof s.avatar === 'string') OS.avatar = s.avatar;
  OS.installedApps = Array.isArray(s.installedApps) ? [...new Set(s.installedApps)] : OS.installedApps;
  OS.appVersions = (s.appVersions && typeof s.appVersions === 'object') ? { ...s.appVersions } : {};
  OS.taskbarHidden = Array.isArray(s.taskbarHidden) ? [...new Set(s.taskbarHidden)] : [];
  OS.focusMode = !!s.focusMode;
  OS.timeTintEnabled = !!s.timeTintEnabled;
  if(typeof s.bgIntensity === 'number') OS.bgIntensity = Math.min(1.2, Math.max(.2, s.bgIntensity));
  if(typeof s.bgVignette === 'number') OS.bgVignette = Math.min(1.6, Math.max(0, s.bgVignette));
  if(s.bgSettings && typeof s.bgSettings === 'object') OS.bgSettings = normalizeBgSettings(s.bgSettings);
  if(s.desktopSettings && typeof s.desktopSettings === 'object') OS.desktopSettings = normalizeDesktopSettings(s.desktopSettings);
  OS.filesShowEmpty = true;
  if(typeof s.filesCwd === 'string') OS.filesCwd = s.filesCwd || 'home';
  if(typeof s.browserProxyBase === 'string') OS.browserProxyBase = s.browserProxyBase;
  if(typeof s.workspaceCount === 'number') OS.workspaceCount = Math.max(1, Math.min(6, s.workspaceCount));
  if(typeof s.currentWorkspace === 'number') OS.currentWorkspace = Math.max(1, Math.min(OS.workspaceCount, s.currentWorkspace));
  if(typeof s.soundscapeEnabled === 'boolean') OS.soundscapeEnabled = s.soundscapeEnabled;
  if(typeof s.soundscapeProfile === 'string') OS.soundscapeProfile = s.soundscapeProfile;
  if(typeof s.soundscapeVolume === 'number') OS.soundscapeVolume = Math.min(1, Math.max(0, s.soundscapeVolume));
  if(typeof s.cursorPerformanceMode === 'boolean') OS.cursorPerformanceMode = s.cursorPerformanceMode;
  if(typeof s.narrativeEnabled === 'boolean') OS.narrativeEnabled = s.narrativeEnabled;

  const importedHasDesktop = !!(snap.files && Array.isArray(snap.files.desktop));
  if(snap.files && typeof snap.files === 'object') OS.files = JSON.parse(JSON.stringify(snap.files));
  if(Array.isArray(snap.recycleBin)) OS.recycleBin = JSON.parse(JSON.stringify(snap.recycleBin));
  ensureDesktopFileSystem(!importedHasDesktop);
  OS.desktopSettings = normalizeDesktopSettings(OS.desktopSettings);

  applyTintTheme();
  applyBackgroundTuning();
  applyFocusMode();
  applyCursorPerformanceMode();
  applyTimeTint();
  applySoundscapeState();
  scheduleNarrative();
  applyWorkspaceVisibility();
  syncWorkspaceUI();
  applyTaskbarVisibility();
  renderDesktopIcons();
  saveOS();
}

window.createSystemSnapshot = createSystemSnapshot;
window.exportSystemSnapshot = exportSystemSnapshot;
window.importSystemSnapshotObject = importSystemSnapshotObject;

// ═══════════════════════════════════
// PANIC KEY
// ═══════════════════════════════════
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey) && e.code==='Space'){
    e.preventDefault();
    toggleStartMenu();
    return;
  }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    if(cmdkOpen) closeCmdk();
    else openCmdk();
    return;
  }
  if((e.ctrlKey||e.metaKey) && e.altKey && e.key==='ArrowLeft'){
    e.preventDefault();
    switchWorkspace(Math.max(1, OS.currentWorkspace-1));
    return;
  }
  if((e.ctrlKey||e.metaKey) && e.altKey && e.key==='ArrowRight'){
    e.preventDefault();
    switchWorkspace(Math.min(OS.workspaceCount, OS.currentWorkspace+1));
    return;
  }
  if(e.altKey && e.shiftKey && OS.focused){
    if(e.key==='ArrowLeft'){ e.preventDefault(); snapWin(OS.focused,'left'); return; }
    if(e.key==='ArrowRight'){ e.preventDefault(); snapWin(OS.focused,'right'); return; }
    if(e.key==='ArrowUp'){ e.preventDefault(); snapWin(OS.focused,'top'); return; }
  }
  if(cmdkOpen){
    const inp = document.getElementById('cmdk-input');
    if(e.key==='Escape'){
      e.preventDefault();
      closeCmdk();
      return;
    }
    if(e.key==='ArrowDown'){
      e.preventDefault();
      cmdkSelectedIdx = Math.min(cmdkItems.length-1, cmdkSelectedIdx+1);
      renderCmdk(inp?.value || '');
      return;
    }
    if(e.key==='ArrowUp'){
      e.preventDefault();
      cmdkSelectedIdx = Math.max(0, cmdkSelectedIdx-1);
      renderCmdk(inp?.value || '');
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      runCmdkSelected();
      return;
    }
  }
  const pk = String(localStorage.getItem('panicKey') || '').toLowerCase();
  if(pk && String(e.key || '').toLowerCase() === pk){
    document.body.style.transition='opacity .1s'; document.body.style.opacity='0';
    const panicUrl = normalizeSafeHttpUrl(localStorage.getItem('os-panic-url')) || 'https://clever.com/';
    setTimeout(()=>{
      localStorage.clear();
      location.href = panicUrl;
    },100);
  }
  if(e.key==='Escape'){
    hideCtx();
    if(cmdkOpen){closeCmdk();return;}
    if(notifCenterOpen){hideNotifCenter();return;}
    if(startOpen){hideStartMenu();return;}
    return;
  }
});

// ═══════════════════════════════════
// BOOT
// ═══════════════════════════════════
const BOOT_LINES=[
  {t:0,   cls:'',   text:'oblivionOS boot sequence v0.3.0'},
  {t:80,  cls:'ok', text:'[  ok  ] initializing void kernel...'},
  {t:170, cls:'ok', text:'[  ok  ] mounting filesystem'},
  {t:270, cls:'ok', text:'[  ok  ] calibrating runtime sectors'},
  {t:390, cls:'ok', text:'[  ok  ] loading window compositor'},
  {t:490, cls:'ok', text:'[  ok  ] starting background subsystem'},
  {t:570, cls:'ok', text:'[  ok  ] memory map synchronized'},
  {t:670, cls:'ok', text:`[  ok  ] loading user profile: ${OS.username}`},
  {t:770, cls:'ok', text:`[  ok  ] restoring ${OS.installedApps.length} installed apps`},
  {t:880, cls:'hi', text:'between here and nowhere.'},
  {t:1020,cls:'ok', text:'[  ok  ] boot complete'},
];

function runBoot(){
  const log=document.getElementById('boot-log'); if(!log)return;
  BOOT_LINES.forEach(({t,cls,text})=>{
    setTimeout(()=>{
      const line=document.createElement('span');
      if(cls)line.className=cls;
      line.textContent=text; log.appendChild(line);
    },t);
  });
  setTimeout(()=>{
    document.getElementById('boot').classList.add('done');
    setTimeout(()=>{
      document.getElementById('boot').remove();
      initWorkspaceUI();
      applyWorkspaceVisibility();
      applyTaskbarVisibility();
      renderDesktopIcons();
      if(typeof restoreInstalledApps === 'function') restoreInstalledApps();
      setTimeout(restoreSessionWindows,300);
      requestNotifPerms();
      applySoundscapeState();
      scheduleNarrative();
      setTimeout(()=>notify('oblivionOS',`welcome back, ${OS.username}.`),400);
    },800);
  },1450);
}

const repairedKeys = runSchemaMigrations();
applyTintTheme();
if(repairedKeys.length){
  setTimeout(()=>notify('system',`recovered corrupted data: ${repairedKeys.join(', ')}`),2200);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',runBoot);}
else{runBoot();}

window.addEventListener('beforeunload',saveSessionWindows);

