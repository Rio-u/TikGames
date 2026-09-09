import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HoloSurface } from "../shared/materials";
import { P, urgencyColor } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 08 — HOLOGRAPHIC SCAN
 *
 * An instrument reading the number. The composition is deliberately the most *rectilinear* of the
 * nine — brackets, rails, planes, a travelling scan bar — because that formal contrast is what
 * separates it from the seven curved, organic designs around it.
 *
 * Everything is aligned to one grid and moves on hard, stepped timing rather than eased curves:
 * this scene should feel machined, not alive.
 */

/** Corner brackets — the framing device the whole design hangs off. */
function Brackets({ tint, phase }: { tint: string; phase: number }) {
  const group = useRef<THREE.Group>(null);

  const geo = useMemo(() => {
    const s = new THREE.Shape();
    // An L, extruded: long arm, short arm, uniform stroke.
    s.moveTo(0, 0);
    s.lineTo(1.15, 0);
    s.lineTo(1.15, 0.12);
    s.lineTo(0.12, 0.12);
    s.lineTo(0.12, 1.15);
    s.lineTo(0, 1.15);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 1 });
  }, []);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.9, roughness: 0.25, emissive: tint, emissiveIntensity: 0.9 }),
    [tint],
  );

  useFrame(() => {
    material.emissive.set(tint);
    if (!group.current) return;
    // Brackets close in on the number as the second runs out, then snap back open.
    const close = 0.12 * (1 - phase);
    group.current.children.forEach((c, i) => {
      const sx = i === 0 || i === 3 ? -1 : 1;
      const sy = i < 2 ? 1 : -1;
      c.position.set(sx * (2.15 - close), sy * (1.75 - close), 0);
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          geometry={geo}
          material={material}
          rotation={[0, 0, (i * Math.PI) / 2 + Math.PI]}
          scale={0.85}
        />
      ))}
    </group>
  );
}

/** The scan bar: a bright plane sweeping vertically through the glyph. */
function ScanBar({ tint, t }: { tint: string; t: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [tint],
  );

  useFrame(() => {
    material.color.set(tint);
    if (!mesh.current) return;
    // Sweeps once per second and resets hard — a mechanical repeat, not a loop.
    const y = -2.1 + ((t * 1.0) % 1) * 4.2;
    mesh.current.position.y = y;
    material.opacity = 0.35 + Math.sin(t * 12) * 0.08;
  });

  return (
    <mesh ref={mesh} material={material}>
      <planeGeometry args={[4.8, 0.075]} />
    </mesh>
  );
}

/** Data rails flanking the number, stepping in discrete ticks. */
function Rails({ tint }: { tint: string }) {
  const left = useRef<THREE.InstancedMesh>(null);
  const right = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const N = 18;

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.6, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    [tint],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    material.color.set(tint);
    [left, right].forEach((ref, side) => {
      if (!ref.current) return;
      for (let i = 0; i < N; i++) {
        // Quantised widths — a readout, not a waveform.
        const step = Math.floor(t.current * 5 + i * 1.7 + side * 3) % 5;
        const w = 0.1 + step * 0.11;
        dummy.position.set((side ? 1 : -1) * (2.55 + w / 2), -1.7 + (i / (N - 1)) * 3.4, 0);
        dummy.scale.set(w, 0.045, 1);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
      }
      ref.current.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      <instancedMesh ref={left} args={[undefined, material, N]}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={right} args={[undefined, material, N]}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const t = useRef(0);
  const stack = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    t.current += d;
    if (stack.current) stack.current.rotation.y = Math.sin(t.current * 0.28) * 0.14;
  });

  return (
    <>
      <ambientLight intensity={0.5} color={P.mist} />
      <directionalLight position={[3, 5, 7]} intensity={1.7} color={P.highlight} />
      <pointLight position={[0, 0, 3]} intensity={16} color={tint} distance={12} />
      <pointLight position={[-5, 2, -3]} intensity={22} color={P.electric} distance={18} />

      <group ref={stack}>
        {/* Three parallel projection planes at different depths — the analysis stack. */}
        {[-1.15, -0.5, 0.55].map((z, i) => (
          <HoloSurface
            key={i}
            color={tint}
            lines={40 + i * 30}
            sweepSpeed={0.3 + i * 0.2}
            opacity={0.18 + i * 0.06}
            position={[0, 0, z]}
          >
            <planeGeometry args={[5.4 - i * 0.5, 4.1 - i * 0.4]} />
          </HoloSurface>
        ))}

        <Brackets tint={tint} phase={progress} />
        <Rails tint={tint} />

        <group position={[0, 0, 0.1]}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={2.5}
            depth={0.4}
            face={P.highlight}
            body={P.slate}
            edge={tint}
            intensity={urgent ? 1.2 : 0.9}
          />
        </group>

        <ScanBar tint={tint} t={t.current} />
      </group>

      <Particles motion="drift" count={120} color={P.mist} spread={7} size={0.024} opacity={0.32} />
    </>
  );
}

export const Countdown08: Design = {
  id: "countdown-08",
  name: "Holographic Scan",
  nameAr: "الماسح الهولوجرامي",
  descriptionAr: "جهاز بيحلّل الرقم — أقواس بتقفل عليه، شريط مسح بيعدّي، وقراءات على الجانبين.",
  Scene,
  camera: { position: [0, 0, 8.2], fov: 42 },
  effects: { bloom: 0.63, bloomThreshold: 0.56, chromatic: 0.0005, vignette: 0.4 },
  parallax: 0.42,
};
