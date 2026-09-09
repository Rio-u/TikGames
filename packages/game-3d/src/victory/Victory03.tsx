import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P, col } from "../shared/palette";
import { easeOutBack, easeOutExpo } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 03 — CELESTIAL BURST
 *
 * A single detonation, shaped. The brief asked for controlled rather than chaotic, so the burst
 * is built from three components that peak at *different* times — shockwave first, rays second,
 * embers last — instead of one explosion where everything happens at once.
 *
 * That stagger is the whole design. It is also the only victory scene with no persistent object:
 * once the burst settles there is nothing but the number and a slow ember fall.
 */

/** The shockwave: an expanding, thinning ring seen face-on. */
function Shockwave({ t }: { t: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: col(P.highlight).clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useFrame(() => {
    if (!mesh.current) return;
    const k = easeOutExpo(Math.min(t * 1.6, 1));
    mesh.current.scale.setScalar(0.2 + k * 6.5);
    material.opacity = Math.max(0, 0.85 - k * 0.95);
    material.color.lerpColors(col(P.highlight), col(P.ember), k);
  });

  return (
    <mesh ref={mesh} material={material}>
      <ringGeometry args={[0.86, 1, 72]} />
    </mesh>
  );
}

/** Rays: tapered blades radiating out, peaking after the shockwave. */
function Rays({ t }: { t: number }) {
  const group = useRef<THREE.Group>(null);
  const N = 16;

  const geo = useMemo(() => {
    // A long thin triangle — a ray of light, not a bar.
    const s = new THREE.Shape();
    s.moveTo(0, -0.07);
    s.lineTo(3.4, -0.012);
    s.lineTo(3.4, 0.012);
    s.lineTo(0, 0.07);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: P.ember, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  );

  useFrame((state) => {
    const k = THREE.MathUtils.clamp((t - 0.08) * 1.5, 0, 1);
    const e = easeOutExpo(k);
    material.opacity = Math.max(0, Math.sin(k * Math.PI) * 0.8);
    if (!group.current) return;
    group.current.rotation.z = state.clock.elapsedTime * 0.1;
    group.current.children.forEach((c, i) => {
      // Alternating lengths keep it from reading as a sunburst clip-art.
      c.scale.set(0.15 + e * (i % 2 ? 1 : 0.62), 1, 1);
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} geometry={geo} material={material} rotation={[0, 0, (i / N) * Math.PI * 2]} />
      ))}
    </group>
  );
}

/** Embers: the slowest layer, still falling long after the flash. */
function Embers({ t }: { t: number }) {
  const N = 420;
  const points = useRef<THREE.Points>(null);

  const { geometry, dirs } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const dirs = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.6 + Math.random() * 1.5;
      dirs[i * 4] = Math.sin(phi) * Math.cos(theta) * speed;
      dirs[i * 4 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      dirs[i * 4 + 2] = Math.cos(phi) * speed * 0.55;
      dirs[i * 4 + 3] = 0.5 + Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, dirs };
  }, []);

  const material = useMemo(
    () => new THREE.PointsMaterial({ size: 0.065, color: col(P.ember).clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  );

  useFrame(() => {
    const arr = geometry.attributes.position!.array as Float32Array;
    const e = easeOutExpo(Math.min(t * 0.85, 1));
    for (let i = 0; i < N; i++) {
      const drag = dirs[i * 4 + 3]!;
      arr[i * 3] = dirs[i * 4]! * e * 5.4;
      // Gravity pulls the tail of the burst down — embers, not sparks in a vacuum.
      arr[i * 3 + 1] = dirs[i * 4 + 1]! * e * 5.4 - t * t * 1.5 * drag;
      arr[i * 3 + 2] = dirs[i * 4 + 2]! * e * 5.4;
    }
    geometry.attributes.position!.needsUpdate = true;
    material.opacity = THREE.MathUtils.clamp(1.15 - t * 0.75, 0, 1);
    if (points.current) points.current.rotation.y = t * 0.1;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

function Scene({ value, progress }: SceneProps) {
  // The burst runs on its own accelerated clock so it is over well before the loop repeats.
  const t = progress * 1.35;
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.14) / 0.4, 0, 1), 1.8);
  const flash = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (flash.current) flash.current.intensity = 18 + Math.max(0, 1 - t * 3) * 220;
  });

  return (
    <>
      <ambientLight intensity={0.35} color={P.mist} />
      <directionalLight position={[3, 5, 6]} intensity={1.3} color={P.highlight} />
      <pointLight ref={flash} position={[0, 0, 1]} intensity={18} color={P.ember} distance={18} />
      <pointLight position={[-5, -2, -3]} intensity={26} color={P.electric} distance={20} />

      <group position={[0, 0, -1.2]}>
        <Shockwave t={t} />
        <Rays t={t} />
      </group>
      <Embers t={t} />

      <group scale={reveal}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.7}
          depth={0.6}
          face={P.highlight}
          body={P.violet}
          edge={P.ember}
          intensity={1.35}
        />
        <FresnelShell color={P.ember} power={2.6} intensity={0.9}>
          <sphereGeometry args={[2.1, 30, 22]} />
        </FresnelShell>
      </group>
    </>
  );
}

export const Victory03: Design = {
  id: "victory-03",
  name: "Celestial Burst",
  nameAr: "الانفجار السماوي",
  descriptionAr: "انفجار مرتّب على تلات موجات — صدمة، فأشعة، فجمر بيقع ببطء ورا الرقم.",
  Scene,
  camera: { position: [0, 0, 8], fov: 46 },
  effects: { bloom: 1.14, bloomThreshold: 0.42, chromatic: 0.0011, vignette: 0.55 },
  parallax: 0.35,
};
