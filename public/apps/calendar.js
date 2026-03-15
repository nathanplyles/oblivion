let calEvents = {};
let calTimers = [];

function calEscape(value) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _loadCalEvents() {
  try { calEvents = JSON.parse(localStorage.getItem('os-calendar-events')) || {}; } catch(e) { calEvents = {}; }
}
function _saveCalEvents() {
  localStorage.setItem('os-calendar-events', JSON.stringify(calEvents));
}

function _scheduleCalNotifs() {
  calTimers.forEach(clearTimeout);
  calTimers = [];
  const now = new Date();
  Object.entries(calEvents).forEach(([key, evts]) => {
    evts.forEach(ev => {
      if (!ev.time) return;
      const [y, m, d] = key.split('-').map(Number);
      const [h, min] = ev.time.split(':').map(Number);
      const evDate = new Date(y, m - 1, d, h, min, 0);
      const ms = evDate - now;
      if (ms > 0 && ms < 7 * 24 * 60 * 60 * 1000) {
        const t = setTimeout(() => sysNotify('calendar', `${ev.name} — now`), ms);
        calTimers.push(t);
      }
    });
  });
}

function launchCalendar() {
  if (window.shouldReuseAppWindow?.('calendar') && window.focusAnyAppWindow?.('calendar')) return;
  _loadCalEvents();
  _scheduleCalNotifs();

  let now = new Date(), viewYear = now.getFullYear(), viewMonth = now.getMonth();
  let selectedDay = null;

  const html = `<div style="display:flex;height:100%;overflow:hidden">
    <div style="flex:1;display:flex;flex-direction:column;padding:18px;min-width:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0">
        <button id="cal-prev" class="btn btn-dim" style="padding:5px 14px;font-size:11px">←</button>
        <div id="cal-month-title" style="font-family:var(--font-d);font-size:1.3rem;color:#bbb;letter-spacing:.02em"></div>
        <button id="cal-next" class="btn btn-dim" style="padding:5px 14px;font-size:11px">→</button>
      </div>
      <div id="cal-grid" style="flex:1;overflow:hidden"></div>
    </div>
    <div style="width:210px;flex-shrink:0;border-left:1px solid var(--border2);padding:18px;display:flex;flex-direction:column;gap:10px;overflow:hidden">
      <div style="font-size:10px;color:var(--text3);letter-spacing:.12em;text-transform:uppercase">events</div>
      <div id="cal-events-list" style="flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.04) transparent;font-size:11px;color:var(--text3)">select a day</div>
      <div id="cal-add-form" style="display:none;flex-direction:column;gap:6px">
        <input id="cal-event-inp" class="inp" style="margin:0" placeholder="event name..." autocomplete="off" spellcheck="false">
        <div style="display:flex;gap:6px;align-items:center">
          <input id="cal-event-time" type="time" class="inp" style="margin:0;flex:1;color-scheme:dark">
          <span style="font-size:10px;color:var(--text3)">time</span>
        </div>
        <button id="cal-add-btn" class="btn" style="padding:7px">add event</button>
      </div>
    </div>
  </div>`;

  createWin('calendar', 'calendar', 680, 440, html);

  function renderCal() {
    const title = document.getElementById('cal-month-title');
    if (title) title.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('cal-grid'); if (!grid) return;
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days = ['su','mo','tu','we','th','fr','sa'];
    let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;height:100%">
      ${days.map(d => `<div style="font-size:9px;color:var(--text3);text-align:center;padding:2px 0;letter-spacing:.1em">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div></div>').join('')}
      ${Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const key = `${viewYear}-${viewMonth + 1}-${d}`;
        const hasEvent = (calEvents[key] || []).length > 0;
        const isToday = d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
        const isSel = selectedDay?.d === d && selectedDay?.m === viewMonth && selectedDay?.y === viewYear;
        return `<button class="cal-day" data-d="${d}" data-m="${viewMonth}" data-y="${viewYear}"
          style="aspect-ratio:1;border-radius:6px;border:1px solid ${isSel?'rgba(var(--accent-rgb),.3)':'transparent'};
          background:${isSel?'rgba(var(--accent-rgb),.1)':isToday?'rgba(255,255,255,.04)':'none'};
          font-size:11px;color:${isToday||isSel?'var(--accent)':'#666'};cursor:none;transition:background .1s;position:relative;
          ${isToday?'text-shadow:0 0 10px rgba(var(--accent-rgb),.5);':''}">
          ${d}${hasEvent?`<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--accent)"></div>`:''}
        </button>`;
      }).join('')}
    </div>`;
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDay = { d: parseInt(btn.dataset.d), m: parseInt(btn.dataset.m), y: parseInt(btn.dataset.y) };
        renderCal(); renderDayEvents();
      });
    });
  }

  function renderDayEvents() {
    if (!selectedDay) return;
    const list = document.getElementById('cal-events-list');
    const form = document.getElementById('cal-add-form');
    if (!list) return;
    const key = `${selectedDay.y}-${selectedDay.m + 1}-${selectedDay.d}`;
    const evts = calEvents[key] || [];
    list.innerHTML = evts.length
      ? evts.map((ev, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);gap:6px">
          <div>
            <div style="color:#888;font-size:11px">${calEscape(ev.name)}</div>
            ${ev.time ? `<div style="color:var(--text3);font-size:10px">${calEscape(ev.time)}</div>` : ''}
          </div>
          <button data-del="${i}" data-key="${key}" style="background:none;border:none;color:#333;cursor:none;font-size:14px;transition:color .1s;padding:0 2px;flex-shrink:0">×</button>
        </div>`).join('')
      : `<div style="color:var(--text3);font-size:10px;padding-top:4px">no events — ${selectedDay.d}/${selectedDay.m + 1}</div>`;
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        calEvents[btn.dataset.key].splice(parseInt(btn.dataset.del), 1);
        _saveCalEvents(); _scheduleCalNotifs();
        renderCal(); renderDayEvents();
      });
    });
    if (form) form.style.display = 'flex';
  }

  setTimeout(() => {
    renderCal();
    document.getElementById('cal-prev').addEventListener('click', () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCal();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCal();
    });
    document.getElementById('cal-add-btn').addEventListener('click', () => {
      const nameInp = document.getElementById('cal-event-inp');
      const timeInp = document.getElementById('cal-event-time');
      if (!nameInp.value.trim() || !selectedDay) return;
      const key = `${selectedDay.y}-${selectedDay.m + 1}-${selectedDay.d}`;
      if (!calEvents[key]) calEvents[key] = [];
      calEvents[key].push({ name: nameInp.value.trim(), time: timeInp.value || '' });
      nameInp.value = ''; timeInp.value = '';
      _saveCalEvents(); _scheduleCalNotifs();
      renderCal(); renderDayEvents();
    });
    document.getElementById('cal-event-inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('cal-add-btn').click();
    });
  }, 50);
}


