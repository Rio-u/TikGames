import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { P, col } from "./palette";

/**
 * The three shaders every design draws on. Each exists because no combination of the stock
 * three.js materials produces it, and each is written to stay cheap: no loops over lights, no
 * texture fetches, and all of them run in a single pass.
 */

/** 3D simplex-ish value noise. Shared source string so it compiles once per program, not per use. */
const NOISE_GLSL = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

/* ---------------------------------------------------------------------------
   Fresnel shell — the single most load-bearing material here.

   Wrapped just outside a solid object it produces the rim light that makes glass
   and holograms read as volume rather than as a flat silhouette. Additive and
   depth-write-off so it layers over anything.
   --------------------------------------------------------------------------- */

export function FresnelShell({
  color = P.lavender,
  power = 3.4,
  intensity = 0.85,
  speed = 0,
  children,
  ...props
}: {
  color?: string;
  power?: number;
  intensity?: number;
  /** Non-zero adds a slow noise wobble to the rim, for energy fields rather than glass. */
  speed?: number;
  children?: React.ReactNode;
} & Record<string, unknown>) {
  const mat = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColor: { value: col(color).clone() },
      uPower: { value: power },
      uIntensity: { value: intensity },
      uSpeed: { value: speed },
      uTime: { value: 0 },
    }),
    // Built once; live edits go through the refs below so the program is never recompiled.
    [],
  );

  useFrame((_, delta) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime!.value += delta;
    mat.current.uniforms.uColor!.value.set(color);
    mat.current.uniforms.uIntensity!.value = intensity;
    mat.current.uniforms.uPower!.value = power;
    mat.current.uniforms.uSpeed!.value = speed;
  });

  return (
    <mesh {...(props as object)}>
      {children}
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        // BackSide, emphatically not DoubleSide. Additive blending sums every fragment it draws,
        // so a double-sided shell adds its near *and* far faces across the whole disc and fills
        // in as an opaque ball — and its near face paints over whatever it was meant to be
        // wrapping. Drawing only the far side gives a clean silhouette halo and leaves the
        // object in front of it untouched.
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          varying vec3 vPos;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            vPos = position;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          uniform float uPower, uIntensity, uSpeed, uTime;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          varying vec3 vPos;
          ${NOISE_GLSL}
          void main() {
            float f = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
            f = pow(clamp(f, 0.0, 1.0), uPower);
            // Cut the long tail: without this the falloff still washes a faint film across the
            // whole disc, which bloom then amplifies back into the ball we were avoiding.
            f = smoothstep(0.04, 0.85, f);
            float wobble = uSpeed > 0.0 ? 0.72 + 0.28 * fbm(vPos * 2.2 + vec3(0.0, 0.0, uTime * uSpeed)) : 1.0;
            gl_FragColor = vec4(uColor * uIntensity * wobble, f * wobble * 0.85);
          }
        `}
      />
    </mesh>
  );
}

/* ---------------------------------------------------------------------------
   Energy field — a volumetric-looking core.

   Ray-marching would be the honest way to get this and far too expensive to run
   nine times on a page. Instead: fbm noise scrolling through a sphere's local
   space, weighted by fresnel so the centre stays hot and the edge falls away.
   Reads as depth from any angle at the cost of one noise stack.
   --------------------------------------------------------------------------- */

export function EnergyField({
  colorA = P.electric,
  colorB = P.lavender,
  speed = 0.6,
  density = 2.4,
  intensity = 1.4,
  children,
  ...props
}: {
  colorA?: string;
  colorB?: string;
  speed?: number;
  density?: number;
  intensity?: number;
  children?: React.ReactNode;
} & Record<string, unknown>) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uA: { value: col(colorA).clone() },
      uB: { value: col(colorB).clone() },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uDensity: { value: density },
      uIntensity: { value: intensity },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime!.value += delta;
    u.uA!.value.set(colorA);
    u.uB!.value.set(colorB);
    u.uSpeed!.value = speed;
    u.uDensity!.value = density;
    u.uIntensity!.value = intensity;
  });

  return (
    <mesh {...(props as object)}>
      {children}
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vPos;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            vPos = position;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uA, uB;
          uniform float uTime, uSpeed, uDensity, uIntensity;
          varying vec3 vPos;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          ${NOISE_GLSL}
          void main() {
            vec3 q = vPos * uDensity;
            float n = fbm(q + vec3(0.0, uTime * uSpeed, uTime * uSpeed * 0.5));
            float n2 = fbm(q * 1.9 - vec3(uTime * uSpeed * 0.8, 0.0, 0.0));
            float e = smoothstep(-0.25, 0.65, n * 0.65 + n2 * 0.35);
            float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 1.6);
            vec3 c = mix(uA, uB, clamp(e * 1.35, 0.0, 1.0));
            // Weighted hard toward the rim. Centre-weighted, the plasma is opaque exactly where
            // the number sits — and the number is the one thing in every scene that has to read.
            float body = e * 0.32;
            float edge = rim * 0.9;
            gl_FragColor = vec4(c * uIntensity * (body + edge), (body + edge) * 0.8);
          }
        `}
      />
    </mesh>
  );
}

/* ---------------------------------------------------------------------------
   Holographic surface — scanlines, grid and a travelling sweep.

   The one material with an explicitly synthetic look: it is meant to read as a
   projection, not a solid, so it stays flat-shaded and leans on the sweep for life.
   --------------------------------------------------------------------------- */

export function HoloSurface({
  color = P.lavender,
  lines = 90,
  sweepSpeed = 0.55,
  opacity = 0.55,
  children,
  ...props
}: {
  color?: string;
  lines?: number;
  sweepSpeed?: number;
  opacity?: number;
  children?: React.ReactNode;
} & Record<string, unknown>) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: col(color).clone() },
      uTime: { value: 0 },
      uLines: { value: lines },
      uSweep: { value: sweepSpeed },
      uOpacity: { value: opacity },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime!.value += delta;
    u.uColor!.value.set(color);
    u.uOpacity!.value = opacity;
    u.uSweep!.value = sweepSpeed;
  });

  return (
    <mesh {...(props as object)}>
      {children}
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          uniform float uTime, uLines, uSweep, uOpacity;
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          void main() {
            float scan = 0.5 + 0.5 * sin((vUv.y + uTime * 0.05) * uLines * 6.2831);
            scan = smoothstep(0.35, 1.0, scan);
            vec2 g = abs(fract(vUv * 14.0) - 0.5);
            float grid = smoothstep(0.46, 0.5, max(g.x, g.y));
            // A single band travelling up the surface — the "it is live" tell.
            float sweep = smoothstep(0.0, 0.06, abs(fract(vUv.y - uTime * uSweep) - 0.5) * -1.0 + 0.5);
            float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.0);
            float a = (scan * 0.35 + grid * 0.55 + sweep * 0.9 + rim * 0.5) * uOpacity;
            gl_FragColor = vec4(uColor * (0.7 + sweep * 1.4 + rim), a);
          }
        `}
      />
    </mesh>
  );
}
