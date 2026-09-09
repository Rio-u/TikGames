import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { P } from "./palette";

/**
 * The rig every design renders inside: one canvas, one composer, one parallax rule.
 *
 * Designs bring their own lights and geometry; the stage owns only what has to be identical
 * across all eighteen — colour management, the post chain, and the constraints that keep this
 * affordable to run next to a live encode.
 */

export interface StageEffects {
  /** Bloom intensity. 0 disables the pass entirely rather than running it at zero. */
  bloom?: number;
  bloomThreshold?: number;
  /** Chromatic aberration offset. Keep at or under ~0.0012 or it reads as a broken display. */
  chromatic?: number;
  vignette?: number;
}

export interface StageProps {
  children: ReactNode;
  camera?: { position?: [number, number, number]; fov?: number };
  effects?: StageEffects;
  /** How far the camera leans toward the pointer. 0 disables it. */
  parallax?: number;
  className?: string;
  /** Paused stages stop their render loop completely — see `frameloop`. */
  active?: boolean;
  /** Lets a card show a fallback when the machine has no WebGL at all. */
  onUnsupported?: () => void;
}

const DEFAULT_EFFECTS: Required<StageEffects> = {
  // Threshold well above mid-grey on purpose: only genuinely hot pixels — emissive faces, rim
  // highlights, particle cores — should bloom. Low thresholds pull the whole frame into the
  // glow and everything resolves to the same white blur.
  bloom: 0.85,
  bloomThreshold: 0.5,
  chromatic: 0.0006,
  vignette: 0.42,
};

/**
 * Camera parallax. Deliberately a *lean*, not a rotation: the camera translates a little and
 * keeps looking at the origin, so the composition never swings around when the pointer moves.
 * Damped toward the target so a fast flick glides instead of snapping.
 */
function CursorParallax({ amount }: { amount: number }) {
  const { camera } = useThree();
  const home = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector2());
  const current = useRef(new THREE.Vector2());

  useEffect(() => {
    home.current.copy(camera.position);
    const onMove = (e: PointerEvent) => {
      target.current.set(
        (e.clientX / window.innerWidth - 0.5) * 2,
        (e.clientY / window.innerHeight - 0.5) * 2,
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [camera]);

  useFrame((_, delta) => {
    const k = 1 - Math.pow(0.0015, delta);
    current.current.lerp(target.current, k);
    camera.position.set(
      home.current.x + current.current.x * amount,
      home.current.y - current.current.y * amount,
      home.current.z,
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Applied inside the Canvas so it can reach the renderer. */
function ColorPipeline() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // ACES keeps the emissive cores from clipping to flat white once bloom is stacked on top —
    // without it every hot pixel in these scenes reads as the same blown-out disc.
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.15;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

export function Stage({
  children,
  camera,
  effects,
  parallax = 0.35,
  className,
  active = true,
  onUnsupported,
}: StageProps) {
  const fx = { ...DEFAULT_EFFECTS, ...effects };

  const supported = useMemo(() => {
    if (typeof document === "undefined") return true;
    try {
      const probe = document.createElement("canvas");
      return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!supported) onUnsupported?.();
  }, [supported, onUnsupported]);

  // Declared before the early return below: hooks must run in the same order every render, and
  // a machine without WebGL still renders this component (it just returns nothing).
  const offset = useMemo(() => new THREE.Vector2(fx.chromatic, fx.chromatic * 0.6), [fx.chromatic]);

  if (!supported) return null;

  return (
    <Canvas
      className={className}
      // Capped hard. These scenes sit on the same GPU as an OBS encode, and above ~1.5 the extra
      // pixels buy nothing visible while costing real frames.
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{
        alpha: true,
        antialias: false, // The composer resolves edges; MSAA on top is pure waste.
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
      camera={{ position: camera?.position ?? [0, 0, 7], fov: camera?.fov ?? 45, near: 0.1, far: 100 }}
      style={{ pointerEvents: "none" }}
    >
      <ColorPipeline />
      {parallax > 0 && <CursorParallax amount={parallax} />}
      {children}
      {(fx.bloom > 0 || fx.vignette > 0 || fx.chromatic > 0) && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <>
            {fx.bloom > 0 && (
              <Bloom
                intensity={fx.bloom}
                luminanceThreshold={fx.bloomThreshold}
                luminanceSmoothing={0.28}
                mipmapBlur
                radius={0.72}
              />
            )}
            {fx.chromatic > 0 && (
              <ChromaticAberration offset={offset} radialModulation modulationOffset={0.25} />
            )}
            {fx.vignette > 0 && (
              <Vignette eskil={false} offset={0.28} darkness={fx.vignette} blendFunction={BlendFunction.NORMAL} />
            )}
          </>
        </EffectComposer>
      )}
    </Canvas>
  );
}

/**
 * The lighting most designs start from — a cool key, a violet fill from below, and a rim from
 * behind. Designs that need their own scheme simply don't use it.
 */
export function StandardLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <ambientLight intensity={0.5 * intensity} color={P.mist} />
      <directionalLight position={[4, 6, 5]} intensity={1.6 * intensity} color={P.highlight} />
      <pointLight position={[-5, -3, 3]} intensity={38 * intensity} color={P.electric} distance={22} />
      <pointLight position={[4, 3, -4]} intensity={26 * intensity} color={P.lavender} distance={20} />
    </>
  );
}
