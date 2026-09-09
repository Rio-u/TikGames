import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EnergyField, FresnelShell } from "../shared/materials";
import { P } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { easeOutBack, easeOutExpo } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 09 — THE SIGIL
 *
 * An object that exists nowhere else: a torus knot cage in glass, wound through a floating
 * armature, with a charged core at its centre.
 *
 * A `TorusKnotGeometry` is a primitive, but a (3,7) knot rendered as thick glass, wrapped by a
 * counter-rotating armature of ribs, sitting inside a fresnel envelope, is not something the eye
 * parses as one. It is the most distinctive silhouette in the set and is meant to be the mark the
 * game is recognised by — a shape you could stamp on a trophy.
 */

/** The armature: ribs following the knot's path, tightening as the sigil forms. */
function Armature({ form }: { form: number }) {
  const group = useRef<THREE.Group>(null);
  const ribs = useRef<THREE.Mesh[]>([]);
  const N = 22;

  const geo = useMemo(() => new THREE.TorusGeometry(0.3, 0.022, 5, 22), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.violet, emissive: P.lavender, emissiveIntensity: 1.5, metalness: 0.8, roughness: 0.2 }),
    [],
  );

  // Sample the same knot curve the glass uses, so the ribs genuinely ride it.
  const path = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const p = 3;
    const q = 7;
    for (let i = 0; i < N; i++) {
      const u = (i / N) * Math.PI * 2;
      const r = 1.55 + 0.42 * Math.cos(q * u);
      pts.push(new THREE.Vector3(r * Math.cos(p * u), r * Math.sin(p * u), 0.42 * Math.sin(q * u)));
    }
    return pts;
  }, []);

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y -= d * 0.28;
    ribs.current.forEach((m, i) => {
      if (!m) return;
      const local = easeOutExpo(THREE.MathUtils.clamp((form - (i / N) * 0.4) / 0.6, 0, 1));
      const home = path[i]!;
      m.position.copy(home).multiplyScalar(0.6 + local * 0.4);
      m.lookAt(0, 0, 0);
      m.rotation.z += t * 0.5 + i;
      m.scale.setScalar(local);
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { if (m) ribs.current[i] = m; }} geometry={geo} material={material} />
      ))}
    </group>
  );
}

function Scene({ value, progress }: SceneProps) {
  const form = Math.min(progress * 1.6, 1);
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.3) / 0.4, 0, 1), 1.6);
  const knot = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Group>(null);

  const knotGeo = useMemo(() => new THREE.TorusKnotGeometry(1.55, 0.2, 220, 20, 3, 7), []);

  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: P.mist,
        metalness: 0,
        roughness: 0.04,
        transmission: 0.95,
        thickness: 1.3,
        ior: 1.75,
        iridescence: 0.7,
        iridescenceIOR: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        attenuationColor: new THREE.Color(P.electric),
        attenuationDistance: 1.1,
      }),
    [],
  );

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (knot.current) {
      knot.current.rotation.y += d * 0.2;
      knot.current.rotation.x = Math.sin(t * 0.28) * 0.16;
      knot.current.scale.setScalar(0.3 + form * 0.7);
    }
    if (core.current) core.current.rotation.z = Math.sin(t * 0.4) * 0.06;
  });

  return (
    <>
      <ambientLight intensity={0.42} color={P.mist} />
      {/* Glass needs hard, separated speculars to describe its own curvature. */}
      <directionalLight position={[6, 7, 5]} intensity={3} color={P.highlight} />
      <directionalLight position={[-5, -3, -5]} intensity={1.5} color={P.electric} />
      <pointLight position={[0, 0, 0]} intensity={22 + form * 18} color={P.ember} distance={10} />
      <pointLight position={[4, -2, 4]} intensity={20} color={P.lavender} distance={16} />

      <group ref={core}>
        <mesh ref={knot} geometry={knotGeo} material={glass} />
        <Armature form={form} />

        <EnergyField colorA={P.electric} colorB={P.ember} speed={0.85} density={2.6} intensity={0.7 + form * 0.8}>
          <sphereGeometry args={[0.95, 36, 26]} />
        </EnergyField>

        <group scale={reveal}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={1.75}
            depth={0.38}
            face={P.highlight}
            body={P.violet}
            edge={P.ember}
            intensity={1.3}
          />
        </group>

        <FresnelShell color={P.lavender} power={3} intensity={0.6 + form * 0.6}>
          <sphereGeometry args={[2.5, 32, 24]} />
        </FresnelShell>
      </group>

      <Particles motion="inflow" count={210} color={P.lavender} spread={5.6} size={0.04} speed={1.1} />
      <Particles motion="drift" count={130} color={P.mist} spread={8} size={0.026} opacity={0.4} />
    </>
  );
}

export const Victory09: Design = {
  id: "victory-09",
  name: "The Sigil",
  nameAr: "الشعار",
  descriptionAr: "عقدة زجاجية بتتلف حوالي قلب مشحون، وهيكل بيلف عكسها — شكل مميز يتعرف من بعيد.",
  Scene,
  camera: { position: [0, 0, 7.4], fov: 45 },
  effects: { bloom: 0.81, bloomThreshold: 0.54, chromatic: 0.001, vignette: 0.5 },
  parallax: 0.55,
};
