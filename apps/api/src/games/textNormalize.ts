/**
 * Normalizes Arabic (and Latin) free-text answers for comparison: case-folds, unifies alef /
 * teh-marbuta / alef-maksura variants that Arabic typists routinely mix up, and strips
 * everything that isn't a letter or digit (diacritics, punctuation, whitespace). Two strings
 * that normalize to the same non-empty value are treated as the same answer.
 */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
