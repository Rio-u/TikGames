import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { BRAND, Confetti3D, Float, NeonRing, PopIn, Sparkles, Stage, ToonMaterial } from "./brandKit";

/**
 * The 3D half of the winner moment: a chunky cartoon trophy that drops in, bounces, and keeps
 * turning inside a confetti burst, on a transparent canvas so the winner's avatar and name can be
 * laid over it as normal DOM (crisp text and a real <img>, which a WebGL texture would only make
 * blurrier and harder to keep RTL-correct).
 */

/** Built from primitives rather than a loaded model — no asset to ship, no loader to await. */
function Trophy() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = Math.sin(t * 0.8) * 0.45;
    // A settling bounce: big at first, decayed to a gentle bob within a couple of seconds.
    group.current.position.y = Math.abs(Math.sin(t * 2.4)) * Math.max(0.08, Math.exp(-t * 0.9) * 0.5);
  });

  return (
    // Lifted into the upper half of the scene: the winner card is laid over the lower half,
    // and at y=0 the card cropped the trophy's base off.
    <group ref={group} position={[0, 1.35, 0]} scale={1.15}>
      {/* cup */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.72, 0.42, 1.05, 24]} />
        <ToonMaterial color={BRAND.gold} emissive="#b45309" emissiveIntensity={0.45} roughness={0.2} />
      </mesh>
      {/* rim */}
      <mesh position={[0, 1.29, 0]}>
        <torusGeometry args={[0.72, 0.09, 10, 28]} />
        <ToonMaterial color="#fde68a" emissive={BRAND.gold} emissiveIntensity={0.8} roughness={0.15} />
      </mesh>
      {/* handles */}
      {[-1, 1].map((side) => (
        // Negated: a half-torus spans the *upper* half, so +90° about Z bulges it toward -x.
        // With the old sign both handles arced inward and met over the cup as a basket handle.
        <mesh key={side} position={[side * 0.78, 0.85, 0]} rotation={[0, 0, (-side * Math.PI) / 2]}>
          <torusGeometry args={[0.26, 0.06, 8, 20, Math.PI]} />
          <ToonMaterial color={BRAND.gold} emissive="#b45309" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* stem + base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.45, 16]} />
        <ToonMaterial color={BRAND.gold} emissive="#b45309" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.52, 0.6, 0.24, 24]} />
        <ToonMaterial color={BRAND.primary} emissive={BRAND.deep} emissiveIntensity={0.6} />
      </mesh>
      {/* a star popping off the cup face, so the trophy reads as cartoon rather than a real cup */}
      <mesh position={[0, 0.8, 0.66]} rotation={[0, 0, Math.PI / 10]}>
        <circleGeometry args={[0.3, 5]} />
        <meshBasicMaterial color="#fff7cd" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WinnerScene({ celebrate = true }: { celebrate?: boolean }) {
  return (
    <Stage camera={7.2}>
      <PopIn from={0.05}>
        <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.4}>
          <Trophy />
        </Float>
      </PopIn>
      {/* Sat at the origin these cut straight across the cup. Dropped to the trophy's foot
          they read as the lit podium it is standing on instead. */}
      <group position={[0, 0.55, 0]}>
        <NeonRing radius={2.5} thickness={0.05} color={BRAND.accent} speed={0.45} tilt={1.35} />
        <NeonRing radius={2.9} thickness={0.03} color={BRAND.primary} speed={-0.3} tilt={1.35} />
      </group>
      <Sparkles count={40} scale={8} size={5} speed={0.35} color={BRAND.gold} />
      {celebrate && <Confetti3D count={80} spread={8} />}
    </Stage>
  );
}
