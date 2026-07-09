precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // phosphor scanline shimmer
  float scan = 0.10 * sin(uv.y * u_resolution.y * 3.14159 + u_time * 4.0);
  float grain = (hash(uv * u_resolution.xy + u_time) - 0.5) * 0.05;
  float vig = 1.0 - smoothstep(0.4, 0.95, length(uv - 0.5));

  float darken = (abs(scan) * 0.6 + abs(grain) * 0.4 + vig * 0.3) * u_intensity;
  vec3 tint = vec3(0.0, 1.0, 0.15) * (scan * 0.03 * u_intensity);

  gl_FragColor = vec4(tint, clamp(darken, 0.0, 0.55));
}
