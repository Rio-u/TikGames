import type { LogosPlayer, LogosSettings, LogosState } from "@tikgames/shared-types";
import { LOGOS_QUESTIONS, type LogoQuestion } from "./logosQuestions.js";
import { normalizeAnswer } from "./textNormalize.js";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Logos (شعارات): Flags/Capitals' twin — same round-bounded shape, same "show an image, guess
 * the Arabic name" mechanic, but the image is a brand mark (`logoSlug` — clients render
 * `public/logos/<slug>.svg`) instead of a flag. No join step — any comment while a logo is live
 * is checked as a guess; the first match wins the point. Brands are dealt from a shuffled queue
 * (reshuffled once exhausted, same as Trivia/Flags/Capitals) for the number of rounds the
 * streamer set up front. After a correct guess or a timeout, a short REVEALED pause shows the
 * brand name before the next logo deals (or the game auto-finishes once the last round reveals).
 * The streamer can still stop early; whoever has the most points at FINISHED is the winner.
 */
export class LogosEngine {
  readonly gameSessionId: string;
  private settings: LogosSettings;
  private scores = new Map<string, LogosPlayer>();
  private phase: LogosState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: LogoQuestion[] = [];
  private current: LogoQuestion | null = null;
  private lastWinner: LogosPlayer | null = null;
  private winner: LogosPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: LogosState) => void;

  constructor(gameSessionId: string, settings: LogosSettings, onChange: (state: LogosState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as a guess attempt. Returns whether it scored the point. */
  handleAnswer(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "QUESTION" || !this.current) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;
    const correct = this.current.answers.some((a) => normalizeAnswer(a) === normalized);
    if (!correct) return false;

    const player = this.scores.get(handle) ?? { handle, displayName, avatarUrl, score: 0 };
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.score += 1;
    this.scores.set(handle, player);
    this.lastWinner = player;
    this.reveal();
    return true;
  }

  /** Single entry point for an incoming comment — mirrors the other engines' shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleAnswer(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and deals logo 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(LOGOS_QUESTIONS);
    this.nextQuestion();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. Idempotent. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): LogosState {
    return {
      gameType: "LOGOS",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      logoSlug: this.current?.slug ?? null,
      brandName: this.current?.answers[0] ?? null,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;
  private static readonly MIN_ANSWER_DURATION_S = 5;

  private nextQuestion(): void {
    if (this.queue.length === 0) this.queue = shuffled(LOGOS_QUESTIONS);
    this.current = this.queue.pop() ?? null;
    this.lastWinner = null;
    this.round += 1;
    this.phase = "QUESTION";

    const seconds = Math.max(LogosEngine.MIN_ANSWER_DURATION_S, this.settings.answerDurationSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
  }

  private reveal(): void {
    if (this.phase !== "QUESTION") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + LogosEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => {
      if (this.round >= this.settings.totalRounds) this.finish();
      else this.nextQuestion();
    }, LogosEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.current = null;
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
