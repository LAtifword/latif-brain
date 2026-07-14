/* Matrix Green live wallpaper — classic falling code rain. */
(function () {
  const existing = document.getElementById("gx-live-wallpaper");
  if (existing) existing.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "gx-live-wallpaper";
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const FONT = 16 * dpr;
  const CHARS = "アイウエオカキクケコサシスセソ0123456789ABCDEFXYZ$#@%&*";
  let w, h, cols, drops = [], raf = 0;

  function resize() {
    w = canvas.width = window.innerWidth * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    cols = Math.floor(w / FONT);
    drops = new Array(cols).fill(0).map(() => Math.random() * -50);
  }
  resize();
  window.addEventListener("resize", resize);

  function animate() {
    ctx.fillStyle = "rgba(5,10,6,0.18)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${FONT}px monospace`;
    for (let i = 0; i < cols; i++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const y = drops[i] * FONT;
      ctx.fillStyle = Math.random() < 0.06 ? "#d6ffe0" : "#39ff14";
      ctx.fillText(ch, i * FONT, y);
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    raf = requestAnimationFrame(animate);
  }
  animate();

  window.__gxWallpaperStop = function () {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
})();
