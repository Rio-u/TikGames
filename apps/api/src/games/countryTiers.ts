import type { GeoDifficulty } from "@tikgames/shared-types";

/**
 * Difficulty tiers for the geography games, keyed by ISO 3166-1 alpha-2 code.
 *
 * Flags and Capitals keep separate question banks (each game's content is self-contained), but
 * they cover the same ~195-country roster under the same codes — so the tiering lives here once
 * instead of being duplicated and drifting apart.
 *
 * A tier is the *lowest* difficulty a country appears at, and higher difficulties include
 * everything below them:
 *
 *   1 — easy   : every Arab country, plus the European countries an Arabic-speaking chat names
 *                without thinking. This is the band a casual room can actually shout answers to.
 *   2 — medium : + the rest of Europe, all of Asia, all of North America, and the five African
 *                countries that come up outside the continent. The default.
 *   3 — hard   : everything else — the rest of Africa, all of South America, all of Oceania.
 *
 * Anything not listed defaults to 3, so adding a country to a question bank without touching this
 * file makes it hard-only rather than silently easy.
 */

/** The 22 Arab League states. Tier 1 wherever they sit geographically. */
const ARAB = [
  "dz", "bh", "km", "dj", "eg", "iq", "jo", "kw", "lb", "ly", "mr",
  "ma", "om", "ps", "qa", "sa", "so", "sd", "sy", "tn", "ae", "ye",
];

/** European countries that need no introduction in an Arabic-speaking room. */
const FAMILIAR_EUROPE = [
  "fr", "de", "it", "es", "gb", "pt", "nl", "be", "ch", "se", "no", "gr", "ru", "pl", "at",
];

/** Turkey and Iran sit in the Asia bank but belong with the easy set for this audience. */
const FAMILIAR_NEAR = ["tr", "ir"];

/** The five African countries that reliably land outside the continent. */
const FAMILIAR_AFRICA = ["za", "ng", "ke", "et", "gh"];

/** Everything in these regions is tier 2 if not already tier 1. */
const EUROPE = [
  "al", "ad", "by", "ba", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "hu", "is", "ie", "xk",
  "lv", "li", "lt", "lu", "mt", "md", "mc", "me", "mk", "ro", "sm", "rs", "sk", "si", "ua", "va",
];

const ASIA = [
  "af", "am", "az", "bd", "bt", "bn", "kh", "cn", "ge", "in", "id", "il", "jp", "kz", "kg",
  "la", "my", "mv", "mn", "mm", "np", "kp", "pk", "ph", "sg", "kr", "lk", "tj", "th", "tl",
  "tm", "uz", "vn",
];

const NORTH_AMERICA = [
  "ag", "bs", "bb", "bz", "ca", "cr", "cu", "dm", "do", "sv", "gd", "gt", "ht", "hn", "jm",
  "mx", "ni", "pa", "kn", "lc", "vc", "tt", "us",
];

function build(): Record<string, 1 | 2 | 3> {
  const tiers: Record<string, 1 | 2 | 3> = {};
  // Order matters: tier 2 is written first, then tier 1 overwrites, so a country that is both
  // (Egypt is in Africa and Arab) ends up easy rather than medium.
  for (const code of [...EUROPE, ...ASIA, ...NORTH_AMERICA, ...FAMILIAR_AFRICA]) tiers[code] = 2;
  for (const code of [...ARAB, ...FAMILIAR_EUROPE, ...FAMILIAR_NEAR]) tiers[code] = 1;
  return tiers;
}

const TIER_BY_CODE = build();

const MAX_TIER: Record<GeoDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

/** A country's tier; anything unlisted is hard-only. */
export function tierOf(code: string): number {
  return TIER_BY_CODE[code.toLowerCase()] ?? 3;
}

/**
 * The slice of a question bank a difficulty plays with.
 *
 * Falls back to the full bank if a filter would leave too few questions to fill a session —
 * a game that runs out of countries mid-round and starts repeating immediately is worse than one
 * that quietly includes a few harder ones.
 */
export function filterByDifficulty<T extends { code: string }>(
  bank: readonly T[],
  difficulty: GeoDifficulty,
  minimum = 12,
): T[] {
  const max = MAX_TIER[difficulty] ?? 2;
  const picked = bank.filter((q) => tierOf(q.code) <= max);
  return picked.length >= minimum ? picked : [...bank];
}
