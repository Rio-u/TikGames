/**
 * The timing vocabulary. Every design animates through these rather than raw `Math.sin`, which
 * is what keeps eighteen scenes feeling like one product: entrances overshoot the same way,
 * settles decay the same way.
 */

/** Overshoots then settles. Entrances that should land with weight. */
export function easeOutBack(t: number, overshoot = 1.7): number {
  const c = overshoot + 1;
  const k = Math.min(Math.max(t, 0), 1) - 1;
  return 1 + c * k * k * k + overshoot * k * k;
}

/** Fast out of the gate, long tail. Reveals and expansions. */
export function easeOutExpo(t: number): number {
  const k = Math.min(Math.max(t, 0), 1);
  return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
}

/** Symmetric. Loops and continuous motion that should not read as starting or stopping. */
export function easeInOutCubic(t: number): number {
  const k = Math.min(Math.max(t, 0), 1);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/** A decaying kick, for the beat on each countdown tick. 1 at t=0, → 0. */
export function pulse(t: number, decay = 6): number {
  return Math.exp(-Math.max(t, 0) * decay);
}
