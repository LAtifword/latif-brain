precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

/* This is a FOREGROUND overlay composited on top of the real UI (not a
   background wallpaper — that's wallpaper.js, which already provides the
   colored crimson/cyan glow atmosphere behind everything). It must stay
   translucent and darken toward the EDGES, never the center, so chat text
   anywhere on screen — including the large-screen two-pane layout — stays
   legible. */

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float scan = 0.07 * sin(uv.y * u_resolution.y * 3.14159 + u_time * 2.0);
  float grain = (hash(uv * u_resolution.xy + u_time) - 0.5) * 0.05;
  float edgeDarken = smoothstep(0.35, 0.9, length(uv - 0.5));

  float alpha = clamp(abs(scan) * 0.4 + abs(grain) * 0.35 + edgeDarken * 0.32, 0.0, 0.55) * u_intensity;
  gl_FragColor = vec4(vec3(0.0), alpha);
}
