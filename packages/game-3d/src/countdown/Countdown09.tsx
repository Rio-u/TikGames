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
 * 09 — QUANTUM GEOMETRY
 *
 * A lattice that morphs. The structure is generated, not modelled: vertices are placed on a
 * Fibonacci sphere and every pair inside a distance threshold is joined, which produces an
 * irregular truss no primitive can imitate.
 *
 * The vertices then breathe along a noise field, so edges lengthen and shorten and the whole
 * shell reorganises continuously without ever resampling the topology — the geometry is built
 * once and only its position buffer is touched per frame.
 */

const NODES = 46;
const LINK_DISTANCE = 1.05;

/** Fibonacci sphere: the only cheap way to place N points on a sphere with even spacing. */
function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return pts;
}

function Lattice({ tint, energy }: { tint: string; energy: number }) {
  const group = useRef<THREE.Group>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const nodesMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { base, pairs, geometry } = useMemo(() => {
    const base = fibonacciSphere(NODES, 1.9);
    const pairs: [number, number][] = [];
    for (let i = 0; i < base.length; i++) {
      for (let j = i + 1; j < base.length; j++) {
        if (base[i]!.distanceTo(base[j]!) < LINK_DISTANCE) pairs.push([i, j]);
      }
    }
    const positions = new Float32Array(pairs.length * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { base, pairs, geometry: g };
  }, []);

  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [tint],
  );
  const nodeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: P.violet, emissive: tint, emissiveIntensity: 1.4, metalness: 0.7, roughness: 0.2, flatShading: true }),
    [tint],
  );

  const live = useMemo(() => base.map((v) => v.clone()), [base]);
  const t = useRef(0);

  useFrame((_, d) => {
    t.current += d;
    const time = t.current;
    lineMaterial.color.set(tint);
    nodeMaterial.emissive.set(tint);

    // Breathe each vertex along its own normal — the shell deforms without changing topology.
    for (let i = 0; i < base.length; i++) {
      const b = base[i]!;
      const wob =
        1 +
        Math.sin(time * 0.9 + b.x * 2.1 + b.y * 1.3) * 0.11 * (1 + energy) +
        Math.cos(time * 0.6 + b.z * 2.6) * 0.07;
      live[i]!.copy(b).multiplyScalar(wob);
    }

    const arr = geometry.attributes.position!.array as Float32Array;
    for (let k = 0; k < pairs.length; k++) {
      const [i, j] = pairs[k]!;
      const a = live[i]!;
      const b = live[j]!;
      arr[k * 6] = a.x; arr[k * 6 + 1] = a.y; arr[k * 6 + 2] = a.z;
      arr[k * 6 + 3] = b.x; arr[k * 6 + 4] = b.y; arr[k * 6 + 5] = b.z;
    }
    geometry.attributes.position!.needsUpdate = true;

    if (nodesMesh.current) {
      for (let i = 0; i < live.length; i++) {
        dummy.position.copy(live[i]!);
        dummy.rotation.set(time * 0.4 + i, time * 0.3, 0);
        dummy.scale.setScalar(0.055 + Math.sin(time * 2 + i) * 0.012);
        dummy.updateMatrix();
        nodesMesh.current.setMatrixAt(i, dummy.matrix);
      }
      nodesMesh.current.instanceMatrix.needsUpdate = true;
    }

    if (group.current) {
      group.current.rotation.y += d * 0.14;
      group.current.rotation.x = Math.sin(time * 0.25) * 0.16;
    }
    if (lines.current) lines.current.rotation.copy(group.current!.rotation);
  });

  return (
    <group>
      <group ref={group}>
        <instancedMesh ref={nodesMesh} args={[undefined, nodeMaterial, NODES]}>
          <octahedronGeometry args={[1, 0]} />
        </instancedMesh>
      </group>
      <lineSegments ref={lines} geometry={geometry} material={lineMaterial} />
    </group>
  );
}

function Scene({ value, progress, urgent }: SceneProps) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const hub = useRef<THREE.Group>(null);

  useFrame(() => {
    if (hub.current) hub.current.scale.setScalar(1 + pulse(progress, 7) * 0.11);
  });

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[4, 5, 6]} intensity={1.6} color={P.highlight} />
      <pointLight position={[0, 0, 0]} intensity={20} color={tint} distance={10} />
      <pointLight position={[-5, -3, 3]} intensity={28} color={P.electric} distance={20} />

      <Lattice tint={tint} energy={urgent ? 1.2 : 0} />

      <group ref={hub}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={1.85}
          depth={0.38}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.35 : 1.0}
        />
      </group>

      <FresnelShell color={tint} power={3} intensity={0.85} speed={0.6}>
        <icosahedronGeometry args={[2.5, 2]} />
      </FresnelShell>

      <Particles motion="drift" count={200} color={P.mist} spread={6.5} size={0.028} opacity={0.45} />
    </>
  );
}

export const Countdown09: Design = {
  id: "countdown-09",
  name: "Quantum Geometry",
  nameAr: "الهندسة الكمّية",
  descriptionAr: "شبكة مولّدة برمجياً بتتنفّس وتعيد ترتيب نفسها، والرقم معلّق في قلبها.",
  Scene,
  camera: { position: [0, 0, 7.4], fov: 45 },
  effects: { bloom: 0.78, bloomThreshold: 0.51, chromatic: 0.0007, vignette: 0.48 },
  parallax: 0.5,
};
