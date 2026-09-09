import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EnergyField, FresnelShell } from "../shared/materials";
import { P, col, urgencyColor } from "../shared/palette";
import { pulse } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 07 — GRAVITY FIELD
 *
 * A mass warping the space around it. Debris falls on decaying spirals; a lensing shell bends
 * what is behind it; the number sits at the centre, untouched.
 *
 * Two things keep this off the black-hole cliché: it stays violet rather than going orange-blue,
 * and the accretion disc is *dust on inclined orbits* rather than a flat glowing ring — so the
 * plane of the disc is ambiguous and the scene reads as a field, not a disc seen edge-on.
 */

/** Debris on decaying spirals — each particle is a real point with its own orbital plane. */
function Accretion({ tint, urgency }: { tint: string; urgency: number }) {
  const N = 520;
  const points = useRef<THREE.Points>(null);

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      seeds[i * 4] = 1.1 + Math.random() * 3.4; // radius
      seeds[i * 4 + 1] = Math.random() * Math.PI * 2; // phase
      seeds[i * 4 + 2] = (Math.random() - 0.5) * 1.1; // inclination
      seeds[i * 4 + 3] = 0.35 + Math.random(); // rate
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, seeds };
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.055,
        color: col(tint).clone(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [tint],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d * (1 + urgency);
    material.color.set(tint);
    const arr = geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const r0 = seeds[i * 4]!;
      const ph = seeds[i * 4 + 1]!;
      const inc = seeds[i * 4 + 2]!;
      const rate = seeds[i * 4 + 3]!;
      // Inner orbits sweep faster — the shear is what makes it read as gravity rather than a fan.
      const k = (t.current * 0.12 * rate + ph / 6.283) % 1;
      const r = 0.55 + (r0 - 0.55) * (1 - k);
      const a = ph + t.current * (1.6 / (r * r + 0.4)) * rate;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.sin(a) * r * Math.cos(inc) + Math.sin(inc) * r * 0.35;
      arr[i * 3 + 2] = Math.sin(a) * r * Math.sin(inc);
    }
    geometry.attributes.position!.needsUpdate = true;
    if (points.current) points.current.rotation.y = t.current * 0.05;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/** Curved trails: tube segments bent along the field, giving the warp a visible grain. */
function Filaments({ tint }: { tint: string }) {
  const group = useRef<THREE.Group>(null);

  const tubes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const start = 1.4 + (i % 3) * 0.75;
        const inc = (i / 9) * Math.PI * 2;
        const pts = Array.from({ length: 16 }, (_, k) => {
          const kk = k / 15;
          const r = start * (1 - kk * 0.72) + 0.5;
          const a = inc + kk * 3.4;
          return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.68, Math.sin(a + inc) * r * 0.3);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.014, 5, false);
      }),
    [],
  );

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [tint],
  );

  useFrame((_, d) => {
    material.color.set(tint);
    if (group.current) group.current.rotation.z += d * 0.22;
  });

  return (
    <group ref={group}>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
    </group>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const well = useRef<THREE.Mesh>(null);
  const hub = useRef<THREE.Group>(null);

  const lens = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: P.abyss,
        roughness: 0,
        metalness: 0,
        transmission: 1,
        thickness: 3.4,
        ior: 2.3,
        transparent: true,
      }),
    [],
  );

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (well.current) {
      well.current.rotation.y += d * 0.1;
      well.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02);
    }
    if (hub.current) hub.current.scale.setScalar(1 + pulse(progress, 6) * 0.1);
  });

  return (
    <>
      <ambientLight intensity={0.3} color={P.mist} />
      <directionalLight position={[5, 4, 6]} intensity={1.5} color={P.highlight} />
      <pointLight position={[0, 0, 0]} intensity={18} color={tint} distance={9} />
      <pointLight position={[-6, -3, -3]} intensity={34} color={P.electric} distance={22} />

      <Accretion tint={tint} urgency={urgent ? 1 : 0} />
      <Filaments tint={tint} />

      {/* The lensing body: a transmissive sphere that visibly bends the debris behind it. */}
      <mesh ref={well} material={lens}>
        <sphereGeometry args={[0.95, 40, 30]} />
      </mesh>

      <EnergyField colorA={P.electric} colorB={tint} speed={urgent ? 1.4 : 0.7} density={3.2} intensity={1.1}>
        <sphereGeometry args={[1.25, 36, 26]} />
      </EnergyField>

      <group ref={hub} position={[0, 0, 1.9]}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.15}
          depth={0.42}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.3 : 0.95}
        />
      </group>

      <FresnelShell color={tint} power={3.6} intensity={1.1} speed={0.8}>
        <sphereGeometry args={[1.55, 34, 26]} />
      </FresnelShell>
    </>
  );
}

export const Countdown07: Design = {
  id: "countdown-07",
  name: "Gravity Field",
  nameAr: "حقل الجاذبية",
  descriptionAr: "كتلة بتلوي الفضا حواليها — حطام على مدارات مائلة بيتسحب للمركز، والرقم ثابت قدّامها.",
  Scene,
  camera: { position: [0, 0.4, 7.6], fov: 46 },
  effects: { bloom: 0.75, bloomThreshold: 0.52, chromatic: 0.001, vignette: 0.62 },
  parallax: 0.6,
};
