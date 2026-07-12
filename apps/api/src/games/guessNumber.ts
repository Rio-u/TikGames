import type { GuessNumberPlayer, GuessNumberSettings, GuessNumberState } from "@tikgames/shared-types";
import { normalizeAnswer } from "./textNormalize.js";

/**
 * Guess Number/Word: no join step, single secret per session. The streamer sets the secret (and
 * an optional hint) in the pre-game settings form; once begun, any viewer comment while
 * GUESSING is checked against it, and the first match wins instantly. Times out to FINISHED
 * (no winner) if nobody gets it. The secret is a private field — `getState()` never includes it
 * except once phase is FINISHED, so it can never leak to the dashboard or overlay mid-round.
 */
export class GuessNumberEngine {
  readonly gameSessionId: string;
  private settings: GuessNumberSettings;
  private normalizedSecret: string;
  private players = new Map<string, GuessNumberPlayer>();
  private phase: GuessNumberState["phase"] = "WAITING_TO_START";
  private round = 0;
  private winner: GuessNumberPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: GuessNumberState) => void;

  constructor(
    gameSessionId: string,
    settings: GuessNumberSettings,
    onChange: (state: GuessNumberState) => void,
  ) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.normalizedSecret = normalizeAnswer(settings.secret);
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as a guess attempt. Returns whether it matched the secret. */
  handleGuess(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "GUESSING") return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;

    const player = this.players.get(handle) ?? { handle, displayName, avatarUrl, attempts: 0 };
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.attempts += 1;
    this.players.set(handle, player);

    if (normalized === this.normalizedSecret) {
      this.finish(player);
      return true;
    }
    this.emitChange();
    return false;
  }

  /** Single entry point for an incoming comment — mirrors the other engines' shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleGuess(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and opens the guessing window. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.phase = "GUESSING";
    this.round = 1;
    this.phaseEndsAt = new Date(Date.now() + this.settings.durationSeconds * 1000);
    this.timer = setTimeout(() => this.finish(null), this.settings.durationSeconds * 1000);
    this.emitChange();
    return true;
  }

  /** Force-ends the session early (e.g. the streamer cancels mid-round). Idempotent. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish(null);
  }

  getState(): GuessNumberState {
    return {
      gameType: "GUESS_NUMBER",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: { hint: this.settings.hint, durationSeconds: this.settings.durationSeconds },
      // Whoever actually guessed it ranks first, regardless of attempts — trying the most and
      // still being wrong isn't the achievement here. Everyone else sorts by attempts below.
      players: [...this.players.values()].sort((a, b) => {
        if (this.winner && a.handle === this.winner.handle) return -1;
        if (this.winner && b.handle === this.winner.handle) return 1;
        return b.attempts - a.attempts;
      }),
      round: this.round,
      winner: this.winner,
      // Phase-gated, not a separate flag to remember to check — as soon as FINISHED is true by
      // any path (win, timeout, manual stop), the secret is included. Never before.
      secret: this.phase === "FINISHED" ? this.settings.secret : null,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private finish(winner: GuessNumberPlayer | null): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.winner = winner;
    this.phaseEndsAt = null;
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
