let photosState = { tabs: [], active: null, seq: 0 };

function photoSafeDataUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value) ? value : '';
}

function launchPhotos() {
  if (window.shouldReuseAppWindow?.('photos') && window.focusAnyAppWindow?.('photos')) return;
  const html = `<div style="display:flex;flex-direction:column;height:100%">
    <div id="photos-tabs" style="display:flex;align-items:flex-end;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--border2);background:rgba(0,0,0,.2)">
      <button id="photos-newtab" class="btn btn-dim" style="padding:3px 8px;font-size:9px;margin-left:auto">+</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid var(--border2);display:flex;align-items:center;gap:6px">
      <button id="photos-zoom-in" class="btn btn-dim" style="padding:3px 9px;font-size:9px">zoom +</button>
      <button id="photos-zoom-out" class="btn btn-dim" style="padding:3px 9px;font-size:9px">zoom -</button>
      <button id="photos-grayscale" class="btn btn-dim" style="padding:3px 9px;font-size:9px">grayscale</button>
      <button id="photos-saveas" class="btn btn-dim" style="padding:3px 9px;font-size:9px">save as</button>
    </div>
    <div id="photos-stage" style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,.28)"></div>
  </div>`;
  createWin('photos', 'photos', 720, 520, html);
  setTimeout(() => {
    renderPhotosTabs();
    document.getElementById('photos-newtab').onclick = () => photosOpenTab('blank.png', '');
    document.getElementById('photos-zoom-in').onclick = () => photosScaleActive(1.12);
    document.getElementById('photos-zoom-out').onclick = () => photosScaleActive(1 / 1.12);
    document.getElementById('photos-grayscale').onclick = () => photosToggleGray();
    document.getElementById('photos-saveas').onclick = () => photosSaveAs();
  }, 40);
}

function photosOpenTab(name, dataUrl) {
  const id = ++photosState.seq;
  photosState.tabs.push({ id, name: String(name || 'image.png'), dataUrl: photoSafeDataUrl(dataUrl), zoom: 1, gray: false });
  photosState.active = id;
  renderPhotosTabs();
}

function renderPhotosTabs() {
  const tabsEl = document.getElementById('photos-tabs');
  if (!tabsEl) return;
  const addBtn = document.getElementById('photos-newtab');
  tabsEl.querySelectorAll('.photos-tab').forEach((t) => t.remove());
  photosState.tabs.forEach((tab) => {
    const b = document.createElement('button');
    b.className = 'photos-tab';
    b.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--border2);border-bottom:none;border-radius:6px 6px 0 0;background:rgba(255,255,255,.03);color:var(--text3);font-size:10px;max-width:180px';
    if (tab.id === photosState.active) {
      b.style.background = 'rgba(var(--accent-rgb),.09)';
      b.style.color = 'var(--accent)';
      b.style.borderColor = 'rgba(var(--accent-rgb),.2)';
    }
    const title = document.createElement('span');
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.whiteSpace = 'nowrap';
    title.textContent = tab.name;
    const close = document.createElement('span');
    close.dataset.x = String(tab.id);
    close.style.fontSize = '12px';
    close.style.opacity = '.6';
    close.textContent = 'x';
    b.appendChild(title);
    b.appendChild(close);
    b.onclick = (e) => {
      if (e.target.closest('[data-x]')) return photosCloseTab(tab.id);
      photosState.active = tab.id;
      renderPhotosTabs();
    };
    tabsEl.insertBefore(b, addBtn);
  });
  renderPhotosStage();
}

function photosCloseTab(id) {
  if (photosState.tabs.length <= 1) return;
  const idx = photosState.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  photosState.tabs.splice(idx, 1);
  if (photosState.active === id) photosState.active = photosState.tabs[Math.max(0, idx - 1)].id;
  renderPhotosTabs();
}

function photosStageActive() {
  return photosState.tabs.find((t) => t.id === photosState.active) || null;
}

function renderPhotosStage() {
  const stage = document.getElementById('photos-stage');
  if (!stage) return;
  const tab = photosStageActive();
  const safeSrc = photoSafeDataUrl(tab?.dataUrl || '');
  if (!tab || !safeSrc) {
    stage.innerHTML = '<div class="empty-note" style="max-width:320px">drop/open an image to view it here</div>';
    return;
  }
  stage.innerHTML = '';
  const img = document.createElement('img');
  img.id = 'photos-img';
  img.src = safeSrc;
  img.style.maxWidth = 'none';
  img.style.transform = `scale(${tab.zoom})`;
  img.style.filter = tab.gray ? 'grayscale(1)' : 'none';
  img.style.transition = 'transform .18s ease,filter .18s ease';
  stage.appendChild(img);
}

function photosScaleActive(mult) {
  const tab = photosStageActive();
  if (!tab) return;
  tab.zoom = Math.max(0.1, Math.min(8, tab.zoom * mult));
  renderPhotosStage();
}

function photosToggleGray() {
  const tab = photosStageActive();
  if (!tab) return;
  tab.gray = !tab.gray;
  renderPhotosStage();
}

function photosSaveAs() {
  const tab = photosStageActive();
  const safeSrc = photoSafeDataUrl(tab?.dataUrl || '');
  if (!tab || !safeSrc) return;
  const name = (prompt('save as filename:', tab.name || 'image.png') || '').trim();
  if (!name) return;
  const a = document.createElement('a');
  a.href = safeSrc;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 80);
  if (window.addFileToDir) {
    const ext = (name.split('.').pop() || 'png').toLowerCase();
    window.addFileToDir('pictures', { name, type: 'file', ext, dataUrl: safeSrc });
  }
  notify('photos', `exported ${name}`);
}

window.photosOpenFile = function(fileItem) {
  launchPhotos();
  setTimeout(() => photosOpenTab(fileItem.name || 'image.png', fileItem.dataUrl || ''), 50);
};

window.photosReceiveFile = function(fileData) {
  launchPhotos();
  setTimeout(() => photosOpenTab(fileData.name || 'image.png', fileData.dataUrl || ''), 50);
};
