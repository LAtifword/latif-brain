/* Underwave live wallpaper — drifting glow particles with a faint link mesh.
   Injected by the mod engine; cleans itself up via window.__gxWallpaperStop. */
(function () {
  const existing = document.getElementById("gx-live-wallpaper");
  if (existing) existing.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "gx-live-wallpaper";
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let w, h, particles = [], raf = 0, mouse = { x: -999, y: -999 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = canvas.width = window.innerWidth * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = Math.min(60, Math.floor(window.innerWidth / 14));
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4 * dpr,
      vy: (Math.random() - 0.5) * 0.4 * dpr,
      size: (Math.random() * 2.4 + 1) * dpr,
      alpha: Math.random() * 0.5 + 0.15,
      hue: Math.random() < 0.7 ? "250,30,78" : "0,212,170"
    });
  }

  function onMove(e) {
    const t = e.touches ? e.touches[0] : e;
    mouse.x = t.clientX * dpr; mouse.y = t.clientY * dpr;
  }
  window.addEventListener("pointermove", onMove);

  function animate() {
    ctx.fillStyle = "#0A0A0F";
    ctx.fillRect(0, 0, w, h);

    // link mesh
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const max = 120 * dpr;
        if (d < max) {
          ctx.strokeStyle = `rgba(250,30,78,${(1 - d / max) * 0.06})`;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }

    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      // gentle repel from cursor
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 100 * dpr && d > 0.1) { p.x += (dx / d) * 1.2; p.y += (dy / d) * 1.2; }

      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue},${p.alpha * 0.08})`;
      ctx.fill();
    });

    raf = requestAnimationFrame(animate);
  }
  animate();

  window.__gxWallpaperStop = function () {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    canvas.remove();
  };
})();
