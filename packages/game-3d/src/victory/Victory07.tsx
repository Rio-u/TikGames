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
 * WIN 07 — ENERGY CROWN
 *
 * A crown as a light structure: seven tapered prisms rising off a floating band, assembling out
 * of nothing and settling into a ring above the number.
 *
 * The brief ruled out anything medieval, so the read comes from proportion alone — a band, points
 * of graduated height, radial symmetry — with no jewels, no fur, no gold. It is built from the
 * same machined-violet vocabulary as the rest of the set and only the tips carry the warm accent.
 */

const POINTS = 7;

/** A crown point: a tapered triangular prism, tallest at the front centre. */
function useSpireGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.16, 0);
    shape.lineTo(0.16, 0);
    shape.lineTo(0.045, 1);
    shape.lineTo(-0.045, 1);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.022,
      bevelSegments: 2,
    });
    geo.center();
    geo.translate(0, 0.5, 0);
    return geo;
  }, []);
}

function Crown({ assemble }: { assemble: number }) {
  const spireGeo = useSpireGeometry();
  const group = useRef<THREE.Group>(null);
  const spires = useRef<THREE.Group[]>([]);

  const body = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.95, roughness: 0.17, emissive: P.electric, emissiveIntensity: 0.5 }),
    [],
  );
  const tip = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.violet, emissive: P.ember, emissiveIntensity: 1.8, metalness: 0.6, roughness: 0.2 }),
    [],
  );
  const bandGeo = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < POINTS * 2; i++) {
      const a = (i / (POINTS * 2)) * Math.PI * 2;
      const r = 1.55;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    for (let i = 0; i < POINTS * 2; i++) {
      const a = (i / (POINTS * 2)) * Math.PI * 2;
      const r = 1.42;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    g.center();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = t * 0.22;
      group.current.position.y = 1.55 + Math.sin(t * 0.8) * 0.05;
    }
    spires.current.forEach((g, i) => {
      if (!g) return;
      // Points arrive one after another, tallest last — the crown builds to its centre.
      const order = Math.abs(i - (POINTS - 1) / 2) / ((POINTS - 1) / 2);
      const local = easeOutExpo(THREE.MathUtils.clamp((assemble - (1 - order) * 0.35) / 0.6, 0, 1));
      const a = (i / POINTS) * Math.PI * 2;
      g.position.set(Math.cos(a) * 1.48, 0.1, Math.sin(a) * 1.48);
      g.rotation.y = -a + Math.PI / 2;
      // Graduated height: the front point is the tallest.
      const h = 0.55 + (1 - order) * 0.72;
      g.scale.set(local, h * local, local);
    });
  });

  return (
    <group ref={group}>
      <mesh geometry={bandGeo} material={body} scale={assemble} />
      {Array.from({ length: POINTS }, (_, i) => (
        <group key={i} ref={(g) => { if (g) spires.current[i] = g; }}>
          <mesh geometry={spireGeo} material={body} />
          {/* The tip is a separate mesh so only it burns warm. */}
          <mesh geometry={spireGeo} material={tip} scale={[0.5, 0.16, 0.5]} position={[0, 0.92, 0]} />
        </group>
      ))}
    </group>
  );
}

function Scene({ value, progress }: SceneProps) {
  const assemble = Math.min(progress * 1.7, 1);
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.32) / 0.42, 0, 1), 1.5);

  return (
    <>
      <ambientLight intensity={0.34} color={P.mist} />
      <directionalLight position={[4, 7, 5]} intensity={2.6} color={P.highlight} />
      <directionalLight position={[-5, 1, -4]} intensity={1.2} color={P.lavender} />
      <pointLight position={[0, 2, 2]} intensity={24} color={P.ember} distance={13} />
      <pointLight position={[0, -1, 3]} intensity={18} color={P.electric} distance={14} />

      <Crown assemble={assemble} />

      <group position={[0, -0.5, 0]} scale={reveal}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.4}
          depth={0.5}
          face={P.highlight}
          body={P.violet}
          edge={P.ember}
          intensity={1.25}
        />
        <FresnelShell color={P.lavender} power={2.7} intensity={0.8}>
          <sphereGeometry args={[1.85, 30, 22]} />
        </FresnelShell>
      </group>

      <Particles motion="updraft" count={210} color={P.ember} spread={4.4} size={0.042} speed={1.1} opacity={0.75} />
      <Particles motion="drift" count={130} color={P.mist} spread={7.5} size={0.026} opacity={0.38} />
    </>
  );
}

export const Victory07: Design = {
  id: "victory-07",
  name: "Energy Crown",
  nameAr: "تاج الطاقة",
  descriptionAr: "تاج من ضوء — سبع قمم بتتبني واحدة ورا التانية فوق الرقم، من غير أي زخرفة.",
  Scene,
  camera: { position: [0, 0.4, 8], fov: 45 },
  effects: { bloom: 0.87, bloomThreshold: 0.5, chromatic: 0.0006, vignette: 0.5 },
  parallax: 0.45,
};
