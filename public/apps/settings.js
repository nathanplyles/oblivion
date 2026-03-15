const ACCENTS = [
  { id:'void-green', hex:'#c8f0a0', rgb:'200,240,160', name:'void green' },
  { id:'sky-blue',   hex:'#7dd3fc', rgb:'125,211,252', name:'sky blue'   },
  { id:'lavender',   hex:'#c4b5fd', rgb:'196,181,253', name:'lavender'   },
  { id:'amber',      hex:'#fcd34d', rgb:'252,211,77',  name:'amber'      },
  { id:'rose',       hex:'#f9a8d4', rgb:'249,168,212', name:'rose'       },
  { id:'mint',       hex:'#86efac', rgb:'134,239,172', name:'mint'       },
  { id:'peach',      hex:'#fdba74', rgb:'253,186,116', name:'peach'      },
  { id:'silver',     hex:'#e5e7eb', rgb:'229,231,235', name:'silver'     },
];
const BG_MODES = [
  {id:'rain',label:'rain'},{id:'particles',label:'particles'},{id:'aurora',label:'aurora'},
  {id:'dots',label:'dots'},{id:'lines',label:'lines'},{id:'void',label:'void'},
];
const BG_CONTROL_CONFIG = {
  rain: [
    { key:'density', label:'density', min:0.5, max:2.4, step:0.05 },
    { key:'speed', label:'speed', min:0.4, max:2.5, step:0.05 },
    { key:'wind', label:'wind', min:0, max:1.6, step:0.05 },
  ],
  particles: [
    { key:'density', label:'density', min:0.6, max:2.8, step:0.05 },
    { key:'drift', label:'drift', min:0.1, max:1.4, step:0.05 },
    { key:'linkDist', label:'link distance', min:70, max:180, step:1 },
  ],
  aurora: [
    { key:'bands', label:'bands', min:2, max:8, step:1 },
    { key:'speed', label:'speed', min:0.4, max:2, step:0.05 },
    { key:'intensity', label:'intensity', min:0.35, max:1.8, step:0.05 },
  ],
  dots: [
    { key:'spacing', label:'spacing', min:24, max:72, step:1 },
    { key:'repelRadius', label:'repel radius', min:70, max:230, step:1 },
    { key:'drift', label:'drift', min:0, max:1.4, step:0.05 },
    { key:'bulge', label:'bulge amount', min:0, max:90, step:1 },
    { key:'linkDist', label:'link distance', min:20, max:120, step:1 },
  ],
  lines: [
    { key:'density', label:'density', min:0.5, max:2.4, step:0.05 },
    { key:'flow', label:'flow', min:0.2, max:2.1, step:0.05 },
    { key:'wander', label:'wander', min:0, max:1.2, step:0.05 },
  ],
  void: [
    { key:'density', label:'density', min:0.5, max:2.3, step:0.05 },
    { key:'pulse', label:'pulse', min:0.3, max:2.3, step:0.05 },
    { key:'darkness', label:'darkness', min:0.45, max:1.5, step:0.05 },
    { key:'glow', label:'glow', min:0, max:1.6, step:0.05 },
  ],
};
const CLOAK_PRESETS = [
  { id:'noodletools', label:'noodletools', title:'Noodletools - Projects', favicon:'/favicons/noodletools.ico' },
  { id:'schoology', label:'schoology', title:'Home | Schoology', favicon:'/favicons/schoology.ico' },
  { id:'clever', label:'clever', title:'Clever | Portal', favicon:'/favicons/clever.ico' },
  { id:'classroom', label:'classroom', title:'Google Classroom', favicon:'/favicons/classroom.png' },
  { id:'docs', label:'docs', title:'Google Docs', favicon:'/favicons/docs.png' },
  { id:'drive', label:'drive', title:'Google Drive', favicon:'/favicons/drive.png' },
  { id:'desmos', label:'desmos', title:'Desmos', favicon:'/favicons/desmos.ico' },
  { id:'duolingo', label:'duolingo', title:'Duolingo', favicon:'/favicons/duolingo.ico' },
  { id:'iready', label:'iready', title:'i-Ready', favicon:'/favicons/iready.ico' },
  { id:'khan', label:'khan', title:'Khan Academy', favicon:'/favicons/khan.ico' },
  { id:'quizlet', label:'quizlet', title:'Quizlet', favicon:'/favicons/quizlet.ico' },
];
let settingsSaveTimer = 0;

function queueSettingsSave(immediate = false) {
  if (immediate) {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = 0;
    if (typeof saveOS === 'function') saveOS();
    return;
  }
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    settingsSaveTimer = 0;
    if (typeof saveOS === 'function') saveOS();
  }, 120);
}

function launchSettings() {
  if (window.shouldReuseAppWindow?.('settings') && window.focusAnyAppWindow?.('settings')) return;
  const icons = {
    appearance:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/></svg>`,
    audio:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 9.5H5l3 3V3.5l-3 3H2.5z"/><path d="M11 5.5a3 3 0 010 5M12.8 4a5.2 5.2 0 010 8"/></svg>`,
    status:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 13v1.5M11 13v1.5M3 15h10"/></svg>`,
    cloaking:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><path d="M8 2.5c2.9 0 5.1 2 6 5.5-.9 3.5-3.1 5.5-6 5.5S2.9 11.5 2 8c.9-3.5 3.1-5.5 6-5.5z"/><circle cx="8" cy="8" r="2"/></svg>`,
    about:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v5M8 5v.5"/></svg>`,
  };
  const panels = ['appearance','audio','status','cloaking','about'];
  const html = `<div style="display:flex;height:100%;overflow:hidden">
    <div class="app-sidebar" style="width:140px;flex-shrink:0">${panels.map((p,i)=>`<div class="app-sidebar-item${i===0?' active':''}" data-panel="${p}">${icons[p]}${p}</div>`).join('')}</div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:14px 22px 0;flex-shrink:0"><input class="inp" id="settings-search" placeholder="search settings..." autocomplete="off" spellcheck="false" style="margin:0"></div>
      <div id="settings-main" style="flex:1;padding:16px 22px 22px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent"></div>
    </div>
  </div>`;
  createWin('settings', 'settings', 760, 520, html);

  function applySearch() {
    const q = (document.getElementById('settings-search')?.value || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#settings-main [data-s-search]');
    let shown = 0;
    rows.forEach(r=>{ const ok=!q || r.dataset.sSearch.includes(q); r.style.display=ok?'':'none'; if(ok) shown++; });
    const empty = document.getElementById('settings-search-empty');
    if (empty) empty.style.display = (q && shown===0)?'':'none';
  }

  function fmtValue(v, step){
    const s = String(step || '');
    const decimals = s.includes('.') ? s.split('.')[1].length : 0;
    return Number(v).toFixed(Math.min(2, decimals));
  }

  function renderBackgroundControls(){
    const defs = BG_CONTROL_CONFIG[bgMode] || [];
    const vals = (window.getBgSettings ? window.getBgSettings(bgMode) : {}) || {};
    if(!defs.length){
      return `<div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--border2)" data-s-search="background controls">
        <div class="inp-label">background controls</div>
        <div style="font-size:10px;color:var(--text3)">no controls available for this mode.</div>
      </div>`;
    }
    return `<div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--border2)" data-s-search="background controls tuning">
      <div class="inp-label">background controls (${bgMode})</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${defs.map(d => {
          const val = Number(vals[d.key] ?? d.min);
          return `<div class="s-row" data-s-search="${bgMode} ${d.label} ${d.key}">
            <span class="s-key">${d.label}</span>
            <input class="bg-setting-range" data-mode="${bgMode}" data-key="${d.key}" data-step="${d.step}" type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${val}" style="width:160px">
            <span class="s-val" data-bg-val="${d.key}" style="min-width:40px;text-align:right">${fmtValue(val, d.step)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function render(panel){
    document.querySelectorAll('.app-sidebar-item[data-panel]').forEach(i=>i.classList.toggle('active', i.dataset.panel===panel));
    const main = document.getElementById('settings-main'); if(!main) return;
    if(panel==='appearance'){
      const bgOn = document.getElementById('bgc')?.style.opacity !== '0';
      const tints = (window.getColorTints ? window.getColorTints() : ACCENTS.map(a => ({ id: a.id, name: a.name, hex: a.hex, rgb: a.rgb })));
      const activeTint = OS.tintId || (tints.find(t => t.hex === OS.accent)?.id) || 'void-green';
      const desktopSettings = {
        showIcons: OS.desktopSettings?.showIcons !== false,
        showLabels: OS.desktopSettings?.showLabels !== false,
        iconSize: Number(OS.desktopSettings?.iconSize) || 54,
        gridGap: Number(OS.desktopSettings?.gridGap) || 12,
      };
      main.innerHTML = `
        <div class="app-section-title">appearance</div>
        <div class="s-row" data-s-search="background render"><span class="s-key">background</span><div class="toggle${bgOn?' on':''}" id="tog-bg"></div></div>
        <div class="s-row" data-s-search="focus mode"><span class="s-key">focus mode</span><div class="toggle${OS.focusMode?' on':''}" id="tog-focus"></div></div>
        <div class="s-row" data-s-search="time tint sun moon"><span class="s-key">time tint</span><div class="toggle${OS.timeTintEnabled?' on':''}" id="tog-tint"></div></div>
        <div class="s-row" data-s-search="cursor performance mode low power"><span class="s-key">cursor performance mode</span><div class="toggle${OS.cursorPerformanceMode?' on':''}" id="tog-cursor-perf"></div></div>
        <div class="s-row" data-s-search="background intensity brightness"><span class="s-key">background intensity</span><input id="bg-intensity" type="range" min="0.2" max="1.2" step="0.05" value="${OS.bgIntensity}" style="width:170px"></div>
        <div class="s-row" data-s-search="vignette"><span class="s-key">vignette</span><input id="bg-vignette" type="range" min="0" max="1.6" step="0.05" value="${OS.bgVignette}" style="width:170px"></div>
        <div style="margin-top:14px" data-s-search="color tint accent palette">
          <div class="inp-label">color tint</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px">each tint applies full shell styling.</div>
          <div class="swatches">${tints.map(a=>`<div class="swatch${activeTint===a.id?' active':''}" data-tint="${a.id}" data-hex="${a.hex}" data-rgb="${a.rgb}" title="${a.name}" style="background:${a.hex}"></div>`).join('')}</div>
        </div>
        <div style="margin-top:14px" data-s-search="background mode rain particles aurora dots lines void">
          <div class="inp-label">background mode</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${BG_MODES.map(m=>`<button class="btn${bgMode===m.id?'':' btn-dim'} bg-mode-btn" data-bg="${m.id}" style="padding:5px 12px;font-size:10px">${m.label}</button>`).join('')}</div>
        </div>
        ${renderBackgroundControls()}
        <div style="margin-top:18px;padding-top:12px;border-top:1px solid var(--border2)" data-s-search="desktop icons labels shortcuts">
          <div class="inp-label">desktop</div>
          <div class="s-row" data-s-search="desktop show icons"><span class="s-key">show desktop icons</span><div class="toggle${desktopSettings.showIcons?' on':''}" id="tog-desktop-icons"></div></div>
          <div class="s-row" data-s-search="desktop labels"><span class="s-key">show labels</span><div class="toggle${desktopSettings.showLabels?' on':''}" id="tog-desktop-labels"></div></div>
          <div class="s-row" data-s-search="desktop icon size"><span class="s-key">icon size</span><input id="desktop-icon-size" type="range" min="42" max="88" step="1" value="${desktopSettings.iconSize}" style="width:170px"><span class="s-val" id="desktop-icon-size-val">${Math.round(desktopSettings.iconSize)}px</span></div>
          <div class="s-row" data-s-search="desktop grid spacing"><span class="s-key">grid spacing</span><input id="desktop-grid-gap" type="range" min="6" max="26" step="1" value="${desktopSettings.gridGap}" style="width:170px"><span class="s-val" id="desktop-grid-gap-val">${Math.round(desktopSettings.gridGap)}px</span></div>
        </div>
        <div id="settings-search-empty" class="empty-note" style="display:none;margin-top:12px">no settings match your search</div>`;
      setTimeout(()=>{
        document.getElementById('tog-bg').onclick = function(){ this.classList.toggle('on'); const bg=document.getElementById('bgc'); if(bg) bg.style.opacity=this.classList.contains('on')?'1':'0'; };
        document.getElementById('tog-focus').onclick = function(){ this.classList.toggle('on'); OS.focusMode=this.classList.contains('on'); queueSettingsSave(true); applyFocusMode(); };
        document.getElementById('tog-tint').onclick = function(){ this.classList.toggle('on'); OS.timeTintEnabled=this.classList.contains('on'); queueSettingsSave(true); applyTimeTint(); };
        document.getElementById('tog-cursor-perf').onclick = function(){
          this.classList.toggle('on');
          OS.cursorPerformanceMode = this.classList.contains('on');
          if(window.applyCursorPerformanceMode) window.applyCursorPerformanceMode();
          queueSettingsSave(true);
        };
        document.getElementById('bg-intensity').oninput = e => { OS.bgIntensity=parseFloat(e.target.value); queueSettingsSave(false); };
        document.getElementById('bg-vignette').oninput = e => { OS.bgVignette=parseFloat(e.target.value); queueSettingsSave(false); applyBackgroundTuning(); };
        document.querySelectorAll('.swatch').forEach(sw => sw.onclick = () => {
          const tintId = sw.dataset.tint || '';
          if(window.setColorTint){
            window.setColorTint(tintId);
          }else{
            OS.tintId = tintId;
            OS.accent = sw.dataset.hex;
            OS.accentRgb = sw.dataset.rgb;
            document.documentElement.style.setProperty('--accent',OS.accent);
            document.documentElement.style.setProperty('--accent-rgb',OS.accentRgb);
            queueSettingsSave(true);
          }
          notify('settings',`tint -> ${sw.title}`);
          render('appearance');
        });
        document.querySelectorAll('.bg-mode-btn').forEach(btn => btn.onclick = () => { setBgMode(btn.dataset.bg); render('appearance'); });
        document.querySelectorAll('.bg-setting-range').forEach(inp => inp.oninput = () => {
          const key = inp.dataset.key;
          const mode = inp.dataset.mode;
          const val = parseFloat(inp.value);
          const valEl = inp.parentElement?.querySelector(`[data-bg-val="${key}"]`);
          if(valEl) valEl.textContent = fmtValue(val, inp.dataset.step);
          if(window.setBgSetting) window.setBgSetting(mode, key, val);
          queueSettingsSave(false);
        });
        document.getElementById('tog-desktop-icons').onclick = function(){
          this.classList.toggle('on');
          OS.desktopSettings = { ...(OS.desktopSettings || {}), showIcons: this.classList.contains('on') };
          if(window.setDesktopSetting) window.setDesktopSetting('showIcons', OS.desktopSettings.showIcons);
          queueSettingsSave(false);
        };
        document.getElementById('tog-desktop-labels').onclick = function(){
          this.classList.toggle('on');
          OS.desktopSettings = { ...(OS.desktopSettings || {}), showLabels: this.classList.contains('on') };
          if(window.setDesktopSetting) window.setDesktopSetting('showLabels', OS.desktopSettings.showLabels);
          queueSettingsSave(false);
        };
        document.getElementById('desktop-icon-size').oninput = e => {
          const val = parseInt(e.target.value, 10) || 54;
          const valEl = document.getElementById('desktop-icon-size-val');
          if(valEl) valEl.textContent = `${val}px`;
          OS.desktopSettings = { ...(OS.desktopSettings || {}), iconSize: val };
          if(window.setDesktopSetting) window.setDesktopSetting('iconSize', val);
          queueSettingsSave(false);
        };
        document.getElementById('desktop-grid-gap').oninput = e => {
          const val = parseInt(e.target.value, 10) || 12;
          const valEl = document.getElementById('desktop-grid-gap-val');
          if(valEl) valEl.textContent = `${val}px`;
          OS.desktopSettings = { ...(OS.desktopSettings || {}), gridGap: val };
          if(window.setDesktopSetting) window.setDesktopSetting('gridGap', val);
          queueSettingsSave(false);
        };
        applySearch();
      },20);
    } else if(panel==='audio'){
      main.innerHTML = `
        <div class="app-section-title">audio</div>
        <div class="s-row" data-s-search="ambient audio"><span class="s-key">ambient audio</span><div class="toggle${OS.soundscapeEnabled?' on':''}" id="tog-audio"></div></div>
        <div style="margin-top:8px" data-s-search="sound profile void rain dusk">
          <div class="inp-label">sound profile</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn sound-prof${OS.soundscapeProfile==='void'?'':' btn-dim'}" data-prof="void" style="padding:5px 11px;font-size:10px">void drone</button>
            <button class="btn sound-prof${OS.soundscapeProfile==='rain'?'':' btn-dim'}" data-prof="rain" style="padding:5px 11px;font-size:10px">rain hush</button>
            <button class="btn sound-prof${OS.soundscapeProfile==='dusk'?'':' btn-dim'}" data-prof="dusk" style="padding:5px 11px;font-size:10px">dusk hum</button>
          </div>
        </div>
        <div class="s-row" data-s-search="volume"><span class="s-key">volume</span><input id="audio-vol" type="range" min="0" max="1" step="0.01" value="${OS.soundscapeVolume}" style="width:170px"></div>
        <div style="font-size:10px;color:var(--text3);line-height:1.55;margin-top:8px" data-s-search="ambient notifications">
          ambient notification lines are disabled.
        </div>
        <div id="settings-search-empty" class="empty-note" style="display:none;margin-top:12px">no settings match your search</div>`;
      setTimeout(()=>{
        document.getElementById('tog-audio').onclick = function(){ this.classList.toggle('on'); OS.soundscapeEnabled=this.classList.contains('on'); queueSettingsSave(true); if(window.applySoundscapeState) window.applySoundscapeState(); };
        document.querySelectorAll('.sound-prof').forEach(btn => btn.onclick = () => { OS.soundscapeProfile = btn.dataset.prof; queueSettingsSave(true); if(window.applySoundscapeState) window.applySoundscapeState(); render('audio'); });
        document.getElementById('audio-vol').oninput = e => { OS.soundscapeVolume=parseFloat(e.target.value); queueSettingsSave(false); if(window.applySoundscapeState) window.applySoundscapeState(); };
        applySearch();
      },20);
    } else if(panel==='status'){
      main.innerHTML = `
        <div class="app-section-title">status</div>
        <div style="margin-top:2px" data-s-search="keybind shortcuts apps launcher">
          <div class="inp-label">keybinds</div>
          <div style="font-size:10px;color:var(--text3);line-height:1.65">
            ctrl/cmd + space : apps launcher<br>
            ctrl/cmd + k : command palette<br>
            ctrl/cmd + alt + left/right : switch desktop<br>
            alt + shift + arrows : snap focused window
          </div>
        </div>
        <div style="margin-top:16px" data-s-search="proxy browser network scramjet">
          <label class="inp-label">scramjet status</label>
          <div id="scramjet-status" style="font-size:10px;color:var(--text3);margin-bottom:8px">checking...</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-dim" id="scramjet-reset">reset scramjet cache</button>
          </div>
        </div>
        <div style="margin-top:16px" data-s-search="backup export import snapshot files settings">
          <label class="inp-label">backup / restore snapshot</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-dim" id="snapshot-export">export snapshot</button>
            <button class="btn btn-dim" id="snapshot-import">import snapshot</button>
            <input id="snapshot-file" type="file" accept="application/json,.json" style="display:none">
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:6px;line-height:1.5">snapshot includes tint, background tuning, audio, narrative, workspace and files</div>
        </div>
        <div id="settings-search-empty" class="empty-note" style="display:none;margin-top:12px">no settings match your search</div>`;
      setTimeout(()=>{
        document.getElementById('scramjet-reset').onclick = async () => {
          try {
            if (typeof window.clearScramjetStorage !== 'function') throw new Error('scramjet tools unavailable');
            await window.clearScramjetStorage();
            localStorage.removeItem('_sjVer');
            window._scramjetTransportReady = false;
            notify('settings', 'scramjet cache cleared - refresh now');
          } catch (err) {
            notify('settings', `scramjet reset failed: ${err.message || 'unknown error'}`);
          }
        };
        const sjStatus = document.getElementById('scramjet-status');
        if (sjStatus) {
          if (!window._scramjetReady) {
            sjStatus.textContent = 'not initialized';
            sjStatus.style.color = '#d48383';
          } else {
            window._scramjetReady.then(ok => {
              const reason = window._scramjetStatusMessage && window._scramjetStatusMessage !== 'ready'
                ? ` (${window._scramjetStatusMessage})`
                : '';
              sjStatus.textContent = ok ? 'ready' : `unavailable${reason}`;
              sjStatus.style.color = ok ? 'var(--accent)' : '#d48383';
            }).catch(() => {
              sjStatus.textContent = 'unavailable';
              sjStatus.style.color = '#d48383';
            });
          }
        }
        document.getElementById('snapshot-export').onclick = () => { if(typeof exportSystemSnapshot==='function'){ exportSystemSnapshot(); notify('settings','snapshot exported'); } };
        const fileIn = document.getElementById('snapshot-file');
        document.getElementById('snapshot-import').onclick = () => fileIn.click();
        fileIn.onchange = () => {
          const f = fileIn.files?.[0]; if(!f) return;
          const r = new FileReader();
          r.onload = () => {
            try {
              const data = JSON.parse(String(r.result||'{}'));
              if(typeof importSystemSnapshotObject!=='function') throw new Error('import helper missing');
              importSystemSnapshotObject(data);
              if (typeof restoreInstalledApps === 'function') restoreInstalledApps();
              notify('settings','snapshot imported');
            } catch(err){ notify('settings', `import failed: ${err.message||'invalid file'}`); }
            fileIn.value = '';
          };
          r.readAsText(f);
        };
        applySearch();
      },20);
    } else if(panel==='cloaking'){
      const panicKey = String(localStorage.getItem('panicKey') || '').slice(0, 1).toLowerCase();
      const panicUrl = (typeof window.normalizeSafeHttpUrl === 'function'
        ? window.normalizeSafeHttpUrl(localStorage.getItem('os-panic-url') || '')
        : '') || 'https://clever.com/';
      const cloakCfg = (typeof window.getTabCloakConfig === 'function')
        ? window.getTabCloakConfig()
        : { title:'', favicon:'', defaultTitle:'oblivionOS', defaultFavicon:'/favicon-blackhole.svg' };
      main.innerHTML = `
        <div class="app-section-title">cloaking</div>
        <div class="s-row" data-s-search="panic key emergency"><span class="s-key">current panic key</span><span class="s-val">${panicKey ? `"${panicKey}"` : 'not set'}</span></div>
        <div class="s-row" data-s-search="panic url redirect"><span class="s-key">current redirect</span><span class="s-val" style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${panicUrl}</span></div>
        <div style="margin-top:16px" data-s-search="panic key redirect url">
          <label class="inp-label">panic key (single key)</label>
          <input id="cloak-panic-key" class="inp" placeholder="e.g. p" maxlength="1" autocomplete="off" spellcheck="false" value="${panicKey}">
          <label class="inp-label">panic redirect url</label>
          <input id="cloak-panic-url" class="inp" placeholder="https://..." autocomplete="off" spellcheck="false" value="${panicUrl}">
        </div>
        <div style="margin-top:14px" data-s-search="cloak preset noodletools schoology clever classroom docs drive desmos duolingo iready khan quizlet">
          <div class="inp-label">cloaking presets</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${CLOAK_PRESETS.map((preset) => `<button class="btn btn-dim cloak-preset-btn" data-cloak-preset="${preset.id}" style="padding:5px 10px;font-size:10px">${preset.label}</button>`).join('')}
          </div>
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border2)" data-s-search="tab cloak title favicon">
          <div class="inp-label">tab cloak</div>
          <label class="inp-label">cloaked tab title</label>
          <input id="cloak-title" class="inp" placeholder="${cloakCfg.defaultTitle}" autocomplete="off" spellcheck="false" value="${escapeHtml(cloakCfg.title || '')}">
          <label class="inp-label">cloaked favicon url</label>
          <input id="cloak-favicon" class="inp" placeholder="${cloakCfg.defaultFavicon}" autocomplete="off" spellcheck="false" value="${escapeHtml(cloakCfg.favicon || '')}">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <button class="btn" id="cloak-save">save cloaking</button>
            <button class="btn btn-dim" id="cloak-reset">reset cloak</button>
          </div>
        </div>
        <div style="font-size:10px;color:var(--text3);line-height:1.6;margin-top:10px" data-s-search="cloak notes">
          presets update tab cloak only. panic key and panic redirect stay unchanged.
        </div>
        <div id="settings-search-empty" class="empty-note" style="display:none;margin-top:12px">no settings match your search</div>`;
      setTimeout(() => {
        const keyInp = document.getElementById('cloak-panic-key');
        const urlInp = document.getElementById('cloak-panic-url');
        const titleInp = document.getElementById('cloak-title');
        const iconInp = document.getElementById('cloak-favicon');
        const saveBtn = document.getElementById('cloak-save');
        const resetBtn = document.getElementById('cloak-reset');
        if(!keyInp || !urlInp || !titleInp || !iconInp || !saveBtn || !resetBtn) return;

        const persistCloak = (includePanic = true) => {
          const key = String(keyInp.value || '').trim().slice(0, 1).toLowerCase();
          if (includePanic) {
            localStorage.setItem('panicKey', key);
            const safeUrl = typeof window.normalizeSafeHttpUrl === 'function'
              ? window.normalizeSafeHttpUrl(urlInp.value || '')
              : '';
            localStorage.setItem('os-panic-url', safeUrl || 'https://clever.com/');
          }
          if (typeof window.setTabCloakConfig === 'function') {
            window.setTabCloakConfig({
              title: titleInp.value || '',
              favicon: iconInp.value || '',
            });
          }
        };

        saveBtn.onclick = () => {
          persistCloak(true);
          notify('settings', 'cloaking saved');
          render('cloaking');
        };

        resetBtn.onclick = () => {
          if (typeof window.setTabCloakConfig === 'function') window.setTabCloakConfig({ title:'', favicon:'' });
          titleInp.value = '';
          iconInp.value = '';
          notify('settings', 'cloak reset');
        };

        document.querySelectorAll('.cloak-preset-btn[data-cloak-preset]').forEach((btn) => {
          btn.onclick = () => {
            const preset = CLOAK_PRESETS.find((entry) => entry.id === btn.dataset.cloakPreset);
            if (!preset) return;
            titleInp.value = preset.title;
            iconInp.value = preset.favicon;
            persistCloak(false);
            notify('settings', `cloak preset -> ${preset.label}`);
            render('cloaking');
          };
        });

        applySearch();
      }, 20);
    } else {
      const storageKb = Math.round(JSON.stringify(localStorage).length / 1024);
      main.innerHTML = `
        <div class="app-section-title">about</div>
        <div style="font-family:var(--font-d);font-size:2rem;color:var(--accent);opacity:.7;margin-bottom:6px;text-shadow:0 0 30px rgba(var(--accent-rgb),.3)">oblivionOS</div>
        <div style="font-size:11px;color:#3a3a4a;line-height:1.9;letter-spacing:.04em;margin-bottom:14px">
          v0.3.0 - between here and nowhere<br>
          running on void-infinity kernel
        </div>
        <div style="font-size:10px;color:var(--text3);line-height:1.6;margin-bottom:12px" data-s-search="void infinity kernel meaning">
          void-infinity kernel is the shell runtime mood layer: window/compositor state, ambient systems, background rendering, and app lifecycle orchestration.
        </div>
        <div class="s-row" data-s-search="version"><span class="s-key">version</span><span class="s-val">oblivionOS v0.3.0</span></div>
        <div class="s-row" data-s-search="schema version"><span class="s-key">schema</span><span class="s-val">v${localStorage.getItem('os-schema-version')||'0'}</span></div>
        <div class="s-row" data-s-search="installed apps"><span class="s-key">installed</span><span class="s-val">${OS.installedApps.length} apps</span></div>
        <div class="s-row" data-s-search="storage"><span class="s-key">storage</span><span class="s-val">~${storageKb}kb</span></div>
        <div class="s-row" data-s-search="engine"><span class="s-key">engine</span><span class="s-val">scramjet / baremux</span></div>
        <div class="s-row" data-s-search="fonts"><span class="s-key">fonts</span><span class="s-val">DM Serif + DM Mono</span></div>
        <div class="s-row" data-s-search="built"><span class="s-key">built with</span><span class="s-val">vanilla JS + CSS</span></div>
        <div id="settings-search-empty" class="empty-note" style="display:none;margin-top:12px">no settings match your search</div>`;
      setTimeout(applySearch,20);
    }
  }

  setTimeout(() => {
    render('appearance');
    const search = document.getElementById('settings-search');
    search.addEventListener('input', () => applySearch());
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; applySearch(); } });
    document.querySelectorAll('.app-sidebar-item[data-panel]').forEach(item => item.addEventListener('click', () => render(item.dataset.panel)));
  }, 50);
}
