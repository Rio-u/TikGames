import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { P, col } from "./palette";

/**
 * The particle vocabulary. Four behaviours cover every design; each is one draw call.
 *
 * All of them run on `Points` with a pre-allocated buffer and write positions in place — no
 * per-frame allocation, no geometry rebuilds. Counts are scaled by the quality tier so a weak
 * device draws a third as many without any design having to know that happened.
 */

export type ParticleMotion =
  /** Drifts on a slow noise current. Atmosphere. */
  | "drift"
  /** Falls inward toward the origin, recycling outward. Charging / gathering. */
  | "inflow"
  /** Rises and fades. Achievement, ascension. */
  | "updraft"
  /** Rushes past the camera down -Z. Speed. */
  | "stream";

export interface ParticlesProps {
  count?: number;
  motion?: ParticleMotion;
  color?: string;
  size?: number;
  /** Radius of the volume particles occupy. */
  spread?: number;
  speed?: number;
  opacity?: number;
}

/** A soft round sprite, built once. A square GL_POINT is the single clearest "demo" tell. */
let sprite: THREE.CanvasTexture | null = null;
function dotSprite(): THREE.CanvasTexture {
  if (sprite) return sprite;
  const px = 64;
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.65)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, px, px);
  }
  sprite = new THREE.CanvasTexture(c);
  return sprite;
}

export function Particles({
  count = 260,
  motion = "drift",
  color = P.lavender,
  size = 0.05,
  spread = 6,
  speed = 1,
  opacity = 0.85,
}: ParticlesProps) {
  const tier = useQualityTier();
  const n = Math.max(24, Math.round(count * tier));
  const points = useRef<THREE.Points>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // Cube-rejection would clump at the corners; spherical sampling keeps density even.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = spread * Math.cbrt(Math.random());
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      positions[i * 3 + 2] = Math.cos(phi) * r * 0.6;
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = 0.4 + Math.random() * 1.6;
      seeds[i * 4 + 2] = Math.random() * Math.PI * 2;
      seeds[i * 4 + 3] = r;
    }
    return { positions, seeds };
  }, [n, spread]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size,
        map: dotSprite(),
        color: col(color).clone(),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [size, color, opacity],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta * speed;
    const time = t.current;
    const arr = geometry.attributes.position!.array as Float32Array;

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const s0 = seeds[i * 4]!;
      const s1 = seeds[i * 4 + 1]!;
      const s2 = seeds[i * 4 + 2]!;
      const r0 = seeds[i * 4 + 3]!;

      if (motion === "drift") {
        arr[i3] = positions[i3]! + Math.sin(time * 0.4 * s1 + s2) * 0.35;
        arr[i3 + 1] = positions[i3 + 1]! + Math.cos(time * 0.33 * s1 + s2) * 0.35;
        arr[i3 + 2] = positions[i3 + 2]! + Math.sin(time * 0.25 * s1) * 0.25;
      } else if (motion === "inflow") {
        // Spirals in, then respawns at the rim — a continuous gathering current.
        const k = (time * 0.22 * s1 + s0) % 1;
        const rad = r0 * (1 - k) + 0.25;
        const ang = s2 + k * 4.2;
        arr[i3] = Math.cos(ang) * rad;
        arr[i3 + 1] = Math.sin(ang) * rad;
        arr[i3 + 2] = positions[i3 + 2]! * (1 - k * 0.8);
      } else if (motion === "updraft") {
        const k = (time * 0.28 * s1 + s0) % 1;
        arr[i3] = positions[i3]! + Math.sin(time * 0.8 * s1 + s2) * 0.3;
        arr[i3 + 1] = -spread * 0.7 + k * spread * 1.7;
        arr[i3 + 2] = positions[i3 + 2]!;
      } else {
        // stream — depth recycling toward the camera.
        const k = (time * 0.7 * s1 + s0) % 1;
        arr[i3] = positions[i3]!;
        arr[i3 + 1] = positions[i3 + 1]!;
        arr[i3 + 2] = -spread * 2.2 + k * spread * 3.0;
      }
    }
    geometry.attributes.position!.needsUpdate = true;
    if (points.current) points.current.rotation.z = motion === "drift" ? time * 0.02 : 0;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/* ---------------------------------------------------------------------------
   Instanced fragments — chunky geometry rather than sprites, for designs that
   need debris with real shading and silhouette.
   --------------------------------------------------------------------------- */

export interface FragmentsProps {
  count?: number;
  /** Where each fragment settles, relative to the origin. */
  spread?: number;
  color?: string;
  emissive?: string;
  /** 0 = fully exploded outward, 1 = settled into place. Drive this to animate assembly. */
  assembly?: number;
  scale?: number;
  spin?: number;
  geometry?: THREE.BufferGeometry;
}

export function Fragments({
  count = 60,
  spread = 3.2,
  color = P.slate,
  emissive = P.electric,
  assembly = 1,
  scale = 0.16,
  spin = 0.4,
  geometry,
}: FragmentsProps) {
  const tier = useQualityTier();
  const n = Math.max(10, Math.round(count * tier));
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const geo = useMemo(
    () => geometry ?? new THREE.TetrahedronGeometry(1, 0),
    [geometry],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: col(color).clone(),
        emissive: col(emissive).clone(),
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.65,
        flatShading: true,
      }),
    [color, emissive],
  );

  const bits = useMemo(
    () =>
      Array.from({ length: n }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = spread * (0.45 + Math.random() * 0.55);
        return {
          home: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * r,
            Math.sin(phi) * Math.sin(theta) * r,
            Math.cos(phi) * r * 0.55,
          ),
          out: 1.9 + Math.random() * 1.6,
          rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
          spin: (Math.random() - 0.5) * spin,
          size: scale * (0.5 + Math.random()),
        };
      }),
    [n, spread, scale, spin],
  );

  useEffect(
    () => () => {
      if (!geometry) geo.dispose();
      material.dispose();
    },
    [geo, material, geometry],
  );

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!mesh.current) return;
    const a = THREE.MathUtils.clamp(assembly, 0, 1);
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i]!;
      const dist = 1 + (1 - a) * b.out;
      dummy.position.copy(b.home).multiplyScalar(dist);
      dummy.position.y += Math.sin(t.current * 0.7 + i) * 0.06 * a;
      dummy.rotation.set(
        b.rot.x + t.current * b.spin,
        b.rot.y + t.current * b.spin * 0.7,
        b.rot.z,
      );
      dummy.scale.setScalar(b.size * (0.35 + a * 0.65));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, material, n]} />;
}

/* ---------------------------------------------------------------------------
   Quality tier
   --------------------------------------------------------------------------- */

/**
 * A multiplier every particle count runs through. Derived once from the renderer's own pixel
 * ratio and the device's core count rather than from a user setting — the point is that a weak
 * laptop, or a machine already busy encoding a stream, quietly draws fewer particles instead of
 * dropping frames. Designs never branch on it themselves.
 */
export function useQualityTier(): number {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4;
    const dpr = gl.getPixelRatio();
    if (cores <= 4) return 0.4;
    if (cores <= 8 && dpr > 1.5) return 0.65;
    return 1;
  }, [gl]);
}
