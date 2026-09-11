import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FresnelShell } from "../shared/materials";
import { P, col } from "../shared/palette";
import { Particles } from "../shared/Particles";
import { Stage } from "../shared/Stage";

/**
 * The Musical Chairs arena, as real furniture on a lit stage.
 *
 * Chairs are modelled rather than implied: a bevelled seat, a raked backrest, four turned legs
 * and a numbered plate. The number matters — viewers claim a chair by typing its number in chat,
 * so it has to be readable from a phone watching a stream, which is why it sits on a bright plate
 * facing the camera rather than being painted onto the backrest at an angle.
 *
 * The two phases read differently on purpose:
 *   RUNNING  — the ring turns, a light sweeps around it, chairs are dim. Nothing is claimable yet.
 *   CHOOSING — the ring stops dead, every chair lifts slightly, and a claimed chair goes warm and
 *              drops back down. The stop is the beat the whole game turns on, so it is a hard
 *              halt rather than a decelerating one.
 */

/** Cached per-number so a round with twelve chairs builds twelve textures, not twelve per frame. */
const plateCache = new Map<string, THREE.CanvasTexture>();
function numberPlate(n: number): THREE.CanvasTexture {
  const key = String(n);
  const hit = plateCache.get(key);
  if (hit) return hit;

  const px = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${px * 0.68}px Cairo, "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(key, px / 2, px / 2 + px * 0.03);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  plateCache.set(key, tex);
  return tex;
}

/** A rounded, bevelled slab — the seat and the backrest are both built from this. */
function slab(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const iw = w - r * 2;
  const ih = h - r * 2;
  shape.moveTo(x, y - r + r);
  shape.absarc(x + iw, y, r, -Math.PI / 2, 0);
  shape.absarc(x + iw, y + ih, r, 0, Math.PI / 2);
  shape.absarc(x, y + ih, r, Math.PI / 2, Math.PI);
  shape.absarc(x, y, r, Math.PI, Math.PI * 1.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: d * 0.22,
    bevelSize: r * 0.4,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

interface ChairProps {
  number: number;
  taken: boolean;
  /** 0 → 1 as the chairs become claimable. A ref, not a prop value: it changes every frame, and
   *  pushing that through React state would re-render the whole ring sixty times a second. */
  ready: { current: number };
  frame: THREE.Material;
  cushion: THREE.Material;
  cushionTaken: THREE.Material;
  seatGeo: THREE.BufferGeometry;
  backGeo: THREE.BufferGeometry;
  legGeo: THREE.BufferGeometry;
}

function Chair({ number, taken, ready, frame, cushion, cushionTaken, seatGeo, backGeo, legGeo }: ChairProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const k = ready.current;
    // Every chair lifts when the music stops, and a claimed one settles back down — so a glance
    // at the ring tells you which seats are still free without reading a single number.
    const lift = taken ? 0 : k * 0.22;
    group.current.position.y = lift + Math.sin(t * 2 + number) * 0.015 * k;
  });

  const legs = useMemo(() => [
    [-0.28, -0.28], [0.28, -0.28], [-0.28, 0.26], [0.28, 0.26],
  ] as [number, number][], []);

  return (
    <group ref={group}>
      {/* seat */}
      <mesh geometry={seatGeo} material={taken ? cushionTaken : cushion} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.52, 0]} />
      {/* backrest, raked back a little the way a real chair is */}
      <mesh
        geometry={backGeo}
        material={taken ? cushionTaken : cushion}
        position={[0, 1.02, -0.32]}
        rotation={[-0.16, 0, 0]}
      />
      {legs.map(([x, z], i) => (
        <mesh key={i} geometry={legGeo} material={frame} position={[x, 0.26, z]} />
      ))}
    </group>
  );
}

/**
 * The chair's number, floating above it.
 *
 * A real billboard rather than a fixed tilt. It lives outside the chair's own group (chairs turn
 * to face outward, and a label inheriting that ends up edge-on for half the ring), and a single
 * hand-computed rake does not work either: the camera looks at the centre, so its angle to a
 * chair on the near side differs from one on the far side, and the labels come out foreshortened
 * by different amounts. Billboard re-aims every one at the camera each frame.
 *
 * This matters more here than anywhere else in the product, because the number *is* the input —
 * a viewer claims a seat by typing it into chat.
 */
function NumberMarker({ number, taken }: { number: number; taken: boolean }) {
  const plate = useMemo(() => numberPlate(number), [number]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: plate,
        transparent: true,
        toneMapped: false,
        depthWrite: false,
        depthTest: false,
      }),
    [plate],
  );
  const disc = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: col(taken ? P.ember : P.electric),
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
        depthWrite: false,
        depthTest: false,
      }),
    [taken],
  );
  useEffect(
    () => () => {
      mat.dispose();
      disc.dispose();
    },
    [mat, disc],
  );

  return (
    <Billboard position={[0, 1.55, 0]}>
      <mesh material={disc} renderOrder={3}>
        <circleGeometry args={[0.42, 32]} />
      </mesh>
      <mesh material={mat} position={[0, 0, 0.01]} renderOrder={4}>
        <planeGeometry args={[0.62, 0.62]} />
      </mesh>
    </Billboard>
  );
}

function Ring({
  chairCount,
  taken,
  spinning,
}: {
  chairCount: number;
  taken: Set<number>;
  spinning: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  // Eased here, in the render loop, and read by each chair from the same ref.
  const ready = useRef(0);

  // Radius grows with the count so twelve chairs don't overlap and three don't look lost.
  const radius = Math.max(2.2, chairCount * 0.42);

  const geos = useMemo(
    () => ({
      seat: slab(0.78, 0.74, 0.13, 0.12),
      back: slab(0.72, 0.76, 0.11, 0.14),
      leg: new THREE.CylinderGeometry(0.055, 0.045, 0.52, 10),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: P.slate, metalness: 0.9, roughness: 0.3 }),
      cushion: new THREE.MeshStandardMaterial({
        color: P.violet,
        emissive: P.electric,
        emissiveIntensity: 0.35,
        metalness: 0.3,
        roughness: 0.55,
      }),
      cushionTaken: new THREE.MeshStandardMaterial({
        color: "#8a5a1f",
        emissive: P.ember,
        emissiveIntensity: 1.1,
        metalness: 0.35,
        roughness: 0.4,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geos, mats],
  );

  useFrame((_, d) => {
    const target = spinning ? 0 : 1;
    ready.current += (target - ready.current) * Math.min(1, d * 6);
    if (!group.current) return;
    // Turns while the music plays, stops dead when it doesn't. The halt is the whole game.
    if (spinning) group.current.rotation.y += d * 0.42;
  });

  return (
    <group ref={group}>
      {Array.from({ length: chairCount }, (_, i) => {
        const angle = (i / chairCount) * Math.PI * 2;
        const number = i + 1;
        return (
          <group key={number} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
            {/* Only the chair turns to face outward; the label stays square to the camera. */}
            <NumberMarker number={number} taken={taken.has(number)} />
            <group rotation={[0, -angle + Math.PI / 2, 0]}>
            <Chair
              number={number}
              taken={taken.has(number)}
              ready={ready}
              frame={mats.frame}
              cushion={mats.cushion}
              cushionTaken={mats.cushionTaken}
              seatGeo={geos.seat}
              backGeo={geos.back}
              legGeo={geos.leg}
            />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** The stage floor, plus a light that sweeps around it while the music plays. */
function Floor({ radius, spinning }: { radius: number; spinning: boolean }) {
  const sweep = useRef<THREE.Mesh>(null);

  useFrame((state, d) => {
    if (!sweep.current) return;
    if (spinning) sweep.current.rotation.z -= d * 1.1;
    const mat = sweep.current.material as THREE.MeshBasicMaterial;
    mat.opacity = spinning ? 0.22 + Math.sin(state.clock.elapsedTime * 3) * 0.05 : 0.04;
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <mesh>
        <circleGeometry args={[radius + 1.6, 64]} />
        <meshStandardMaterial color={P.abyss} roughness={0.85} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[radius - 0.35, radius + 0.35, 72]} />
        <meshBasicMaterial color={col(P.electric)} transparent opacity={0.14} toneMapped={false} />
      </mesh>
      {/* A bright wedge chasing round the ring — the visual for "the music is playing". */}
      <mesh ref={sweep} position={[0, 0, 0.02]}>
        <ringGeometry args={[radius - 0.45, radius + 0.45, 48, 1, 0, Math.PI / 3]} />
        <meshBasicMaterial color={col(P.lavender)} transparent opacity={0.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

export interface ChairsArena3DProps {
  chairCount: number;
  /** Chair numbers already claimed this round. */
  takenNumbers: number[];
  /** True while the music is playing (phase RUNNING). */
  spinning: boolean;
  className?: string;
}

const FOV = 40;

export function ChairsArena3D({ chairCount, takenNumbers, spinning, className }: ChairsArena3DProps) {
  const taken = useMemo(() => new Set(takenNumbers), [takenNumbers]);
  const count = Math.max(1, chairCount);
  const radius = Math.max(2.2, count * 0.42);

  // Raked ~64° above the horizon: steep enough that the ring projects to nearly a circle, shallow
  // enough that the chairs still read as objects with a seat, a back and legs.
  // The margin is what separates the chairs from the avatar ring the game views draw on top of
  // this. At +1.6 the chairs filled the frame and the avatars sat right on top of them; +3.2 was
  // clear but shrank the chairs too far. This keeps both layers legible.
  const distance = (radius + 2.5) / Math.tan((FOV / 2) * (Math.PI / 180));
  const camY = distance * 0.9;
  const camZ = distance * 0.44;

  return (
    <div className={className}>
      <Stage
        // Distance is solved from the ring, not guessed: at fov 40 the visible half-height is
        // distance * tan(20°), so the camera has to sit far enough back that it clears the ring
        // radius plus a chair. Hard-coded multipliers cropped the outer chairs the moment the
        // player count grew.
        camera={{ position: [0, camY, camZ], fov: FOV }}
        // No post-processing, for the same reason the round timer has none: on a transparent
        // canvas the composer's pass leaves a faint darkened rectangle exactly where the canvas
        // sits, which is plainly visible against the page behind it.
        effects={{ bloom: 0, chromatic: 0, vignette: 0 }}
        parallax={0.35}
      >
        <ambientLight intensity={0.5} color={P.mist} />
        <directionalLight position={[5, 9, 6]} intensity={2.1} color={P.highlight} />
        <pointLight position={[0, 5, 0]} intensity={45} color={P.electric} distance={26} />
        <pointLight position={[-6, 3, 5]} intensity={22} color={P.lavender} distance={22} />

        <Floor radius={radius} spinning={spinning} />
        <Ring chairCount={count} taken={taken} spinning={spinning} />

        <FresnelShell color={P.electric} power={3.4} intensity={0.4} position={[0, 1, 0]}>
          <sphereGeometry args={[radius + 2.6, 28, 20]} />
        </FresnelShell>

        <Particles motion="drift" count={110} color={P.mist} spread={radius + 4} size={0.03} opacity={0.3} />
      </Stage>
    </div>
  );
}
