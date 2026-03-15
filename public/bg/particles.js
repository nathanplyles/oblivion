let particles = [];
let particlesT = 0;

function initParticles(w, h, opts = {}) {
  const density = Math.max(0.6, Number(opts.density) || 1);
  const count = Math.max(120, Math.round((w * h / 9000) * density));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.26,
    vy: (Math.random() - 0.5) * 0.26,
    r: Math.random() * 1.6 + 0.5,
    op: Math.random() * 0.28 + 0.07,
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 0.9 + 0.2,
  }));
}

function drawParticles(ctx, w, h, rgb, mx, my, opts = {}) {
  const driftScale = Math.max(0.1, Number(opts.drift) || 0.55);
  const linkDist = Math.max(40, Number(opts.linkDist) || 120);
  particlesT += 0.008 * driftScale;

  for (const p of particles) {
    p.phase += 0.01 * p.drift * driftScale;
    p.vx += Math.sin(p.phase + particlesT) * 0.0032;
    p.vy += Math.cos((p.phase * 0.92) - particlesT) * 0.0032;

    const dx = mx - p.x;
    const dy = my - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 140 && dist > 0) {
      const force = ((140 - dist) / 140) * 1.2;
      p.vx -= (dx / dist) * force * 0.14;
      p.vy -= (dy / dist) * force * 0.14;
    }

    p.vx *= 0.982;
    p.vy *= 0.982;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${p.op})`;
    ctx.fill();
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= linkDist || d <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = `rgba(${rgb},${(1 - d / linkDist) * 0.09})`;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  }
}
