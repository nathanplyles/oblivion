let pulseT = 0;
let voidMotes = [];
let voidW = 0;
let voidH = 0;

function initVoid(w, h, opts = {}) {
  voidW = w;
  voidH = h;
  const density = Math.max(0.5, Number(opts.density) || 1);
  const count = Math.max(42, Math.round((w * h / 42000) * density));
  voidMotes = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.8 + 0.3,
    drift: Math.random() * 0.03 + 0.004,
    phase: Math.random() * Math.PI * 2,
    twinkle: Math.random() * 0.26 + 0.08,
    alpha: Math.random() * 0.07 + 0.01,
  }));
}

function drawVoid(ctx, w, h, rgb, opts = {}) {
  if (!voidMotes.length || w !== voidW || h !== voidH) initVoid(w, h, opts);
  const pulseSpeed = Math.max(0.3, Number(opts.pulse) || 1);
  const darkness = Math.max(0.45, Number(opts.darkness) || 1.2);
  const glow = Math.max(0, Number(opts.glow) || 0.85);
  pulseT += 0.0027 * pulseSpeed;

  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.9, 0.28 + darkness * 0.34)})`;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  const pulse = (Math.sin(pulseT) + 1) / 2;

  const innerR = maxR * (0.05 + 0.018 * pulse);
  const outerR = maxR * (0.26 + 0.05 * pulse);
  const halo = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  halo.addColorStop(0, `rgba(${rgb},${(0.008 + pulse * 0.008) * glow})`);
  halo.addColorStop(0.55, `rgba(${rgb},${(0.003 + pulse * 0.003) * glow})`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  const outerGlow = ctx.createRadialGradient(cx, cy, maxR * 0.15, cx, cy, maxR * 0.88);
  outerGlow.addColorStop(0, `rgba(${rgb},0)`);
  outerGlow.addColorStop(1, `rgba(${rgb},${0.009 * glow})`);
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, w, h);

  for (const m of voidMotes) {
    m.phase += m.drift;
    m.x += Math.sin(m.phase * 0.73) * 0.018;
    m.y += Math.cos(m.phase * 0.67) * 0.018;
    if (m.x < 0) m.x = w;
    if (m.x > w) m.x = 0;
    if (m.y < 0) m.y = h;
    if (m.y > h) m.y = 0;

    const tw = (Math.sin(m.phase) + 1) * 0.5;
    const a = m.alpha + tw * m.twinkle * 0.25;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fill();
  }
}
