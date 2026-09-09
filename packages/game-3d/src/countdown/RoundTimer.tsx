import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { pulse } from "../shared/easing";
import { P, col, urgencyColor } from "../shared/palette";
import { VolumetricNumber } from "../shared/VolumetricNumber";
import type { SceneProps } from "../shared/types";

/**
 * The timer inside a live round — deliberately the plainest thing in the whole 3D system.
 *
 * It is not one of the nine pre-roll designs and is not selectable. Those play for three seconds
 * with the screen to themselves; this one sits in the corner of a question for the entire round,
 * next to the thing the viewer is actually trying to read. Anything with debris, orbits or a
 * tunnel competes with the question, and after twenty seconds it grates.
 *
 * So: a depleting arc, the number, one soft glow. No particles, no shells, no extra passes. It is
 * also by far the cheapest scene here, which matters because it is the only one that renders
 * continuously rather than in a burst.
 */

const SEGMENTS = 44;

function Arc({ remaining, tint }: { remaining: number; tint: string }) {
  const group = useRef<THREE.Group>(null);
  const blocks = useRef<THREE.Mesh[]>([]);

  const geo = useMemo(() => new THREE.BoxGeometry(0.07, 0.26, 0.07), []);
  const lit = useMemo(
    () => new THREE.MeshBasicMaterial({ color: col(tint).clone(), toneMapped: false }),
    [tint],
  );
  const dim = useMemo(
    () => new THREE.MeshBasicMaterial({ color: col(P.slate).clone(), toneMapped: false }),
    [],
  );

  useFrame((_, d) => {
    lit.color.set(tint);
    if (group.current) group.current.rotation.z -= d * 0.12;
    const litCount = Math.round(SEGMENTS * THREE.MathUtils.clamp(remaining, 0, 1));
    blocks.current.forEach((m, i) => {
      if (!m) return;
      m.material = i < litCount ? lit : dim;
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        // Starts at the top and depletes clockwise, the direction a clock actually runs.
        const a = Math.PI / 2 - (i / SEGMENTS) * Math.PI * 2;
        return (
          <mesh
            key={i}
            ref={(m) => { if (m) blocks.current[i] = m; }}
            geometry={geo}
            material={dim}
            position={[Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0]}
            rotation={[0, 0, a - Math.PI / 2]}
          />
        );
      })}
    </group>
  );
}

/**
 * `progress` here is fraction elapsed through the current second, and `remainingFraction` is how
 * much of the whole phase is left — the arc needs the second of those, the number-pop the first.
 */
export function RoundTimerScene({
  value,
  progress,
  urgent,
  remainingFraction = 1,
}: SceneProps & { remainingFraction?: number }) {
  const tint = urgent ? urgencyColor(1) : P.lavender;
  const hub = useRef<THREE.Group>(null);

  useFrame(() => {
    if (hub.current) hub.current.scale.setScalar(1 + pulse(progress, 9) * 0.09);
  });

  return (
    <>
      <ambientLight intensity={0.7} color={P.mist} />
      <directionalLight position={[2, 4, 6]} intensity={1.6} color={P.highlight} />
      <pointLight position={[0, 0, 3]} intensity={14} color={tint} distance={10} />

      <Arc remaining={remainingFraction} tint={tint} />

      <group ref={hub}>
        <VolumetricNumber
          key={String(value)}
          value={value}
          size={2.05}
          depth={0.3}
          face={P.highlight}
          body={P.violet}
          edge={tint}
          intensity={urgent ? 1.1 : 0.8}
          outline={false}
        />
      </group>

      {/* One flat disc behind the number. Cheaper than a shell and enough to lift it off the art. */}
      <mesh position={[0, 0, -1]}>
        <circleGeometry args={[1.75, 40]} />
        <meshBasicMaterial color={col(tint)} transparent opacity={0.07} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  );
}
