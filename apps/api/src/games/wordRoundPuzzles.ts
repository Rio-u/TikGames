export interface WordRoundPuzzle {
  centralLetter: string;
  /** The rest of this puzzle's available letters (does not repeat centralLetter). */
  extraLetters: string[];
  /** Every valid word for this puzzle — the sole source of truth for correctness, same trust
   *  model as FLAGS_QUESTIONS/CAPITALS_QUESTIONS: the engine never re-derives validity from the
   *  letters, it just looks the guess up here. Already in normalizeAnswer()-stable form (ا not
   *  إ/أ/آ/ٱ, ه not ة, ي not ى), so a raw string-equality check after normalizing the guess is
   *  enough — no separate letter-membership check needed at runtime. A word may reuse a pool
   *  letter more than once (typed input, not physical tiles to consume), it just has to contain
   *  centralLetter at least once and use no letter outside centralLetter + extraLetters.
   */
  validWords: string[];
}

/**
 * The built-in word-round puzzle bank — hand-curated (unlike FLAGS_QUESTIONS' enumerable country
 * list, there's no authoritative source list for this, so correctness here rests entirely on
 * careful manual review). The engine deals these shuffled, same reshuffle-on-exhaustion pattern
 * as Flags/Capitals/Logos.
 */
export const WORD_ROUND_PUZZLES: WordRoundPuzzle[] = [
  {
    centralLetter: "ت",
    extraLetters: ["ك", "ا", "ب", "ر", "س"],
    validWords: ["تاب", "ستار", "تراب", "كبت", "بات", "سكت", "تكبر", "سبات", "كاتب", "كتاب"],
  },
  {
    centralLetter: "د",
    extraLetters: ["م", "ر", "س", "ه", "ن"],
    validWords: ["مدرسه", "درس", "سند", "ندم", "دهن", "هدر", "مهد", "درهم"],
  },
  {
    centralLetter: "ل",
    extraLetters: ["ق", "م", "ر", "ي", "ب"],
    validWords: ["قلم", "لقب", "مقبل", "قبل", "يقبل", "قليل"],
  },
  {
    centralLetter: "ش",
    extraLetters: ["م", "س", "ر", "ق", "ي"],
    validWords: ["شمس", "مشرق", "قشر", "رشيق", "مشي", "شمر"],
  },
  {
    centralLetter: "ح",
    extraLetters: ["ب", "ر", "ي", "ق"],
    validWords: ["حريق", "حب", "حبر", "بحر", "رحيب", "حق"],
  },
  {
    centralLetter: "ع",
    extraLetters: ["ل", "م", "ا", "ن"],
    validWords: ["علم", "عالم", "عمل", "معلن", "نعم", "لمع", "عمال"],
  },
  {
    centralLetter: "ر",
    extraLetters: ["س", "م", "ي", "ل", "و"],
    validWords: ["رسم", "رسمي", "سر", "مسير", "سرير", "مسرور", "رسول"],
  },
  {
    centralLetter: "ف",
    extraLetters: ["ر", "ح", "ه", "س"],
    validWords: ["فرح", "حرف", "فرس", "فهرس", "سفر", "حفر", "فرحه"],
  },
  {
    centralLetter: "س",
    extraLetters: ["ل", "ا", "م", "ه", "ت"],
    validWords: ["سلام", "سلم", "سهل", "سلاسه", "سلمت", "تسلم", "استلم"],
  },
  {
    centralLetter: "ن",
    extraLetters: ["و", "ر", "ع", "م"],
    validWords: ["نور", "نمر", "منع", "عون", "نوع", "منور"],
  },
  {
    centralLetter: "ط",
    extraLetters: ["ر", "ي", "ق", "و", "ه"],
    validWords: ["طريق", "طير", "طور", "قطر", "طهي", "طيور"],
  },
  {
    centralLetter: "ج",
    extraLetters: ["م", "ي", "ل", "ب"],
    validWords: ["جميل", "جبل", "جمل", "جيل", "جليل", "لجم"],
  },
];
