/** Draw a static starfield once (cheap: no per-frame cost). */
export function drawStars(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const paint = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, hgt = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(hgt * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = Math.floor((w * hgt) / 2600);
    for (let i = 0; i < count; i++) {
      const x = rnd() * w, y = rnd() * hgt, r = rnd() * 1.3 + 0.2;
      const hue = rnd() < 0.15 ? 190 : rnd() < 0.1 ? 280 : 220;
      ctx.fillStyle = `hsla(${hue}, 80%, ${70 + rnd() * 30}%, ${0.3 + rnd() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  paint();
  let t = 0;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(paint, 200);
  });
}
