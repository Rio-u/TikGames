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
 * WIN 02 — MONOLITH
 *
 * A trophy reduced to its idea: three tapered blades rising from a machined plinth, holding a
 * charged void between them. No cup, no handles, no literal object — the brief was explicitly
 * *not* a cartoon trophy, so what carries "award" here is the silhouette and the ceremony of the
 * rise, not iconography.
 *
 * Metal is the point of this one. It is the only design that leans on real metalness and a sharp
 * environment response rather than emissive glow.
 */

/** A blade: a tapered, twisted prism. Lathed rather than boxed so the taper is continuous. */
function useBladeGeometry() {
  return useMemo(() => {
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      // Wide at the base, pinched at the waist, drawn to a point. The earlier curve collapsed to
      // near-zero width over most of its length, so the blades rendered as hairlines.
      const w = 0.5 * Math.pow(1 - t, 0.45) * (0.8 + 0.2 * Math.cos(t * Math.PI));
      profile.push(new THREE.Vector2(Math.max(w, 0.006), -1.0 + t * 2.9));
    }
    // Five sides, not three: a three-sided lathe of a tapering profile is a sliver in silhouette
    // from most angles.
    const geo = new THREE.LatheGeometry(profile, 6);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function Plinth() {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    // A chamfered hexagon — machined, not turned.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * 1.45;
      const y = Math.sin(a) * 1.45;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.09,
      bevelSegments: 3,
    });
    g.center();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.6, roughness: 0.35, emissive: P.electric, emissiveIntensity: 0.22 }),
    [],
  );

  return <mesh geometry={geo} material={material} position={[0, -1.35, 0]} />;
}

function Scene({ value, progress }: SceneProps) {
  const bladeGeo = useBladeGeometry();
  const rise = easeOutExpo(Math.min(progress * 1.9, 1));
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.3) / 0.42, 0, 1), 1.4);
  const group = useRef<THREE.Group>(null);
  const blades = useRef<THREE.Group>(null);

  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e3d8ff",
        // Not fully metallic: pure metal with no environment map to reflect renders as near-black.
        // Dropping metalness and lifting roughness lets the direct lights actually describe the
        // form, which is the whole point of this design.
        metalness: 0.55,
        roughness: 0.28,
        emissive: P.lavender,
        emissiveIntensity: 0.35,
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = -1.4 + rise * 1.4;
      group.current.rotation.y = t * 0.16;
    }
    if (blades.current) {
      // The blades untwist as they rise — the whole gesture of the piece.
      blades.current.children.forEach((c, i) => {
        c.rotation.y = (i / 3) * Math.PI * 2 + (1 - rise) * 1.2;
        c.rotation.z = (1 - rise) * 0.25 * (i % 2 ? 1 : -1);
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} color={P.mist} />
      {/* Two hard speculars are what make the metal read; a soft fill would kill it. */}
      <directionalLight position={[5, 7, 4]} intensity={3.2} color={P.highlight} />
      <directionalLight position={[-4, 2, -5]} intensity={1.8} color={P.lavender} />
      <pointLight position={[0, 0.5, 2.4]} intensity={22} color={P.electric} distance={12} />
      <pointLight position={[0, -1.4, 1]} intensity={16} color={P.ember} distance={8} />

      <group ref={group}>
        <Plinth />
        <group ref={blades} position={[0, 0.5, 0]}>
          {[0, 1, 2].map((i) => (
            <group key={i}>
              <mesh geometry={bladeGeo} material={metal} // 1.15 apart: at the previous spacing the three blades overlapped into a single cone and
                // the design lost the one thing that made it a trophy silhouette.
                position={[Math.cos((i / 3) * Math.PI * 2) * 1.15, 0, Math.sin((i / 3) * Math.PI * 2) * 1.15]}
                rotation={[0, 0, -0.16]} />
            </group>
          ))}
        </group>

        {/* The charged void the blades enclose. */}
        <FresnelShell color={P.ember} power={2.2} intensity={0.8 + rise * 0.9} speed={0.6} position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.85, 32, 24]} />
        </FresnelShell>

        <group position={[0, 0.65, 0]} scale={reveal}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={1.5}
            depth={0.34}
            face={P.highlight}
            body={P.violet}
            edge={P.ember}
            intensity={1.2}
          />
        </group>
      </group>

      <Particles motion="updraft" count={200} color={P.lavender} spread={4.6} size={0.04} speed={1.1} opacity={0.7} />
      <Particles motion="drift" count={110} color={P.mist} spread={7.5} size={0.026} opacity={0.35} />
    </>
  );
}

export const Victory02: Design = {
  id: "victory-02",
  name: "Monolith",
  nameAr: "النصب",
  descriptionAr: "ثلاث شفرات معدنية بتطلع من قاعدة مشغولة وبينها فراغ مشحون — كأس مختزلة لفكرتها.",
  Scene,
  camera: { position: [0, 0.5, 7.2], fov: 44 },
  effects: { bloom: 0.69, bloomThreshold: 0.6, chromatic: 0.0005, vignette: 0.5 },
  parallax: 0.45,
};
