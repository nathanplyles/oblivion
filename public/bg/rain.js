let rainDrops = [];

function initRain(w, h, opts = {}) {
  const density = Math.max(0.5, Number(opts.density) || 1);
  const count = Math.max(90, Math.floor((w / 6) * density));
  rainDrops = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * -h,
    speed: (Math.random() * 4 + 3.5) * Math.max(0.4, Number(opts.speed) || 1),
    len: Math.random() * 22 + 12,
    op: Math.random() * 0.45 + 0.18,
    w: Math.random() * 0.8 + 0.3,
    wind: (Math.random() - 0.3) * Math.max(0, Number(opts.wind) || 0.7),
  }));
}

function drawRain(ctx, w, h, rgb, opts = {}) {
  const speedMul = Math.max(0.4, Number(opts.speed) || 1);
  for (const d of rainDrops) {
    const dh = d.len * 10;
    const dx = d.wind * dh;
    const g = ctx.createLinearGradient(d.x - dx, d.y - dh, d.x, d.y);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.5, `rgba(${rgb},${d.op * 0.4})`);
    g.addColorStop(1, `rgba(${rgb},${d.op})`);
    ctx.beginPath();
    ctx.moveTo(d.x - dx, d.y - dh);
    ctx.lineTo(d.x, d.y);
    ctx.strokeStyle = g;
    ctx.lineWidth = d.w;
    ctx.stroke();
    d.y += d.speed * 5 * speedMul;
    d.x += d.wind * 0.9;
    if (d.y > h + 20) {
      d.y = Math.random() * -h * 0.6;
      d.x = Math.random() * w;
    }
  }
}
