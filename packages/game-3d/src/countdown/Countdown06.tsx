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
 * 06 — ENERGY TUNNEL
 *
 * Hyperspace. The only design where the camera itself is doing the work: everything rushes past
 * it and the number holds dead centre, which is what communicates speed rather than motion.
 *
 * Built from three layers that move at different rates — ribs, light streaks, dust. Parallax
 * between them is the whole effect; a single layer at any speed just reads as a moving texture.
 */

const RIBS = 26;

/** The tunnel wall: square ribs receding, so the throat reads as constructed, not as a pipe. */
function Ribs({ tint, speed }: { tint: string; speed: number }) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);

  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    const r = 1;
    // A rounded square section — cheap, and its corners catch light as it spins.
    shape.moveTo(-r, -r * 0.72);
    shape.lineTo(r, -r * 0.72);
    shape.lineTo(r, r * 0.72);
    shape.lineTo(-r, r * 0.72);
    shape.closePath();
    const hole = new THREE.Path();
    const h = 0.9;
    hole.moveTo(-h, -h * 0.72);
    hole.lineTo(h, -h * 0.72);
    hole.lineTo(h, h * 0.72);
    hole.lineTo(-h, h * 0.72);
    hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    g.center();
    return g;
  }, []);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    [tint],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d * speed;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      // Recycle through a 30-unit run so the tunnel never ends.
      const z = ((t.current * 6 + i * 1.15) % 30) - 27;
      m.position.z = z;
      const near = THREE.MathUtils.clamp(1 + z / 12, 0, 1);
      m.scale.setScalar(2.6 + (1 - near) * 1.6);
      m.rotation.z = z * 0.035 + t.current * 0.1;
      // Fades up out of the far dark and back down as it sweeps past the camera, so ribs never
      // pop into or out of existence at the ends of the recycle run. Each rib owns a cloned
      // material precisely so it can hold its own opacity.
      const fade =
        THREE.MathUtils.smoothstep(z, -27, -16) * (1 - THREE.MathUtils.smoothstep(z, 0, 3));
      (m.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
      (m.material as THREE.MeshBasicMaterial).color.set(tint);
      m.visible = fade > 0.02;
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: RIBS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { if (m) meshes.current[i] = m; }}
          geometry={geo}
          material={material.clone()}
        />
      ))}
    </group>
  );
}

/** Light streaks — long thin quads stretched along Z, the classic speed cue done with real depth. */
function Streaks({ tint, speed }: { tint: string; speed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const N = 54;

  const bits = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 1.6 + Math.random() * 2.6;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75, off: Math.random(), len: 1.4 + Math.random() * 3.4, w: 0.012 + Math.random() * 0.03 };
      }),
    [],
  );

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.75, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
    [tint],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d * speed;
    material.color.set(tint);
    if (!mesh.current) return;
    bits.forEach((b, i) => {
      const z = ((t.current * 11 + b.off * 34) % 34) - 30;
      dummy.position.set(b.x, b.y, z);
      dummy.scale.set(b.w, b.w, b.len);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, material, N]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const speed = urgent ? 2.1 : 1;
  const hub = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!hub.current) return;
    // Only the number is still. A slight counter-drift keeps it from feeling pasted on.
    hub.current.position.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    hub.current.scale.setScalar(1 + pulse(progress, 8) * 0.13);
  });

  return (
    <>
      <ambientLight intensity={0.35} color={P.mist} />
      <pointLight position={[0, 0, 3]} intensity={26} color={tint} distance={12} />
      <pointLight position={[0, 0, -8]} intensity={40} color={P.electric} distance={26} />
      <directionalLight position={[2, 3, 6]} intensity={1.1} color={P.highlight} />

      <Ribs tint={tint} speed={speed} />
      <Streaks tint={tint} speed={speed} />

      <group ref={hub} position={[0, 0, 1.2]}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.4}
          depth={0.55}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.35 : 1.0}
        />
        <FresnelShell color={tint} power={2.6} intensity={0.8}>
          <sphereGeometry args={[1.85, 26, 18]} />
        </FresnelShell>
      </group>

      <Particles motion="stream" count={320} color={P.mist} spread={4.2} size={0.035} speed={speed * 2.2} opacity={0.65} />
    </>
  );
}

export const Countdown06: Design = {
  id: "countdown-06",
  name: "Energy Tunnel",
  nameAr: "نفق الطاقة",
  descriptionAr: "اندفاع في نفق — أضلاع وخطوط ضوء بتعدّي جنب الكاميرا، والرقم ثابت في القلب.",
  Scene,
  camera: { position: [0, 0, 6.5], fov: 62 },
  effects: { bloom: 0.9, bloomThreshold: 0.46, chromatic: 0.0012, vignette: 0.6 },
  parallax: 0.25,
};
