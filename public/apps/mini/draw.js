function launchDraw() {
  if (window.shouldReuseAppWindow?.('draw') && window.focusAnyAppWindow?.('draw')) return;
  const html = `<div style="display:flex;flex-direction:column;height:100%;position:relative">
    <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border2);flex-shrink:0">
      <input id="draw-color" type="color" value="#c8f0a0" style="width:24px;height:24px;border:none;border-radius:4px;cursor:none;background:none;padding:0">
      ${[2, 4, 8, 14].map(s => `<button data-sz="${s}" style="width:${s + 14}px;height:${s + 14}px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid var(--border2);cursor:none;transition:all .1s"></button>`).join('')}
      <button id="draw-eraser" class="btn btn-dim" style="padding:4px 10px;font-size:10px">erase</button>
      <button id="draw-save" class="btn" style="padding:4px 10px;font-size:10px">save</button>
      <button id="draw-saveas" class="btn btn-dim" style="padding:4px 10px;font-size:10px">save as</button>
      <button id="draw-clear" style="background:rgba(255,80,80,.06);border:1px solid rgba(255,80,80,.12);color:#ff7070;font-family:var(--font-m);font-size:10px;padding:4px 10px;border-radius:6px;cursor:none;letter-spacing:.06em;transition:all .1s">clear</button>
    </div>
    <canvas id="draw-canvas" style="flex:1;cursor:none;display:block"></canvas>
    <div id="draw-saveas-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:30">
      <div style="width:min(360px,calc(100% - 30px));background:rgba(8,8,14,.98);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.75)">
        <div style="font-size:10px;color:var(--text3);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px">save drawing as</div>
        <input id="draw-saveas-input" class="inp" placeholder="drawing.png" style="margin:0 0 10px 0">
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button id="draw-saveas-cancel" class="btn btn-dim" style="padding:6px 10px">cancel</button>
          <button id="draw-saveas-confirm" class="btn" style="padding:6px 10px">save</button>
        </div>
      </div>
    </div>
  </div>`;
  createWin('draw', 'draw', 600, 420, html);
  setTimeout(() => {
    const canvas = document.getElementById('draw-canvas');
    const ctx = canvas.getContext('2d');
    let currentFile = null;

    function resize() {
      const parentW = canvas.parentElement.offsetWidth;
      const parentH = canvas.parentElement.offsetHeight - 41;
      const prev = canvas.toDataURL('image/png');
      canvas.width = parentW;
      canvas.height = parentH;
      if (prev && prev.length > 30) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = prev;
      }
    }
    resize();

    let drawing = false;
    let color = '#c8f0a0';
    let size = 4;
    let erasing = false;

    canvas.addEventListener('mousedown', e => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
    canvas.addEventListener('mousemove', e => {
      if (!drawing) return;
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.strokeStyle = erasing ? '#010103' : color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);

    document.getElementById('draw-color').addEventListener('input', e => {
      color = e.target.value;
      erasing = false;
      document.getElementById('draw-eraser').style.background = 'rgba(255,255,255,.04)';
    });
    document.querySelectorAll('[data-sz]').forEach(btn => btn.addEventListener('click', () => size = parseInt(btn.dataset.sz, 10) || 4));
    document.getElementById('draw-eraser').addEventListener('click', function () {
      erasing = !erasing;
      this.style.background = erasing ? 'rgba(var(--accent-rgb),.1)' : 'rgba(255,255,255,.04)';
    });

    function saveDrawing(nameOverride = '') {
      const dataUrl = canvas.toDataURL('image/png');
      const wantedName = String(nameOverride || '').trim();

      if (wantedName) {
        const ext = (wantedName.split('.').pop() || 'png').toLowerCase();
        const fileName = wantedName.includes('.') ? wantedName : `${wantedName}.png`;
        const item = window.addFileToDir ? window.addFileToDir('pictures', { name: fileName, type: 'file', ext, dataUrl }) : null;
        currentFile = item || currentFile;
        notify('draw', `saved ${item?.name || fileName}`);
        return;
      }

      if (currentFile) {
        currentFile.dataUrl = dataUrl;
        currentFile.ext = currentFile.ext || 'png';
        if (typeof saveOS === 'function') saveOS();
        notify('draw', `saved ${currentFile.name || 'drawing'}`);
        return;
      }

      const fallback = `drawing-${Date.now()}.png`;
      const item = window.addFileToDir ? window.addFileToDir('pictures', { name: fallback, type: 'file', ext: 'png', dataUrl }) : null;
      currentFile = item || currentFile;
      notify('draw', `saved ${item?.name || fallback}`);
    }

    function showSaveAs() {
      const overlay = document.getElementById('draw-saveas-overlay');
      const input = document.getElementById('draw-saveas-input');
      if (!overlay || !input) return;
      input.value = currentFile?.name || 'drawing.png';
      overlay.style.display = 'flex';
      setTimeout(() => { input.focus(); input.select(); }, 0);
    }

    function hideSaveAs() {
      const overlay = document.getElementById('draw-saveas-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    document.getElementById('draw-save').addEventListener('click', () => saveDrawing());
    document.getElementById('draw-saveas').addEventListener('click', showSaveAs);
    document.getElementById('draw-saveas-cancel').addEventListener('click', hideSaveAs);
    document.getElementById('draw-saveas-confirm').addEventListener('click', () => {
      const input = document.getElementById('draw-saveas-input');
      const value = String(input?.value || '').trim();
      if (!value) return;
      saveDrawing(value);
      hideSaveAs();
    });
    document.getElementById('draw-saveas-input').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const value = String(e.target.value || '').trim();
      if (!value) return;
      saveDrawing(value);
      hideSaveAs();
    });

    document.getElementById('draw-clear').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

    window.__drawImportImage = function drawImportImage(dataUrl, name, fileRef) {
      if (!dataUrl || typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      };
      img.src = dataUrl;
      if (fileRef) currentFile = fileRef;
      else if (name) currentFile = { name, ext: 'png', dataUrl };
    };
  }, 80);
}

window.drawReceiveFile = function(fileData){
  launchDraw();
  setTimeout(() => {
    if (typeof window.__drawImportImage === 'function' && typeof fileData?.dataUrl === 'string') {
      window.__drawImportImage(fileData.dataUrl, fileData.name || 'drawing.png', fileData);
      notify('draw', `${fileData.name || 'image'} opened`);
      return;
    }
    notify('draw', `${fileData.name || 'file'} dropped`);
  }, 120);
};
