// Constelación de triángulos en forma de cerebro (imagen de marca, estilo Dala).
const PALETTE = ['#8052ff', '#8052ff', '#b49cff', '#ffb829', '#15846e', '#3fd1b0', '#ff4fa3', '#4f8cff'];

function insideBrain(x, y) {
  // Dos hemisferios con borde ondulado + cerebelo.
  const lobes = [[-0.32, -0.04, 0.62, 0.5], [0.3, -0.06, 0.6, 0.48]];
  for (const [cx, cy, rx, ry] of lobes) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const a = Math.atan2(dy, dx);
    const r = 1 + 0.07 * Math.sin(a * 6) + 0.04 * Math.sin(a * 13 + 1.3);
    if (dx * dx + dy * dy < r * r) return true;
  }
  const dx = (x - 0.42) / 0.28, dy = (y - 0.42) / 0.16;
  return dx * dx + dy * dy < 1;
}

export function constellation(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;
  const N = small ? 650 : 1500;
  const pts = [];
  while (pts.length < N) {
    const x = Math.random() * 2.2 - 1.1, y = Math.random() * 1.4 - 0.7;
    if (!insideBrain(x, y)) continue;
    pts.push({ x, y, z: (Math.random() - 0.5) * 0.7, s: 1.6 + Math.random() * 2.6, r: Math.random() * Math.PI * 2,
      c: PALETTE[(Math.random() * PALETTE.length) | 0], p: Math.random() * Math.PI * 2, amb: false });
  }
  for (let i = 0; i < (small ? 70 : 160); i++) {
    pts.push({ x: Math.random() * 3 - 1.5, y: Math.random() * 2 - 1, z: (Math.random() - 0.5) * 2, s: 1.4 + Math.random() * 2,
      r: Math.random() * 6.28, c: PALETTE[(Math.random() * PALETTE.length) | 0], p: Math.random() * 6.28, amb: true });
  }
  let w = 0, hgt = 0, dpr = 1, raf = 0, t0 = performance.now(), mx = 0, my = 0;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; hgt = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, hgt);
    const scale = Math.min(w / 1.9, hgt / 1.25);
    const ang = Math.sin(t * 0.12) * 0.35 + mx * 0.25;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    ctx.lineWidth = 1;
    for (const q of pts) {
      const X = q.x * cos + q.z * sin;
      const Z = -q.x * sin + q.z * cos;
      const persp = 1 / (1.6 - Z * 0.5);
      const px = w / 2 + X * scale * persp * 1.1;
      const py = hgt / 2 + (q.y + my * 0.05) * scale * persp * 1.1 + (q.amb ? Math.sin(t * 0.3 + q.p) * 6 : 0);
      const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + q.p);
      ctx.globalAlpha = (q.amb ? 0.25 : 0.55 + 0.45 * persp * 0.6) * tw;
      ctx.strokeStyle = q.c;
      const sz = q.s * persp, rot = q.r + t * 0.2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = rot + (k * Math.PI * 2) / 3;
        const vx = px + Math.cos(a) * sz, vy = py + Math.sin(a) * sz;
        k ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  const onMove = (e) => { mx = (e.clientX / innerWidth - 0.5); my = (e.clientY / innerHeight - 0.5); };
  const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', onMove);
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
  };
}
