import type { SpeedWordPlayer, SpeedWordSettings, SpeedWordState } from "@tikgames/shared-types";
import { normalizeAnswer } from "./textNormalize.js";
import { SPEED_WORDS } from "./speedWordQuestions.js";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Speed Word (أسرع): no join step — any viewer comment while a word is live is checked against
 * it directly (unlike Trivia, the displayed word *is* the answer, no separate correctAnswer
 * field); the first match wins the point. Words are dealt from a shuffled queue (reshuffled once
 * exhausted, same as Trivia) with a random background per word, drawn from this game's own
 * admin-curated image pool. After a correct answer or a timeout, a short REVEALED pause shows who
 * won before the next word deals. The streamer can stop at any time; whoever has the most points
 * is the winner.
 */
export class SpeedWordEngine {
  readonly gameSessionId: string;
  private settings: SpeedWordSettings;
  private backgroundPool: string[];
  private scores = new Map<string, SpeedWordPlayer>();
  private phase: SpeedWordState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: string[] = [];
  private currentWord: string | null = null;
  private currentBackground: string | null = null;
  private lastWinner: SpeedWordPlayer | null = null;
  private winner: SpeedWordPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: SpeedWordState) => void;

  /** `backgroundPool` is a snapshot of the admin-curated image pool taken when the session
   *  starts — later admin edits apply to the next session started, not one already running. */
  constructor(
    gameSessionId: string,
    settings: SpeedWordSettings,
    backgroundPool: string[],
    onChange: (state: SpeedWordState) => void,
  ) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.backgroundPool = backgroundPool;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as an answer attempt. Returns whether it scored the point. */
  handleAnswer(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "QUESTION" || !this.currentWord) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;
    if (normalizeAnswer(this.currentWord) !== normalized) return false;

    const player = this.scores.get(handle) ?? { handle, displayName, avatarUrl, score: 0 };
    player.displayName = displayName;
    player.avatarUrl = avatarUrl;
    player.score += 1;
    this.scores.set(handle, player);
    this.lastWinner = player;
    this.reveal();
    return true;
  }

  /** Single entry point for an incoming comment — mirrors TriviaEngine's shape so the ingestion
   *  layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleAnswer(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and deals word 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(SPEED_WORDS);
    this.nextWord();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): SpeedWordState {
    return {
      gameType: "SPEED_WORD",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      word: this.currentWord,
      backgroundUrl: this.currentBackground,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;
  private static readonly MIN_ANSWER_DURATION_S = 5;

  private nextWord(): void {
    if (this.queue.length === 0) this.queue = shuffled(SPEED_WORDS);
    this.currentWord = this.queue.pop() ?? null;
    this.currentBackground = this.pickBackground();
    this.lastWinner = null;
    this.round += 1;
    this.phase = "QUESTION";

    const seconds = Math.max(SpeedWordEngine.MIN_ANSWER_DURATION_S, this.settings.answerDurationSeconds);
    this.phaseEndsAt = new Date(Date.now() + seconds * 1000);
    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), seconds * 1000);
    this.emitChange();
  }

  private pickBackground(): string | null {
    if (this.backgroundPool.length === 0) return null;
    return this.backgroundPool[Math.floor(Math.random() * this.backgroundPool.length)]!;
  }

  private reveal(): void {
    if (this.phase !== "QUESTION") return;
    this.clearTimer();
    this.phase = "REVEALED";
    this.phaseEndsAt = new Date(Date.now() + SpeedWordEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => this.nextWord(), SpeedWordEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.currentWord = null;
    this.currentBackground = null;
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
