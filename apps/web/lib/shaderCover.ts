/** GLSL covers follow the Shadertoy contract, so shaders paste straight in from shadertoy.com. */
export const SHADER_COVER_MAX = 32 * 1024

export const SHADER_PRELUDE_LINES = 9

export function wrapShadertoy(source: string): string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
out vec4 nvFragColor;
${source}
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  nvFragColor = vec4(color.rgb, 1.0);
}
`
}

/** Returns the trimmed source, or an error message a person can act on. */
export function checkShaderSource(raw: string): { ok: true; source: string } | { ok: false; error: string } {
  const source = raw.replace(/\r\n?/g, "\n").trim()
  if (new TextEncoder().encode(source).length > SHADER_COVER_MAX) {
    return { ok: false, error: "Shader cover is larger than 32 KB." }
  }
  if (/^\s*#\s*version\b/m.test(source)) {
    return { ok: false, error: "Leave out #version; NodeVault adds the WebGL 2 header itself." }
  }
  if (/\bvoid\s+main\s*\(/.test(source)) {
    return { ok: false, error: "Write a mainImage(out vec4 fragColor, in vec2 fragCoord) function instead of main()." }
  }
  if (!/\bvoid\s+mainImage\s*\(/.test(source)) {
    return { ok: false, error: "Shader cover needs a mainImage(out vec4 fragColor, in vec2 fragCoord) function." }
  }
  return { ok: true, source }
}

/** Shifts compiler line numbers back onto the person's own source. */
export function friendlyCompileLog(log: string): string {
  return log
    .replace(/ERROR:\s*0:(\d+):/g, (_, line: string) => `Line ${Math.max(1, Number(line) - SHADER_PRELUDE_LINES)}:`)
    .replace(/\u0000/g, "")
    .trim()
}
