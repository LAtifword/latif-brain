precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // vertical sunset gradient
  vec3 top = vec3(0.05, 0.01, 0.13);
  vec3 mid = vec3(0.33, 0.05, 0.28);
  vec3 low = vec3(0.55, 0.10, 0.30);
  vec3 color = mix(top, mid, smoothstep(0.4, 0.75, uv.y));
  color = mix(color, low, smoothstep(0.75, 1.0, uv.y));

  // horizon glow band
  float band = exp(-pow((uv.y - 0.62) * 8.0, 2.0));
  color += vec3(1.0, 0.30, 0.55) * band * 0.5 * u_intensity;

  // drifting magenta bloom
  float t = u_time * 0.25;
  vec2 c = vec2(0.5 + 0.2 * sin(t), 0.62);
  float glow = 0.03 / (length(uv - c) + 0.03);
  color += vec3(1.0, 0.18, 0.58) * glow * 0.12 * u_intensity;

  float vig = 1.0 - length(uv - 0.5) * 0.7;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
