import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell, HoloSurface } from "../shared/materials";
import { P, urgencyColor } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { easeOutExpo } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * 02 — HOLOGRAPHIC PORTAL
 *
 * A gateway seen slightly off-axis, with the number suspended in its throat.
 *
 * The depth is literal: seven concentric frames march back along -Z at decreasing scale and
 * increasing spin, so the eye reads a tunnel rather than a stack. The frames are chamfered
 * octagons rather than circles — an aperture, not a ring — and each carries a holographic
 * surface so the whole gate shimmers as one projection.
 */

/** One chamfered octagonal frame, extruded. Built once and shared by every ring. */
function useFrameGeometry() {
  return useMemo(() => {
    const outer = new THREE.Shape();
    const inner = new THREE.Path();
    const poly = (path: THREE.Shape | THREE.Path, r: number) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
    };
    poly(outer, 1);
    poly(inner, 0.84);
    outer.holes.push(inner);
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    geo.center();
    return geo;
  }, []);
}

const RINGS = 7;

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const frameGeo = useFrameGeometry();
  const group = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Mesh[]>([]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.slate,
        metalness: 0.85,
        roughness: 0.22,
        emissive: tint,
        emissiveIntensity: 0.5,
      }),
    [tint],
  );

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    material.emissive.set(tint);
    rings.current.forEach((m, i) => {
      if (!m) return;
      // Alternating spin direction per frame is what makes the aperture read as a mechanism.
      m.rotation.z += d * (0.12 + i * 0.045) * (i % 2 ? -1 : 1);
      const breathe = 1 + Math.sin(t * 0.7 + i * 0.5) * 0.02;
      const k = 1 - i / RINGS;
      m.scale.setScalar((0.55 + k * 0.95) * breathe);
    });
    if (group.current) {
      // A slow yaw so the tunnel is never seen dead-on — that is what sells the depth.
      group.current.rotation.y = Math.sin(t * 0.22) * 0.2;
      group.current.rotation.x = Math.cos(t * 0.18) * 0.09;
    }
  });

  const entry = easeOutExpo(Math.min(progress * 3, 1));

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[3, 4, 7]} intensity={1.4} color={P.highlight} />
      <pointLight position={[0, 0, -3]} intensity={40} color={P.electric} distance={20} />
      <pointLight position={[-4, 2, 4]} intensity={18} color={tint} distance={16} />

      <group ref={group}>
        {Array.from({ length: RINGS }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => { if (m) rings.current[i] = m; }}
            geometry={frameGeo}
            material={material}
            position={[0, 0, -i * 0.72]}
            scale={2.4}
          />
        ))}

        {/* The projection membrane filling the aperture. */}
        <HoloSurface color={tint} lines={70} sweepSpeed={urgent ? 0.9 : 0.42} opacity={0.4} position={[0, 0, -1.4]}>
          <circleGeometry args={[2.1, 48]} />
        </HoloSurface>

        <FresnelShell color={tint} power={2.2} intensity={0.9} position={[0, 0, -1.4]}>
          <circleGeometry args={[2.35, 48]} />
        </FresnelShell>

        <group position={[0, 0, 0.55]} scale={0.9 + entry * 0.1}>
          <VolumetricNumber
            key={String(value)}
            value={value}
            size={2.15}
            depth={0.42}
            face={P.highlight}
            body={P.slate}
            edge={tint}
            intensity={urgent ? 1.2 : 0.88}
          />
        </group>
      </group>

      {/* Drawn through the gate, so they read as coming out of it. */}
      <Particles motion="stream" count={220} color={tint} spread={3.4} size={0.045} speed={urgent ? 2.2 : 1.2} />
      <Particles motion="drift" count={90} color={P.mist} spread={7} size={0.028} opacity={0.35} />
    </>
  );
}

export const Countdown02: Design = {
  id: "countdown-02",
  name: "Holographic Portal",
  nameAr: "بوابة هولوجرام",
  descriptionAr: "بوابة بسبع حلقات مثمّنة بتغور في العمق، والرقم معلّق في فتحتها.",
  Scene,
  camera: { position: [0, 0.3, 7.4], fov: 48 },
  effects: { bloom: 0.78, bloomThreshold: 0.5, chromatic: 0.0009, vignette: 0.55 },
  parallax: 0.55,
};
