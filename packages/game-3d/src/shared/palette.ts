import * as THREE from "three";

/**
 * One palette for all eighteen scenes.
 *
 * Deliberately narrow: deep black through violet to a near-white highlight, with a single warm
 * accent reserved for the victory half. Every design draws from this and nothing else — that
 * constraint is what keeps eighteen very different compositions reading as one product rather
 * than eighteen demos.
 *
 * Values are the app's own CSS custom properties where they overlap (`--color-primary`,
 * `--color-accent`), extended with the darker and lighter steps the 3D work needs. three.js
 * cannot read CSS variables, so the overlap is kept in sync by hand.
 */
export const P = {
  /** Deepest ground. Scenes render on transparent, but fog and depth fades resolve toward this. */
  void: "#04020a",
  /** Near-black purple — the body colour of solid geometry seen edge-on. */
  abyss: "#0d0718",
  /** Structural violet: chassis, plates, the non-emissive mass of an object. */
  slate: "#241a3d",
  /** Mid violet — the workhorse for lit surfaces. */
  violet: "#5b2bc4",
  /** The brand primary. Emissive cores, key lights. */
  electric: "#7c3aed",
  /** The brand accent. Edges, rims, energy filaments. */
  lavender: "#c084fc",
  /** Soft lavender for atmosphere, haze and distant particles. */
  mist: "#d8c7ff",
  /** White highlight, used sparingly — specular hits and the hottest core pixels. */
  highlight: "#f6f2ff",
  /** The single warm note. Victory scenes only; never appears in a countdown. */
  ember: "#ffb545",
  /** Deep amber shadow for the warm accent. */
  emberDeep: "#b4610a",
} as const;

export type PaletteKey = keyof typeof P;

/** Cached THREE.Color instances — building these per frame is a real allocation cost at 60fps. */
const colorCache = new Map<string, THREE.Color>();
export function col(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

/** Countdown scenes shift toward the warm accent as time runs out; this is that ramp. */
export function urgencyColor(secondsLeft: number): string {
  if (secondsLeft <= 1) return P.ember;
  if (secondsLeft <= 3) return "#e879a6";
  return P.lavender;
}
