function accountEscape(value) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function accountSafeAvatarUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)) return value;
  const safe = typeof window.normalizeSafeHttpUrl === 'function' ? window.normalizeSafeHttpUrl(value) : '';
  return safe || '';
}

function renderAccountProfilePanel() {
  const main = document.getElementById('account-main');
  if (!main) return;

  const avatar = accountSafeAvatarUrl(OS.avatar);
  const initials = String(OS.username || 'v').slice(0, 2).toUpperCase();
  const safeUser = accountEscape(OS.username);
  const safeAvatar = accountEscape(avatar);
  main.innerHTML = `
    <div style="font-size:10px;color:var(--text3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:20px">profile</div>
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px">
      <div id="avatar-wrap" style="position:relative;width:64px;height:64px;flex-shrink:0;cursor:none">
        <div id="avatar-display" style="width:64px;height:64px;border-radius:50%;background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.2);display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:1.5rem;color:var(--accent);overflow:hidden;box-shadow:0 0 20px rgba(var(--accent-rgb),.1)">
          ${safeAvatar ? `<img src="${safeAvatar}" style="width:100%;height:100%;object-fit:cover">` : accountEscape(initials)}
        </div>
        <div id="avatar-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s">
          <svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" style="width:18px;height:18px"><path d="M11 2l3 3-8 8H3v-3L11 2z"/><path d="M9 4l3 3"/></svg>
        </div>
        <input type="file" id="avatar-file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none">
      </div>
      <div>
        <div style="font-size:14px;color:#bbb;margin-bottom:3px">${safeUser}</div>
        <div style="font-size:10px;color:var(--text3);letter-spacing:.06em">${safeUser}@oblivion.void</div>
      </div>
    </div>
    <label class="inp-label">username</label>
    <input id="acc-user" class="inp" value="${safeUser}" autocomplete="off" spellcheck="false">
    <button id="acc-save" class="btn" style="margin-top:4px">save changes</button>
  `;

  setTimeout(() => {
    const wrap = document.getElementById('avatar-wrap');
    const overlay = document.getElementById('avatar-overlay');
    const fileInp = document.getElementById('avatar-file');
    const saveBtn = document.getElementById('acc-save');
    const userInp = document.getElementById('acc-user');
    if (!wrap || !overlay || !fileInp || !saveBtn || !userInp) return;

    wrap.addEventListener('mouseenter', () => { overlay.style.opacity = '1'; });
    wrap.addEventListener('mouseleave', () => { overlay.style.opacity = '0'; });
    wrap.addEventListener('click', () => fileInp.click());

    fileInp.addEventListener('change', () => {
      const file = fileInp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        OS.avatar = e.target?.result || '';
        saveOS();
        const disp = document.getElementById('avatar-display');
        if (disp) {
          disp.innerHTML = '';
          const img = document.createElement('img');
          img.src = accountSafeAvatarUrl(OS.avatar);
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          disp.appendChild(img);
        }
        notify('account', 'profile picture updated');
      };
      reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', () => {
      const val = String(userInp.value || '').trim();
      if (!val) return;
      OS.username = val;
      saveOS();
      notify('account', 'profile updated');
      renderAccountProfilePanel();
    });
  }, 30);
}

function launchAccount() {
  if (window.shouldReuseAppWindow?.('account') && window.focusAnyAppWindow?.('account')) return;
  const html = `<div id="account-main" style="height:100%;padding:24px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent"></div>`;
  createWin('account', 'account', 520, 380, html);
  setTimeout(renderAccountProfilePanel, 40);
}
