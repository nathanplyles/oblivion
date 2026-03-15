let dots = [];
let dotsCols = 0;
let dotsRows = 0;
let dotsSpacing = 38;

function dotIndex(x, y){
  if(x < 0 || y < 0 || x >= dotsCols || y >= dotsRows) return -1;
  return y * dotsCols + x;
}

function initDots(w, h, opts = {}) {
  dotsSpacing = Math.max(24, Number(opts.spacing) || 38);
  dots = [];
  dotsCols = Math.max(1, Math.floor(w / dotsSpacing));
  dotsRows = Math.max(1, Math.floor(h / dotsSpacing));
  for (let gy = 0; gy < dotsRows; gy++) {
    for (let gx = 0; gx < dotsCols; gx++) {
      const ox = gx * dotsSpacing + dotsSpacing / 2;
      const oy = gy * dotsSpacing + dotsSpacing / 2;
      dots.push({
        gx,
        gy,
        ox,
        oy,
        x: ox,
        y: oy,
        tx: ox,
        ty: oy,
        op: Math.random() * 0.2 + 0.04,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
}

function drawDots(ctx, w, h, rgb, mx, my, opts = {}) {
  const repelRadius = Math.max(50, Number(opts.repelRadius) || 110);
  const drift = Math.max(0, Number(opts.drift) || 0.55);
  const bulge = Math.max(0, Number(opts.bulge) || 32);
  const linkDist = Math.max(20, Number(opts.linkDist) || 44);
  const linkTarget = Math.min(linkDist * 0.76, dotsSpacing * 1.05);
  const linkStrength = 0.022 + drift * 0.018;

  for (const d of dots) {
    d.phase += 0.012 * (0.5 + drift);
    const nx = Math.sin(d.phase) * 2.8 * drift;
    const ny = Math.cos(d.phase * 0.85) * 2.8 * drift;
    const dx = mx - d.ox;
    const dy = my - d.oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const repel = Math.max(0, 1 - dist / repelRadius);
    d.tx = d.ox + nx - (dx / Math.max(dist, 1)) * repel * bulge;
    d.ty = d.oy + ny - (dy / Math.max(dist, 1)) * repel * bulge;
  }

  for (const d of dots) {
    const right = dots[dotIndex(d.gx + 1, d.gy)];
    const down = dots[dotIndex(d.gx, d.gy + 1)];
    const pairs = [right, down];
    for (const n of pairs) {
      if (!n) continue;
      const dx = n.x - d.x;
      const dy = n.y - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 0 || dist > linkDist) continue;
      const pull = (1 - dist / linkDist);
      const nx = dx / dist;
      const ny = dy / dist;
      const spring = (dist - linkTarget) * linkStrength;
      d.tx += nx * spring;
      d.ty += ny * spring;
      n.tx -= nx * spring;
      n.ty -= ny * spring;

      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = `rgba(${rgb},${pull * 0.1})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  for (const d of dots) {
    d.x += (d.tx - d.x) * 0.12;
    d.y += (d.ty - d.y) * 0.12;

    const mdx = mx - d.ox;
    const mdy = my - d.oy;
    const md = Math.sqrt(mdx * mdx + mdy * mdy);
    const repel = Math.max(0, 1 - md / repelRadius);
    const r = 1.1 + repel * 2;
    const op = d.op + repel * 0.25;
    if (repel > 0.01) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${repel * 0.06})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${op})`;
    ctx.fill();
  }
}
