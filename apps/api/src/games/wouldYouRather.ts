import type {
  WouldYouRatherSettings,
  WouldYouRatherState,
  WouldYouRatherVoter,
} from "@tikgames/shared-types";
import { WOULD_YOU_RATHER_QUESTIONS, type WouldYouRatherQuestion } from "./wouldYouRatherQuestions.js";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Would You Rather (إما / أو): no join step, no scoring, no roster — pure crowd voting. Each
 * round deals a two-option question from the built-in bank; any viewer comment of "1" or "2"
 * (Arabic-Indic digits accepted) while VOTING counts once per viewer per round. When the window
 * closes, a short RESULTS pause shows which side won before the next question deals. Runs until
 * the streamer stops it; `winner` is always null — the payoff is the vote reveal, not a person.
 */
export class WouldYouRatherEngine {
  readonly gameSessionId: string;
  private settings: WouldYouRatherSettings;
  private phase: WouldYouRatherState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: WouldYouRatherQuestion[] = [];
  private currentQuestion: WouldYouRatherQuestion | null = null;
  private votes = new Map<string, "A" | "B">(); // handle -> side, reset every round
  private recentVotersA: WouldYouRatherVoter[] = [];
  private recentVotersB: WouldYouRatherVoter[] = [];
  private resultSide: "A" | "B" | "TIE" | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: WouldYouRatherState) => void;

  constructor(
    gameSessionId: string,
    settings: WouldYouRatherSettings,
    onChange: (state: WouldYouRatherState) => void,
  ) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as a vote. First vote per round locks — spam can't flip sides. */
  handleVote(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "VOTING") return false;
    if (this.votes.has(handle)) return false;

    const trimmed = text.trim();
    const side = trimmed === "1" || trimmed === "١" ? "A" : trimmed === "2" || trimmed === "٢" ? "B" : null;
    if (!side) return false;

    this.votes.set(handle, side);
    const voter: WouldYouRatherVoter = { handle, displayName, avatarUrl };
    if (side === "A") this.recentVotersA = [voter, ...this.recentVotersA].slice(0, 12);
    else this.recentVotersB = [voter, ...this.recentVotersB].slice(0, 12);
    this.emitChange();
    return true;
  }

  /** Single entry point for an incoming comment — mirrors the other engines' shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleVote(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and deals question 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(WOULD_YOU_RATHER_QUESTIONS);
    this.nextQuestion();
    return true;
  }

  /** Force-ends the session (this game only ends when the streamer stops it). Idempotent. */
  stop(): void {
    this.clearTimer();
    if (this.phase !== "FINISHED") {
      this.phase = "FINISHED";
      this.currentQuestion = null;
      this.resultSide = null;
      this.phaseEndsAt = null;
      this.emitChange();
    }
  }

  getState(): WouldYouRatherState {
    let votesA = 0;
    for (const side of this.votes.values()) if (side === "A") votesA += 1;
    return {
      gameType: "WOULD_YOU_RATHER",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      round: this.round,
      winner: null,
      optionA: this.currentQuestion?.a ?? null,
      optionB: this.currentQuestion?.b ?? null,
      votesA,
      votesB: this.votes.size - votesA,
      recentVotersA: this.recentVotersA,
      recentVotersB: this.recentVotersB,
      resultSide: this.resultSide,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly RESULTS_DURATION_MS = 6000;
  private static readonly MIN_VOTE_DURATION_S = 5;

  private nextQuestion(): void {
    if (this.queue.length === 0) this.queue = shuffled(WOULD_YOU_RATHER_QUESTIONS);
    this.currentQuestion = this.queue.pop() ?? null;
    this.votes.clear();
    this.recentVotersA = [];
    this.recentVotersB = [];
    this.resultSide = null;
    this.round += 1;
    this.phase = "VOTING";

    const seconds = Math.max(WouldYouRatherEngine.MIN_VOTE_DURATION_S, this.settings.voteDurationSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.showResults(), seconds * 1000);
    this.emitChange();
  }

  private showResults(): void {
    if (this.phase !== "VOTING") return;
    this.clearTimer();
    const { votesA, votesB } = this.getState();
    this.resultSide = votesA === votesB ? "TIE" : votesA > votesB ? "A" : "B";
    this.phase = "RESULTS";
    this.phaseEndsAt = new Date(Date.now() + WouldYouRatherEngine.RESULTS_DURATION_MS);
    this.timer = setTimeout(() => this.nextQuestion(), WouldYouRatherEngine.RESULTS_DURATION_MS);
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
