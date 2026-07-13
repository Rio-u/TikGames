import type { WordRoundFoundWord, WordRoundPlayer, WordRoundSettings, WordRoundState } from "@tikgames/shared-types";
import { normalizeAnswer } from "./textNormalize.js";
import { WORD_ROUND_PUZZLES, type WordRoundPuzzle } from "./wordRoundPuzzles.js";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Word Round (جولة كلمات): a central letter + extra letters are dealt each round, and every
 * viewer comment is checked as a candidate word — unlike Flags' single-race-to-answer shape, any
 * number of players can each claim any number of distinct valid words during the same round (the
 * round always runs its full timer, a correct guess never short-circuits it early), scored by
 * word length. First correct submission of a given word claims it; nobody else can score it again
 * that round. Puzzles are dealt from a shuffled queue (reshuffled once exhausted, same as Flags)
 * for the number of rounds the streamer set up front, then auto-finishes; the streamer can still
 * stop early. Whoever has the most points at FINISHED is the winner.
 */
export class WordRoundEngine {
  readonly gameSessionId: string;
  private settings: WordRoundSettings;
  private scores = new Map<string, WordRoundPlayer>();
  private phase: WordRoundState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: WordRoundPuzzle[] = [];
  private currentPuzzle: WordRoundPuzzle | null = null;
  private normalizedToWord = new Map<string, string>();
  private foundWords: WordRoundFoundWord[] = [];
  private foundNormalized = new Set<string>();
  private winner: WordRoundPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: WordRoundState) => void;

  constructor(gameSessionId: string, settings: WordRoundSettings, onChange: (state: WordRoundState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as a word-guess attempt. Returns whether it scored. */
  handleGuess(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "PUZZLE" || !this.currentPuzzle) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized || this.foundNormalized.has(normalized)) return false;
    const word = this.normalizedToWord.get(normalized);
    if (!word) return false;

    this.foundNormalized.add(normalized);
    const points = word.length;
    const player = this.scores.get(handle) ?? { handle, displayName, avatarUrl, score: 0 };
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.score += points;
    this.scores.set(handle, player);
    this.foundWords.push({ word, handle, displayName, points });
    this.emitChange();
    return true;
  }

  /** Single entry point for an incoming comment — mirrors the other engines' shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleGuess(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and deals puzzle 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(WORD_ROUND_PUZZLES);
    this.nextPuzzle();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. Idempotent. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): WordRoundState {
    return {
      gameType: "WORD_ROUND",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      centralLetter: this.currentPuzzle?.centralLetter ?? null,
      extraLetters: this.currentPuzzle?.extraLetters ?? [],
      foundWords: this.foundWords,
      allWords: this.phase === "REVEALED" || this.phase === "FINISHED" ? (this.currentPuzzle?.validWords ?? []) : null,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 5000;
  private static readonly MIN_ROUND_DURATION_S = 20;

  private nextPuzzle(): void {
    if (this.queue.length === 0) this.queue = shuffled(WORD_ROUND_PUZZLES);
    this.currentPuzzle = this.queue.pop() ?? null;
    this.normalizedToWord = new Map(this.currentPuzzle?.validWords.map((w) => [normalizeAnswer(w), w]) ?? []);
    this.foundWords = [];
    this.foundNormalized = new Set();
    this.round += 1;
    this.phase = "PUZZLE";

    const seconds = Math.max(WordRoundEngine.MIN_ROUND_DURATION_S, this.settings.roundSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
  }

  private reveal(): void {
    if (this.phase !== "PUZZLE") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + WordRoundEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => {
      if (this.round >= this.settings.totalRounds) this.finish();
      else this.nextPuzzle();
    }, WordRoundEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.phaseEndsAt = null;
    const ranked = [...this.scores.values()].sort((a, b) => b.score - a.score);
    this.winner = ranked[0] ?? null;
    this.emitChange();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emitChange(): void {
    this.onChange(this.getState());
  }
}
