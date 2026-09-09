import { Float, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, type Vector3 } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

/**
 * The shared 3D look for TikGames — one brand, one set of materials, used by both the countdown
 * and the winner scene so the two moments read as the same world.
 *
 * Deliberately duplicated in apps/overlay rather than extracted: the two apps ship separately and
 * share only @tikgames/shared-types, which is a types-only contract with no React or three.js in
 * it. Same precedent as WinnerCelebration itself.
 *
 * Two constraints shaped everything here:
 *
 * 1. **This shares a GPU with a live encode.** The streamer is running OBS while this page is
 *    open, so every scene caps its DPR, keeps the light count fixed, and renders nothing at all
 *    once its moment has passed (see `Stage`'s `frameloop`). No post-processing, no shadow maps.
 *    Kept byte-identical to the overlay's copy so the two stay in visual lockstep.
 * 2. **No font assets.** Extruded `Text3D` needs a typeface JSON, which would mean shipping and
 *    loading a font just for a handful of glyphs — and Arabic ("يلا!") does not survive that
 *    pipeline's shaping anyway. Instead `GlyphPlate` paints the glyph on a 2D canvas with the
 *    site's own Cairo face and maps it onto a real bevelled 3D slab. It is genuinely 3D — lit,
 *    rotated, and beveled — while staying font-file free and correct in Arabic.
 */

// Straight off the CSS custom properties in index.css — keep them in sync by hand; three.js can't
// read CSS variables, and threading them through per-component props would bloat every call site.
export const BRAND = {
  primary: "#7c3aed",
  accent: "#c084fc",
  deep: "#3b0f7a",
  ink: "#f5f3ff",
  gold: "#fbbf24",
} as const;

/** Cartoon plastic: bright, low-roughness, and lifted by emissive so it glows against the dark. */
export function ToonMaterial({
  color,
  emissive = color,
  emissiveIntensity = 0.55,
  roughness = 0.25,
}: {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={0.15}
    />
  );
}

/**
 * A glyph (a digit, or a short Arabic word) rendered to a canvas texture and mapped onto a
 * bevelled slab. `text` is drawn once per change, not per frame.
 */
export function GlyphPlate({
  text,
  size = 2.4,
  color = BRAND.ink,
  glow = BRAND.accent,
}: {
  text: string;
  size?: number;
  color?: string;
  glow?: string;
}) {
  const texture = useMemo(() => {
    const px = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // A short label ("يلا!") needs to shrink to fit the same plate a single digit fills.
    const fontSize = text.length > 2 ? px * 0.34 : px * 0.62;
    ctx.font = `900 ${fontSize}px Cairo, "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = glow;
    ctx.shadowBlur = px * 0.11;
    ctx.fillStyle = color;
    // Three passes over the same glyph stack the shadow into a real bloom instead of a faint halo.
    for (let i = 0; i < 3; i += 1) ctx.fillText(text, px / 2, px / 2 + px * 0.02);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [text, color, glow]);

  // A CanvasTexture holds a GPU handle; without this every countdown tick leaks one.
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <group>
      <RoundedBox args={[size, size, size * 0.22]} radius={size * 0.13} smoothness={5}>
        <ToonMaterial color={BRAND.primary} emissive={BRAND.deep} emissiveIntensity={0.5} />
      </RoundedBox>
      {/* The glyph sits just proud of the front face so it never z-fights with it. */}
      <mesh position={[0, 0, size * 0.112]}>
        <planeGeometry args={[size * 0.92, size * 0.92]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A neon ring that sweeps around whatever it frames. */
export function NeonRing({
  radius = 2.1,
  thickness = 0.07,
  color = BRAND.accent,
  speed = 0.6,
  tilt = 0,
}: {
  radius?: number;
  thickness?: number;
  color?: string;
  speed?: number;
  tilt?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, thickness, 12, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
  );
}

/** Chunky cartoon confetti — real 3D boxes that fall and tumble, not sprites. */
export function Confetti3D({ count = 90, spread = 7 }: { count?: number; spread?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const palette = useMemo(
    () => [BRAND.accent, BRAND.primary, BRAND.gold, BRAND.ink].map((c) => new THREE.Color(c)),
    [],
  );

  const bits = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * spread,
        y: Math.random() * 6 + 2,
        z: (Math.random() - 0.5) * 2.5,
        fall: 1.4 + Math.random() * 2.2,
        spin: (Math.random() - 0.5) * 4,
        tilt: Math.random() * Math.PI,
        scale: 0.09 + Math.random() * 0.1,
      })),
    [count, spread],
  );

  useEffect(() => {
    if (!mesh.current) return;
    bits.forEach((_, i) => mesh.current!.setColorAt(i, palette[i % palette.length]!));
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [bits, palette]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    bits.forEach((b, i) => {
      // Wrap through a fixed 9-unit band so the burst never runs out mid-celebration.
      const y = b.y - ((t * b.fall) % 9);
      dummy.position.set(b.x + Math.sin(t * 1.2 + i) * 0.25, y < -3 ? y + 9 : y, b.z);
      dummy.rotation.set(b.tilt + t * b.spin, t * b.spin, b.tilt);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1.6, 0.14]} />
      {/* Two deliberate choices here, both learned the hard way by ending up with black confetti:
          - Basic, not standard: a lit material shades each tumbling face by its angle to the
            lights, and a face turned away goes black — which is what confetti does most of the
            time. Unlit keeps every piece its own colour whichever way it spins.
          - No `vertexColors`: setColorAt writes `instanceColor`, which three.js wires up on its
            own. `vertexColors` instead asks the shader for a per-vertex `color` geometry
            attribute that doesn't exist here, and the pieces render black. */}
      <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** Pops in with an overshoot, then holds — the cartoon "landing" beat both scenes open on. */
export function PopIn({
  children,
  delay = 0,
  from = 0.1,
  position,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  position?: Vector3;
}) {
  const ref = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    elapsed.current += delta;
    const t = Math.max(0, elapsed.current - delay);
    // Damped spring, evaluated closed-form: no physics step, no per-frame allocation.
    const settle = t >= 1.1 ? 1 : 1 - Math.cos(t * 14) * Math.exp(-t * 5.5);
    ref.current.scale.setScalar(from + (1 - from) * Math.min(settle, 1.35));
    ref.current.visible = t > 0;
  });

  return (
    <group ref={ref} position={position} visible={false}>
      {children}
    </group>
  );
}

/**
 * The shared canvas. Transparent by default because the overlay composites straight onto the
 * streamer's scene in OBS — a canvas that clears to a colour would paint a black box over it.
 */
export function Stage({
  children,
  className = "",
  camera = 7,
  active = true,
}: {
  children: ReactNode;
  className?: string;
  camera?: number;
  active?: boolean;
}) {
  const [supported, setSupported] = useState(true);

  // A Browser Source with GPU acceleration off has no WebGL context at all. Detect it once and
  // let the caller fall back, rather than letting r3f throw inside render.
  useEffect(() => {
    try {
      const probe = document.createElement("canvas");
      setSupported(!!(probe.getContext("webgl2") || probe.getContext("webgl")));
    } catch {
      setSupported(false);
    }
  }, []);

  if (!supported) return null;

  return (
    <Canvas
      className={className}
      // Capped: a retina dashboard would otherwise render 4x the pixels for no visible gain, and
      // that cost lands on the same GPU the streamer is encoding with.
      dpr={[1, 1.6]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, camera], fov: 45 }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 6]} intensity={2.2} color={BRAND.ink} />
      <pointLight position={[-5, -2, 4]} intensity={40} color={BRAND.primary} />
      <pointLight position={[5, 3, 2]} intensity={25} color={BRAND.accent} />
      {children}
    </Canvas>
  );
}

export { Float, Sparkles };
