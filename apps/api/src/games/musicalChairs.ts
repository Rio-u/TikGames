import type { MusicalChairsPlayer, MusicalChairsSettings, MusicalChairsState } from "@tikgames/shared-types";

/**
 * Musical Chairs: viewers join by commenting the configured join command (default "!ادخل")
 * while WAITING_FOR_PLAYERS, under the configured player cap. Each round alternates two
 * phases: RUNNING ("music" plays for a fixed duration, no input needed) then CHOOSING (music
 * stops — one fewer chair than players left, and players race to comment the chair number
 * they want; first valid, still-free number wins it, and a rejected guess can just be retried).
 * When the window closes, anyone without a claimed chair is eliminated — that can be more than
 * one player if several were too slow. Repeats until a single winner remains.
 */
export class MusicalChairsEngine {
  readonly gameSessionId: string;
  private settings: MusicalChairsSettings;
  private players = new Map<string, MusicalChairsPlayer>();
  private phase: MusicalChairsState["phase"] = "WAITING_FOR_PLAYERS";
  private round = 0;
  private winner: MusicalChairsPlayer | null = null;
  private lastEliminated: MusicalChairsPlayer[] = [];
  private chairCount = 0;
  private claims = new Map<string, number>(); // handle -> chairNumber, reset every round
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: MusicalChairsState) => void;
  private readonly musicUrl: string | null;

  constructor(
    gameSessionId: string,
    settings: MusicalChairsSettings,
    musicPool: string[],
    onChange: (state: MusicalChairsState) => void,
  ) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
    // Picked once for the whole session (not re-rolled every round) — same track restarting each
    // round reads as "the music," re-randomizing would just feel like shuffling mid-game.
    this.musicUrl = musicPool.length ? musicPool[Math.floor(Math.random() * musicPool.length)]! : null;
  }

  /** Registers a viewer's comment as a join attempt. Returns whether it actually joined. */
  handleJoin(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "WAITING_FOR_PLAYERS") return false;
    if (!text.trim().startsWith(this.settings.joinCommand)) return false;
    if (this.players.has(handle)) return false;
    if (this.players.size >= this.settings.maxPlayers) return false;

    this.players.set(handle, {
      handle,
      displayName,
      avatarUrl,
      joinedAt: new Date().toISOString(),
      eliminatedAt: null,
      eliminatedRound: null,
    });
    this.emitChange();
    return true;
  }

  /**
   * Registers a viewer's comment as a chair-claim attempt during the CHOOSING window. A player
   * who already secured a chair this round, or a number that's invalid/already taken, is a
   * silent no-op — the point is the player can just send another comment and try again.
   */
  handleChairChoice(handle: string, text: string): boolean {
    if (this.phase !== "CHOOSING") return false;
    const player = this.players.get(handle);
    if (!player || player.eliminatedAt) return false;
    if (this.claims.has(handle)) return false;

    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return false;
    const chairNumber = Number(trimmed);
    if (chairNumber < 1 || chairNumber > this.chairCount) return false;
    if ([...this.claims.values()].includes(chairNumber)) return false;

    this.claims.set(handle, chairNumber);
    this.emitChange();
    return true;
  }

  /** Single entry point for an incoming comment — mirrors TriviaEngine's shape so the ingestion
   *  layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleJoin(handle, displayName, avatarUrl, text);
    this.handleChairChoice(handle, text);
  }

  /** Closes joining and starts the elimination rounds. Needs at least 2 players. */
  begin(): boolean {
    if (this.phase !== "WAITING_FOR_PLAYERS") return false;
    if (this.players.size < 2) return false;
    this.startMusicPhase();
    return true;
  }

  /** Force-ends the session early (e.g. the streamer cancels mid-game). */
  stop(): void {
    this.clearTimer();
    if (this.phase !== "FINISHED") {
      this.phase = "FINISHED";
      this.phaseEndsAt = null;
      this.emitChange();
    }
  }

  getState(): MusicalChairsState {
    return {
      gameType: "MUSICAL_CHAIRS",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()],
      round: this.round,
      winner: this.winner,
      lastEliminated: this.lastEliminated,
      chairCount: this.chairCount,
      chairClaims: [...this.claims.entries()].map(([handle, chairNumber]) => ({ chairNumber, handle })),
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
      musicUrl: this.musicUrl,
    };
  }

  private static readonly MUSIC_DURATION_MS = 7000;
  private static readonly CHOOSING_DURATION_MS = 5000;

  private activePlayers(): MusicalChairsPlayer[] {
    return [...this.players.values()].filter((p) => !p.eliminatedAt);
  }

  /** "Music" plays: no input accepted, just a fixed pause before chairs open up for claims. */
  private startMusicPhase(): void {
    const remaining = this.activePlayers();
    this.phase = "RUNNING";
    this.chairCount = remaining.length - 1;
    this.claims.clear();
    this.phaseEndsAt = new Date(Date.now() + MusicalChairsEngine.MUSIC_DURATION_MS);
    this.timer = setTimeout(() => this.startChoosingPhase(), MusicalChairsEngine.MUSIC_DURATION_MS);
    this.emitChange();
  }

  /** "Music" stops: chairs are open, players race to comment a chair number. */
  private startChoosingPhase(): void {
    if (this.phase !== "RUNNING") return;
    this.phase = "CHOOSING";
    this.phaseEndsAt = new Date(Date.now() + MusicalChairsEngine.CHOOSING_DURATION_MS);
    this.timer = setTimeout(() => this.resolveRound(), MusicalChairsEngine.CHOOSING_DURATION_MS);
    this.emitChange();
  }

  private resolveRound(): void {
    if (this.phase !== "CHOOSING") return;
    const remaining = this.activePlayers();

    // Nobody claimed a single chair (chat lag, everyone slow) — replay the window instead of
    // wiping out the whole lobby on what's more likely a fluke than a real elimination.
    if (this.claims.size === 0) {
      this.phaseEndsAt = new Date(Date.now() + MusicalChairsEngine.CHOOSING_DURATION_MS);
      this.timer = setTimeout(() => this.resolveRound(), MusicalChairsEngine.CHOOSING_DURATION_MS);
      this.emitChange();
      return;
    }

    this.round += 1;
    const withoutChair = remaining.filter((p) => !this.claims.has(p.handle));
    const now = new Date().toISOString();
    for (const p of withoutChair) {
      p.eliminatedAt = now;
      p.eliminatedRound = this.round;
    }
    this.lastEliminated = withoutChair;

    const stillIn = remaining.filter((p) => this.claims.has(p.handle));
    if (stillIn.length <= 1) {
      this.finish(stillIn[0] ?? null);
      return;
    }

    this.startMusicPhase();
  }

  private finish(winner: MusicalChairsPlayer | null): void {
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
