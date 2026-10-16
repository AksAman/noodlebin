"use client";

import { HALFTONE_LIBRARY, PAN_SPEED, readGraph, toLinear } from "@/lib/halftone";
import { cn } from "@/lib/ui";
import { useEffect, useRef } from "react";

const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uDpr;
uniform float uPan;
uniform float uScale;
uniform float uDetail;
uniform float uRough;
uniform float uDistort;
uniform vec3 uStops;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uBase;
uniform vec3 uSnap;
uniform vec3 uOffset;
uniform float uInCells;
uniform float uMaxLum;
uniform vec2 uRadius;
uniform vec2 uDim;
uniform vec2 uLitRange;
out vec4 outColor;
${HALFTONE_LIBRARY}
/* One step per node in the homepage graph, in the same order, in linear color. */
void main() {
  vec2 frag = gl_FragCoord.xy / uDpr;
  float plane = uRes.y / uDpr;
  /* Generated coordinates of a default plane seen from above: the hero height spans 0..1, z sits at 0.5. */
  vec3 co = vec3(frag.x / plane + uPan, frag.y / plane, 0.5);
  vec3 center = floor(co / uSnap) * uSnap + uOffset;
  vec3 ramp = colorRamp(noiseTexture(center));
  float light = luminance(ramp) / uMaxLum;
  float radius = sqrt(max(light, 0.0)) * uRadius.x + uRadius.y;
  float dist = distance(co, center) * uInCells;
  /* Blender's Less Than is a hard edge; half a pixel of falloff stands in for its anti-aliasing. */
  float cellPx = plane / uInCells;
  float inside = clamp((radius - dist) * cellPx + 0.5, 0.0, 1.0);
  float lit = smoothstep(uLitRange.x, uLitRange.y, light);
  vec3 color = mix(uBase, ramp, lit);
  float strength = (lit * uDim.x + uDim.y) * inside;
  outColor = vec4(toSrgb(color) * strength, strength);
}
`;

/** Resolves any CSS color (including oklch tokens) to sRGB 0..1. */
function cssColor(value: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [0.5, 0.5, 0.5];
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r! / 255, g! / 255, b! / 255];
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HeroShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: false,
      alpha: true,
    });
    if (!gl) return;

    let teardown = setup(canvas, gl);
    const onLost = (event: Event) => {
      event.preventDefault();
      teardown();
      teardown = () => {};
    };
    const onRestored = () => {
      teardown = setup(canvas, gl);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      teardown();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("hero-shader pointer-events-none block", className)}
    />
  );
}

/** Builds the program and render loop on a live context. The context itself is never destroyed: a canvas only ever gets one, and remounts reuse it. */
function setup(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext
): () => void {
  if (gl.isContextLost()) return () => {};
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return () => {};
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const params = readGraph();
  gl.uniform1f(u("uScale"), params.scale);
  gl.uniform1f(u("uDetail"), params.detail);
  gl.uniform1f(u("uRough"), params.roughness);
  gl.uniform1f(u("uDistort"), params.distortion);
  gl.uniform3f(u("uStops"), ...params.stops);
  params.colors.forEach((c, i) =>
    gl.uniform3f(u(`uC${i}`), c[0]!, c[1]!, c[2]!)
  );
  gl.uniform3f(u("uSnap"), ...params.snap);
  gl.uniform3f(u("uOffset"), ...params.offset);
  gl.uniform1f(u("uInCells"), params.inCells);
  gl.uniform1f(u("uMaxLum"), params.maxLum);
  gl.uniform2f(u("uRadius"), ...params.radius);
  gl.uniform2f(u("uDim"), ...params.dim);
  gl.uniform2f(u("uLitRange"), ...params.litRange);

  /* The unlit grid dots take the theme's line color instead of the graph's dark gray, so they read on light backgrounds too. */
  const applyTheme = () => {
    const styles = getComputedStyle(document.documentElement);
    const base = cssColor(
      styles.getPropertyValue("--line-strong").trim() || "#888"
    ).map(toLinear) as [number, number, number];
    gl.uniform3f(u("uBase"), ...base);
  };
  applyTheme();

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u("uRes"), canvas.width, canvas.height);
    gl.uniform1f(u("uDpr"), dpr);
  };
  resize();

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const start = performance.now();
  let frame = 0;
  let onScreen = true;
  const draw = () => {
    gl.uniform1f(
      u("uPan"),
      still.matches ? 0 : ((performance.now() - start) / 1000) * PAN_SPEED
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = () => {
    draw();
    if (onScreen && !still.matches) frame = requestAnimationFrame(loop);
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    loop();
  };
  restart();

  const sizeObserver = new ResizeObserver(() => {
    resize();
    draw();
  });
  sizeObserver.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = Boolean(entry?.isIntersecting);
    if (onScreen) restart();
  });
  visibility.observe(canvas);
  const themeObserver = new MutationObserver(() => {
    applyTheme();
    draw();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    applyTheme();
    draw();
  };
  scheme.addEventListener("change", onScheme);
  still.addEventListener("change", restart);

  return () => {
    cancelAnimationFrame(frame);
    sizeObserver.disconnect();
    visibility.disconnect();
    themeObserver.disconnect();
    scheme.removeEventListener("change", onScheme);
    still.removeEventListener("change", restart);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
}
