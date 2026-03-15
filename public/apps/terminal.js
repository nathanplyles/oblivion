const TERM_FS = {
  '/':                    ['home','etc','bin','var'],
  '/home':                ['void','guest'],
  '/home/void':           ['documents','downloads','pictures','.config'],
  '/home/void/documents': [],
  '/home/void/downloads': [],
  '/home/void/pictures':  [],
  '/etc':                 ['hosts','os-release','passwd'],
  '/bin':                 ['ls','cd','echo','cat','clear','neofetch','help'],
  '/var':                 ['log','tmp'],
};

let termCwd = '/home/void';
let termHistory = [];
let termHistIdx = -1;

function termToPlainText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

function launchTerminal() {
  if (window.shouldReuseAppWindow?.('terminal') && window.focusAnyAppWindow?.('terminal')) return;
  termCwd = `/home/${OS.username}`;
  if (!TERM_FS[termCwd]) TERM_FS[termCwd] = ['documents','downloads','pictures','.config'];

  const html = `<div class="app-term" id="term-root" style="display:flex;flex-direction:column;height:100%;padding:14px;box-sizing:border-box;overflow:hidden">
    <div id="term-output" style="flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent;display:flex;flex-direction:column;gap:2px"></div>
    <div id="term-input-row" style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-shrink:0">
      <span class="term-ps" id="term-ps" style="white-space:nowrap;flex-shrink:0;color:var(--accent);font-size:12px;opacity:.7"></span>
      <div style="position:relative;flex:1;display:flex;align-items:center">
        <input id="term-input" autocomplete="off" spellcheck="false"
          style="background:none;border:none;outline:none;color:#aaa;font-family:var(--font-m);font-size:12px;width:100%;caret-color:var(--accent)">
      </div>
    </div>
  </div>`;

  createWin('terminal', 'terminal', 580, 380, html);

  setTimeout(() => {
    updateTermPrompt();
    termPrint('oblivionOS terminal - type help for commands', 'out');
    termPrint('', 'out');

    const inp = document.getElementById('term-input');
    if (!inp) return;
    inp.focus();

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = inp.value.trim();
        if (val) { termHistory.unshift(val); termHistIdx = -1; }
        inp.value = '';
        if (val) termExec(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (termHistIdx < termHistory.length - 1) { termHistIdx++; inp.value = termHistory[termHistIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (termHistIdx > 0) { termHistIdx--; inp.value = termHistory[termHistIdx]; }
        else { termHistIdx = -1; inp.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const parts = inp.value.split(' ');
        const last = parts[parts.length - 1];
        if (parts.length === 1) {
          const m = Object.keys(TERM_CMDS).find(c => c.startsWith(last));
          if (m) inp.value = m;
        } else {
          const items = TERM_FS[termCwd] || [];
          const m = items.find(f => f.startsWith(last));
          if (m) { parts[parts.length - 1] = m; inp.value = parts.join(' '); }
        }
      }
    });

    document.getElementById('term-root').addEventListener('click', () => inp.focus());
  }, 50);
}

function termPrint(html, type = 'out') {
  const out = document.getElementById('term-output'); if (!out) return;
  const row = document.createElement('div');
  row.style.cssText = 'font-family:var(--font-m);font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-all';
  const colors = { out: '#666', ok: 'var(--accent)', err: '#e05555', ps: '#888' };
  row.style.color = colors[type] || '#666';
  row.textContent = String(html ?? '');
  out.appendChild(row);
  out.scrollTop = out.scrollHeight;
}

function updateTermPrompt() {
  const ps = document.getElementById('term-ps'); if (!ps) return;
  const disp = termCwd.replace(`/home/${OS.username}`, '~');
  ps.textContent = `${OS.username}@oblivion:${disp}$`;
}

function resolvePath(p) {
  if (!p || p === '~') return `/home/${OS.username}`;
  if (p.startsWith('/')) return p.replace(/\/+$/, '') || '/';
  if (p === '..') { const parts = termCwd.split('/').filter(Boolean); parts.pop(); return '/' + parts.join('/') || '/'; }
  if (p === '.') return termCwd;
  return (termCwd + '/' + p).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

const TERM_CMDS = {
  help: () => {
    return ['<span style="color:var(--accent)">oblivion terminal help</span>',
      '',
      '<span style="color:#888">navigation</span>',
      '  ls        list directory contents',
      '  cd        change directory',
      '  pwd       print working directory',
      '',
      '<span style="color:#888">files</span>',
      '  cat       print file contents',
      '  mkdir     make directory',
      '  touch     create file',
      '  rm        remove file',
      '',
      '<span style="color:#888">system</span>',
      '  whoami    current user',
      '  date      current date/time',
      '  uname     system info',
      '  uptime    session uptime',
      '  ps        running windows',
      '  neofetch  system overview',
      '',
      '<span style="color:#888">apps</span>',
      '  apps      list available core apps',
      '',
      '<span style="color:#888">shell</span>',
      '  echo      print text',
      '  clear     clear terminal',
    ].join('\n');
  },
  ls: (args) => {
    const target = args[0] ? resolvePath(args[0]) : termCwd;
    const items = TERM_FS[target];
    if (items === undefined) return `<span style="color:#e05555">ls: ${target}: no such directory</span>`;
    if (items.length === 0) return '<span style="color:#444">(empty)</span>';
    return items.join('  ');
  },
  pwd: () => termCwd,
  cd: (args) => {
    const target = resolvePath(args[0] || '~');
    if (TERM_FS[target] !== undefined) {
      termCwd = target;
      updateTermPrompt();
      return null;
    }
    return `<span style="color:#e05555">cd: ${args[0]}: no such directory</span>`;
  },
  echo: (args) => args.join(' '),
  clear: () => { const out = document.getElementById('term-output'); if (out) out.innerHTML = ''; return null; },
  whoami: () => OS.username,
  date: () => new Date().toString(),
  uname: () => 'oblivionOS v0.3.0 (void-∞ kernel)',
  uptime: () => { const u = Math.floor(performance.now() / 1000); return `${Math.floor(u/3600)}h ${Math.floor((u%3600)/60)}m ${u%60}s`; },
  ps: () => {
    const wins = Object.keys(OS.wins);
    if (!wins.length) return 'no windows open';
    return wins.map((k, i) => `  ${1000 + i}  ${k}`).join('\n');
  },
  mkdir: (args) => {
    if (!args[0]) return `<span style="color:#e05555">mkdir: missing name</span>`;
    const items = TERM_FS[termCwd] || (TERM_FS[termCwd] = []);
    const full = termCwd + '/' + args[0];
    if (!items.includes(args[0])) { items.push(args[0]); TERM_FS[full] = []; }
    return `<span style="color:var(--accent)">created ${args[0]}</span>`;
  },
  touch: (args) => {
    if (!args[0]) return `<span style="color:#e05555">touch: missing name</span>`;
    const items = TERM_FS[termCwd] || (TERM_FS[termCwd] = []);
    if (!items.includes(args[0])) items.push(args[0]);
    return `<span style="color:var(--accent)">created ${args[0]}</span>`;
  },
  rm: (args) => {
    if (!args[0]) return `<span style="color:#e05555">rm: missing operand</span>`;
    const items = TERM_FS[termCwd];
    if (!items || !items.includes(args[0])) return `<span style="color:#e05555">rm: ${args[0]}: no such file</span>`;
    items.splice(items.indexOf(args[0]), 1);
    delete TERM_FS[termCwd + '/' + args[0]];
    return `<span style="color:var(--accent)">removed ${args[0]}</span>`;
  },
  cat: (args) => {
    if (!args[0]) return `<span style="color:#e05555">cat: missing filename</span>`;
    const built = {
      'etc/os-release':   'NAME=oblivionOS\nVERSION=0.3.0\nKERNEL=void-∞',
      'etc/hosts':        '127.0.0.1  localhost\n::1        localhost',
      'etc/passwd':       `${OS.username}:x:1000:1000::/home/${OS.username}:/bin/vsh`,
    };
    const rel = args[0].replace(/^\//, '').replace(/^\~\//, '');
    const content = built[rel];
    if (content) return content;
    return `<span style="color:#e05555">cat: ${args[0]}: no such file</span>`;
  },
  neofetch: () => {
    const u = Math.floor(performance.now() / 60000);
    return [
      `<span style="color:var(--accent);opacity:.5">  ╔══════╗  </span>  <span style="color:#888">os</span>       oblivionOS v0.3.0`,
      `<span style="color:var(--accent);opacity:.4">  ║ void ║  </span>  <span style="color:#888">kernel</span>   void-∞`,
      `<span style="color:var(--accent);opacity:.3">  ╚══════╝  </span>  <span style="color:#888">user</span>     ${OS.username}`,
      `             <span style="color:#888">uptime</span>   ${u}m`,
      `             <span style="color:#888">shell</span>    vsh 1.0`,
      `             <span style="color:#888">windows</span>  ${Object.keys(OS.wins).length} open`,
      `             <span style="color:#888">accent</span>   <span style="color:var(--accent)">${OS.accent}</span>`,
    ].join('\n');
  },
  apps: (args) => {
    const core = [
      'account','browser','calculator','calendar','clock','draw','files',
      'music','notes','photos','settings','terminal','weather'
    ];
    return core.map(id => `  ${id}`).join('\n');
  },
  install: (args) => {
    return 'install: app store removed, apps are preinstalled';
  },
  remove: (args) => {
    return 'remove: disabled for preinstalled core apps';
  },
  update: (args) => {
    return 'update: app store removed, core apps ship together';
  },
};

function termExec(raw) {
  const ps = document.getElementById('term-ps');
  const psText = ps ? ps.textContent : `${OS.username}@oblivion:~$`;
  termPrint(`${psText} ${raw}`, 'ps');

  const [cmd, ...args] = raw.trim().split(/\s+/);
  const fn = TERM_CMDS[cmd];
  if (!fn) {
    termPrint(`command not found: ${cmd}`, 'err');
    return;
  }
  const result = fn(args);
  if (result !== null && result !== undefined) {
    termPrint(termToPlainText(result));
  }
}

window.terminalReceiveFile = function(fileData){
  launchTerminal();
  setTimeout(() => {
    termPrint(`dropped file: ${fileData.name}`, 'out');
    termPrint(`echo "opened ${fileData.name}"`);
  }, 90);
};


