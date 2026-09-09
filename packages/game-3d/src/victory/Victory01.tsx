import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EnergyField, FresnelShell } from "../shared/materials";
import { P } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { easeOutExpo, easeOutBack } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 01 — VICTORY CORE
 *
 * The countdown's reactor, resolved. A sealed core splits into four petals and releases what it
 * was holding — deliberately the same visual family as Countdown 01, because this is the payoff
 * of that build-up, and the shared language is what makes the release land.
 *
 * The victory half of the palette is where `ember` is allowed, and it appears here only in the
 * burst, never in the chassis.
 */

/** The shell: four petals that hinge open. */
function Petals({ open }: { open: number }) {
  const group = useRef<THREE.Group>(null);

  const geo = useMemo(() => {
    // Radius 2.3, not 1.55: the petals have to *enclose* the number they open to reveal, and the
    // number is 1.9 across. At the smaller radius the shell cut straight through the glyph and
    // the reveal read as a shape stuck in front of it.
    const g = new THREE.SphereGeometry(2.3, 26, 20, 0, Math.PI / 2, 0, Math.PI);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.slate,
        metalness: 0.95,
        roughness: 0.18,
        emissive: P.electric,
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
        // Petals dissolve as they clear the frame. A quarter-sphere orbiting the origin always
        // has some of itself between the camera and the centre, so travel alone can never fully
        // uncover the number — the shell has to stop being opaque as well.
        transparent: true,
      }),
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.18;
    material.opacity = Math.max(0, 1 - open * 1.25);
    group.current.children.forEach((c, i) => {
      // Each petal swings out and back on its own hinge, then drifts outward as it opens.
      c.rotation.z = -open * 1.4;
      // Travel far enough to clear the glyph entirely, and drop behind it on the way out.
      const a = (i / 4) * Math.PI * 2;
      c.position.set(Math.cos(a) * open * 4.2, Math.sin(a) * open * 4.2, -open * 2.2);
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo} material={material} rotation={[0, (i / 4) * Math.PI * 2, 0]} />
      ))}
    </group>
  );
}

function Scene({ value, progress }: SceneProps) {
  const open = easeOutExpo(Math.min(progress * 2.2, 1));
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.22) / 0.4, 0, 1), 1.5);
  const burst = Math.max(0, 1 - progress * 2.6);
  const core = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (core.current) core.current.rotation.z = Math.sin(t * 0.3) * 0.05;
    // A hard flash at the moment of opening, decaying fast.
    if (flash.current) flash.current.intensity = 24 + burst * 160;
  });

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[4, 6, 6]} intensity={1.6} color={P.highlight} />
      <pointLight ref={flash} position={[0, 0, 0]} intensity={24} color={P.ember} distance={16} />
      <pointLight position={[-5, -2, 4]} intensity={30} color={P.electric} distance={20} />

      <group ref={core}>
        <EnergyField colorA={P.electric} colorB={P.ember} speed={1.1} density={2.2} intensity={1.1 + open * 0.9}>
          <sphereGeometry args={[1.35 + open * 0.9, 44, 32]} />
        </EnergyField>

        <Petals open={open} />

        <group scale={reveal}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={1.9}
            depth={0.46}
            face={P.highlight}
            body={P.violet}
            edge={P.ember}
            intensity={1.3}
          />
        </group>

        <FresnelShell color={P.ember} power={2.4} intensity={0.7 + burst * 2.4}>
          <sphereGeometry args={[2.4 + open * 1.8, 40, 28]} />
        </FresnelShell>
      </group>

      <Particles motion="updraft" count={260} color={P.ember} spread={5.5} size={0.055} speed={1.5} />
      <Particles motion="drift" count={140} color={P.lavender} spread={8} size={0.032} opacity={0.5} />
    </>
  );
}

export const Victory01: Design = {
  id: "victory-01",
  name: "Victory Core",
  nameAr: "قلب الانتصار",
  descriptionAr: "القلب بينفتح على أربع بتلات ويطلق الطاقة اللي كان ماسكها — نفس عائلة «قلب الطاقة».",
  Scene,
  camera: { position: [0, 0, 7.6], fov: 45 },
  effects: { bloom: 1.02, bloomThreshold: 0.44, chromatic: 0.0008, vignette: 0.5 },
  parallax: 0.4,
};
