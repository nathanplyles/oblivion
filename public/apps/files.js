let filesSelectedIdx = -1;
let filesSearch = '';
let filesSort = 'name-asc';
let filesVisibleMap = [];
let filesDragSource = null;

function filesEscape(value) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fileResolveShortcutAppId(item) {
  if (typeof window.resolveShortcutAppId === 'function') return window.resolveShortcutAppId(item);
  const fromId = String(item?.appId || '').trim().toLowerCase();
  if (fromId) return fromId;
  return String(item?.name || '').replace(/\.exe$/i, '').trim().toLowerCase();
}

function fileDisplayName(item) {
  if (typeof window.getEntryDisplayName === 'function') return window.getEntryDisplayName(item);
  if (item?.type === 'app') return String(item?.name || '').replace(/\.exe$/i, '');
  return String(item?.name || '');
}

function appShortcutFileName(app) {
  const base = String(app?.id || app?.name || 'app').trim().toLowerCase();
  const safe = base || 'app';
  return `${safe}.exe`;
}

function safeColorToken(value, fallback = '#666') {
  const token = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(token) ? token : fallback;
}

function dirPathFor(parentDir, name) {
  return parentDir === 'home' ? name : `${parentDir}/${name}`;
}

function remapDirTree(oldPath, newPath) {
  if (!oldPath || !newPath || oldPath === newPath) return;
  const keys = Object.keys(OS.files).filter((k) => k === oldPath || k.startsWith(`${oldPath}/`));
  keys.sort((a, b) => a.length - b.length);
  keys.forEach((key) => {
    const suffix = key === oldPath ? '' : key.slice(oldPath.length);
    const nextKey = `${newPath}${suffix}`;
    OS.files[nextKey] = OS.files[key];
    if (nextKey !== key) delete OS.files[key];
  });
}

function launchFiles() {
  if (window.shouldReuseAppWindow?.('files') && window.focusAnyAppWindow?.('files')) return;
  const html = `<div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
    <div class="files-topbar" style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border2);flex-shrink:0;gap:10px">
      <span class="files-path" id="files-path" style="font-size:11px;color:var(--text3);letter-spacing:.06em;min-width:86px">~/home</span>
      <div style="display:flex;gap:6px;align-items:center;flex:1;justify-content:flex-end">
        <input id="files-search" class="inp" placeholder="search..." autocomplete="off" spellcheck="false" style="margin:0;max-width:160px;padding:5px 9px;font-size:10px">
        <select id="files-sort" class="sel-dark" style="margin:0;max-width:128px;padding:5px 8px;font-size:10px">
          <option value="name-asc">name A-Z</option>
          <option value="name-desc">name Z-A</option>
          <option value="type">type</option>
        </select>
        <button id="files-up" class="btn btn-dim" style="padding:4px 10px;font-size:10px">up</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;padding:7px 14px;border-bottom:1px solid var(--border2);flex-shrink:0">
      <button id="files-open" class="btn btn-dim" style="padding:4px 10px;font-size:10px">open</button>
      <button id="files-rename" class="btn btn-dim" style="padding:4px 10px;font-size:10px">rename</button>
      <button id="files-dup" class="btn btn-dim" style="padding:4px 10px;font-size:10px">duplicate</button>
      <button id="files-del" class="btn btn-dim" style="padding:4px 10px;font-size:10px">delete</button>
      <button id="files-restore" class="btn btn-dim" style="padding:4px 10px;font-size:10px;display:none">restore</button>
    </div>
    <div style="display:flex;flex:1;overflow:hidden">
      <div class="app-sidebar" style="width:132px;flex-shrink:0">
        <div class="app-sidebar-item active" data-dir="home"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z"/><path d="M5.5 15v-5h5v5"/></svg>home</div>
        <div class="app-sidebar-item" data-dir="desktop"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="2.5" width="12" height="8.5" rx="1.2"/><path d="M6.2 13h3.6M8 11v2"/></svg>desktop</div>
        <div class="app-sidebar-item" data-dir="apps"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><path d="M2 5.2c0-.7.5-1.2 1.2-1.2h3L7.7 5.2h5.1c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H3.2c-.7 0-1.2-.5-1.2-1.2V5.2z"/><path d="M2 7h12"/><path d="M5 10.2h3.8"/></svg>apps</div>
        <div class="app-sidebar-item" data-dir="documents"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 4c0-.6.4-1 1-1h3l1 1h6a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/></svg>documents</div>
        <div class="app-sidebar-item" data-dir="downloads"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 2v8M5 7l3 3 3-3M2 13h12"/></svg>downloads</div>
        <div class="app-sidebar-item" data-dir="pictures"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="6" cy="7" r="1.2"/><path d="M2 11l3-3 2 2 3-3.5 4 4.5"/></svg>pictures</div>
        <div class="app-sidebar-item" data-dir="recycle"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 4h10M6 4V3h4v1M5 4l.6 8.2a1 1 0 001 .9h2.8a1 1 0 001-.9L11 4"/></svg>recycle</div>
      </div>
      <div id="files-grid" style="flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent;display:flex;flex-wrap:wrap;gap:10px;align-content:start"></div>
    </div>
  </div>`;
  createWin('files', 'files', 740, 500, html);
  setTimeout(() => {
    renderFiles(OS.filesCwd || 'home');
    hookFilesUI();
  }, 50);
}

function hookFilesUI(){
  document.querySelectorAll('.app-sidebar-item[data-dir]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.app-sidebar-item[data-dir]').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      renderFiles(item.dataset.dir);
    });
    item.addEventListener('dragover', e => {
      if (!filesDragSource) return;
      e.preventDefault();
      item.classList.add('drop-ready');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drop-ready'));
    item.addEventListener('drop', e => {
      if (!filesDragSource) return;
      e.preventDefault();
      item.classList.remove('drop-ready');
      moveDraggedFileToDir(item.dataset.dir);
    });
  });
  document.getElementById('files-up').onclick = () => {
    if (OS.filesCwd === 'recycle') return;
    const parts = OS.filesCwd.split('/').filter(Boolean);
    if (parts.length > 0) { parts.pop(); renderFiles(parts.join('/') || 'home'); }
  };
  document.getElementById('files-search').addEventListener('input', e => {
    filesSearch = (e.target.value || '').trim().toLowerCase();
    renderFiles(OS.filesCwd);
  });
  document.getElementById('files-sort').addEventListener('change', e => {
    filesSort = e.target.value;
    renderFiles(OS.filesCwd);
  });
  document.getElementById('files-open').onclick = () => { if (filesSelectedIdx > -1) openFilesItem(OS.filesCwd, filesSelectedIdx); };
  document.getElementById('files-rename').onclick = () => renameSelectedFile();
  document.getElementById('files-dup').onclick = () => duplicateSelectedFile();
  document.getElementById('files-del').onclick = () => deleteSelectedFile();
  document.getElementById('files-restore').onclick = () => restoreSelectedFile();

  const win = document.getElementById('win-files');
  if (win) {
    win.addEventListener('keydown', e => {
      const editable = !!e.target?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable]:not([contenteditable="false"])');
      if (editable) return;
      if (e.key === 'Enter' && filesSelectedIdx > -1) openFilesItem(OS.filesCwd, filesSelectedIdx);
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedFile(); }
      if (e.key === 'F2') { e.preventDefault(); renameSelectedFile(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelectedFile(); }
    });
    win.addEventListener('contextmenu', filesHandleContextMenu);
    win.tabIndex = 0;
  }
}

function filesHandleContextMenu(e){
  e.preventDefault();
  e.stopPropagation();
  const itemEl = e.target.closest('.file-item');
  if(itemEl){
    const idx = parseInt(itemEl.dataset.idx,10);
    filesSelectedIdx = idx;
    const dir = OS.filesCwd;
    const sourceIdx = filesVisibleMap[idx];
    const item = getFilesItems(dir)[sourceIdx];
    const appId = item && item.type === 'app' ? fileResolveShortcutAppId(item) : '';
    const isPinned = !!(appId && Array.isArray(OS.taskbarHidden) && !OS.taskbarHidden.includes(appId));
    if(typeof showCtx === 'function'){
      showCtx(e.clientX,e.clientY,[
        { label:'open', action:()=>openFilesItem(dir, idx) },
        appId ? (isPinned
          ? { label:'unpin from taskbar', action:()=>window.unpinApp?.(appId) }
          : { label:'pin to taskbar', action:()=>window.pinApp?.(appId) }) : null,
        item && item.type === 'file' ? { label:'open in notes', action:()=>openFileWith(dir, idx, 'notes') } : null,
        item && item.type === 'file' ? { label:'open in photos', action:()=>openFileWith(dir, idx, 'photos') } : null,
        'sep',
        { label:'rename', action:()=>renameSelectedFile() },
        { label:'duplicate', action:()=>duplicateSelectedFile() },
        { label:'delete', action:()=>deleteSelectedFile(), danger:true },
      ].filter(Boolean));
    }
    return;
  }
  if(typeof showCtx === 'function'){
    showCtx(e.clientX,e.clientY,[
      { label:'new folder', action:()=>createNewFolderPrompt() },
      { label:'new text file', action:()=>createNewFilePrompt('txt') },
      { label:'new app shortcut', action:()=>createNewAppShortcutPrompt() },
      { label:'new markdown file', action:()=>createNewFilePrompt('md') },
      { label:'new json file', action:()=>createNewFilePrompt('json') },
      { label:'new javascript file', action:()=>createNewFilePrompt('js') },
      { label:'new image placeholder', action:()=>createNewImagePlaceholder() },
    ]);
  }
}
window.filesHandleContextMenu = filesHandleContextMenu;

function getFilesItems(dir) {
  if (dir === 'recycle') return OS.recycleBin || [];
  if (!OS.files[dir]) OS.files[dir] = [];
  return OS.files[dir];
}

function getUniqueName(items, baseName) {
  const used = new Set(items.map(i => i.name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;
  let n = 2;
  while (used.has(`${baseName} ${n}`.toLowerCase())) n++;
  return `${baseName} ${n}`;
}

function splitName(name) {
  const idx = name.lastIndexOf('.');
  if (idx < 1) return { base: name, ext: '' };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

function getSelectedItem() {
  if (filesSelectedIdx < 0) return null;
  const sourceIdx = filesVisibleMap[filesSelectedIdx];
  if (sourceIdx === undefined) return null;
  const items = getFilesItems(OS.filesCwd);
  const item = items[sourceIdx];
  if (!item) return null;
  return { item, sourceIdx, items };
}

async function createNewFolderPrompt(){
  if(OS.filesCwd === 'recycle') return;
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: 'new folder',
      label: 'folder name',
      value: 'new folder',
      placeholder: 'folder name',
      confirmLabel: 'create',
    })
    : prompt('new folder name:', 'new folder');
  const name = String(inputValue || '').trim();
  if(!name) return;
  const items = getFilesItems(OS.filesCwd);
  const finalName = getUniqueName(items, name);
  items.push({ name:finalName, type:'dir', color:'#c8f0a0' });
  const path = OS.filesCwd === 'home' ? finalName : `${OS.filesCwd}/${finalName}`;
  if(!OS.files[path]) OS.files[path] = [];
  saveOS();
  renderFiles(OS.filesCwd);
}

async function createNewFilePrompt(ext='txt'){
  if(OS.filesCwd === 'recycle') return;
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: `new .${ext} file`,
      label: 'file name',
      value: `untitled.${ext}`,
      placeholder: `name.${ext}`,
      confirmLabel: 'create',
    })
    : prompt(`new .${ext} file name:`, `untitled.${ext}`);
  const base = String(inputValue || '').trim();
  if(!base) return;
  const items = getFilesItems(OS.filesCwd);
  const name = getUniqueName(items, base.includes('.') ? base : `${base}.${ext}`);
  items.push({ name, type:'file', ext, content:'' });
  saveOS();
  renderFiles(OS.filesCwd);
}

async function createNewImagePlaceholder(){
  if(OS.filesCwd === 'recycle') return;
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: 'new image placeholder',
      label: 'image name',
      value: 'image.png',
      placeholder: 'image.png',
      confirmLabel: 'create',
    })
    : prompt('new image name:', 'image.png');
  const name = String(inputValue || '').trim();
  if(!name) return;
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0d12'; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = '#9aa3b2'; ctx.font = '18px monospace'; ctx.fillText('oblivion image', 24, 40);
  const dataUrl = c.toDataURL('image/png');
  getFilesItems(OS.filesCwd).push({ name:name.endsWith('.png')?name:`${name}.png`, type:'file', ext:'png', dataUrl });
  saveOS();
  renderFiles(OS.filesCwd);
}

async function createNewAppShortcutPrompt(){
  if(OS.filesCwd === 'recycle') return;
  const apps = (typeof window.getLaunchableApps === 'function')
    ? window.getLaunchableApps()
    : [
      { id:'browser', name:'browser' },
      { id:'music', name:'music' },
      { id:'files', name:'files' },
      { id:'notes', name:'notes' },
      { id:'settings', name:'settings' },
      { id:'terminal', name:'terminal' },
    ];
  if(!apps.length){ notify('files', 'no launchable apps'); return; }
  const hint = apps.map((app) => app.id).join(', ');
  const inputValue = (typeof window.showShellPrompt === 'function')
    ? await window.showShellPrompt({
      title: 'new app shortcut',
      label: `app id (${hint})`,
      value: 'browser',
      placeholder: 'browser',
      confirmLabel: 'create',
    })
    : prompt(`app id for shortcut:\n${hint}`, 'browser');
  const raw = String(inputValue || '').trim().toLowerCase();
  if(!raw) return;
  const app = apps.find((entry) => entry.id.toLowerCase() === raw || String(entry.name || '').toLowerCase() === raw);
  if(!app){ notify('files', `unknown app id: ${raw}`); return; }
  const items = getFilesItems(OS.filesCwd);
  const name = getUniqueName(items, appShortcutFileName(app));
  items.push({ name, type:'app', appId: app.id });
  saveOS();
  renderFiles(OS.filesCwd);
}

function removeDirTree(path) {
  if (!path || path === 'home') return;
  Object.keys(OS.files).forEach(k => {
    if (k === path || k.startsWith(path + '/')) delete OS.files[k];
  });
}

function openFileWith(dir, visibleIdx, app){
  const sourceIdx = filesVisibleMap[visibleIdx];
  const item = getFilesItems(dir)[sourceIdx];
  if(!item || item.type !== 'file') return;
  if(app==='notes' && typeof window.notesOpenFile==='function'){ window.notesOpenFile(item); return; }
  if(app==='photos' && typeof window.photosOpenFile==='function'){ window.photosOpenFile(item); return; }
}

function openFilesItem(dir, visibleIdx) {
  const sourceIdx = filesVisibleMap[visibleIdx];
  const item = getFilesItems(dir)[sourceIdx];
  if (!item) return;
  if (dir === 'recycle') { restoreFileByIndex(sourceIdx); return; }
  if (item.type === 'app') {
    const appId = fileResolveShortcutAppId(item);
    if (typeof window.launchShortcutApp === 'function') {
      window.launchShortcutApp(appId);
    } else if (typeof launchApp === 'function') {
      launchApp(appId);
    }
    return;
  }
  if (item.type === 'dir') {
    const subKey = dir === 'home' ? item.name : dir + '/' + item.name;
    if (!OS.files[subKey]) OS.files[subKey] = [];
    renderFiles(subKey);
    return;
  }
  const ext = String(item.ext || '').toLowerCase();
  if (window.IMAGE_EXTS?.has(ext) && typeof window.photosOpenFile === 'function') { window.photosOpenFile(item); return; }
  if (window.TEXT_EXTS?.has(ext)) {
    if (typeof window.notesOpenFile === 'function') { window.notesOpenFile(item); return; }
  }
  notify('files', `opened ${item.name}`);
}

function renameSelectedFile() {
  const sel = getSelectedItem();
  if (!sel) return;
  const prevName = sel.item.name;
  const promptName = fileDisplayName(sel.item) || sel.item.name;
  let next = (prompt('rename to:', promptName) || '').trim();
  if (sel.item.type === 'app' && next) {
    const fallbackId = fileResolveShortcutAppId(sel.item) || next;
    next = `${String(next).replace(/\.exe$/i, '').trim() || fallbackId}.exe`;
  }
  if (!next || next === sel.item.name) return;
  if (sel.items.some((i, idx) => idx !== sel.sourceIdx && i.name.toLowerCase() === next.toLowerCase())) {
    notify('files', 'name already exists');
    return;
  }
  sel.item.name = next;
  if (sel.item.type === 'dir') {
    remapDirTree(dirPathFor(OS.filesCwd, prevName), dirPathFor(OS.filesCwd, next));
  }
  saveOS();
  renderFiles(OS.filesCwd);
}

function duplicateSelectedFile() {
  if (OS.filesCwd === 'recycle') { notify('files', 'duplicate disabled in recycle'); return; }
  const sel = getSelectedItem();
  if (!sel) return;
  const copy = JSON.parse(JSON.stringify(sel.item));
  const { base, ext } = splitName(sel.item.name);
  copy.name = getUniqueName(sel.items, ext ? `${base} copy${ext}` : `${base} copy`);
  sel.items.push(copy);
  if (copy.type === 'dir') {
    const srcPath = dirPathFor(OS.filesCwd, sel.item.name);
    const dstPath = dirPathFor(OS.filesCwd, copy.name);
    const subtreeKeys = Object.keys(OS.files).filter((k) => k === srcPath || k.startsWith(`${srcPath}/`));
    subtreeKeys.forEach((key) => {
      const suffix = key === srcPath ? '' : key.slice(srcPath.length);
      OS.files[`${dstPath}${suffix}`] = JSON.parse(JSON.stringify(OS.files[key]));
    });
  }
  saveOS();
  renderFiles(OS.filesCwd);
}

function deleteSelectedFile() {
  const sel = getSelectedItem();
  if (!sel) return;
  if (OS.filesCwd === 'recycle') {
    const gone = sel.items.splice(sel.sourceIdx, 1)[0];
    if (gone?.type === 'app' && typeof window.unpinApp === 'function') {
      window.unpinApp(fileResolveShortcutAppId(gone), { forceHide:true });
    }
    if (gone?.type === 'dir' && gone._originalPath) removeDirTree(gone._originalPath);
    saveOS();
    notify('files', `${gone?.name || 'item'} permanently deleted`);
    renderFiles('recycle');
    return;
  }
  const removed = sel.items.splice(sel.sourceIdx, 1)[0];
  if (removed?.type === 'app' && typeof window.unpinApp === 'function') {
    window.unpinApp(fileResolveShortcutAppId(removed), { forceHide:true });
  }
  const originalPath = OS.filesCwd === 'home' ? removed.name : `${OS.filesCwd}/${removed.name}`;
  OS.recycleBin.unshift({
    ...JSON.parse(JSON.stringify(removed)),
    _trashId: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    _fromDir: OS.filesCwd,
    _originalPath: originalPath,
    _deletedAt: Date.now(),
  });
  saveOS();
  notify('files', `${removed.name} moved to recycle`);
  renderFiles(OS.filesCwd);
}

function moveDraggedFileToDir(targetDir) {
  if (!filesDragSource) return;
  if (targetDir === 'recycle') {
    const old = filesSelectedIdx;
    filesSelectedIdx = filesDragSource.visibleIdx;
    deleteSelectedFile();
    filesSelectedIdx = old;
    filesDragSource = null;
    return;
  }
  if (!OS.files[targetDir]) OS.files[targetDir] = [];
  const srcItems = getFilesItems(filesDragSource.dir);
  const item = srcItems[filesDragSource.sourceIdx];
  if (!item) { filesDragSource = null; return; }
  const clone = JSON.parse(JSON.stringify(item));
  clone.name = getUniqueName(OS.files[targetDir], clone.name);
  OS.files[targetDir].push(clone);
  srcItems.splice(filesDragSource.sourceIdx, 1);
  if (clone.type === 'dir') {
    const srcPath = dirPathFor(filesDragSource.dir, item.name);
    const dstPath = dirPathFor(targetDir, clone.name);
    remapDirTree(srcPath, dstPath);
  }
  saveOS();
  notify('files', `${clone.name} moved to ${targetDir}`);
  filesDragSource = null;
  renderFiles(OS.filesCwd);
}

function restoreFileByIndex(sourceIdx) {
  const item = OS.recycleBin[sourceIdx];
  if (!item) return;
  const targetDir = item._fromDir && OS.files[item._fromDir] ? item._fromDir : 'home';
  if (!OS.files[targetDir]) OS.files[targetDir] = [];
  const clean = JSON.parse(JSON.stringify(item));
  delete clean._trashId;
  delete clean._fromDir;
  delete clean._originalPath;
  delete clean._deletedAt;
  clean.name = getUniqueName(OS.files[targetDir], clean.name);
  OS.files[targetDir].push(clean);
  if (clean.type === 'dir') {
    const dirPath = targetDir === 'home' ? clean.name : `${targetDir}/${clean.name}`;
    if (!OS.files[dirPath]) OS.files[dirPath] = [];
  }
  OS.recycleBin.splice(sourceIdx, 1);
  saveOS();
  notify('files', `${clean.name} restored`);
  renderFiles('recycle');
}

function restoreSelectedFile() {
  const sel = getSelectedItem();
  if (!sel || OS.filesCwd !== 'recycle') return;
  restoreFileByIndex(sel.sourceIdx);
}

function applyFilesActionState() {
  const selected = filesSelectedIdx > -1;
  const inRecycle = OS.filesCwd === 'recycle';
  const upBtn = document.getElementById('files-up');
  if (upBtn) upBtn.disabled = inRecycle || OS.filesCwd === 'home';
  const openBtn = document.getElementById('files-open');
  const renameBtn = document.getElementById('files-rename');
  const dupBtn = document.getElementById('files-dup');
  const delBtn = document.getElementById('files-del');
  const restoreBtn = document.getElementById('files-restore');
  if (openBtn) openBtn.disabled = !selected;
  if (renameBtn) renameBtn.disabled = !selected;
  if (dupBtn) dupBtn.disabled = !selected || inRecycle;
  if (delBtn) delBtn.disabled = !selected;
  if (restoreBtn) { restoreBtn.style.display = inRecycle ? '' : 'none'; restoreBtn.disabled = !selected || !inRecycle; }
}

function renderFiles(dir) {
  OS.filesCwd = dir;
  filesSelectedIdx = -1;
  const grid = document.getElementById('files-grid'); if (!grid) return;
  const pathEl = document.getElementById('files-path');
  if (pathEl) pathEl.textContent = dir === 'recycle' ? '~/recycle' : `~/${dir}`;

  document.querySelectorAll('.app-sidebar-item[data-dir]').forEach(i => {
    i.classList.toggle('active', i.dataset.dir === dir.split('/')[0] || (dir === 'recycle' && i.dataset.dir === 'recycle'));
  });

  const extColors = { js:'#f7df1e', json:'#7dd3fc', md:'#c4b5fd', txt:'#a3a3a3', html:'#f97316', css:'#38bdf8', png:'#f9a8d4', jpg:'#f9a8d4', jpeg:'#f9a8d4', gif:'#f9a8d4', webp:'#f9a8d4' };
  const rawItems = getFilesItems(dir);
  const filtered = rawItems
    .map((item, sourceIdx) => ({ item, sourceIdx }))
    .filter(({ item }) => {
      if (!filesSearch) return true;
      const visibleName = fileDisplayName(item).toLowerCase();
      const rawName = String(item?.name || '').toLowerCase();
      return visibleName.includes(filesSearch) || rawName.includes(filesSearch);
    });
  const sorted = filtered.sort((a, b) => {
    if (filesSort === 'type') {
      const rank = (type) => {
        if (type === 'dir') return 0;
        if (type === 'app') return 1;
        return 2;
      };
      const at = rank(a.item.type);
      const bt = rank(b.item.type);
      if (at !== bt) return at - bt;
    }
    const n = fileDisplayName(a.item).localeCompare(fileDisplayName(b.item));
    return filesSort === 'name-desc' ? -n : n;
  });
  filesVisibleMap = sorted.map(s => s.sourceIdx);

  if (sorted.length === 0) {
    grid.innerHTML = `<div class="empty-note">${filesSearch ? 'no files match search' : (dir === 'recycle' ? 'recycle is empty' : 'empty folder')}<br><span style="font-size:9px;letter-spacing:.04em;text-transform:none">${dir === 'recycle' ? 'deleted files can be restored from here' : 'right click to create folder or files'}</span></div>`;
    applyFilesActionState();
    return;
  }

  grid.innerHTML = sorted.map(({ item }, i) => {
    const color = item.type === 'dir'
      ? safeColorToken(item.color || '#c8f0a0', '#c8f0a0')
      : item.type === 'app'
        ? safeColorToken('#7dd3fc', '#7dd3fc')
        : safeColorToken(extColors[item.ext] || '#666', '#666');
    const rgb = hexToRgb(color);
    const visibleName = fileDisplayName(item);
    const icon = item.type === 'dir'
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"><path d="M2 4c0-.6.4-1 1-1h3l1 1h6a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/></svg>`
      : item.type === 'app'
        ? (typeof window.getAppIconSvg === 'function' ? window.getAppIconSvg(fileResolveShortcutAppId(item)) : `<svg viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>`)
        : `<svg viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3"/></svg>`;
    return `<div class="file-item" data-idx="${i}">
      <div class="file-item-icon-wrap" style="--file-item-rgb:${rgb}">${icon}</div>
      <span class="file-item-name">${filesEscape(visibleName)}</span>
    </div>`;
  }).join('');

  grid.querySelectorAll('.file-item').forEach(el => {
    const idx = parseInt(el.dataset.idx, 10);
    const sourceIdx = filesVisibleMap[idx];
    el.draggable = true;
    el.addEventListener('click', () => {
      filesSelectedIdx = idx;
      grid.querySelectorAll('.file-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      applyFilesActionState();
    });
    el.addEventListener('dblclick', () => {
      filesSelectedIdx = idx;
      if (dir === 'recycle') return;
      openFilesItem(dir, idx);
    });
    el.addEventListener('dragstart', e => {
      const item = getFilesItems(dir)[sourceIdx];
      if (!item) return;
      filesDragSource = { dir, visibleIdx: idx, sourceIdx };
      const payload = {
        name: item.name, type: item.type, ext: item.ext || '', fromDir: dir,
        content: item.content || '', dataUrl: item.dataUrl || '', appId: fileResolveShortcutAppId(item) || '',
        color: item.color || ''
      };
      e.dataTransfer.setData('application/x-oblivion-file', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      filesDragSource = null;
      el.classList.remove('dragging');
      document.querySelectorAll('.app-sidebar-item.drop-ready').forEach(n => n.classList.remove('drop-ready'));
    });
  });
  applyFilesActionState();
}

window.filesReceiveExternalFile = function(fileData){
  if(!fileData || !fileData.name) return;
  const target = (OS.filesCwd && OS.filesCwd !== 'recycle') ? OS.filesCwd : 'home';
  if (!OS.files[target]) OS.files[target] = [];
  const copy = { name: fileData.name, type: fileData.type || 'file', ext: fileData.ext || '', content:fileData.content || '', dataUrl:fileData.dataUrl || '', appId:fileData.appId || '' };
  if(copy.type === 'app'){
    copy.name = String(copy.name || '').trim();
    if(!copy.name) copy.name = appShortcutFileName({ id: copy.appId || 'app' });
    if(!/\.exe$/i.test(copy.name)) copy.name = `${copy.name.replace(/\.[a-z0-9]+$/i, '')}.exe`;
  }
  copy.name = getUniqueName(OS.files[target], copy.name);
  OS.files[target].push(copy);
  saveOS();
  const hasFilesWin = Object.keys(OS.wins || {}).some((id) => id === 'files' || String(id).startsWith('files-'));
  if (hasFilesWin) renderFiles(target);
  notify('files', `${copy.name} added to ${target}`);
};
