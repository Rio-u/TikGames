import type { CapitalsPlayer, CapitalsSettings, CapitalsState } from "@tikgames/shared-types";
import { CAPITALS_QUESTIONS, type CapitalQuestion } from "./capitalsQuestions.js";
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
 * Capitals (عواصم): Flags' twin — same round-bounded shape, same flag artwork (`countryCode`
 * reuses Flags' own `public/flags/<code>.svg` files, no separate asset set), but the question
 * flips: a country's flag and name are shown, and viewers guess *its capital city* instead of
 * the country itself. No join step — any comment while a question is live is checked as a guess;
 * the first match wins the point. Countries are dealt from a shuffled queue (reshuffled once
 * exhausted, same as Trivia/Flags) for the number of rounds the streamer set up front. After a
 * correct guess or a timeout, a short REVEALED pause shows the capital before the next country
 * deals (or the game auto-finishes once the last round reveals). The streamer can still stop
 * early; whoever has the most points at FINISHED is the winner.
 */
export class CapitalsEngine {
  readonly gameSessionId: string;
  private settings: CapitalsSettings;
  private scores = new Map<string, CapitalsPlayer>();
  private phase: CapitalsState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: CapitalQuestion[] = [];
  private current: CapitalQuestion | null = null;
  private lastWinner: CapitalsPlayer | null = null;
  private winner: CapitalsPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: CapitalsState) => void;

  constructor(gameSessionId: string, settings: CapitalsSettings, onChange: (state: CapitalsState) => void) {
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

  /** Closes setup and deals country 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(CAPITALS_QUESTIONS);
    this.nextQuestion();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. Idempotent. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): CapitalsState {
    return {
      gameType: "CAPITALS",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      countryCode: this.current?.code ?? null,
      countryName: this.current?.country ?? null,
      capitalName: this.current?.answers[0] ?? null,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;
  private static readonly MIN_ANSWER_DURATION_S = 5;

  private nextQuestion(): void {
    if (this.queue.length === 0) this.queue = shuffled(CAPITALS_QUESTIONS);
    this.current = this.queue.pop() ?? null;
    this.lastWinner = null;
    this.round += 1;
    this.phase = "QUESTION";

    const seconds = Math.max(CapitalsEngine.MIN_ANSWER_DURATION_S, this.settings.answerDurationSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
  }

  private reveal(): void {
    if (this.phase !== "QUESTION") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + CapitalsEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => {
      if (this.round >= this.settings.totalRounds) this.finish();
      else this.nextQuestion();
    }, CapitalsEngine.REVEAL_DURATION_MS);
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
