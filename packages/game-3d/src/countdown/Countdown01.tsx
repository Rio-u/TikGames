import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EnergyField, FresnelShell } from "../shared/materials";
import { P, urgencyColor } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { pulse } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 01 — ENERGY CORE
 *
 * A reactor charging between questions. The number is *inside* the containment, not in front of
 * it, so the volumetric field reads in front of and behind the glyph at once.
 *
 * The composition is four nested shells at different scales and speeds — containment cage, plasma
 * field, fresnel glass, particle inflow. Depth here comes from those layers disagreeing about
 * rotation, which is what stops it flattening into a disc the moment it stops spinning.
 */

/** The containment cage: eight curved struts on a ring, not a torus. */
function Cage({ tint }: { tint: string }) {
  const group = useRef<THREE.Group>(null);

  const struts = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  const geo = useMemo(() => {
    // A shallow arc swept into a bar — reads as engineered hardware where a torus reads as a ring.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0.34, -0.5, 0.12),
      new THREE.Vector3(0.44, 0, 0.16),
      new THREE.Vector3(0.34, 0.5, 0.12),
      new THREE.Vector3(0, 1, 0),
    ]);
    return new THREE.TubeGeometry(curve, 22, 0.045, 6, false);
  }, []);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.9, roughness: 0.28, emissive: tint, emissiveIntensity: 0.25 }),
    [tint],
  );

  useFrame((_, d) => {
    if (group.current) group.current.rotation.y += d * 0.24;
    material.emissive.set(tint);
  });

  return (
    <group ref={group} scale={2.05}>
      {struts.map((a, i) => (
        <mesh key={i} geometry={geo} material={material} rotation={[0, a, 0]} />
      ))}
    </group>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const core = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);

  useFrame((state, d) => {
    const kick = pulse(progress, 7);
    if (core.current) {
      core.current.scale.setScalar(1 + kick * 0.16);
      core.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
    if (inner.current) inner.current.rotation.y -= d * 0.5;
  });

  return (
    <>
      <ambientLight intensity={0.35} color={P.mist} />
      <pointLight position={[0, 0, 0]} intensity={26} color={tint} distance={12} />
      <directionalLight position={[3, 5, 6]} intensity={1.2} color={P.highlight} />
      <pointLight position={[-4, -2, 3]} intensity={30} color={P.electric} distance={18} />

      <group ref={core}>
        {/* Plasma. BackSide so we look *into* the volume. */}
        <EnergyField
          colorA={P.electric}
          colorB={tint}
          speed={urgent ? 1.5 : 0.75}
          density={2.6}
          intensity={urgent ? 0.95 : 0.68}
        >
          <sphereGeometry args={[1.72, 48, 36]} />
        </EnergyField>

        <group ref={inner}>
          <Cage tint={tint} />
        </group>

        {/* Containment glass. */}
        <FresnelShell color={tint} power={2.9} intensity={1.15} speed={0.5}>
          <sphereGeometry args={[2.2, 44, 32]} />
        </FresnelShell>

        {/* Inside the field, so plasma passes in front of the glyph as well as behind it. */}
        <group position={[0, 0, 0]}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={2.3}
            depth={0.5}
            face={P.highlight}
            body={P.violet}
            edge={tint}
            intensity={urgent ? 1.3 : 0.95}
          />
        </group>
      </group>

      <Particles motion="inflow" count={280} color={tint} spread={6.5} size={0.05} speed={urgent ? 1.8 : 1} />
      <Particles motion="drift" count={110} color={P.mist} spread={8} size={0.03} opacity={0.4} />
    </>
  );
}

export const Countdown01: Design = {
  id: "countdown-01",
  name: "Energy Core",
  nameAr: "قلب الطاقة",
  descriptionAr: "مفاعل بيشحن — الرقم جوّه البلازما نفسها، وقفص احتواء بيلف حواليه.",
  Scene,
  camera: { position: [0, 0, 7.2], fov: 45 },
  effects: { bloom: 0.87, bloomThreshold: 0.46, chromatic: 0.0007, vignette: 0.5 },
  parallax: 0.4,
};
