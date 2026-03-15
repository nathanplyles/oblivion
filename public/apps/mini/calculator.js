function launchCalculator() {
  if (window.shouldReuseAppWindow?.('calculator') && window.focusAnyAppWindow?.('calculator')) return;
  let calcExpr = '';
  const html = `<div style="display:flex;flex-direction:column;height:100%;padding:16px;gap:10px;background:rgba(2,2,5,.98)">
    <div id="calc-display" style="background:rgba(255,255,255,.04);border:1px solid var(--border2);border-radius:8px;padding:12px 16px;font-family:var(--font-d);font-size:1.6rem;color:#ccc;text-align:right;min-height:56px;display:flex;align-items:center;justify-content:flex-end">0</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex:1">
      ${['C', '+/-', '%', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '', '='].map((k) => {
        if (!k) return '<div></div>';
        const isOp = ['/', '*', '-', '+', '='].includes(k);
        const isC = k === 'C';
        const bg = isOp ? 'rgba(var(--accent-rgb),.1)' : isC ? 'rgba(255,80,80,.08)' : 'rgba(255,255,255,.04)';
        const bc = isOp ? 'rgba(var(--accent-rgb),.18)' : isC ? 'rgba(255,80,80,.15)' : 'var(--border2)';
        const col = isOp ? 'var(--accent)' : isC ? '#ff8080' : '#aaa';
        return `<button data-calc="${k}" style="background:${bg};border:1px solid ${bc};color:${col};font-family:var(--font-m);font-size:13px;border-radius:8px;cursor:none;transition:all .1s;letter-spacing:.02em">${k}</button>`;
      }).join('')}
    </div>
  </div>`;

  createWin('calculator', 'calculator', 260, 340, html);
  setTimeout(() => {
    document.querySelectorAll('[data-calc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.calc;
        const disp = document.getElementById('calc-display');
        if (!disp) return;

        if (k === 'C') {
          calcExpr = '';
          disp.textContent = '0';
          return;
        }

        if (k === '=') {
          try {
            const r = Function('"use strict";return(' + calcExpr + ')')();
            disp.textContent = String(r);
            calcExpr = String(r);
          } catch {
            disp.textContent = 'err';
            calcExpr = '';
          }
          return;
        }

        calcExpr += (k === '+/-' ? '*-1' : k);
        disp.textContent = calcExpr.slice(-18) || '0';
      });
    });
  }, 50);
}
