/* Synthwave live wallpaper — scrolling neon horizon grid with a sun glow. */
(function () {
  const existing = document.getElementById("gx-live-wallpaper");
  if (existing) existing.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "gx-live-wallpaper";
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w, h, raf = 0, t = 0;

  function resize() {
    w = canvas.width = window.innerWidth * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resize();
  window.addEventListener("resize", resize);

  function animate() {
    t += 0.016;
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0D0221");
    g.addColorStop(0.55, "#2A0A3A");
    g.addColorStop(0.75, "#54123B");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.62;

    // sun
    const sunR = Math.min(w, h) * 0.16;
    const sunG = ctx.createRadialGradient(w / 2, horizon, sunR * 0.2, w / 2, horizon, sunR);
    sunG.addColorStop(0, "#FFB347");
    sunG.addColorStop(1, "#FF2D95");
    ctx.save();
    ctx.beginPath(); ctx.rect(0, horizon - sunR * 2, w, sunR * 2); ctx.clip();
    ctx.fillStyle = sunG;
    ctx.beginPath(); ctx.arc(w / 2, horizon, sunR, 0, Math.PI * 2); ctx.fill();
    // scanline gaps across the sun
    ctx.fillStyle = "#2A0A3A";
    for (let i = 0; i < 8; i++) {
      const yy = horizon - sunR + i * (sunR * 2 / 8) + (t * 12 % (sunR * 2 / 8));
      ctx.fillRect(w / 2 - sunR, yy, sunR * 2, Math.max(2, sunR * 0.05));
    }
    ctx.restore();

    // perspective grid
    ctx.strokeStyle = "rgba(255,45,149,0.5)";
    ctx.lineWidth = dpr;
    const vanishX = w / 2;
    // horizontal lines receding toward horizon
    for (let i = 0; i < 22; i++) {
      const p = ((i + (t * 0.4 % 1)) / 22);
      const y = horizon + Math.pow(p, 2) * (h - horizon);
      ctx.globalAlpha = 0.15 + p * 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // vertical converging lines
    ctx.globalAlpha = 0.35;
    for (let i = -12; i <= 12; i++) {
      const x = vanishX + i * (w / 8);
      ctx.beginPath();
      ctx.moveTo(vanishX + i * (w / 60), horizon);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(animate);
  }
  animate();

  window.__gxWallpaperStop = function () {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
})();
