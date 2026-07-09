precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // Dark midnight base
  vec3 color = vec3(0.04, 0.04, 0.06);

  // Animated glow spots — GX-style floating depth
  float t = u_time * 0.3;
  for (float i = 0.0; i < 3.0; i++) {
    vec2 pos = vec2(
      0.5 + 0.30 * cos(t + i * 2.0),
      0.5 + 0.30 * sin(t * 0.7 + i * 1.5)
    );
    float dist = length(uv - pos);
    float glow = 0.02 / (dist + 0.02);
    color += vec3(0.98, 0.12, 0.30) * glow * 0.15 * u_intensity; // primary red
    color += vec3(0.00, 0.83, 0.67) * glow * 0.10 * u_intensity; // accent cyan
  }

  // Vignette
  float vig = 1.0 - length(uv - 0.5) * 0.8;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
