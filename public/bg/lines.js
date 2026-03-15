let lines = [];

function initLines(w, h, opts = {}) {
  const density = Math.max(0.4, Number(opts.density) || 1);
  const count = Math.max(32, Math.round(64 * density));
  lines = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    angle: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.5 + 0.12,
    len: Math.random() * 76 + 24,
    op: Math.random() * 0.09 + 0.022,
    turnPhase: Math.random() * Math.PI * 2,
    turnRate: Math.random() * 0.02 + 0.006,
  }));
}

function drawLines(ctx, w, h, rgb, mx, my, opts = {}) {
  const flow = Math.max(0.2, Number(opts.flow) || 1);
  const wander = Math.max(0, Number(opts.wander) || 0.7);

  for (const l of lines) {
    l.turnPhase += l.turnRate * (0.45 + wander * 0.9);
    l.angle += Math.sin(l.turnPhase) * 0.006 * (0.3 + wander * 1.4);

    const dx = mx - l.x;
    const dy = my - l.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 220) {
      const target = Math.atan2(dy, dx) + Math.PI;
      let diff = target - l.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      l.angle += diff * 0.018 * (1 - dist / 220);
    }

    const ex = l.x + Math.cos(l.angle) * l.len;
    const ey = l.y + Math.sin(l.angle) * l.len;
    const g = ctx.createLinearGradient(l.x, l.y, ex, ey);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.48, `rgba(${rgb},${l.op})`);
    g.addColorStop(0.52, `rgba(${rgb},${l.op})`);
    g.addColorStop(1, `rgba(${rgb},0)`);

    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    const step = l.speed * (0.22 + flow * 0.2);
    l.x += Math.cos(l.angle) * step;
    l.y += Math.sin(l.angle) * step;
    if (l.x < -40) l.x = w + 40;
    if (l.x > w + 40) l.x = -40;
    if (l.y < -40) l.y = h + 40;
    if (l.y > h + 40) l.y = -40;
  }
}
