import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P, urgencyColor } from "../shared/palette";
import { easeOutExpo } from "../shared/easing";
import { Fragments, Particles } from "../shared/Particles";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 05 — FRACTURED NUMBER
 *
 * The number is the object. Nothing frames it, nothing orbits it — it arrives in pieces and is
 * held together by the field around it, then blows apart as the second runs out.
 *
 * The cycle is driven entirely off `progress`, so the assembly is locked to the server tick:
 * shards converge over the first third of each second, hold, then scatter in the last fifth,
 * which is what makes the *next* digit's arrival feel caused rather than merely next.
 */

/** Struts of energy bridging the fragments to the glyph. */
function Tethers({ tint, tension }: { tint: string; tension: number }) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.55, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    [tint],
  );

  const arms = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 1.7 + Math.random() * 1.5;
        return { a, r, y: (Math.random() - 0.5) * 2.2 };
      }),
    [],
  );

  useFrame((state) => {
    material.color.set(tint);
    material.opacity = 0.15 + tension * 0.55;
    if (group.current) group.current.rotation.z = state.clock.elapsedTime * 0.12;
  });

  return (
    <group ref={group}>
      {arms.map((arm, i) => {
        const x = Math.cos(arm.a) * arm.r;
        const y = Math.sin(arm.a) * arm.r;
        const len = Math.hypot(x, y);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={material}
            position={[x / 2, y / 2, arm.y * 0.2]}
            rotation={[0, 0, Math.atan2(y, x) - Math.PI / 2]}
            scale={[1, len, 1]}
          />
        );
      })}
    </group>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const glyph = useRef<THREE.Group>(null);

  // Converge over the first 35% of the second, hold, then break apart over the last 18%.
  const assembly = progress < 0.35 ? easeOutExpo(progress / 0.35) : progress > 0.82 ? 1 - (progress - 0.82) / 0.18 : 1;

  useFrame((state) => {
    if (!glyph.current) return;
    const t = state.clock.elapsedTime;
    glyph.current.rotation.y = Math.sin(t * 0.45) * 0.18;
    glyph.current.rotation.x = Math.cos(t * 0.33) * 0.07;
    // The glyph itself is only fully solid while the fragments are locked in.
    glyph.current.scale.setScalar(0.75 + assembly * 0.25);
  });

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[4, 5, 6]} intensity={2} color={P.highlight} />
      <pointLight position={[0, 0, 2.5]} intensity={20 + assembly * 26} color={tint} distance={12} />
      <pointLight position={[-5, -3, -2]} intensity={26} color={P.electric} distance={18} />

      <group ref={glyph}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={3.3}
          depth={0.78}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.4 : 1.0}
        />
      </group>

      <Fragments
        count={70}
        spread={2.9}
        assembly={assembly}
        color={P.slate}
        emissive={tint}
        scale={0.19}
        spin={0.5}
      />

      <Tethers tint={tint} tension={assembly} />

      <FresnelShell color={tint} power={3.2} intensity={0.55 + assembly * 0.6}>
        <sphereGeometry args={[3.1, 30, 22]} />
      </FresnelShell>

      <Particles motion="inflow" count={210} color={tint} spread={6} size={0.04} speed={urgent ? 2 : 1.2} />
      <Particles motion="drift" count={100} color={P.mist} spread={8} size={0.026} opacity={0.35} />
    </>
  );
}

export const Countdown05: Design = {
  id: "countdown-05",
  name: "Fractured Number",
  nameAr: "الرقم المتشظّي",
  descriptionAr: "الرقم نفسه هو المشهد — شظايا بتتجمّع عليه وخيوط طاقة ماسكاه، وبينفجر آخر الثانية.",
  Scene,
  camera: { position: [0, 0, 8], fov: 42 },
  effects: { bloom: 0.81, bloomThreshold: 0.5, chromatic: 0.0008, vignette: 0.5 },
  parallax: 0.5,
};
