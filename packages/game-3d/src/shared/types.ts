import type { ComponentType } from "react";
import type { StageEffects } from "./Stage";

/**
 * What a design receives. Both categories take the same shape so the registry, the picker and
 * the game all treat a countdown and a victory scene identically.
 */
export interface SceneProps {
  /** The number (or short label) to show. Never hardcoded inside a design. */
  value: string | number;
  /**
   * 0 → 1 through the current beat.
   *
   * For a countdown that is progress through the current *second*, so designs can pulse on each
   * tick. For a victory scene it is progress through the celebration, so an entrance can play
   * once and settle. Driven by the server clock upstream, never by a local timer.
   */
  progress: number;
  /** Countdown only: true for the last couple of seconds, when the palette shifts warm. */
  urgent?: boolean;
}

export interface Design {
  /** Stable across releases — this is what gets persisted. Never renumber. */
  id: string;
  /** Shown on the picker card. */
  name: string;
  nameAr: string;
  descriptionAr: string;
  /** Scene contents only: lights and geometry, no Canvas. The stage supplies that. */
  Scene: ComponentType<SceneProps>;
  camera?: { position?: [number, number, number]; fov?: number };
  /** Per-design post tuning — part of the art direction, not a global setting. */
  effects?: StageEffects;
  parallax?: number;
}
