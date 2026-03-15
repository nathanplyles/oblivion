const STORE_APPS = [
  { id:'notes',      name:'notes',      desc:'minimal notepad',         cat:'productivity', color:'#c8f0a0', src:'apps/mini/notes.js',      version:'1.0.0', latest:'1.2.0' },
  { id:'calculator', name:'calculator', desc:'clean calculator',         cat:'productivity', color:'#7dd3fc', src:'apps/mini/calculator.js', version:'1.0.0', latest:'1.0.0' },
  { id:'draw',       name:'draw',       desc:'digital canvas',           cat:'creative',     color:'#f9a8d4', src:'apps/mini/draw.js',       version:'1.0.0', latest:'1.1.0' },
  { id:'clock',      name:'clock',      desc:'clock & stopwatch',        cat:'utilities',    color:'#fcd34d', src:'apps/mini/clock.js',      version:'1.0.0', latest:'1.0.0' },
  { id:'weather',    name:'weather',    desc:'real-time weather',        cat:'utilities',    color:'#67e8f9', src:'apps/mini/weather.js',    version:'1.0.0', latest:'1.3.0' },
  { id:'games',      name:'games',      desc:'coming soon',              cat:'games',        color:'#a78bfa', src:null,                      version:'0.0.0', latest:'0.0.0' },
];

const STORE_SVG = {
  notes:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
  calculator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h2M8 14h2M12 14h2M16 14h2M8 18h2M12 18h2M16 18h2"/></svg>`,
  draw:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>`,
  clock:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  weather:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.5 19H9a7 7 0 110-14c.47 0 .92.05 1.35.15A5.5 5.5 0 1117.5 19z"/></svg>`,
  games:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="14" rx="3"/><path d="M8 10v4M6 12h4M15 11h2M15 14h2"/></svg>`,
};

const _loadedScripts = new Set();
let _storeMenuDismissHooked = false;

function _semverCmp(a='0.0.0', b='0.0.0'){
  const pa = String(a).split('.').map(n=>parseInt(n,10)||0);
  const pb = String(b).split('.').map(n=>parseInt(n,10)||0);
  for(let i=0;i<3;i++){
    if((pa[i]||0)>(pb[i]||0)) return 1;
    if((pa[i]||0)<(pb[i]||0)) return -1;
  }
  return 0;
}

function _getInstalledVersion(id){
  return (OS.appVersions && OS.appVersions[id]) || (STORE_APPS.find(a=>a.id===id)?.version) || '0.0.0';
}

function _hasUpdate(id){
  const app = STORE_APPS.find(a=>a.id===id);
  if(!app || !OS.installedApps.includes(id)) return false;
  return _semverCmp(_getInstalledVersion(id), app.latest || app.version) < 0;
}

function _loadScript(app) {
  return new Promise((resolve, reject) => {
    if (!app.src) { resolve(); return; }
    if (_loadedScripts.has(app.id)) { resolve(); return; }
    const normalizedPath = String(app.src).replace(/^\.\//, '');
    const alreadyInDom = [...document.querySelectorAll('script[src]')].some((scriptEl) => {
      const src = scriptEl.getAttribute('src') || '';
      const clean = String(src).replace(/^\.\//, '');
      return clean === normalizedPath || clean.endsWith(`/${normalizedPath}`);
    });
    if (alreadyInDom) {
      _loadedScripts.add(app.id);
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = app.src;
    s.onload = () => { _loadedScripts.add(app.id); resolve(); };
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

function launchInstalledApp(id) {
  const app = STORE_APPS.find(a => a.id === id);
  if (!app) { notify('store', `${id} not found`); return; }
  if (!app.src) { notify('store', `${id} coming soon`); return; }
  if (typeof markRecentApp === 'function') markRecentApp(id, 'installed');
  if (_loadedScripts.has(id)) {
    _callLaunch(id);
  } else {
    _loadScript(app).then(() => _callLaunch(id)).catch(() => notify('store', `failed to load ${id}`));
  }
}

function _callLaunch(id) {
  const launchers = {
    notes: 'launchNotes',
    calculator: 'launchCalculator',
    draw: 'launchDraw',
    clock: 'launchClock',
    weather: 'launchWeather',
  };
  const fnName = launchers[id];
  const fn = fnName ? window[fnName] : null;
  if (typeof fn === 'function') fn();
  else notify('store', `${id} not available`);
}

function restoreInstalledApps() {
  OS.installedApps.forEach(id => {
    const app = STORE_APPS.find(a => a.id === id);
    if (!app) return;
    if (!OS.appVersions) OS.appVersions = {};
    if (!OS.appVersions[id]) OS.appVersions[id] = app.version || '1.0.0';
    _loadScript(app).then(() => addTbBtn(id)).catch(() => {});
  });
}

function addTbBtn(id) {
  const app = STORE_APPS.find(a => a.id === id); if (!app) return;
  if (document.querySelector(`.tb-btn[data-app="${id}"]`)) return;
  const tbApps = document.getElementById('tb-apps');
  const btn = document.createElement('button');
  btn.className = 'tb-btn'; btn.dataset.app = id;
  btn.onclick = () => launchInstalledApp(id);
  const svg = (STORE_SVG[id] || '').replace(/stroke-width="1\.5"/, 'stroke-width="1.4"');
  btn.innerHTML = `${svg}<div class="tb-dot"></div><div class="tb-tip">${app.name}</div>`;
  const svgEl = btn.querySelector('svg');
  if (svgEl) svgEl.style.cssText = 'width:17px;height:17px;color:var(--text3)';
  tbApps.appendChild(btn);
  if (typeof syncTaskbarButtonState === 'function') syncTaskbarButtonState(btn, id);
}

function launchStore() {
  if (window.shouldReuseAppWindow?.('store') && window.focusAnyAppWindow?.('store')) return;
  const cats = ['all','productivity','creative','utilities','games','installed'];
  const html = `<div style="display:flex;height:100%;overflow:hidden">
    <div class="app-sidebar" style="width:120px;flex-shrink:0">
      ${cats.map((c,i) => `<div class="app-sidebar-item${i===0?' active':''}" data-cat="${c}">${c}</div>`).join('')}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:16px 20px 8px;flex-shrink:0">
        <input class="inp" id="store-q" placeholder="search apps..." autocomplete="off" spellcheck="false" style="margin:0;width:100%;box-sizing:border-box">
      </div>
      <div id="store-grid" style="flex:1;overflow-y:auto;padding:0 20px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;align-content:start"></div>
    </div>
  </div>`;
  createWin('store', 'app store', 700, 460, html);
  setTimeout(() => {
    if (!_storeMenuDismissHooked) {
      document.addEventListener('click', e => {
        if (!e.target.closest('.store-more-wrap')) closeStoreMenus();
      });
      _storeMenuDismissHooked = true;
    }
    renderStoreGrid('all');
    document.querySelectorAll('.app-sidebar-item[data-cat]').forEach(nav => {
      nav.addEventListener('click', () => {
        document.querySelectorAll('.app-sidebar-item[data-cat]').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        renderStoreGrid(nav.dataset.cat, document.getElementById('store-q').value);
      });
    });
    document.getElementById('store-q').addEventListener('input', e => {
      const active = document.querySelector('.app-sidebar-item[data-cat].active');
      renderStoreGrid(active?.dataset.cat || 'all', e.target.value);
    });
  }, 50);
}

function closeStoreMenus() {
  document.querySelectorAll('#store-grid .store-more-menu.show').forEach(menu => menu.classList.remove('show'));
}

function uninstallInstalledApp(id) {
  if (typeof id === 'object' && id) id = id.id;
  if (!OS.installedApps.includes(id)) return;
  const idx = OS.installedApps.indexOf(id);
  if (idx > -1) OS.installedApps.splice(idx, 1);
  if (OS.appVersions) delete OS.appVersions[id];
  const hiddenIdx = OS.taskbarHidden.indexOf(id);
  if (hiddenIdx > -1) OS.taskbarHidden.splice(hiddenIdx, 1);
  saveOS();
  document.querySelector(`.tb-btn[data-app="${id}"]`)?.remove();
  if (OS.wins[id]) closeWin(id);
  if (typeof renderStartMenu === 'function') renderStartMenu();
  notify('store', `${id} uninstalled`);
  const active = document.querySelector('.app-sidebar-item[data-cat].active')?.dataset.cat || 'all';
  const q = document.getElementById('store-q')?.value || '';
  renderStoreGrid(active, q);
}

function installStoreApp(id, { silent = false } = {}) {
  const app = STORE_APPS.find(a => a.id === id);
  if (!app) return Promise.reject(new Error('app not found'));
  if (!app.src) return Promise.reject(new Error('app coming soon'));
  return _loadScript(app).then(() => new Promise((resolve) => {
    setTimeout(() => {
      if (!OS.installedApps.includes(id)) OS.installedApps.push(id);
      if (!OS.appVersions) OS.appVersions = {};
      OS.appVersions[id] = app.version || '1.0.0';
      saveOS();
      addTbBtn(id);
      if (typeof renderStartMenu === 'function') renderStartMenu();
      if (!silent) notify('store', `${id} installed`);
      resolve({ id, version: OS.appVersions[id] });
    }, 260);
  }));
}

function updateStoreApp(id, { silent = false } = {}) {
  const app = STORE_APPS.find(a => a.id === id);
  if (!app) return Promise.reject(new Error('app not found'));
  if (!OS.installedApps.includes(id)) return Promise.reject(new Error('app not installed'));
  if (!app.src) return Promise.reject(new Error('app coming soon'));
  if (!_hasUpdate(id)) return Promise.resolve({ id, version: _getInstalledVersion(id), unchanged: true });
  return _loadScript(app).then(() => new Promise((resolve) => {
    setTimeout(() => {
      if (!OS.appVersions) OS.appVersions = {};
      OS.appVersions[id] = app.latest || app.version || '1.0.0';
      saveOS();
      if (!silent) notify('store', `${id} updated to ${OS.appVersions[id]}`);
      resolve({ id, version: OS.appVersions[id] });
    }, 240);
  }));
}

function listInstalledStoreApps() {
  return OS.installedApps.map(id => {
    const app = STORE_APPS.find(a => a.id === id) || { id, name: id, latest:'0.0.0', version:'0.0.0' };
    const version = _getInstalledVersion(id);
    return {
      id: app.id,
      name: app.name,
      version,
      latest: app.latest || app.version || version,
      updateAvailable: _hasUpdate(id),
    };
  });
}

function renderStoreGrid(cat, q = '') {
  const grid = document.getElementById('store-grid'); if (!grid) return;
  const isInstalledView = cat === 'installed';
  let apps = cat === 'all' ? STORE_APPS
    : cat === 'installed' ? STORE_APPS.filter(a => OS.installedApps.includes(a.id))
    : STORE_APPS.filter(a => a.cat === cat);
  if (q) apps = apps.filter(a => a.name.includes(q.toLowerCase()) || a.desc.includes(q.toLowerCase()));

  const cards = apps.map(app => {
    const installed = OS.installedApps.includes(app.id);
    const updateAvailable = _hasUpdate(app.id);
    const installedVersion = _getInstalledVersion(app.id);
    const latestVersion = app.latest || app.version || installedVersion;
    const rgb = hexToRgb(app.color);
    return `<div class="store-card${isInstalledView ? ' store-card-installed' : ''}" style="position:relative;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">
      ${isInstalledView ? `<div class="store-more-wrap">
        <button class="store-more-btn" data-more="${app.id}" title="app options" aria-label="app options">
          <span class="store-more-icon"><span></span><span></span><span></span></span>
        </button>
        <div class="store-more-menu" data-menu="${app.id}">
          <button class="store-menu-btn" data-update="${app.id}" ${updateAvailable?'':'disabled'}>update</button>
          <button class="store-menu-btn danger" data-uninstall="${app.id}">uninstall</button>
        </div>
      </div>` : ''}
      <div style="width:40px;height:40px;border-radius:8px;background:rgba(${rgb},.08);border:1px solid rgba(${rgb},.15);display:flex;align-items:center;justify-content:center;color:${app.color};flex-shrink:0">
        ${STORE_SVG[app.id] || ''}
      </div>
      <div>
        <div style="font-size:12px;color:#bbb;margin-bottom:2px">${app.name}</div>
        <div style="font-size:10px;color:var(--text3);line-height:1.4">${app.desc}</div>
        ${installed ? `<div style="margin-top:4px;font-size:9px;letter-spacing:.07em;color:${updateAvailable?'#d8b86f':'#5f6a72'};text-transform:uppercase">v${installedVersion}${updateAvailable?` -> update ${latestVersion}`:''}</div>` : ''}
      </div>
      <button class="store-install-btn btn${installed?' installed':' btn-dim'}" data-install="${app.id}" style="margin-top:auto;padding:5px 0;font-size:10px;width:100%;text-align:center">
        ${installed ? (updateAvailable ? 'update' : 'open') : 'install'}
      </button>
    </div>`;
  }).join('');

  const sectionHead = isInstalledView ? `<div class="store-section-head">
    <div>installed apps</div>
    <div>${apps.length} total</div>
  </div>` : '';

  const emptyState = apps.length ? '' : `<div class="store-empty">${isInstalledView ? 'no apps installed yet' : 'no apps found, try another search'}</div>`;
  grid.innerHTML = `${sectionHead}${cards}${emptyState}`;

  grid.onclick = e => {
    const moreBtn = e.target.closest('[data-more]');
    if (moreBtn) {
      e.stopPropagation();
      const id = moreBtn.dataset.more;
      const menu = grid.querySelector(`.store-more-menu[data-menu="${id}"]`);
      const wasOpen = !!menu?.classList.contains('show');
      closeStoreMenus();
      if (!wasOpen && menu) menu.classList.add('show');
      return;
    }

    const uninstallBtn = e.target.closest('[data-uninstall]');
    if (uninstallBtn) {
      e.stopPropagation();
      uninstallInstalledApp(uninstallBtn.dataset.uninstall);
      return;
    }
    const updateMenuBtn = e.target.closest('[data-update]');
    if (updateMenuBtn) {
      e.stopPropagation();
      const id = updateMenuBtn.dataset.update;
      updateMenuBtn.textContent = 'updating...';
      updateMenuBtn.disabled = true;
      updateStoreApp(id).then(() => {
        renderStoreGrid(cat, q);
      }).catch(() => {
        notify('store', `failed to update ${id}`);
      });
      return;
    }

    const btn = e.target.closest('.store-install-btn');
    if (!btn) { closeStoreMenus(); return; }

    const id = btn.dataset.install;
    if (OS.installedApps.includes(id)) {
      if (_hasUpdate(id)) {
        btn.textContent = 'updating...';
        btn.disabled = true;
        updateStoreApp(id).then(() => {
          btn.disabled = false;
          renderStoreGrid(cat, q);
        }).catch(() => {
          btn.textContent = 'update';
          btn.disabled = false;
          notify('store', `failed to update ${id}`);
        });
      } else {
        launchInstalledApp(id);
      }
      closeStoreMenus();
      return;
    }

    btn.textContent = 'installing...'; btn.disabled = true;
    installStoreApp(id).then(() => {
      btn.textContent = 'open';
      btn.classList.remove('btn-dim');
      btn.classList.add('installed');
      btn.disabled = false;
      if (isInstalledView) renderStoreGrid(cat, q);
    }).catch(() => {
      btn.textContent = 'install';
      btn.disabled = false;
      notify('store', `failed to load ${id}`);
    });
  };
}

window.installStoreApp = installStoreApp;
window.updateStoreApp = updateStoreApp;
window.uninstallInstalledApp = uninstallInstalledApp;
window.listInstalledStoreApps = listInstalledStoreApps;
window.getStoreApps = () => STORE_APPS.map(a => ({...a}));


