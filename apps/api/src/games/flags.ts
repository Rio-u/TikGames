import type { FlagsPlayer, FlagsSettings, FlagsState } from "@tikgames/shared-types";
import { FLAGS_QUESTIONS, type FlagQuestion } from "./flagsQuestions.js";
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
 * Flags (أعلام): no join step — any viewer comment while a flag is live is checked as a guess
 * against its country name; the first match wins the point. Flags are dealt from a shuffled
 * queue (reshuffled once exhausted, same as Trivia) for the number of rounds the streamer set
 * up front — that bound is this game's one real difference from Trivia, which just runs until
 * stopped. After a correct guess or a timeout, a short REVEALED pause shows the answer before
 * the next flag deals (or the game auto-finishes once the last round reveals). The streamer can
 * still stop early; whoever has the most points at FINISHED is the winner.
 */
export class FlagsEngine {
  readonly gameSessionId: string;
  private settings: FlagsSettings;
  private scores = new Map<string, FlagsPlayer>();
  private phase: FlagsState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: FlagQuestion[] = [];
  private currentFlag: FlagQuestion | null = null;
  private lastWinner: FlagsPlayer | null = null;
  private winner: FlagsPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: FlagsState) => void;

  constructor(gameSessionId: string, settings: FlagsSettings, onChange: (state: FlagsState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as a guess attempt. Returns whether it scored the point. */
  handleAnswer(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "QUESTION" || !this.currentFlag) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;
    const correct = this.currentFlag.answers.some((a) => normalizeAnswer(a) === normalized);
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

  /** Closes setup and deals flag 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(FLAGS_QUESTIONS);
    this.nextFlag();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. Idempotent. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): FlagsState {
    return {
      gameType: "FLAGS",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      countryCode: this.currentFlag?.code ?? null,
      countryName: this.currentFlag?.answers[0] ?? null,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;
  private static readonly MIN_ANSWER_DURATION_S = 5;

  private nextFlag(): void {
    if (this.queue.length === 0) this.queue = shuffled(FLAGS_QUESTIONS);
    this.currentFlag = this.queue.pop() ?? null;
    this.lastWinner = null;
    this.round += 1;
    this.phase = "QUESTION";

    const seconds = Math.max(FlagsEngine.MIN_ANSWER_DURATION_S, this.settings.answerDurationSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
  }

  private reveal(): void {
    if (this.phase !== "QUESTION") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + FlagsEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => {
      if (this.round >= this.settings.totalRounds) this.finish();
      else this.nextFlag();
    }, FlagsEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.currentFlag = null;
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
