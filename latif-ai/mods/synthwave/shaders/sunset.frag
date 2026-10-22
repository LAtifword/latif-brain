precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

/* Foreground overlay on top of the real UI (the retro-sunset colors and
   horizon grid already come from wallpaper.js, which sits behind
   everything). Stays translucent and darkens toward the edges, never the
   center, so chat text anywhere on screen stays legible. */

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float scan = 0.06 * sin(uv.y * u_resolution.y * 3.14159 + u_time * 3.0);
  float grain = (hash(uv * u_resolution.xy + u_time) - 0.5) * 0.06;
  float edgeDarken = smoothstep(0.3, 0.85, length(uv - 0.5));

  float alpha = clamp(abs(scan) * 0.35 + abs(grain) * 0.4 + edgeDarken * 0.35, 0.0, 0.55) * u_intensity;
  gl_FragColor = vec4(vec3(0.0), alpha);
}
