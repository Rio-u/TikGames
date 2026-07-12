import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, Octahedron } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Group } from "three";

function Shapes() {
  const group = useRef<Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();
    g.rotation.y = t * 0.15;
    g.rotation.x = Math.sin(t * 0.3) * 0.15;
  });

  return (
    <group ref={group}>
      <Float speed={1.6} rotationIntensity={1.3} floatIntensity={1.6}>
        <Icosahedron args={[1.1, 0]}>
          <meshStandardMaterial
            color="#A855F7"
            emissive="#7C3AED"
            emissiveIntensity={0.45}
            flatShading
            roughness={0.25}
            metalness={0.55}
          />
        </Icosahedron>
      </Float>

      <Float speed={2.1} rotationIntensity={1.6} floatIntensity={2} position={[-1.7, -0.6, -0.8]}>
        <Octahedron args={[0.4, 0]}>
          <meshStandardMaterial
            color="#C084FC"
            emissive="#C084FC"
            emissiveIntensity={0.6}
            flatShading
            roughness={0.2}
            metalness={0.6}
          />
        </Octahedron>
      </Float>

      <Float speed={1.9} rotationIntensity={1.2} floatIntensity={1.8} position={[1.8, 0.85, -0.6]}>
        <Icosahedron args={[0.3, 0]}>
          <meshStandardMaterial
            color="#7C3AED"
            emissive="#A855F7"
            emissiveIntensity={0.5}
            flatShading
            roughness={0.3}
            metalness={0.5}
          />
        </Icosahedron>
      </Float>
    </group>
  );
}

export function GamesScene({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 4]} color="#C084FC" intensity={3.5} />
        <pointLight position={[-3, -2, -3]} color="#7C3AED" intensity={2.5} />
        <Suspense fallback={null}>
          <Shapes />
        </Suspense>
      </Canvas>
    </div>
  );
}
