import { Countdown01 } from "../countdown/Countdown01";
import { Countdown02 } from "../countdown/Countdown02";
import { Countdown03 } from "../countdown/Countdown03";
import { Countdown04 } from "../countdown/Countdown04";
import { Countdown05 } from "../countdown/Countdown05";
import { Countdown06 } from "../countdown/Countdown06";
import { Countdown07 } from "../countdown/Countdown07";
import { Countdown08 } from "../countdown/Countdown08";
import { Countdown09 } from "../countdown/Countdown09";
import type { Design } from "../shared/types";

/**
 * The pre-roll designs. This is the only part of the 3D system that is chosen rather than fixed,
 * and the choice is an admin one that applies platform-wide.
 *
 * Order is the display order and the numbering the admin sees. Ids are stable and must never be
 * renumbered: a stored `countdown-06` has to keep resolving to the same scene across releases.
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

/** Energy Tunnel. The chosen default for the pre-roll — speed and urgency is what that beat is
 *  communicating, and it is the one design in the set built entirely around motion toward the
 *  viewer. An admin can change it for the whole platform on /3d-designs. */
export const DEFAULT_COUNTDOWN_ID = "countdown-06";

/** Falls back to the first design rather than throwing — a stale stored id must never blank the
 *  game mid-stream, which is exactly when nobody can fix it. */
export function getCountdownDesign(id: string | null | undefined): Design {
  return COUNTDOWN_DESIGNS.find((d) => d.id === id) ?? COUNTDOWN_DESIGNS[0]!;
}
