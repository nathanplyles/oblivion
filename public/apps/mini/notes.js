let notesState = {
  tabs: [],
  active: null,
  seq: 0,
  wordWrap: true,
  showStatusBar: true,
  zoom: 1,
  openMenu: '',
  justInsertedLink: false,
  textStyle: 'p',
  fontFamily: 'var(--font-m)',
  findQuery: '',
  findMatches: [],
  findIndex: -1,
  pendingEdit: null,
  pendingCloseAfterSaveAs: null,
  pendingClosePromptTabId: null,
  pendingSaveAsTabId: null,
  closingTabIds: new Set(),
  pendingWindowClose: false,
  allowWindowCloseOnce: false,
  windowCloseDiscardedTabIds: new Set(),
};

function _ensureNotesBootTab() {
  if (notesState.tabs.length) return;
  const saved = localStorage.getItem('os-notes-default') || '';
  const id = ++notesState.seq;
  notesState.tabs.push({ id, name: 'notes.txt', content: saved, savedContent: saved, dirty: false, fileRef: null, links: [] });
  notesState.active = id;
}

function getActiveNotesTab() {
  return notesState.tabs.find((tab) => tab.id === notesState.active) || null;
}

function getNotesTabById(id) {
  const tabId = Number.parseInt(String(id || ''), 10);
  if (!tabId) return null;
  return notesState.tabs.find((tab) => tab.id === tabId) || null;
}

function notesRefreshTabDirty(tab) {
  if (!tab) return;
  tab.dirty = String(tab.content || '') !== String(tab.savedContent || '');
}

function notesMarkTabSaved(tab) {
  if (!tab) return;
  tab.savedContent = String(tab.content || '');
  tab.dirty = false;
}

function notesUpdateTabDirtyUi(tabId) {
  const tab = getNotesTabById(tabId);
  const node = document.querySelector(`#notes-tabs .notes-tab[data-tabid="${tabId}"]`);
  if (!node || !tab) return;
  node.classList.toggle('dirty', !!tab.dirty);
}

function launchNotes() {
  if (window.shouldReuseAppWindow?.('notes') && window.focusAnyAppWindow?.('notes')) return;

  _ensureNotesBootTab();
  const html = `
    <div class="app-shell-with-menu notes-shell" id="notes-root">
      <div class="app-menubar" id="notes-menubar"></div>
      <div id="notes-tabs" class="notes-tabstrip">
        <button id="notes-newtab" class="notes-newtab" title="new tab">+</button>
      </div>
      <div class="notes-toolbar">
        <select id="notes-style" aria-label="text style">
          <option value="p">paragraph</option>
          <option value="h1">h1</option>
          <option value="h2">h2</option>
          <option value="h3">h3</option>
          <option value="quote">quote</option>
          <option value="code">code</option>
        </select>
        <select id="notes-font" aria-label="font family">
          <option value="var(--font-m)">dm mono</option>
          <option value="'JetBrains Mono', monospace">jetbrains mono</option>
          <option value="'Fira Code', monospace">fira code</option>
          <option value="'IBM Plex Mono', monospace">ibm plex mono</option>
          <option value="'Space Mono', monospace">space mono</option>
          <option value="'Courier New', monospace">courier new</option>
          <option value="'DM Serif Display', Georgia, serif">dm serif display</option>
          <option value="Georgia, serif">georgia</option>
          <option value="'Times New Roman', serif">times new roman</option>
          <option value="'Trebuchet MS', sans-serif">trebuchet</option>
        </select>
        <button data-notes-cmd="bold" title="bold">B</button>
        <button data-notes-cmd="italic" title="italic"><i>I</i></button>
        <button data-notes-cmd="link" title="insert link" aria-label="insert link">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:block">
            <path d="M6.2 9.8l-1.8 1.8a2.2 2.2 0 103.1 3.1l1.9-1.9"/>
            <path d="M9.8 6.2l1.8-1.8a2.2 2.2 0 10-3.1-3.1L6.6 3.2"/>
            <path d="M5.8 10.2l4.4-4.4"/>
          </svg>
        </button>
        <span class="sep"></span>
        <button data-notes-cmd="bullet" title="bulleted list">&#8226; list</button>
        <button data-notes-cmd="number" title="numbered list">1. list</button>
        <span class="sep"></span>
        <input id="notes-find" class="inp" placeholder="find" style="max-width:150px;margin:0;padding:5px 8px;font-size:10px;">
        <span id="notes-find-count" style="font-size:10px;color:var(--text3);letter-spacing:.04em;min-width:56px">0 matches</span>
      </div>
      <div class="notes-editor-wrap" id="notes-editor-wrap">
        <div id="notes-find-layer" class="notes-find-layer" aria-hidden="true"></div>
        <textarea id="notes-area" class="notes-editor" spellcheck="false"></textarea>
      </div>
      <div class="notes-status" id="notes-status">
        <div class="notes-status-left">
          <span id="notes-status-pos">Ln 1, Col 1</span>
          <span id="notes-status-chars">0 characters</span>
        </div>
        <div class="notes-status-right">
          <span>Plain text</span>
          <span id="notes-status-zoom">100%</span>
          <span>Windows (CRLF)</span>
          <span>UTF-8</span>
        </div>
      </div>
      <div id="notes-saveas-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:40">
        <div style="width:min(360px,calc(100% - 30px));background:rgba(8,8,14,.98);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.75)">
          <div style="font-size:10px;color:var(--text3);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px">save as</div>
          <input id="notes-saveas-input" class="inp" placeholder="filename.txt" style="margin:0 0 10px 0">
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button id="notes-saveas-cancel" class="btn btn-dim" style="padding:6px 10px">cancel</button>
            <button id="notes-saveas-confirm" class="btn" style="padding:6px 10px">save</button>
          </div>
        </div>
      </div>
      <div id="notes-close-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:41">
        <div style="width:min(420px,calc(100% - 30px));background:rgba(8,8,14,.98);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.75)">
          <div style="font-size:10px;color:var(--text3);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px">unsaved changes</div>
          <div id="notes-close-message" style="font-size:11px;color:#d9d9df;line-height:1.5;margin-bottom:12px">Save changes before closing?</div>
          <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
            <button id="notes-close-cancel" class="btn btn-dim" style="padding:6px 10px">cancel</button>
            <button id="notes-close-discard" class="btn btn-dim" style="padding:6px 10px">don't save</button>
            <button id="notes-close-saveas" class="btn btn-dim" style="padding:6px 10px">save as</button>
            <button id="notes-close-save" class="btn" style="padding:6px 10px">save</button>
          </div>
        </div>
      </div>
      <div id="notes-replace-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:40">
        <div style="width:min(400px,calc(100% - 30px));background:rgba(8,8,14,.98);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.75)">
          <div style="font-size:10px;color:var(--text3);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px">replace</div>
          <input id="notes-replace-find" class="inp" placeholder="find" style="margin:0 0 8px 0">
          <input id="notes-replace-with" class="inp" placeholder="replace with" style="margin:0 0 10px 0">
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button id="notes-replace-cancel" class="btn btn-dim" style="padding:6px 10px">cancel</button>
            <button id="notes-replace-confirm" class="btn" style="padding:6px 10px">replace all</button>
          </div>
        </div>
      </div>
      <div id="notes-link-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:40">
        <div style="width:min(420px,calc(100% - 30px));background:rgba(8,8,14,.98);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:12px;box-shadow:0 18px 40px rgba(0,0,0,.75)">
          <div style="font-size:10px;color:var(--text3);letter-spacing:.11em;text-transform:uppercase;margin-bottom:10px">insert link</div>
          <input id="notes-link-text" class="inp" placeholder="text (optional)" style="margin:0 0 8px 0">
          <input id="notes-link-url" class="inp" placeholder="https://example.com" style="margin:0 0 10px 0">
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button id="notes-link-cancel" class="btn btn-dim" style="padding:6px 10px">cancel</button>
            <button id="notes-link-confirm" class="btn" style="padding:6px 10px">insert</button>
          </div>
        </div>
      </div>
    </div>
  `;

  createWin('notes', 'notes', 760, 520, html);
  setTimeout(bindNotesUI, 50);
}

function bindNotesUI() {
  if (!document.getElementById('win-notes')) return;
  renderNotesMenus();
  renderNotesTabs();
  applyNotesWrap();
  applyNotesZoom();
  applyNotesStatusBar();
  updateNotesStatus();

  const area = document.getElementById('notes-area');
  const findInput = document.getElementById('notes-find');
  if (area) {
    area.addEventListener('beforeinput', notesHandleEditorBeforeInput);
    area.addEventListener('input', () => {
      notesApplyPendingLinkMutation();
      syncActiveNotesTabFromEditor();
      updateNotesStatus();
      notesUpdateFindHighlights();
    });
    area.addEventListener('keydown', notesHandleEditorKeydown);
    area.addEventListener('click', notesHandleEditorClick);
    area.addEventListener('scroll', syncNotesFindLayerScroll);
    ['click', 'keyup', 'select', 'mouseup'].forEach((eventName) => {
      area.addEventListener(eventName, updateNotesStatus);
    });
  }

  if (findInput) {
    findInput.addEventListener('input', () => notesUpdateFindHighlights());
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) notesFindPrevious();
        else notesFindNext();
      }
    });
  }

  document.getElementById('notes-newtab')?.addEventListener('click', () => notesNewTab());
  document.querySelectorAll('[data-notes-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => runNotesFormatCommand(btn.dataset.notesCmd || ''));
  });
  document.getElementById('notes-style')?.addEventListener('change', (e) => {
    notesApplyTextStyle(String(e.target.value || 'p'));
  });
  document.getElementById('notes-font')?.addEventListener('change', (e) => notesApplyFont(String(e.target.value || 'var(--font-m)')));

  document.getElementById('notes-saveas-cancel')?.addEventListener('click', hideNotesSaveAsOverlay);
  document.getElementById('notes-saveas-confirm')?.addEventListener('click', notesSaveAsCurrent);
  document.getElementById('notes-saveas-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      notesSaveAsCurrent();
    }
  });
  document.getElementById('notes-close-cancel')?.addEventListener('click', hideNotesCloseOverlay);
  document.getElementById('notes-close-discard')?.addEventListener('click', notesClosePromptDiscard);
  document.getElementById('notes-close-saveas')?.addEventListener('click', notesClosePromptSaveAs);
  document.getElementById('notes-close-save')?.addEventListener('click', notesClosePromptSave);

  document.getElementById('notes-replace-cancel')?.addEventListener('click', hideNotesReplaceOverlay);
  document.getElementById('notes-replace-confirm')?.addEventListener('click', notesReplaceAllFromDialog);
  document.getElementById('notes-replace-with')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      notesReplaceAllFromDialog();
    }
  });
  document.getElementById('notes-link-cancel')?.addEventListener('click', hideNotesLinkOverlay);
  document.getElementById('notes-link-confirm')?.addEventListener('click', notesInsertLinkFromDialog);
  document.getElementById('notes-link-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      notesInsertLinkFromDialog();
    }
  });

  const win = document.getElementById('win-notes');
  if (win) {
    win.addEventListener('keydown', handleNotesShortcuts);
  }
  const tabsWrap = document.getElementById('notes-tabs');
  if (tabsWrap && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => updateNotesTabLayout());
    ro.observe(tabsWrap);
  }
  document.addEventListener('mousedown', notesHandleGlobalPointer, true);
  notesApplyTextStyle(notesState.textStyle || 'p');
  notesApplyFont(notesState.fontFamily || 'var(--font-m)');
  notesUpdateFindHighlights();
}

function notesHandleGlobalPointer(e) {
  const root = document.getElementById('notes-root');
  if (!root) {
    document.removeEventListener('mousedown', notesHandleGlobalPointer, true);
    return;
  }
  if (!root.contains(e.target)) {
    closeNotesMenus();
    return;
  }
  if (!e.target.closest('.app-menu-wrap')) closeNotesMenus();
}

function renderNotesMenus() {
  const menubar = document.getElementById('notes-menubar');
  if (!menubar) return;

  const menus = [
    {
      id: 'file',
      label: 'File',
      items: [
        { action: 'new-tab', label: 'New tab', shortcut: 'Ctrl+N' },
        { action: 'new-window', label: 'New window', shortcut: 'Ctrl+Shift+N' },
        { action: 'open-files', label: 'Open', shortcut: 'Ctrl+O' },
        'sep',
        { action: 'save', label: 'Save', shortcut: 'Ctrl+S' },
        { action: 'save-as', label: 'Save as', shortcut: 'Ctrl+Shift+S' },
        { action: 'save-all', label: 'Save all', shortcut: 'Ctrl+Alt+S' },
        'sep',
        { action: 'close-tab', label: 'Close tab', shortcut: 'Ctrl+W' },
        { action: 'close-window', label: 'Close window', shortcut: 'Ctrl+Shift+W' },
        { action: 'exit', label: 'Exit' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { action: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
        { action: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
        { action: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
        { action: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
        { action: 'delete', label: 'Delete', shortcut: 'Del' },
        { action: 'clear-formatting', label: 'Clear formatting' },
        'sep',
        { action: 'find', label: 'Find', shortcut: 'Ctrl+F' },
        { action: 'find-next', label: 'Find next', shortcut: 'F3' },
        { action: 'find-prev', label: 'Find previous', shortcut: 'Shift+F3' },
        { action: 'replace', label: 'Replace', shortcut: 'Ctrl+H' },
        { action: 'go-to', label: 'Go to', shortcut: 'Ctrl+G' },
        { action: 'select-all', label: 'Select all', shortcut: 'Ctrl+A' },
        { action: 'time-date', label: 'Time/Date', shortcut: 'F5' },
        { action: 'font', label: 'Font' },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { action: 'zoom-in', label: 'Zoom in', shortcut: 'Ctrl++' },
        { action: 'zoom-out', label: 'Zoom out', shortcut: 'Ctrl+-' },
        { action: 'zoom-reset', label: 'Reset zoom', shortcut: 'Ctrl+0' },
        'sep',
        { action: 'status-bar', label: 'Status bar', checked: () => notesState.showStatusBar },
        { action: 'word-wrap', label: 'Word wrap', checked: () => notesState.wordWrap },
      ],
    },
  ];

  menubar.innerHTML = menus
    .map((menu) => {
      const panelHtml = menu.items
        .map((item) => {
          if (item === 'sep') return '<div class="app-menu-sep"></div>';
          const checked = typeof item.checked === 'function' && item.checked() ? '<span class="app-menu-check">&#10003;</span>' : '<span class="app-menu-check"></span>';
          const shortcut = item.shortcut ? `<span class="app-menu-shortcut">${item.shortcut}</span>` : '<span class="app-menu-shortcut"></span>';
          return `<button class="app-menu-item" data-notes-menu-action="${item.action}">${checked}<span style="flex:1;min-width:0">${item.label}</span>${shortcut}</button>`;
        })
        .join('');
      return `
        <div class="app-menu-wrap ${notesState.openMenu === menu.id ? 'open' : ''}" data-notes-menu="${menu.id}">
          <button class="app-menu-btn" data-notes-open-menu="${menu.id}">${menu.label}</button>
          <div class="app-menu-panel ${notesState.openMenu === menu.id ? 'show' : ''}" data-notes-menu-panel="${menu.id}">${panelHtml}</div>
        </div>
      `;
    })
    .join('');

  menubar.querySelectorAll('[data-notes-open-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuId = btn.dataset.notesOpenMenu;
      notesState.openMenu = notesState.openMenu === menuId ? '' : menuId;
      renderNotesMenus();
    });
    btn.parentElement?.addEventListener('mouseenter', () => {
      if (!notesState.openMenu) return;
      const menuId = btn.dataset.notesOpenMenu;
      if (menuId !== notesState.openMenu) {
        notesState.openMenu = menuId;
        renderNotesMenus();
      }
    });
  });

  menubar.querySelectorAll('[data-notes-menu-action]').forEach((row) => {
    row.addEventListener('click', (e) => {
      e.preventDefault();
      const action = row.dataset.notesMenuAction || '';
      runNotesMenuAction(action);
      closeNotesMenus();
    });
  });
}

function closeNotesMenus() {
  if (!notesState.openMenu) return;
  notesState.openMenu = '';
  renderNotesMenus();
}

function runNotesMenuAction(action) {
  if (!action) return;
  if (action === 'new-tab') return notesNewTab();
  if (action === 'new-window') return notesNewTab();
  if (action === 'open-files') return typeof launchFiles === 'function' ? launchFiles() : null;
  if (action === 'save') return notesSaveCurrent();
  if (action === 'save-as') return showNotesSaveAsOverlay();
  if (action === 'save-all') return notesSaveAll();
  if (action === 'close-tab') return notesCloseTab(notesState.active);
  if (action === 'close-window' || action === 'exit') return typeof closeWin === 'function' ? closeWin(OS.focused || 'notes') : null;

  if (action === 'undo') return notesExecNative('undo');
  if (action === 'cut') return notesExecNative('cut');
  if (action === 'copy') return notesExecNative('copy');
  if (action === 'paste') return notesExecNative('paste');
  if (action === 'delete') return notesDeleteSelection();
  if (action === 'clear-formatting') return notesClearFormatting();
  if (action === 'find') return focusNotesFind();
  if (action === 'find-next') return notesFindNext();
  if (action === 'find-prev') return notesFindPrevious();
  if (action === 'replace') return showNotesReplaceOverlay();
  if (action === 'go-to') return notesGoToLine();
  if (action === 'select-all') return notesSelectAll();
  if (action === 'time-date') return notesInsertTimeDate();
  if (action === 'font') return notesCycleFont();

  if (action === 'zoom-in') return notesAdjustZoom(.1);
  if (action === 'zoom-out') return notesAdjustZoom(-.1);
  if (action === 'zoom-reset') return notesSetZoom(1);
  if (action === 'status-bar') {
    notesState.showStatusBar = !notesState.showStatusBar;
    applyNotesStatusBar();
    renderNotesMenus();
    return;
  }
  if (action === 'word-wrap') {
    notesState.wordWrap = !notesState.wordWrap;
    applyNotesWrap();
    renderNotesMenus();
  }
}

function handleNotesShortcuts(e) {
  if (!document.getElementById('win-notes') || !String(OS.focused || '').startsWith('notes')) return;

  const key = String(e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 's') {
    e.preventDefault();
    notesSaveCurrent({ allowSaveAsPrompt: false });
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === 's') {
    e.preventDefault();
    showNotesSaveAsOverlay();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.altKey && key === 's') {
    e.preventDefault();
    notesSaveAll();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'n') {
    e.preventDefault();
    notesNewTab();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'w') {
    e.preventDefault();
    notesCloseTab(notesState.active);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === 'w') {
    e.preventDefault();
    if (typeof closeWin === 'function' && OS.focused) closeWin(OS.focused);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'f') {
    e.preventDefault();
    focusNotesFind();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'b') {
    e.preventDefault();
    runNotesFormatCommand('bold');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'i') {
    e.preventDefault();
    runNotesFormatCommand('italic');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'k') {
    e.preventDefault();
    showNotesLinkOverlay();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'h') {
    e.preventDefault();
    showNotesReplaceOverlay();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'g') {
    e.preventDefault();
    notesGoToLine();
    return;
  }
  if (e.key === 'F3') {
    e.preventDefault();
    if (e.shiftKey) notesFindPrevious();
    else notesFindNext();
    return;
  }
  if (e.key === 'F5') {
    e.preventDefault();
    notesInsertTimeDate();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && key === '0') {
    e.preventDefault();
    notesSetZoom(1);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    notesAdjustZoom(.1);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    notesAdjustZoom(-.1);
  }
}

function notesHandleEditorKeydown(e) {
  if (e.key !== 'Enter') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const area = e.target;
  if (!area || area.id !== 'notes-area') return;

  const value = area.value || '';
  const caret = area.selectionStart || 0;
  const lineStart = value.lastIndexOf('\n', Math.max(0, caret - 1)) + 1;
  const line = value.slice(lineStart, caret);

  const numbered = line.match(/^(\s*)(\d+)\.\s(.*)$/);
  if (numbered) {
    const [, indent, num, rest] = numbered;
    if (!rest.trim()) return;
    const next = Number(num) + 1;
    e.preventDefault();
    notesReplaceSelection(`\n${indent}${next}. `);
    return;
  }

  const bulleted = line.match(/^(\s*)\u2022\s(.*)$/);
  if (bulleted) {
    const [, indent, rest] = bulleted;
    if (!rest.trim()) return;
    e.preventDefault();
    notesReplaceSelection(`\n${indent}\u2022 `);
  }
}

function renderNotesTabs(options = {}) {
  const hydrate = options.hydrate !== false;
  const focusEditor = options.focusEditor !== false;
  const tabsEl = document.getElementById('notes-tabs');
  const addBtn = document.getElementById('notes-newtab');
  if (!tabsEl || !addBtn) return;

  const existing = new Map(
    [...tabsEl.querySelectorAll('.notes-tab')].map((node) => [node.dataset.tabid || '', node]),
  );

  notesState.tabs.forEach((tab) => {
    const key = String(tab.id);
    let node = existing.get(key);
    if (!node) {
      node = document.createElement('button');
      node.className = 'notes-tab opening';
      node.dataset.tabid = key;
      node.innerHTML = `<span class="notes-tab-title-wrap"><span class="notes-tab-title"></span><span class="notes-tab-dirty" aria-hidden="true"></span></span><button class="notes-tab-close" data-notes-close="${tab.id}" title="close">x</button>`;
      setTimeout(() => node.classList.remove('opening'), 180);
      node.addEventListener('mousedown', () => {
        if (typeof window.__setCursorMode === 'function') window.__setCursorMode('default');
      });
      node.addEventListener('click', (e) => {
        const tabId = Number.parseInt(node.dataset.tabid || '0', 10);
        if (!tabId) return;
        if (e.target.closest('[data-notes-close]')) {
          e.stopPropagation();
          notesCloseTab(tabId);
          return;
        }
        if (tabId === notesState.active) return;
        syncActiveNotesTabFromEditor();
        notesState.active = tabId;
        hydrateNotesEditorFromActiveTab({ focusEditor: false });
        renderNotesTabs({ hydrate: false, focusEditor: false });
        if (typeof window.__setCursorMode === 'function') window.__setCursorMode('default');
      });
    } else {
      existing.delete(key);
    }
    const title = node.querySelector('.notes-tab-title');
    if (title) title.textContent = tab.name || 'untitled.txt';
    const close = node.querySelector('.notes-tab-close');
    if (close) close.dataset.notesClose = key;
    node.classList.toggle('dirty', !!tab.dirty);
    node.classList.toggle('active', tab.id === notesState.active);
    tabsEl.insertBefore(node, addBtn);
  });

  existing.forEach((node) => {
    node.remove();
  });

  updateNotesTabLayout();
  if (hydrate) hydrateNotesEditorFromActiveTab({ focusEditor });
}

function updateNotesTabLayout() {
  const tabs = [...document.querySelectorAll('#notes-tabs .notes-tab')];
  const wrap = document.getElementById('notes-tabs');
  if (!tabs.length || !wrap) return;
  const previous = new Map(
    tabs.map((tab) => [
      tab.dataset.tabid || '',
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
      if (tab.classList.contains('opening') || tab.classList.contains('closing')) return;
      const prev = previous.get(tab.dataset.tabid || '');
      if (!prev) return;
      const nowLeft = tab.getBoundingClientRect().left;
      const dx = prev.left - nowLeft;
      if (Math.abs(dx) < 0.5) return;
      tab.style.transition = 'none';
      tab.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => {
        tab.style.transition = 'width .2s cubic-bezier(.22,.61,.36,1),flex-basis .2s cubic-bezier(.22,.61,.36,1),max-width .2s cubic-bezier(.22,.61,.36,1),transform .2s cubic-bezier(.22,.61,.36,1),background-color .16s ease,color .16s ease';
        tab.style.transform = '';
      });
    });
  });
}

function hydrateNotesEditorFromActiveTab(options = {}) {
  const focusEditor = options.focusEditor !== false;
  const area = document.getElementById('notes-area');
  const tab = getActiveNotesTab();
  if (!area || !tab) return;
  area.value = tab.content || '';
  area.scrollTop = 0;
  area.scrollLeft = 0;
  if (focusEditor) area.focus();
  updateNotesStatus();
  notesUpdateFindHighlights();
}

function syncActiveNotesTabFromEditor() {
  const tab = getActiveNotesTab();
  const area = document.getElementById('notes-area');
  if (!tab || !area) return;
  tab.content = area.value;
  notesRefreshTabDirty(tab);
  notesUpdateTabDirtyUi(tab.id);
}

function notesNewTab(name = 'untitled.txt', content = '', fileRef = null) {
  syncActiveNotesTabFromEditor();
  const id = ++notesState.seq;
  notesState.tabs.push({ id, name, content, savedContent: content, dirty: false, fileRef: fileRef || null, links: [] });
  notesState.active = id;
  renderNotesTabs({ focusEditor: true });
}

function notesAnimateCloseTab(id) {
  if (notesState.closingTabIds.has(id)) return;
  const node = document.querySelector(`#notes-tabs .notes-tab[data-tabid="${id}"]`);
  if (!node) {
    notesFinalizeCloseTab(id);
    return;
  }
  notesState.closingTabIds.add(id);
  node.classList.add('closing');
  updateNotesTabLayout();
  setTimeout(() => {
    notesFinalizeCloseTab(id);
  }, 165);
}

function notesFinalizeCloseTab(id) {
  notesState.closingTabIds.delete(id);
  if (notesState.tabs.length <= 1) return;
  const idx = notesState.tabs.findIndex((tab) => tab.id === id);
  if (idx < 0) return;
  const wasActive = notesState.active === id;
  notesState.tabs.splice(idx, 1);
  const staleNode = document.querySelector(`#notes-tabs .notes-tab[data-tabid="${id}"]`);
  staleNode?.remove();
  if (wasActive) {
    const next = notesState.tabs[idx] || notesState.tabs[idx - 1] || notesState.tabs[0];
    notesState.active = next?.id || notesState.tabs[0]?.id || null;
  }
  renderNotesTabs({ hydrate: wasActive, focusEditor: false });
}

function notesCloseTab(id) {
  if (notesState.tabs.length <= 1) return;
  syncActiveNotesTabFromEditor();
  const tab = getNotesTabById(id);
  if (!tab) return;
  notesRefreshTabDirty(tab);
  if (tab.dirty) {
    showNotesCloseOverlay(id);
    return;
  }
  notesAnimateCloseTab(id);
}

function notesHandleEditorBeforeInput(e) {
  const area = e.target;
  if (!area || area.id !== 'notes-area') return;
  const start = area.selectionStart || 0;
  const end = area.selectionEnd || 0;
  let insertText = null;
  if (typeof e.data === 'string') insertText = e.data;
  else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') insertText = '\n';
  else if (String(e.inputType || '').startsWith('delete')) insertText = '';
  else if (e.inputType === 'insertFromPaste') {
    const pasted = e.clipboardData?.getData?.('text/plain') || e.dataTransfer?.getData?.('text/plain');
    if (typeof pasted === 'string') insertText = pasted;
  }
  notesState.pendingEdit = { start, end, insertText };
}

function notesHandleEditorClick(e) {
  if (notesState.justInsertedLink) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  setTimeout(() => notesTryOpenLinkAtCaret(), 0);
}

function notesApplyPendingLinkMutation() {
  const pending = notesState.pendingEdit;
  notesState.pendingEdit = null;
  if (!pending) return;
  const tab = getActiveNotesTab();
  if (!tab) return;
  if (typeof pending.insertText !== 'string') {
    tab.links = [];
    return;
  }
  notesAdjustActiveTabLinks(pending.start, pending.end, pending.insertText.length);
}

function notesAdjustActiveTabLinks(start, end, replacementLength) {
  const tab = getActiveNotesTab();
  if (!tab) return;
  if (!Array.isArray(tab.links)) tab.links = [];
  const delta = replacementLength - Math.max(0, end - start);
  tab.links = tab.links
    .map((link) => ({
      start: Number(link?.start || 0),
      end: Number(link?.end || 0),
      url: String(link?.url || ''),
    }))
    .filter((link) => link.url && link.end > link.start)
    .reduce((acc, link) => {
      if (link.end <= start) {
        acc.push(link);
        return acc;
      }
      if (link.start >= end) {
        acc.push({ ...link, start: link.start + delta, end: link.end + delta });
        return acc;
      }
      return acc;
    }, [])
    .sort((a, b) => a.start - b.start);
}

function notesAddLinkRange(start, end, url) {
  const tab = getActiveNotesTab();
  if (!tab) return;
  if (!Array.isArray(tab.links)) tab.links = [];
  tab.links.push({ start, end, url: String(url || '') });
  tab.links = tab.links
    .filter((link) => link.url && Number.isFinite(link.start) && Number.isFinite(link.end) && link.end > link.start)
    .sort((a, b) => a.start - b.start);
}

function notesApplyRangeText(area, replacement, start, end, selectionMode = 'end') {
  notesAdjustActiveTabLinks(start, end, String(replacement || '').length);
  area.setRangeText(replacement, start, end, selectionMode);
}

function notesSaveCurrent(options = {}) {
  const tabId = Number.parseInt(String(options.tabId || notesState.active || ''), 10) || notesState.active;
  if (tabId === notesState.active) syncActiveNotesTabFromEditor();
  const tab = getNotesTabById(tabId);
  if (!tab) return;

  localStorage.setItem('os-notes-default', tab.content || '');
  if (!tab.fileRef) {
    const rawName = String(tab.name || '').trim() || 'untitled.txt';
    const name = rawName.includes('.') ? rawName : `${rawName}.txt`;
    const ext = getNotesExtFromName(name);
    if (typeof window.addFileToDir === 'function') {
      const item = window.addFileToDir('documents', {
        name,
        type: 'file',
        ext,
        content: tab.content || '',
      });
      tab.fileRef = item || tab.fileRef;
      tab.name = item?.name || name;
    } else if (options.allowSaveAsPrompt !== false) {
      notesState.pendingSaveAsTabId = tab.id;
      notesState.pendingCloseAfterSaveAs = options.closeAfterSave ? tab.id : null;
      showNotesSaveAsOverlay(tab.id);
      return;
    } else {
      notify('notes', 'unable to save');
      return;
    }
  }
  if (tab.fileRef) {
    tab.fileRef.content = tab.content || '';
    if (!tab.fileRef.ext) tab.fileRef.ext = getNotesExtFromName(tab.name);
    if (typeof saveOS === 'function') saveOS();
  }
  notesMarkTabSaved(tab);
  notesUpdateTabDirtyUi(tab.id);
  notify('notes', 'saved');
}

function notesSaveAll() {
  syncActiveNotesTabFromEditor();
  notesState.tabs.forEach((tab) => {
    if (tab.fileRef) tab.fileRef.content = tab.content || '';
    notesMarkTabSaved(tab);
  });
  if (typeof saveOS === 'function') saveOS();
  const active = getActiveNotesTab();
  if (active) localStorage.setItem('os-notes-default', active.content || '');
  renderNotesTabs({ hydrate: false, focusEditor: false });
  notify('notes', 'all tabs saved');
}

function showNotesSaveAsOverlay(tabId = notesState.active) {
  const tab = getNotesTabById(tabId);
  const overlay = document.getElementById('notes-saveas-overlay');
  const input = document.getElementById('notes-saveas-input');
  if (!overlay || !input || !tab) return;
  if (tab.id === notesState.active) syncActiveNotesTabFromEditor();
  notesState.pendingSaveAsTabId = tab.id;
  input.value = tab.name || 'untitled.txt';
  overlay.style.display = 'flex';
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function hideNotesSaveAsOverlay() {
  if (notesState.pendingWindowClose) {
    notesState.pendingWindowClose = false;
    notesState.allowWindowCloseOnce = false;
    notesState.windowCloseDiscardedTabIds.clear();
  }
  const overlay = document.getElementById('notes-saveas-overlay');
  if (overlay) overlay.style.display = 'none';
  notesState.pendingSaveAsTabId = null;
  notesState.pendingCloseAfterSaveAs = null;
}

function notesSaveAsCurrent() {
  const tabId = Number.parseInt(String(notesState.pendingSaveAsTabId || notesState.active || ''), 10) || notesState.active;
  if (tabId === notesState.active) syncActiveNotesTabFromEditor();
  const tab = getNotesTabById(tabId);
  const input = document.getElementById('notes-saveas-input');
  if (!tab || !input) return;

  const rawName = String(input.value || '').trim();
  if (!rawName) return;
  const name = rawName.includes('.') ? rawName : `${rawName}.txt`;
  const ext = getNotesExtFromName(name);

  if (typeof window.addFileToDir === 'function') {
    const item = window.addFileToDir('documents', {
      name,
      type: 'file',
      ext,
      content: tab.content || '',
    });
    tab.fileRef = item || tab.fileRef;
    tab.name = item?.name || name;
  } else {
    tab.name = name;
  }
  notesMarkTabSaved(tab);

  const closeAfterId = notesState.pendingCloseAfterSaveAs;
  const keepWindowClose = notesState.pendingWindowClose;
  if (keepWindowClose) {
    const overlay = document.getElementById('notes-saveas-overlay');
    if (overlay) overlay.style.display = 'none';
    notesState.pendingSaveAsTabId = null;
    notesState.pendingCloseAfterSaveAs = null;
  } else {
    hideNotesSaveAsOverlay();
  }
  renderNotesTabs({ hydrate: false, focusEditor: false });
  if (typeof saveOS === 'function') saveOS();
  notify('notes', `saved as ${tab.name}`);
  if (closeAfterId === tab.id) {
    if (notesState.pendingWindowClose) {
      notesContinueWindowCloseFlow();
      return;
    }
    notesAnimateCloseTab(tab.id);
    return;
  }
}

function showNotesCloseOverlay(tabId) {
  const tab = getNotesTabById(tabId);
  const overlay = document.getElementById('notes-close-overlay');
  const message = document.getElementById('notes-close-message');
  if (!tab || !overlay || !message) return;
  notesState.pendingClosePromptTabId = tab.id;
  message.textContent = `Save changes to "${tab.name || 'untitled.txt'}" before closing?`;
  overlay.style.display = 'flex';
  setTimeout(() => {
    document.getElementById('notes-close-save')?.focus();
  }, 0);
}

function hideNotesCloseOverlay() {
  const overlay = document.getElementById('notes-close-overlay');
  if (overlay) overlay.style.display = 'none';
  if (notesState.pendingWindowClose) {
    notesState.pendingWindowClose = false;
    notesState.allowWindowCloseOnce = false;
    notesState.windowCloseDiscardedTabIds.clear();
  }
  notesState.pendingClosePromptTabId = null;
}

function notesClosePromptSave() {
  const tabId = notesState.pendingClosePromptTabId;
  if (!tabId) return;
  const wasWindowClose = notesState.pendingWindowClose;
  const overlay = document.getElementById('notes-close-overlay');
  if (overlay) overlay.style.display = 'none';
  notesState.pendingClosePromptTabId = null;
  const tab = getNotesTabById(tabId);
  if (!tab) return;
  if (tab.fileRef) {
    notesSaveCurrent({ tabId });
    if (wasWindowClose) {
      notesContinueWindowCloseFlow();
      return;
    }
    notesAnimateCloseTab(tabId);
    return;
  }
  notesState.pendingCloseAfterSaveAs = tabId;
  showNotesSaveAsOverlay(tabId);
}

function notesClosePromptSaveAs() {
  const tabId = notesState.pendingClosePromptTabId;
  if (!tabId) return;
  const overlay = document.getElementById('notes-close-overlay');
  if (overlay) overlay.style.display = 'none';
  notesState.pendingClosePromptTabId = null;
  notesState.pendingCloseAfterSaveAs = tabId;
  showNotesSaveAsOverlay(tabId);
}

function notesClosePromptDiscard() {
  const tabId = notesState.pendingClosePromptTabId;
  if (!tabId) return;
  const wasWindowClose = notesState.pendingWindowClose;
  const overlay = document.getElementById('notes-close-overlay');
  if (overlay) overlay.style.display = 'none';
  notesState.pendingClosePromptTabId = null;
  if (wasWindowClose) {
    notesState.windowCloseDiscardedTabIds.add(tabId);
    notesContinueWindowCloseFlow();
    return;
  }
  notesAnimateCloseTab(tabId);
}

function notesContinueWindowCloseFlow() {
  if (!notesState.pendingWindowClose) return;
  syncActiveNotesTabFromEditor();
  let nextDirty = null;
  for (let i = 0; i < notesState.tabs.length; i += 1) {
    const tab = notesState.tabs[i];
    notesRefreshTabDirty(tab);
    if (tab.dirty && !notesState.windowCloseDiscardedTabIds.has(tab.id)) {
      nextDirty = tab;
      break;
    }
  }
  if (nextDirty) {
    showNotesCloseOverlay(nextDirty.id);
    return;
  }
  notesState.pendingWindowClose = false;
  notesState.windowCloseDiscardedTabIds.clear();
  notesState.allowWindowCloseOnce = true;
  setTimeout(() => {
    if (typeof closeWin === 'function') closeWin(OS.focused || 'notes');
  }, 0);
}

function notesCanCloseWindow() {
  if (notesState.allowWindowCloseOnce) {
    notesState.allowWindowCloseOnce = false;
    return true;
  }
  syncActiveNotesTabFromEditor();
  notesState.windowCloseDiscardedTabIds.clear();
  let dirtyTab = null;
  for (let i = 0; i < notesState.tabs.length; i += 1) {
    const tab = notesState.tabs[i];
    notesRefreshTabDirty(tab);
    if (tab.dirty) {
      dirtyTab = tab;
      break;
    }
  }
  if (!dirtyTab) return true;
  notesState.pendingWindowClose = true;
  showNotesCloseOverlay(dirtyTab.id);
  return false;
}

function showNotesReplaceOverlay() {
  const overlay = document.getElementById('notes-replace-overlay');
  const find = document.getElementById('notes-replace-find');
  const quickFind = document.getElementById('notes-find');
  if (!overlay || !find) return;
  find.value = String(quickFind?.value || '');
  overlay.style.display = 'flex';
  setTimeout(() => find.focus(), 0);
}

function hideNotesReplaceOverlay() {
  const overlay = document.getElementById('notes-replace-overlay');
  if (overlay) overlay.style.display = 'none';
}

function notesReplaceAllFromDialog() {
  const area = document.getElementById('notes-area');
  const findInput = document.getElementById('notes-replace-find');
  const replaceInput = document.getElementById('notes-replace-with');
  const quickFind = document.getElementById('notes-find');
  if (!area || !findInput || !replaceInput) return;

  const findText = String(findInput.value || '');
  if (!findText) return;
  const replacement = String(replaceInput.value || '');
  const safeRegex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  area.value = area.value.replace(safeRegex, replacement);
  const tab = getActiveNotesTab();
  if (tab) tab.links = [];
  if (quickFind) quickFind.value = findText;
  hideNotesReplaceOverlay();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
  notesUpdateFindHighlights();
  notify('notes', 'replace complete');
}

function showNotesLinkOverlay() {
  const overlay = document.getElementById('notes-link-overlay');
  const textInput = document.getElementById('notes-link-text');
  const urlInput = document.getElementById('notes-link-url');
  const area = document.getElementById('notes-area');
  if (!overlay || !textInput || !urlInput || !area) return;

  const selected = area.value.slice(area.selectionStart, area.selectionEnd).trim();
  textInput.value = selected;
  urlInput.value = 'https://';
  overlay.style.display = 'flex';
  setTimeout(() => {
    if (selected) urlInput.focus();
    else textInput.focus();
  }, 0);
}

function hideNotesLinkOverlay() {
  const overlay = document.getElementById('notes-link-overlay');
  if (overlay) overlay.style.display = 'none';
}

function notesInsertLinkFromDialog() {
  const textInput = document.getElementById('notes-link-text');
  const urlInput = document.getElementById('notes-link-url');
  const area = document.getElementById('notes-area');
  if (!textInput || !urlInput || !area) return;

  let text = String(textInput.value || '').trim();
  let url = String(urlInput.value || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (!text) text = 'regular link';

  const start = area.selectionStart || 0;
  notesState.justInsertedLink = true;
  notesReplaceSelection(text);
  notesAddLinkRange(start, start + text.length, url);
  notesRenderFindLayer();
  hideNotesLinkOverlay();
  setTimeout(() => {
    notesState.justInsertedLink = false;
  }, 100);
}

function notesTryOpenLinkAtCaret() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  if ((area.selectionStart || 0) !== (area.selectionEnd || 0)) return;
  const link = notesFindLinkAtCaret(area.value || '', area.selectionStart || 0);
  if (!link) return;
  notesOpenLinkInBrowser(link.url);
}

function notesFindLinkAtCaret(text, caret) {
  const tab = getActiveNotesTab();
  const links = Array.isArray(tab?.links) ? tab.links : [];
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    const start = Number(link?.start || 0);
    const end = Number(link?.end || 0);
    if (caret >= start && caret <= end && link?.url) return { url: link.url };
  }

  // backward compatibility for existing plain-text links already in notes content
  const labeledLink = /([^\n()]{1,200})\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = labeledLink.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    if (caret >= start && caret <= end) return { url: match[2] };
  }
  const markdownLike = /\b((?:https?:\/\/)[^\s)]+)\b/g;
  while ((match = markdownLike.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    if (caret >= start && caret <= end) return { url: match[1] };
  }
  const parenUrl = /\((https?:\/\/[^\s)]+)\)/g;
  while ((match = parenUrl.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    if (caret >= start && caret <= end) return { url: match[1] };
  }
  return null;
}

function notesOpenLinkInBrowser(url) {
  let target = String(url || '').trim();
  if (!target) return;
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  if (typeof window.browserOpenUrl === 'function') {
    window.browserOpenUrl(target, { newTab: true });
    notify('notes', `opened ${target}`);
    return;
  }
  if (typeof window.browserReceiveFile === 'function') {
    window.browserReceiveFile({ url: target });
    notify('notes', `opened ${target}`);
    return;
  }
  if (typeof launchApp === 'function') {
    launchApp('browser');
    setTimeout(() => {
      try {
        if (typeof browserNavigate === 'function') browserNavigate(target);
      } catch {}
    }, 120);
  }
}

function focusNotesFind() {
  const find = document.getElementById('notes-find');
  if (!find) return;
  find.focus();
  find.select();
}

function notesFindNext() {
  const area = document.getElementById('notes-area');
  const find = document.getElementById('notes-find');
  if (!area || !find) return;
  const q = String(find.value || '').trim();
  if (!q) return;

  if (!notesState.findMatches.length) {
    notesUpdateFindHighlights();
    if (!notesState.findMatches.length) return notify('notes', 'not found');
  }
  notesState.findIndex = (notesState.findIndex + 1) % notesState.findMatches.length;
  const idx = notesState.findMatches[notesState.findIndex];
  area.focus();
  area.setSelectionRange(idx, idx + q.length);
  notesRenderFindLayer();
  updateNotesStatus();
}

function notesFindPrevious() {
  const area = document.getElementById('notes-area');
  const find = document.getElementById('notes-find');
  if (!area || !find) return;
  const q = String(find.value || '').trim();
  if (!q) return;

  if (!notesState.findMatches.length) {
    notesUpdateFindHighlights();
    if (!notesState.findMatches.length) return notify('notes', 'not found');
  }
  if (notesState.findIndex < 0) notesState.findIndex = notesState.findMatches.length;
  notesState.findIndex = (notesState.findIndex - 1 + notesState.findMatches.length) % notesState.findMatches.length;
  const idx = notesState.findMatches[notesState.findIndex];
  area.focus();
  area.setSelectionRange(idx, idx + q.length);
  notesRenderFindLayer();
  updateNotesStatus();
}

function notesUpdateFindHighlights() {
  const area = document.getElementById('notes-area');
  const findInput = document.getElementById('notes-find');
  if (!area || !findInput) return;
  const q = String(findInput.value || '');
  notesState.findQuery = q;
  notesState.findMatches = [];
  notesState.findIndex = -1;
  if (q.trim()) {
    const source = area.value.toLowerCase();
    const needle = q.toLowerCase();
    let from = 0;
    while (from <= source.length) {
      const idx = source.indexOf(needle, from);
      if (idx < 0) break;
      notesState.findMatches.push(idx);
      from = idx + Math.max(1, needle.length);
    }
  }
  notesUpdateFindCount();
  notesRenderFindLayer();
}

function notesUpdateFindCount() {
  const countEl = document.getElementById('notes-find-count');
  if (!countEl) return;
  const total = notesState.findMatches.length;
  if (!notesState.findQuery.trim()) {
    countEl.textContent = '0 matches';
    return;
  }
  countEl.textContent = `${total} match${total === 1 ? '' : 'es'}`;
}

function notesNormalizedLinksForText(textLength) {
  const tab = getActiveNotesTab();
  if (!tab) return [];
  if (!Array.isArray(tab.links)) tab.links = [];
  tab.links = tab.links
    .map((link) => ({
      start: Number(link?.start || 0),
      end: Number(link?.end || 0),
      url: String(link?.url || ''),
    }))
    .filter((link) => link.url && link.end > link.start && link.start >= 0 && link.end <= textLength)
    .sort((a, b) => a.start - b.start);
  return tab.links;
}

function notesRenderRangeWithLinks(text, start, end, links, markClass = '') {
  if (end <= start) return '';
  const boundaries = [start, end];
  links.forEach((link) => {
    if (link.end <= start || link.start >= end) return;
    boundaries.push(Math.max(start, link.start));
    boundaries.push(Math.min(end, link.end));
  });
  boundaries.sort((a, b) => a - b);
  const unique = [...new Set(boundaries)];
  let html = '';
  for (let i = 0; i < unique.length - 1; i += 1) {
    const segStart = unique[i];
    const segEnd = unique[i + 1];
    if (segEnd <= segStart) continue;
    const raw = escapeNotesHtml(text.slice(segStart, segEnd));
    const isLink = links.some((link) => segStart >= link.start && segEnd <= link.end);
    let chunk = raw;
    if (markClass) chunk = `<mark class="${markClass}">${chunk}</mark>`;
    if (isLink) chunk = `<span class="notes-link-vis">${chunk}</span>`;
    html += chunk;
  }
  return html;
}

function notesRenderFindLayer() {
  const area = document.getElementById('notes-area');
  const layer = document.getElementById('notes-find-layer');
  if (!area || !layer) return;

  layer.style.fontFamily = area.style.fontFamily || notesState.fontFamily || 'var(--font-m)';
  layer.style.fontSize = area.style.fontSize || '12px';
  layer.style.lineHeight = getComputedStyle(area).lineHeight;
  layer.style.letterSpacing = getComputedStyle(area).letterSpacing;
  layer.classList.toggle('nowrap', area.classList.contains('nowrap'));
  layer.classList.toggle('style-h1', area.classList.contains('style-h1'));
  layer.classList.toggle('style-h2', area.classList.contains('style-h2'));
  layer.classList.toggle('style-h3', area.classList.contains('style-h3'));
  layer.classList.toggle('style-quote', area.classList.contains('style-quote'));
  layer.classList.toggle('style-code', area.classList.contains('style-code'));

  const q = notesState.findQuery;
  const text = area.value || '';
  const links = notesNormalizedLinksForText(text.length);
  if (!q.trim() || !notesState.findMatches.length) {
    layer.innerHTML = `${notesRenderRangeWithLinks(text, 0, text.length, links)}<span class="notes-find-eol"> </span>`;
    syncNotesFindLayerScroll();
    return;
  }

  const qLen = q.length;
  let cursor = 0;
  let html = '';
  notesState.findMatches.forEach((start, idx) => {
    if (start < cursor) return;
    html += notesRenderRangeWithLinks(text, cursor, start, links);
    html += notesRenderRangeWithLinks(
      text,
      start,
      start + qLen,
      links,
      `notes-find-hit${idx === notesState.findIndex ? ' active' : ''}`,
    );
    cursor = start + qLen;
  });
  html += notesRenderRangeWithLinks(text, cursor, text.length, links);
  layer.innerHTML = `${html}<span class="notes-find-eol"> </span>`;
  syncNotesFindLayerScroll();
}

function syncNotesFindLayerScroll() {
  const area = document.getElementById('notes-area');
  const layer = document.getElementById('notes-find-layer');
  if (!area || !layer) return;
  layer.scrollTop = area.scrollTop;
  layer.scrollLeft = area.scrollLeft;
}

function notesGoToLine() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const lineRaw = window.prompt('go to line:', '1');
  if (lineRaw == null) return;
  const line = Math.max(1, parseInt(lineRaw, 10) || 1);
  const lines = area.value.split('\n');
  let pos = 0;
  for (let i = 1; i < line && i <= lines.length; i += 1) {
    pos += lines[i - 1].length + 1;
  }
  area.focus();
  area.setSelectionRange(pos, pos);
  updateNotesStatus();
}

function notesSelectAll() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  area.focus();
  area.setSelectionRange(0, area.value.length);
  updateNotesStatus();
}

function notesInsertTimeDate() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const text = new Date().toLocaleString();
  notesReplaceSelection(text);
}

function notesCycleFont() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const current = area.style.fontFamily || 'var(--font-m)';
  if (current.includes('serif')) area.style.fontFamily = 'var(--font-m)';
  else area.style.fontFamily = "'DM Serif Display', Georgia, 'Times New Roman', serif";
}

function notesDeleteSelection() {
  notesReplaceSelection('');
}

function notesClearFormatting() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const { selectionStart, selectionEnd } = area;
  const raw = area.value.slice(selectionStart, selectionEnd) || area.value;
  const cleaned = raw
    .replace(/^\s{0,3}(#{1,6}|>|-|\*|•|\d+\.)\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\((https?:\/\/[^\s)]+)\)/g, '$1');

  if (selectionStart === selectionEnd) {
    area.value = cleaned;
    const tab = getActiveNotesTab();
    if (tab) tab.links = [];
    area.setSelectionRange(0, cleaned.length);
  } else {
    notesApplyRangeText(area, cleaned, selectionStart, selectionEnd, 'select');
  }
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function notesExecNative(cmd) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  area.focus();
  try {
    document.execCommand(cmd);
  } catch {}
}

function runNotesFormatCommand(cmd) {
  if (cmd === 'bold') return notesToggleWrappedSelection('**', '**');
  if (cmd === 'italic') return notesToggleWrappedSelection('*', '*');
  if (cmd === 'link') return showNotesLinkOverlay();
  if (cmd === 'bullet') return notesPrefixSelectedLines('• ');
  if (cmd === 'number') return notesNumberSelectedLines();
}

function notesApplyTextStyle(styleId) {
  notesState.textStyle = ['p', 'h1', 'h2', 'h3', 'quote', 'code'].includes(styleId) ? styleId : 'p';
  const area = document.getElementById('notes-area');
  if (!area) return;
  const select = document.getElementById('notes-style');
  if (select) select.value = notesState.textStyle;
  area.classList.remove('style-h1', 'style-h2', 'style-h3', 'style-quote', 'style-code');
  if (notesState.textStyle !== 'p') area.classList.add(`style-${notesState.textStyle}`);
  notesRenderFindLayer();
}

function notesApplyFont(fontFamily) {
  notesState.fontFamily = fontFamily || 'var(--font-m)';
  const area = document.getElementById('notes-area');
  if (area) area.style.fontFamily = notesState.fontFamily;
  const select = document.getElementById('notes-font');
  if (select) select.value = notesState.fontFamily;
  notesRenderFindLayer();
}

function notesWrapSelection(prefix, suffix) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.slice(start, end);
  const replacement = `${prefix}${selected || 'text'}${suffix}`;
  notesApplyRangeText(area, replacement, start, end, 'select');
  area.focus();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function notesToggleWrappedSelection(prefix, suffix) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const value = area.value || '';
  const selected = value.slice(start, end) || 'text';
  const before = value.slice(start - prefix.length, start);
  const after = value.slice(end, end + suffix.length);
  if (before === prefix && after === suffix) {
    area.setSelectionRange(start - prefix.length, end + suffix.length);
    notesApplyRangeText(area, selected, start - prefix.length, end + suffix.length, 'select');
  } else {
    notesApplyRangeText(area, `${prefix}${selected}${suffix}`, start, end, 'select');
  }
  area.focus();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function notesReplaceSelection(text) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  notesApplyRangeText(area, text, start, end, 'end');
  area.focus();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function notesPrefixSelectedLines(prefix) {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const text = area.value;
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndBreak = text.indexOf('\n', end);
  const lineEnd = lineEndBreak < 0 ? text.length : lineEndBreak;
  const block = text.slice(lineStart, lineEnd);
  const updated = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`))
    .join('\n');
  notesApplyRangeText(area, updated, lineStart, lineEnd, 'end');
  area.focus();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function notesNumberSelectedLines() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const text = area.value;
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndBreak = text.indexOf('\n', end);
  const lineEnd = lineEndBreak < 0 ? text.length : lineEndBreak;
  const block = text.slice(lineStart, lineEnd);
  const updated = block
    .split('\n')
    .map((line, idx) => `${idx + 1}. ${line.replace(/^\d+\.\s+/, '')}`)
    .join('\n');
  notesApplyRangeText(area, updated, lineStart, lineEnd, 'end');
  area.focus();
  syncActiveNotesTabFromEditor();
  updateNotesStatus();
}

function applyNotesWrap() {
  const area = document.getElementById('notes-area');
  const layer = document.getElementById('notes-find-layer');
  if (!area) return;
  if (notesState.wordWrap) {
    area.classList.remove('nowrap');
    area.setAttribute('wrap', 'soft');
    if (layer) layer.classList.remove('nowrap');
  } else {
    area.classList.add('nowrap');
    area.setAttribute('wrap', 'off');
    if (layer) layer.classList.add('nowrap');
  }
  notesRenderFindLayer();
}

function applyNotesStatusBar() {
  const bar = document.getElementById('notes-status');
  if (!bar) return;
  bar.classList.toggle('hidden', !notesState.showStatusBar);
}

function notesSetZoom(value) {
  notesState.zoom = Math.min(2, Math.max(.7, value));
  applyNotesZoom();
}

function notesAdjustZoom(delta) {
  notesSetZoom(notesState.zoom + delta);
}

function applyNotesZoom() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  area.style.fontSize = `${(12 * notesState.zoom).toFixed(2)}px`;
  const zoom = document.getElementById('notes-status-zoom');
  if (zoom) zoom.textContent = `${Math.round(notesState.zoom * 100)}%`;
  notesRenderFindLayer();
}

function updateNotesStatus() {
  const area = document.getElementById('notes-area');
  if (!area) return;
  const pos = document.getElementById('notes-status-pos');
  const chars = document.getElementById('notes-status-chars');

  const value = area.value || '';
  const caret = area.selectionStart || 0;
  const before = value.slice(0, caret);
  const line = before.split('\n').length;
  const col = caret - before.lastIndexOf('\n');

  if (pos) pos.textContent = `Ln ${line}, Col ${col}`;
  if (chars) chars.textContent = `${value.length.toLocaleString()} characters`;
}

function getNotesExtFromName(name) {
  if (!name || !String(name).includes('.')) return 'txt';
  return String(name).split('.').pop().toLowerCase() || 'txt';
}

function escapeNotesHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.notesOpenFile = function notesOpenFile(fileItem) {
  launchNotes();
  setTimeout(() => {
    const name = fileItem?.name || 'file.txt';
    const content = String(fileItem?.content || '');
    notesNewTab(name, content, fileItem || null);
    notify('notes', `${name} opened`);
  }, 70);
};

window.notesReceiveFile = function notesReceiveFile(fileData) {
  launchNotes();
  setTimeout(() => {
    const content = typeof fileData?.content === 'string'
      ? fileData.content
      : `# dropped file\nname: ${fileData?.name || 'file'}\ntime: ${new Date().toLocaleString()}\n`;
    notesNewTab(fileData?.name || 'dropped.txt', content, fileData?.type === 'file' ? fileData : null);
    notify('notes', `${fileData?.name || 'file'} opened in new tab`);
  }, 80);
};

{
  const priorCanClose = typeof window.appCanClose === 'function' ? window.appCanClose : null;
  window.appCanClose = function appCanClose(id) {
    if (String(id || '').startsWith('notes')) return notesCanCloseWindow();
    if (priorCanClose) return priorCanClose(id);
    return true;
  };
}

