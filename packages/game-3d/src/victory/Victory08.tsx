import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P } from "../shared/palette";
import { easeOutBack, easeOutExpo } from "../shared/easing";
import { Fragments, Particles } from "../shared/Particles";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 08 — IMPACT
 *
 * The number arrives by breaking through. A slab shatters outward, the number lands in the hole
 * it left, and the debris slows and drifts back toward it rather than flying off forever.
 *
 * This is the only scene with a camera move of its own — a short push-in on impact, released
 * over the following second. The recoil is what sells the hit; without it the shards read as
 * decoration rather than consequence.
 */

/** The slab that gets broken: a plate of tiles that fly apart from the centre. */
function Slab({ shatter }: { shatter: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const COLS = 9;
  const ROWS = 7;
  const N = COLS * ROWS;

  const tiles = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const cx = (i % COLS) - (COLS - 1) / 2;
        const cy = Math.floor(i / COLS) - (ROWS - 1) / 2;
        const home = new THREE.Vector3(cx * 0.62, cy * 0.62, 0);
        // Impulse falls off with distance from the centre — a real impact pattern.
        const dist = home.length();
        const dir = home.clone().normalize().multiplyScalar(1 / (dist * 0.5 + 0.6));
        return {
          home,
          dir: new THREE.Vector3(dir.x, dir.y, 0.4 + Math.random() * 1.5),
          spin: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
          delay: dist * 0.05,
        };
      }),
    [N],
  );

  const geo = useMemo(() => new THREE.BoxGeometry(0.58, 0.58, 0.14), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.slate,
        metalness: 0.9,
        roughness: 0.28,
        emissive: P.electric,
        emissiveIntensity: 0.3,
        transparent: true,
        flatShading: true,
      }),
    [],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    if (!mesh.current) return;
    tiles.forEach((tile, i) => {
      const k = THREE.MathUtils.clamp(shatter - tile.delay, 0, 1);
      const e = easeOutExpo(k);
      dummy.position.copy(tile.home).addScaledVector(tile.dir, e * 5.5);
      // Gravity on the way out, so debris arcs instead of travelling in straight lines.
      dummy.position.y -= e * e * 1.6;
      dummy.rotation.set(tile.spin.x * e, tile.spin.y * e, tile.spin.z * e);
      dummy.scale.setScalar(1 - e * 0.55);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    material.opacity = Math.max(0, 1 - shatter * 1.15);
  });

  return <instancedMesh ref={mesh} args={[geo, material, N]} />;
}

/** A short camera push-in on the hit, released over the next beat. */
function Recoil({ shatter }: { shatter: number }) {
  useFrame((state) => {
    const hit = Math.max(0, 1 - shatter * 4);
    // Applied on top of whatever the parallax rig set this frame, never replacing it.
    state.camera.position.z -= hit * 0.9;
    state.camera.updateProjectionMatrix();
  });
  return null;
}

function Scene({ value, progress }: SceneProps) {
  const shatter = Math.min(progress * 1.5, 1);
  const land = easeOutBack(THREE.MathUtils.clamp((progress - 0.06) / 0.34, 0, 1), 2.2);
  const flash = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (flash.current) flash.current.intensity = 16 + Math.max(0, 1 - shatter * 3.4) * 180;
  });

  return (
    <>
      <ambientLight intensity={0.36} color={P.mist} />
      <directionalLight position={[4, 6, 7]} intensity={2} color={P.highlight} />
      <pointLight ref={flash} position={[0, 0, 2]} intensity={16} color={P.ember} distance={16} />
      <pointLight position={[-5, -3, -2]} intensity={26} color={P.electric} distance={20} />

      <Recoil shatter={shatter} />
      <group position={[0, 0, -0.6]}>
        <Slab shatter={shatter} />
      </group>

      {/* Secondary debris: finer, slower, settling back toward the number. */}
      <Fragments count={54} spread={3.4} assembly={Math.min(shatter * 1.3, 1)} color={P.slate} emissive={P.ember} scale={0.13} spin={0.9} />

      <group scale={land}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={3}
          depth={0.72}
          face={P.highlight}
          body={P.violet}
          edge={P.ember}
          intensity={1.4}
        />
        <FresnelShell color={P.ember} power={2.4} intensity={0.85}>
          <sphereGeometry args={[2.3, 30, 22]} />
        </FresnelShell>
      </group>

      <Particles motion="drift" count={170} color={P.mist} spread={7} size={0.03} opacity={0.45} />
    </>
  );
}

export const Victory08: Design = {
  id: "victory-08",
  name: "Impact",
  nameAr: "الاصطدام",
  descriptionAr: "الرقم بيخترق لوح بينكسر لبلاطات بتتطاير، والكاميرا نفسها بترتد من الضربة.",
  Scene,
  camera: { position: [0, 0, 8.6], fov: 46 },
  effects: { bloom: 0.96, bloomThreshold: 0.46, chromatic: 0.0012, vignette: 0.58 },
  parallax: 0.35,
};
