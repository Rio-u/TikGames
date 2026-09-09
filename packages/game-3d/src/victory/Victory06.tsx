import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { easeOutBack, easeOutExpo } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 06 — GYROSCOPE
 *
 * A precision instrument locking into alignment. Three gimbal cages spin on perpendicular axes,
 * decelerate, and come to rest square to the camera — the number sitting perfectly framed at the
 * moment they stop.
 *
 * The satisfaction here is mechanical rather than explosive: the payoff beat is *stillness*
 * arriving after motion, which is a different reward shape from every other victory scene.
 */

interface CageSpec {
  radius: number;
  axis: [number, number, number];
  spin: number;
  teeth: number;
}

const CAGES: CageSpec[] = [
  { radius: 2.9, axis: [0, 0, 1], spin: 5.5, teeth: 24 },
  { radius: 2.35, axis: [1, 0, 0], spin: -7.2, teeth: 18 },
  { radius: 1.85, axis: [0, 1, 0], spin: 6.4, teeth: 14 },
];

/** One gimbal: a rail plus regularly spaced blocks, so rotation is legible. */
function Cage({ spec, settle }: { spec: CageSpec; settle: number }) {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(0);

  const rail = useMemo(() => new THREE.TorusGeometry(spec.radius, 0.035, 8, 96), [spec.radius]);
  const tooth = useMemo(() => new THREE.BoxGeometry(0.1, 0.19, 0.1), []);

  const railMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.95, roughness: 0.2, emissive: P.electric, emissiveIntensity: 0.35 }),
    [],
  );
  const toothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.violet, emissive: P.lavender, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.22 }),
    [],
  );

  useFrame((_, d) => {
    // Spins fast, then eases to a dead stop — settle drives the deceleration, not a timer.
    const rate = spec.spin * (1 - easeOutExpo(settle));
    angle.current += d * rate;
    if (!group.current) return;
    const [x, y, z] = spec.axis;
    group.current.rotation.set(x * angle.current, y * angle.current, z * angle.current);
  });

  return (
    <group ref={group}>
      <mesh geometry={rail} material={railMat} />
      {Array.from({ length: spec.teeth }, (_, i) => {
        const a = (i / spec.teeth) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={tooth}
            material={toothMat}
            position={[Math.cos(a) * spec.radius, Math.sin(a) * spec.radius, 0]}
            rotation={[0, 0, a]}
          />
        );
      })}
    </group>
  );
}

/** Pulses that travel outward along the rails each time the mechanism locks. */
function LockPulse({ settle }: { settle: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: P.ember, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    [],
  );

  useFrame(() => {
    if (!mesh.current) return;
    // Fires only once the cages have essentially stopped — the "locked" confirmation.
    const k = THREE.MathUtils.clamp((settle - 0.72) / 0.28, 0, 1);
    const e = easeOutExpo(k);
    mesh.current.scale.setScalar(0.4 + e * 4.4);
    material.opacity = Math.max(0, 0.8 - e * 0.85);
  });

  return (
    <mesh ref={mesh} material={material}>
      <ringGeometry args={[0.9, 1, 64]} />
    </mesh>
  );
}

function Scene({ value, progress }: SceneProps) {
  const settle = Math.min(progress * 1.5, 1);
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.45) / 0.35, 0, 1), 1.7);
  const hub = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (hub.current) hub.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.1 * (1 - settle);
  });

  return (
    <>
      <ambientLight intensity={0.36} color={P.mist} />
      <directionalLight position={[5, 6, 6]} intensity={2.4} color={P.highlight} />
      <directionalLight position={[-4, -2, -4]} intensity={1.1} color={P.electric} />
      <pointLight position={[0, 0, 2.6]} intensity={22} color={P.ember} distance={13} />

      <group ref={hub}>
        {CAGES.map((spec, i) => (
          <Cage key={i} spec={spec} settle={settle} />
        ))}
        <LockPulse settle={settle} />

        <group scale={reveal}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={2.05}
            depth={0.46}
            face={P.highlight}
            body={P.violet}
            edge={P.ember}
            intensity={1.25}
          />
        </group>

        <FresnelShell color={P.lavender} power={2.9} intensity={0.75}>
          <sphereGeometry args={[1.5, 30, 22]} />
        </FresnelShell>
      </group>

      <Particles motion="drift" count={150} color={P.mist} spread={7} size={0.026} opacity={0.4} />
      <Particles motion="inflow" count={120} color={P.ember} spread={5} size={0.04} speed={1.1} opacity={0.65} />
    </>
  );
}

export const Victory06: Design = {
  id: "victory-06",
  name: "Gyroscope",
  nameAr: "الجيروسكوب",
  descriptionAr: "تلات أقفاص بتلف على محاور متعامدة وبتهدى لحد ما تقف مظبوطة — والرقم في النص.",
  Scene,
  camera: { position: [0, 0, 8.6], fov: 44 },
  effects: { bloom: 0.75, bloomThreshold: 0.54, chromatic: 0.0006, vignette: 0.48 },
  parallax: 0.5,
};
