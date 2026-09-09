import { Countdown01 } from "../countdown/Countdown01";
import { Countdown02 } from "../countdown/Countdown02";
import { Countdown03 } from "../countdown/Countdown03";
import { Countdown04 } from "../countdown/Countdown04";
import { Countdown05 } from "../countdown/Countdown05";
import { Countdown06 } from "../countdown/Countdown06";
import { Countdown07 } from "../countdown/Countdown07";
import { Countdown08 } from "../countdown/Countdown08";
import { Countdown09 } from "../countdown/Countdown09";
import { Victory01 } from "../victory/Victory01";
import { Victory02 } from "../victory/Victory02";
import { Victory03 } from "../victory/Victory03";
import { Victory04 } from "../victory/Victory04";
import { Victory05 } from "../victory/Victory05";
import { Victory06 } from "../victory/Victory06";
import { Victory07 } from "../victory/Victory07";
import { Victory08 } from "../victory/Victory08";
import { Victory09 } from "../victory/Victory09";
import type { Design } from "../shared/types";

/**
 * The registry. Everything downstream — the picker, the game, persistence — goes through these
 * two arrays and never imports a design directly, so adding a tenth is one import and one entry.
 *
 * Order is the display order and the numbering the user sees. Ids are stable and must never be
 * renumbered: a stored `victory-03` has to keep resolving to the same scene across releases.
 */

export const COUNTDOWN_DESIGNS: Design[] = [
  Countdown01,
  Countdown02,
  Countdown03,
  Countdown04,
  Countdown05,
  Countdown06,
  Countdown07,
  Countdown08,
  Countdown09,
];

export const VICTORY_DESIGNS: Design[] = [
  Victory01,
  Victory02,
  Victory03,
  Victory04,
  Victory05,
  Victory06,
  Victory07,
  Victory08,
  Victory09,
];

export const DEFAULT_COUNTDOWN_ID = COUNTDOWN_DESIGNS[0]!.id;
export const DEFAULT_VICTORY_ID = VICTORY_DESIGNS[0]!.id;

/** Falls back to the first design rather than throwing — a stale stored id must never blank the
 *  game mid-stream, which is exactly when nobody can fix it. */
export function getCountdownDesign(id: string | null | undefined): Design {
  return COUNTDOWN_DESIGNS.find((d) => d.id === id) ?? COUNTDOWN_DESIGNS[0]!;
}

export function getVictoryDesign(id: string | null | undefined): Design {
  return VICTORY_DESIGNS.find((d) => d.id === id) ?? VICTORY_DESIGNS[0]!;
}
