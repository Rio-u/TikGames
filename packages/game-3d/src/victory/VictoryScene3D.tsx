import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easeOutExpo } from "../shared/easing";
import { FresnelShell } from "../shared/materials";
import { P, col } from "../shared/palette";

/**
 * The 3D half of the winner moment: the light, the blasts and the ring the portrait sits inside.
 *
 * The winner's photo and name are *not* in here. They are DOM on top — a real `<img>` and real
 * text, which stay sharp at any size, keep working when the avatar host refuses cross-origin
 * reads (TikTok's CDN often does, and a tainted texture would black out the whole scene), and
 * keep the Arabic name correctly shaped and bidi-wrapped. This layer's job is to make the space
 * around them feel like an event.
 *
 * Everything is driven by one `progress` 0 → 1 so the beats land in a fixed order:
 * flash, shockwaves, ring forms, debris flies, embers fall.
 */

/** Three expanding rings fired at staggered times — one blast reads as an accident, three as an event. */
function Shockwaves({ p }: { p: number }) {
  const meshes = useRef<THREE.Mesh[]>([]);
  const waves = useMemo(
    () => [
      { delay: 0.0, color: P.highlight, max: 13 },
      { delay: 0.1, color: P.ember, max: 17 },
      { delay: 0.22, color: P.lavender, max: 22 },
    ],
    [],
  );

  const materials = useMemo(
    () =>
      waves.map(
        (w) =>
          new THREE.MeshBasicMaterial({
            color: col(w.color).clone(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [waves],
  );

  useFrame(() => {
    waves.forEach((w, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const k = easeOutExpo(THREE.MathUtils.clamp((p - w.delay) / 0.42, 0, 1));
      m.scale.setScalar(0.4 + k * w.max);
      // Fades as it expands: a ring that stays bright while growing reads as a solid disc.
      materials[i]!.opacity = Math.max(0, (1 - k) * 0.9);
    });
  });

  return (
    <group position={[0, 0, -2]}>
      {waves.map((_, i) => (
        <mesh key={i} ref={(m) => { if (m) meshes.current[i] = m; }} material={materials[i]}>
          <ringGeometry args={[0.92, 1, 96]} />
        </mesh>
      ))}
    </group>
  );
}

/** Light rays sweeping out behind the portrait. */
function Rays({ p }: { p: number }) {
  const group = useRef<THREE.Group>(null);
  const N = 22;

  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.07);
    s.lineTo(6, -0.015);
    s.lineTo(6, 0.015);
    s.lineTo(0, 0.07);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);

  const material = useMemo(
    () =>
      // Violet, not amber. The warm accent belongs to the blast and the ring; letting it take
      // the rays as well floods the whole frame orange and loses the brand identity.
      new THREE.MeshBasicMaterial({
        color: col(P.lavender).clone(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useFrame((state, d) => {
    const k = easeOutExpo(THREE.MathUtils.clamp((p - 0.08) / 0.5, 0, 1));
    // Bright on arrival, then settles to a low ambient shimmer rather than switching off.
    material.opacity = 0.03 + Math.sin(Math.min(k, 1) * Math.PI) * 0.16;
    if (!group.current) return;
    group.current.rotation.z += d * 0.06;
    group.current.children.forEach((c, i) => {
      c.scale.x = 0.1 + k * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.66 : 0.42);
    });
  });

  return (
    <group ref={group} position={[0, 0, -4]}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} geometry={geo} material={material} rotation={[0, 0, (i / N) * Math.PI * 2]} />
      ))}
    </group>
  );
}

/**
 * The ring the portrait sits inside. Built from segmented blocks rather than a torus so it reads
 * as a machined frame, and it assembles segment by segment as the moment lands.
 */
/**
 * `yOffset` lifts the ring onto the portrait rather than the middle of the screen. The DOM column
 * centres the photo *and* the name together, which puts the photo above the viewport centre — a
 * ring at the origin cuts straight through the winner's name.
 */
function PortraitRing({ p, yOffset }: { p: number; yOffset: number }) {
  const group = useRef<THREE.Group>(null);
  const blocks = useRef<THREE.Mesh[]>([]);
  const N = 40;

  const geo = useMemo(() => new THREE.BoxGeometry(0.09, 0.3, 0.09), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.violet,
        emissive: P.ember,
        emissiveIntensity: 1.4,
        metalness: 0.8,
        roughness: 0.2,
      }),
    [],
  );

  useFrame((state, d) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.z += d * 0.16;
    blocks.current.forEach((m, i) => {
      if (!m) return;
      // Segments arrive in sequence around the circle, each with its own small overshoot.
      const local = easeOutExpo(THREE.MathUtils.clamp((p - 0.18 - (i / N) * 0.22) / 0.35, 0, 1));
      const a = (i / N) * Math.PI * 2;
      // Sized to frame the photo, not the screen.
      const r = 1.62 + Math.sin(t * 2 + i * 0.5) * 0.025;
      m.position.set(Math.cos(a) * r, Math.sin(a) * r + yOffset, 0);
      m.rotation.z = a;
      m.scale.setScalar(local);
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { if (m) blocks.current[i] = m; }} geometry={geo} material={material} />
      ))}
    </group>
  );
}

/** Chunky debris thrown out by the blast, tumbling and slowing under drag. */
function Debris({ p }: { p: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const N = 90;

  const bits = useMemo(
    () =>
      Array.from({ length: N }, () => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 3 + Math.random() * 7;
        return {
          dir: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed * 0.4,
          ),
          spin: new THREE.Vector3(Math.random() * 7, Math.random() * 7, Math.random() * 7),
          size: 0.05 + Math.random() * 0.12,
        };
      }),
    [],
  );

  const geo = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: P.slate,
        emissive: P.ember,
        emissiveIntensity: 0.9,
        metalness: 0.7,
        roughness: 0.3,
        flatShading: true,
      }),
    [],
  );

  useFrame(() => {
    if (!mesh.current) return;
    const k = easeOutExpo(THREE.MathUtils.clamp(p / 0.85, 0, 1));
    bits.forEach((b, i) => {
      dummy.position.copy(b.dir).multiplyScalar(k);
      // Gravity on the tail so the debris arcs down instead of drifting forever.
      dummy.position.y -= k * k * 2.6;
      dummy.rotation.set(b.spin.x * k, b.spin.y * k, b.spin.z * k);
      dummy.scale.setScalar(b.size * (1 - k * 0.45));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, material, N]} />;
}

/** Embers drifting up long after the blast — what keeps the frame alive once everything settles. */
function Embers() {
  const N = 260;
  const points = useRef<THREE.Points>(null);

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seeds[i * 3] = (Math.random() - 0.5) * 22;
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = 0.3 + Math.random() * 1.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: g, seeds };
  }, []);

  const sprite = useMemo(() => {
    const px = 64;
    const c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.4, "rgba(255,255,255,0.5)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, px, px);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.11,
        map: sprite,
        color: col(P.ember).clone(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [sprite],
  );

  const t = useRef(0);
  useFrame((_, d) => {
    t.current += d;
    const arr = geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const x = seeds[i * 3]!;
      const off = seeds[i * 3 + 1]!;
      const rate = seeds[i * 3 + 2]!;
      const k = (t.current * 0.06 * rate + off) % 1;
      arr[i * 3] = x + Math.sin(t.current * 0.5 * rate + i) * 0.7;
      arr[i * 3 + 1] = -9 + k * 20;
      arr[i * 3 + 2] = -6 + ((i * 37) % 100) / 12;
    }
    geometry.attributes.position!.needsUpdate = true;
    if (points.current) points.current.rotation.z = Math.sin(t.current * 0.08) * 0.03;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

export function VictoryScene3D({ progress }: { progress: number }) {
  const flash = useRef<THREE.PointLight>(null);
  const key = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // A hard blow-out on the first frames, decaying fast — the impact of the reveal.
    if (flash.current) flash.current.intensity = 20 + Math.max(0, 1 - progress * 5) * 420;
    // The key light breathes once things settle, so the portrait never sits under flat light.
    if (key.current) key.current.intensity = 30 + Math.sin(t * 1.2) * 8;
  });

  return (
    <>
      <ambientLight intensity={0.4} color={P.mist} />
      <directionalLight position={[4, 6, 8]} intensity={1.5} color={P.highlight} />
      <pointLight ref={flash} position={[0, 0, 3]} intensity={20} color={P.ember} distance={40} />
      <pointLight ref={key} position={[-6, 2, 5]} intensity={30} color={P.electric} distance={30} />
      <pointLight position={[6, -3, 4]} intensity={22} color={P.lavender} distance={26} />

      <Rays p={progress} />
      <Shockwaves p={progress} />
      <Debris p={progress} />
      <Embers />
      <PortraitRing p={progress} yOffset={1.5} />

      {/* A soft envelope behind the portrait so it never floats on flat black. */}
      <FresnelShell color={P.electric} power={3.8} intensity={0.5} position={[0, 0.6, -1]}>
        <sphereGeometry args={[3.1, 32, 24]} />
      </FresnelShell>
    </>
  );
}
