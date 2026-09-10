import type { DrawingPlayer, DrawingSettings, DrawingState } from "@tikgames/shared-types";
import { normalizeAnswer } from "./textNormalize.js";

/**
 * Drawing (تحدي الرسم): no pre-set question bank — each round the streamer privately types the
 * word themselves (PICKING), then draws it on a canvas while DRAWING is live; the canvas itself
 * is never touched by this engine, only relayed over its own socket event outside game:state (see
 * apps/api/src/realtime/socket.ts). Chat races to guess the word; the first correct comment scores
 * a point and reveals it. A timeout with nobody guessing also reveals it, unscored. Mirrors
 * TriviaEngine's round/score/reveal shape closely, but — like Trivia not capping at a fixed
 * question count — there's no round cap here either: the streamer just keeps picking new words
 * until they stop the game, at which point the top scorer wins.
 */
export class DrawingEngine {
  readonly gameSessionId: string;
  private settings: DrawingSettings;
  private scores = new Map<string, DrawingPlayer>();
  private phase: DrawingState["phase"] = "WAITING_TO_START";
  private round = 0;
  private currentWord: string | null = null;
  private lastWinner: DrawingPlayer | null = null;
  private winner: DrawingPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: DrawingState) => void;

  constructor(gameSessionId: string, settings: DrawingSettings, onChange: (state: DrawingState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
  }

  /** Streamer submits the word for this round — only valid while PICKING. */
  submitWord(word: string): boolean {
    if (this.phase !== "PICKING") return false;
    const trimmed = word.trim().slice(0, 40);
    if (!trimmed) return false;

    this.currentWord = trimmed;
    this.lastWinner = null;
    this.round += 1;
    this.phase = "DRAWING";
    const seconds = Math.max(10, this.settings.roundSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
    return true;
  }

  /** Registers a viewer's comment as a guess attempt. Returns whether it scored the point. */
  handleGuess(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "DRAWING" || !this.currentWord) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;
    if (normalized !== normalizeAnswer(this.currentWord)) return false;

    const player = this.scores.get(handle) ?? { handle, displayName, avatarUrl, score: 0 };
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.score += 1;
    this.scores.set(handle, player);
    this.lastWinner = player;
    this.reveal();
    return true;
  }

  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleGuess(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and opens the first PICKING window. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.phase = "PICKING";
    this.emitChange();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): DrawingState {
    return {
      gameType: "DRAWING",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      word: this.phase === "REVEALED" ? this.currentWord : null,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;

  private reveal(): void {
    if (this.phase !== "DRAWING") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + DrawingEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => {
      // Same round cap every other game has. Without it this engine looped forever and only
      // reached FINISHED if the streamer pressed stop, so the winner screen never appeared in
      // normal play.
      if (this.round >= this.settings.totalRounds) this.finish();
      else this.startPicking();
    }, DrawingEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private startPicking(): void {
    if (this.phase !== "REVEALED") return;
    this.currentWord = null;
    this.phase = "PICKING";
    this.phaseEndsAt = null;
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.currentWord = null;
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
