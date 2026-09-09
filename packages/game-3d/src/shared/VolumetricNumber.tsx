import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { P, col } from "./palette";

/**
 * The number, as a solid lit object rather than a label floating in space.
 *
 * ## Why it is built this way
 *
 * Real `ExtrudeGeometry` type needs glyph outlines, and the only ways to get those are a
 * typeface JSON (a font asset to ship and load, and one that mangles Arabic shaping — "يلا!"
 * comes out as disconnected letterforms) or hand-authored digit paths (approximate typography,
 * and no Arabic at all). Both trade away correctness for depth.
 *
 * So the glyph is rasterised once from the app's own font, and depth is built from a stack of
 * alpha-cut planes marching back along -Z. Two details are what make that read as a solid
 * extrusion rather than a stack of cards:
 *
 * - **`alphaTest`, not blending.** Cut-out planes stay *opaque*: they write depth, sort
 *   correctly, and take real lighting. A transparent stack of coplanar planes would z-fight and
 *   flicker as the camera moves, and would need manual sort order.
 * - **The body layers are dark and the front face is emissive.** Side walls in a real extrusion
 *   are shadowed; that value break is what the eye reads as thickness.
 *
 * A slightly scaled outline pass sits in front as the bevel highlight, additive so bloom catches
 * it. The whole thing is one geometry and `LAYERS + 2` materials, all memoised.
 */

const LAYERS = 16;

/** One shared plane for every layer of every number on screen. */
const PLANE = new THREE.PlaneGeometry(1, 1);

const glyphCache = new Map<string, THREE.CanvasTexture>();

/**
 * White glyph on transparent, no glow — this is an *alpha* source, so any blur here would eat
 * the alphaTest cutoff and fray the silhouette. Cached per string: a countdown re-renders its
 * digit every second and would otherwise leak a GPU texture a second.
 */
function glyphTexture(text: string, font: string): THREE.CanvasTexture {
  const key = `${text}|${font}`;
  const hit = glyphCache.get(key);
  if (hit) return hit;

  const px = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Long labels ("يلا!") have to fit the same box a single digit fills.
    const size = text.length > 2 ? px * 0.3 : text.length > 1 ? px * 0.46 : px * 0.72;
    ctx.font = `900 ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, px / 2, px / 2 + px * 0.03);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  glyphCache.set(key, tex);
  return tex;
}

/** Same glyph as a hollow stroke — the bevel highlight riding the silhouette edge. */
const outlineCache = new Map<string, THREE.CanvasTexture>();
function outlineTexture(text: string, font: string): THREE.CanvasTexture {
  const key = `${text}|${font}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;

  const px = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const size = text.length > 2 ? px * 0.3 : text.length > 1 ? px * 0.46 : px * 0.72;
    ctx.font = `900 ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = px * 0.014;
    ctx.lineJoin = "round";
    ctx.strokeText(text, px / 2, px / 2 + px * 0.03);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  outlineCache.set(key, tex);
  return tex;
}

export interface VolumetricNumberProps {
  /** What to show. Any string — digits, or a short word for the final beat. */
  value: string | number;
  /** Height of the glyph box in scene units. */
  size?: number;
  /** Total extrusion depth. */
  depth?: number;
  /** Front-face emissive colour. */
  face?: string;
  /** Colour of the extruded side walls. */
  body?: string;
  /** Bevel-edge highlight colour. */
  edge?: string;
  /** How hot the front face burns — feed bloom with this. */
  intensity?: number;
  /** Set false on designs that light the number themselves. */
  outline?: boolean;
  font?: string;
}

export function VolumetricNumber({
  value,
  size = 2.6,
  depth = 0.44,
  face = P.highlight,
  body = P.violet,
  edge = P.lavender,
  intensity = 1.5,
  outline = true,
  font = 'Cairo, "Segoe UI", system-ui, sans-serif',
}: VolumetricNumberProps) {
  const text = String(value);
  const alpha = useMemo(() => glyphTexture(text, font), [text, font]);
  const stroke = useMemo(() => outlineTexture(text, font), [text, font]);
  const group = useRef<THREE.Group>(null);
  const born = useRef(0);

  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < LAYERS; i++) {
      const t = i / (LAYERS - 1); // 0 = deepest wall, 1 = front face
      const isFace = i === LAYERS - 1;
      list.push(
        new THREE.MeshStandardMaterial({
          color: isFace ? col(face) : col(body).clone().multiplyScalar(0.25 + t * 0.75),
          emissive: isFace ? col(face) : col(edge),
          // Only the front face burns; the walls carry a low ember so they never read as black.
          emissiveIntensity: isFace ? intensity : 0.05 + t * 0.22,
          alphaMap: alpha,
          transparent: false,
          alphaTest: 0.45,
          roughness: isFace ? 0.22 : 0.55,
          metalness: isFace ? 0.1 : 0.35,
          side: THREE.DoubleSide,
        }),
      );
    }
    return list;
  }, [alpha, face, body, edge, intensity]);

  const edgeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: stroke,
        color: col(edge),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.9,
      }),
    [stroke, edge],
  );

  // Materials hold GPU programs and texture bindings; a countdown builds a fresh set every
  // second, so releasing the old ones matters more here than almost anywhere else.
  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose());
      edgeMaterial.dispose();
    },
    [materials, edgeMaterial],
  );

  // Remounting on each value change restarts this, which is what gives every tick its own entry.
  useFrame((_, delta) => {
    born.current += delta;
    if (!group.current) return;
    const t = Math.min(born.current, 1);
    const settle = 1 - Math.pow(1 - t, 4);
    group.current.scale.setScalar(0.82 + settle * 0.18);
  });

  return (
    // renderOrder 2: additive shells draw with depthWrite off, so draw order decides whether a
    // shell tints over the glyph. The number is the subject of every one of these scenes and
    // goes last.
    <group ref={group} renderOrder={2}>
      {materials.map((m, i) => (
        <mesh
          key={i}
          geometry={PLANE}
          material={m}
          scale={[size, size, 1]}
          position={[0, 0, -depth / 2 + (i / (LAYERS - 1)) * depth]}
        />
      ))}
      {outline && (
        <mesh
          geometry={PLANE}
          material={edgeMaterial}
          scale={[size * 1.008, size * 1.008, 1]}
          position={[0, 0, depth / 2 + 0.012]}
        />
      )}
    </group>
  );
}
