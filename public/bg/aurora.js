let auroraOffset = 0;

const AURORA_COLORS = [
  '180,255,160',
  '140,200,255',
  '200,150,255',
  '150,255,210',
  '255,200,140',
];

function drawAurora(ctx, w, h, rgb, opts = {}) {
  const bands = Math.max(2, Math.round(Number(opts.bands) || 5));
  const speed = Math.max(0.4, Number(opts.speed) || 1);
  const intensity = Math.max(0.35, Number(opts.intensity) || 1);
  auroraOffset += 0.0018 * speed;
  for (let i = 0; i < bands; i++) {
    const color = AURORA_COLORS[i % AURORA_COLORS.length];
    const baseY = h * (0.18 + i * 0.13) + Math.sin(auroraOffset * 0.6 + i * 0.9) * h * 0.055;
    const opacity = Math.max(0.008, (0.048 - i * 0.006) * intensity);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) {
      const wave1 = Math.sin(x * 0.004 + auroraOffset + i * 1.1) * 65;
      const wave2 = Math.sin(x * 0.009 + auroraOffset * 1.5 + i * 0.7) * 28;
      const wave3 = Math.sin(x * 0.002 + auroraOffset * 0.4 + i * 2.1) * 18;
      ctx.lineTo(x, baseY + wave1 + wave2 + wave3);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(0.3, `rgba(${color},${opacity})`);
    g.addColorStop(0.6, `rgba(${color},${opacity * 0.6})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 10) {
      const wave1 = Math.sin(x * 0.004 + auroraOffset + i * 1.1) * 65;
      const wave2 = Math.sin(x * 0.009 + auroraOffset * 1.5 + i * 0.7) * 28;
      const wave3 = Math.sin(x * 0.002 + auroraOffset * 0.4 + i * 2.1) * 18;
      ctx.lineTo(x, baseY + wave1 + wave2 + wave3);
    }
    ctx.strokeStyle = `rgba(${color},${opacity * 1.6})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}
