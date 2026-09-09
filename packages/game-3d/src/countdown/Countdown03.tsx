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
 * 03 — DIGITAL CRYSTAL
 *
 * A cut mineral holding the number in suspension, with shards orbiting the mass.
 *
 * The crystal is a lathed profile, not an icosahedron — a hand-drawn silhouette revolved on six
 * sides gives faceted, asymmetric planes that catch light like a real cut stone, where a
 * subdivided platonic solid always reads as a primitive.
 *
 * `transmission` is used here and nowhere else: it needs a second render of the scene per frame,
 * which is affordable exactly once.
 */

/** Revolved profile of a cut stone: table, crown, girdle, pavilion. */
function useCrystalGeometry() {
  return useMemo(() => {
    const profile = [
      new THREE.Vector2(0.001, 1.85),
      new THREE.Vector2(0.42, 1.5),
      new THREE.Vector2(0.86, 1.02),
      new THREE.Vector2(1.04, 0.42),
      new THREE.Vector2(0.98, -0.16),
      new THREE.Vector2(0.62, -0.92),
      new THREE.Vector2(0.24, -1.5),
      new THREE.Vector2(0.001, -1.92),
    ];
    // Six segments, flat-shaded: hard facets rather than a smooth revolve.
    const geo = new THREE.LatheGeometry(profile, 6);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

/** Shards drifting off the mass, each a slice of the same silhouette. */
function Shards({ tint }: { tint: string }) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.3, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.slate,
        emissive: tint,
        emissiveIntensity: 0.65,
        metalness: 0.75,
        roughness: 0.18,
        flatShading: true,
        transparent: true,
        opacity: 0.9,
      }),
    [tint],
  );

  const bits = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        radius: 2.6 + (i % 3) * 0.6,
        speed: 0.16 + (i % 4) * 0.07,
        phase: (i / 11) * Math.PI * 2,
        y: (Math.random() - 0.5) * 2.6,
        scale: 0.35 + Math.random() * 0.7,
        tilt: Math.random() * Math.PI,
      })),
    [],
  );

  useFrame((state) => {
    material.emissive.set(tint);
    const t = state.clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      const b = bits[i]!;
      const a = b.phase + t * b.speed;
      child.position.set(Math.cos(a) * b.radius, b.y + Math.sin(t * 0.5 + i) * 0.25, Math.sin(a) * b.radius * 0.7);
      child.rotation.set(b.tilt + t * 0.3, t * 0.24, b.tilt);
    });
  });

  return (
    <group ref={group}>
      {bits.map((b, i) => (
        <mesh key={i} geometry={geo} material={material} scale={b.scale} />
      ))}
    </group>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const crystalGeo = useCrystalGeometry();
  const crystal = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);

  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: P.mist,
        metalness: 0,
        roughness: 0.06,
        transmission: 0.92,
        thickness: 2.4,
        ior: 1.9,
        // Chromatic dispersion through the facets — the detail that reads as a real gemstone.
        iridescence: 0.85,
        iridescenceIOR: 1.6,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        attenuationColor: new THREE.Color(P.electric),
        attenuationDistance: 1.6,
        flatShading: true,
      }),
    [],
  );

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y += d * 0.16;
      crystal.current.rotation.z = Math.sin(t * 0.35) * 0.07;
      crystal.current.scale.setScalar(1 + pulse(progress, 8) * 0.07);
    }
    // The internal light flares on each tick — light visibly passing through the facets.
    if (glow.current) glow.current.intensity = 14 + pulse(progress, 5) * 34;
  });

  return (
    <>
      <ambientLight intensity={0.45} color={P.mist} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color={P.highlight} />
      <directionalLight position={[-5, -2, -4]} intensity={1.1} color={P.electric} />
      <pointLight ref={glow} position={[0, 0, 0]} intensity={16} color={tint} distance={9} />

      {/* Behind the glass, so it refracts through the stone. */}
      <group position={[0, 0, -0.35]}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={1.95}
          depth={0.34}
          face={tint}
          body={P.violet}
          edge={P.highlight}
          intensity={urgent ? 1.5 : 1.15}
          outline={false}
        />
      </group>

      <mesh ref={crystal} geometry={crystalGeo} material={glass} scale={1.32} />

      <FresnelShell color={tint} power={3.4} intensity={0.85}>
        <sphereGeometry args={[2.5, 32, 24]} />
      </FresnelShell>

      <Shards tint={tint} />
      <Particles motion="drift" count={150} color={P.mist} spread={7} size={0.033} opacity={0.5} />
    </>
  );
}

export const Countdown03: Design = {
  id: "countdown-03",
  name: "Digital Crystal",
  nameAr: "البلورة",
  descriptionAr: "حجر مقطوع بأوجه حقيقية، الرقم بيتكسّر ضوءه جوّه، وشظايا بتدور حواليه.",
  Scene,
  camera: { position: [0, 0, 7], fov: 44 },
  effects: { bloom: 0.63, bloomThreshold: 0.56, chromatic: 0.0011, vignette: 0.45 },
  parallax: 0.5,
};
