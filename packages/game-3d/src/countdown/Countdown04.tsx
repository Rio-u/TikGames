import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P, urgencyColor } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { pulse } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 04 — ORBITAL SYSTEM
 *
 * An armillary instrument: three inclined gimbal arcs carrying machined satellites around the
 * number, each on its own plane, period and radius.
 *
 * The brief here was explicitly *not* concentric circles. So the orbits are inclined arcs — open,
 * not closed — and the satellites are compound objects (a hub, a collar, a fin) rather than
 * spheres, with a real trail behind each one. Reading depth in this scene comes from the planes
 * crossing at angles.
 */

interface OrbitSpec {
  radius: number;
  tilt: [number, number, number];
  speed: number;
  count: number;
}

const ORBITS: OrbitSpec[] = [
  { radius: 2.35, tilt: [0.42, 0, 0.18], speed: 0.55, count: 2 },
  { radius: 3.05, tilt: [-0.65, 0.5, -0.3], speed: -0.36, count: 3 },
  { radius: 3.75, tilt: [1.15, -0.3, 0.55], speed: 0.24, count: 2 },
];

/** A satellite: hub, collar and fin. Three parts is the difference between hardware and a dot. */
function Satellite({ material, accent }: { material: THREE.Material; accent: THREE.Material }) {
  return (
    <group>
      <mesh material={material}>
        <boxGeometry args={[0.26, 0.26, 0.34]} />
      </mesh>
      <mesh material={accent} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.035, 6, 16]} />
      </mesh>
      <mesh material={accent} position={[0, 0.24, 0]}>
        <boxGeometry args={[0.05, 0.24, 0.16]} />
      </mesh>
    </group>
  );
}

/** The open arc a satellite rides. Not a full ring — an instrument's gimbal. */
function OrbitArc({ radius, material }: { radius: number; material: THREE.Material }) {
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(radius, 0.016, 5, 96, Math.PI * 1.55);
    return g;
  }, [radius]);
  return <mesh geometry={geo} material={material} />;
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const rings = useRef<THREE.Group[]>([]);
  const hub = useRef<THREE.Group>(null);

  const chassis = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.95, roughness: 0.24 }),
    [],
  );
  const accent = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.violet, emissive: tint, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.2 }),
    [tint],
  );
  const arcMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.5, toneMapped: false }),
    [tint],
  );

  useFrame((state, d) => {
    accent.emissive.set(tint);
    arcMat.color.set(tint);
    rings.current.forEach((g, i) => {
      if (g) g.rotation.z += d * ORBITS[i]!.speed;
    });
    if (hub.current) {
      hub.current.scale.setScalar(1 + pulse(progress, 7) * 0.12);
      hub.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.14;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[5, 6, 6]} intensity={1.9} color={P.highlight} />
      <pointLight position={[0, 0, 1.5]} intensity={22} color={tint} distance={11} />
      <pointLight position={[-5, -3, -2]} intensity={26} color={P.electric} distance={18} />

      <group ref={hub}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.15}
          depth={0.46}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.25 : 0.93}
        />
        {/* A machined collar around the glyph roots it in the mechanism. */}
        <mesh material={chassis} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
          <torusGeometry args={[1.55, 0.055, 8, 48]} />
        </mesh>
        <FresnelShell color={tint} power={3} intensity={0.7}>
          <sphereGeometry args={[1.8, 28, 20]} />
        </FresnelShell>
      </group>

      {ORBITS.map((o, i) => (
        <group key={i} rotation={o.tilt} ref={(g) => { if (g) rings.current[i] = g; }}>
          <OrbitArc radius={o.radius} material={arcMat} />
          {Array.from({ length: o.count }, (_, k) => {
            const a = (k / o.count) * Math.PI * 1.4;
            return (
              <group key={k} position={[Math.cos(a) * o.radius, Math.sin(a) * o.radius, 0]} rotation={[0, 0, a]}>
                <Satellite material={chassis} accent={accent} />
              </group>
            );
          })}
        </group>
      ))}

      <Particles motion="drift" count={170} color={P.mist} spread={7.5} size={0.03} opacity={0.42} />
      <Particles motion="inflow" count={110} color={tint} spread={5} size={0.038} speed={urgent ? 1.6 : 0.85} opacity={0.6} />
    </>
  );
}

export const Countdown04: Design = {
  id: "countdown-04",
  name: "Orbital System",
  nameAr: "المنظومة المدارية",
  descriptionAr: "جهاز فلكي بثلاث مدارات مائلة، وأقمار مصنّعة بتلف على سرعات مختلفة.",
  Scene,
  camera: { position: [0, 0.6, 8.4], fov: 44 },
  effects: { bloom: 0.66, bloomThreshold: 0.54, chromatic: 0.0005, vignette: 0.44 },
  parallax: 0.45,
};
