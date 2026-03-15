function launchClock() {
  if (window.shouldReuseAppWindow?.('clock') && window.focusAnyAppWindow?.('clock')) return;
  const html = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:24px">
    <div id="clock-time" style="font-family:var(--font-d);font-size:3.5rem;color:#ccc;letter-spacing:-.02em;line-height:1"></div>
    <div id="clock-date" style="font-size:11px;color:var(--text3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px"></div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="clock-tab btn" data-tab="clock">clock</button>
      <button class="clock-tab btn btn-dim" data-tab="stopwatch">stopwatch</button>
    </div>
    <div id="sw-display" style="font-family:var(--font-d);font-size:2rem;color:#444;letter-spacing:.04em;display:none">00:00.0</div>
    <div id="sw-btns" style="display:none;gap:8px">
      <button id="sw-start" class="btn">start</button>
      <button id="sw-reset" class="btn btn-dim">reset</button>
    </div>
  </div>`;
  createWin('clock', 'clock', 280, 280, html);
  setTimeout(() => {
    let swRunning = false, swStart = 0, swElapsed = 0, swInterval = null;
    function updateClock() {
      const el = document.getElementById('clock-time'); if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.getElementById('clock-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
    updateClock();
    const clkInt = setInterval(updateClock, 1000);
    document.querySelectorAll('.clock-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.tab;
        document.querySelectorAll('.clock-tab').forEach(bt => { bt.className = 'clock-tab btn btn-dim'; });
        tab.className = 'clock-tab btn';
        document.getElementById('clock-time').style.display = t === 'clock' ? '' : 'none';
        document.getElementById('clock-date').style.display = t === 'clock' ? '' : 'none';
        document.getElementById('sw-display').style.display = t === 'stopwatch' ? '' : 'none';
        document.getElementById('sw-btns').style.display = t === 'stopwatch' ? 'flex' : 'none';
      });
    });
    document.getElementById('sw-start').addEventListener('click', () => {
      swRunning = !swRunning;
      document.getElementById('sw-start').textContent = swRunning ? 'stop' : 'start';
      if (swRunning) {
        swStart = Date.now() - swElapsed;
        swInterval = setInterval(() => {
          swElapsed = Date.now() - swStart;
          const m = Math.floor(swElapsed / 60000), s = Math.floor((swElapsed % 60000) / 1000), ms = Math.floor((swElapsed % 1000) / 100);
          document.getElementById('sw-display').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
        }, 100);
      } else { clearInterval(swInterval); }
    });
    document.getElementById('sw-reset').addEventListener('click', () => {
      clearInterval(swInterval); swRunning = false; swElapsed = 0;
      document.getElementById('sw-display').textContent = '00:00.0';
      document.getElementById('sw-start').textContent = 'start';
    });
  }, 50);
}


