import type { TriviaPlayer, TriviaSettings, TriviaState } from "@tikgames/shared-types";
import { normalizeAnswer } from "./textNormalize.js";
import { TRIVIA_QUESTIONS, type TriviaQuestion } from "./triviaQuestions.js";

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Trivia: no join step — any viewer comment while a question is live is checked as an answer
 * attempt against it; the first match wins the point. Questions are dealt from a shuffled queue
 * (reshuffled once exhausted) with a random background per question, drawn from the platform's
 * admin-curated image pool (streamers don't supply their own). After a correct answer or a
 * timeout, a short REVEALED pause shows the answer before the next question deals. The streamer
 * can stop at any time; whoever has the most points is the winner.
 */
export class TriviaEngine {
  readonly gameSessionId: string;
  private settings: TriviaSettings;
  private backgroundPool: string[];
  private scores = new Map<string, TriviaPlayer>();
  private phase: TriviaState["phase"] = "WAITING_TO_START";
  private round = 0;
  private queue: TriviaQuestion[] = [];
  private currentQuestion: TriviaQuestion | null = null;
  private currentBackground: string | null = null;
  private lastWinner: TriviaPlayer | null = null;
  private winner: TriviaPlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: TriviaState) => void;

  /** `backgroundPool` is a snapshot of the admin-curated image pool taken when the session
   *  starts — later admin edits apply to the next session started, not one already running. */
  constructor(
    gameSessionId: string,
    settings: TriviaSettings,
    backgroundPool: string[],
    onChange: (state: TriviaState) => void,
  ) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.backgroundPool = backgroundPool;
    this.onChange = onChange;
  }

  /** Registers a viewer's comment as an answer attempt. Returns whether it scored the point. */
  handleAnswer(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "QUESTION" || !this.currentQuestion) return false;
    const normalized = normalizeAnswer(text);
    if (!normalized) return false;
    const correct = this.currentQuestion.answers.some((a) => normalizeAnswer(a) === normalized);
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

  /** Single entry point for an incoming comment — mirrors MusicalChairsEngine's shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleAnswer(handle, displayName, avatarUrl, text);
  }

  /** Closes setup and deals question 1. */
  begin(): boolean {
    if (this.phase !== "WAITING_TO_START") return false;
    this.queue = shuffled(TRIVIA_QUESTIONS);
    this.nextQuestion();
    return true;
  }

  /** Force-ends the session early; the current top scorer (if any) is the winner. */
  stop(): void {
    if (this.phase !== "FINISHED") this.finish();
  }

  getState(): TriviaState {
    return {
      gameType: "TRIVIA",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.scores.values()].sort((a, b) => b.score - a.score),
      round: this.round,
      question: this.currentQuestion?.question ?? null,
      backgroundUrl: this.currentBackground,
      correctAnswer: this.currentQuestion?.answers[0] ?? null,
      lastWinner: this.lastWinner,
      winner: this.winner,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly REVEAL_DURATION_MS = 4000;
  private static readonly MIN_QUESTION_DURATION_S = 5;

  private nextQuestion(): void {
    if (this.queue.length === 0) this.queue = shuffled(TRIVIA_QUESTIONS);
    this.currentQuestion = this.queue.pop() ?? null;
    this.currentBackground = this.pickBackground();
    this.lastWinner = null;
    this.round += 1;
    this.phase = "QUESTION";

    const seconds = Math.max(TriviaEngine.MIN_QUESTION_DURATION_S, this.settings.answerDurationSeconds);
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
    this.phaseEndsAt = new Date(Date.now() + TriviaEngine.REVEAL_DURATION_MS);
    this.timer = setTimeout(() => this.nextQuestion(), TriviaEngine.REVEAL_DURATION_MS);
    this.emitChange();
  }

  private finish(): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.currentQuestion = null;
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
