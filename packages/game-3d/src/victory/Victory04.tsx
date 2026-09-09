import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell, HoloSurface } from "../shared/materials";
import { P } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { easeOutBack, easeOutExpo } from "../shared/easing";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { Design, SceneProps } from "../shared/types";

/**
 * WIN 04 — ASCENSION
 *
 * Everything in this scene moves up. A stepped tower of rings lifts the number out of the dark
 * while fragments, particles and light trails all travel in the same direction — the one design
 * where a single unambiguous vector carries the whole meaning.
 *
 * The tower is built from plates of *decreasing* radius going up, so the silhouette tapers and
 * the eye is led to the number at the apex rather than to the mass at the base.
 */

const PLATES = 9;

/** The tower: chamfered plates rising and rotating, each offset from the one below. */
function Tower({ lift }: { lift: number }) {
  const group = useRef<THREE.Group>(null);
  const plates = useRef<THREE.Mesh[]>([]);

  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    // A rounded triangle — directional, so the stack reads as pointing upward.
    const r = 1;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    g.center();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.92, roughness: 0.2, emissive: P.electric, emissiveIntensity: 0.4 }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    plates.current.forEach((m, i) => {
      if (!m) return;
      const k = i / (PLATES - 1);
      // Staggered arrival: the base settles first and the apex last.
      const local = easeOutExpo(THREE.MathUtils.clamp((lift - k * 0.35) / 0.65, 0, 1));
      m.position.y = -2.2 + k * 3.1 - (1 - local) * 2.4;
      m.scale.setScalar((1.5 - k * 1.02) * local);
      m.rotation.y = t * (0.12 + k * 0.16) + k * 1.2;
      // Arrival is carried by scale alone: the plates share one opaque material, so writing
      // opacity here did nothing except touch the same object nine times a frame.
    });
    if (group.current) group.current.rotation.y = Math.sin(t * 0.2) * 0.12;
  });

  return (
    <group ref={group}>
      {Array.from({ length: PLATES }, (_, i) => (
        <mesh key={i} ref={(m) => { if (m) plates.current[i] = m; }} geometry={geo} material={material} />
      ))}
    </group>
  );
}

/** Vertical light trails climbing past the tower. */
function Trails() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const N = 40;

  const bits = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 1.6 + Math.random() * 2.4;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, off: Math.random(), len: 0.7 + Math.random() * 1.9, w: 0.011 + Math.random() * 0.02, rate: 0.5 + Math.random() };
      }),
    [],
  );

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: P.lavender, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    if (!mesh.current) return;
    bits.forEach((b, i) => {
      const y = ((t.current * b.rate * 1.3 + b.off * 8) % 8) - 3.4;
      dummy.position.set(b.x, y, b.z);
      dummy.scale.set(b.w, b.len, b.w);
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

function Scene({ value, progress }: SceneProps) {
  const lift = Math.min(progress * 1.7, 1);
  const reveal = easeOutBack(THREE.MathUtils.clamp((progress - 0.4) / 0.4, 0, 1), 1.5);
  const crest = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (crest.current) crest.current.position.y = 1.35 + Math.sin(state.clock.elapsedTime * 0.9) * 0.06;
  });

  return (
    <>
      <ambientLight intensity={0.38} color={P.mist} />
      <directionalLight position={[4, 8, 5]} intensity={2.1} color={P.highlight} />
      <pointLight position={[0, 2.2, 2]} intensity={26} color={P.ember} distance={14} />
      <pointLight position={[-5, -3, 2]} intensity={28} color={P.electric} distance={20} />

      {/* The floor the tower rises out of — gives the ascent something to leave. */}
      <HoloSurface color={P.electric} lines={30} sweepSpeed={0.25} opacity={0.3} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
        <circleGeometry args={[4.2, 48]} />
      </HoloSurface>

      <Tower lift={lift} />
      <Trails />

      <group ref={crest} scale={reveal}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={1.9}
          depth={0.42}
          face={P.highlight}
          body={P.violet}
          edge={P.ember}
          intensity={1.25}
        />
        <FresnelShell color={P.ember} power={2.5} intensity={0.9}>
          <sphereGeometry args={[1.5, 28, 20]} />
        </FresnelShell>
      </group>

      <Particles motion="updraft" count={280} color={P.lavender} spread={5} size={0.042} speed={1.4} />
      <Particles motion="updraft" count={90} color={P.ember} spread={3} size={0.055} speed={2} opacity={0.8} />
    </>
  );
}

export const Victory04: Design = {
  id: "victory-04",
  name: "Ascension",
  nameAr: "الصعود",
  descriptionAr: "برج من صفايح بيترص لفوق وبيرفع الرقم معاه، وكل حاجة في المشهد طالعة.",
  Scene,
  camera: { position: [0, 0.8, 8.4], fov: 46 },
  effects: { bloom: 0.84, bloomThreshold: 0.5, chromatic: 0.0006, vignette: 0.52 },
  parallax: 0.45,
};
