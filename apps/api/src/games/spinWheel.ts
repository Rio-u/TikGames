import type {
  SpinWheelAction,
  SpinWheelActionVia,
  SpinWheelPlayer,
  SpinWheelSettings,
  SpinWheelState,
} from "@tikgames/shared-types";

/** Arabic-Indic and Persian digits → ASCII, so "٣" counts as picking player 3. */
function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/**
 * Spin Wheel (عجلة الحظ): viewers join with the configured command; each player gets a permanent
 * visible number. Every round the wheel spins (SPINNING — the server picks the target up front,
 * clients animate the wheel to land on them at phaseEndsAt), then the chosen player types the
 * number of whoever they want to eliminate (PICKING). "0" withdraws themselves instead, "00"
 * eliminates a random other player, and a timeout resolves as a random elimination so an AFK
 * picker never stalls the game. One hidden shield is dealt per 5 starting players — holders are
 * engine-private and only revealed when someone tries to eliminate them: the shield burns, the
 * target survives, the picker's turn is wasted. Last player standing wins.
 */
export class SpinWheelEngine {
  readonly gameSessionId: string;
  private settings: SpinWheelSettings;
  private players = new Map<string, SpinWheelPlayer>();
  private phase: SpinWheelState["phase"] = "WAITING_FOR_PLAYERS";
  private round = 0;
  private winner: SpinWheelPlayer | null = null;
  private selectedHandle: string | null = null;
  private lastAction: SpinWheelAction | null = null;
  /** Handles holding an unbroken shield. Never serialized into state — see getState(). */
  private shields = new Set<string>();
  private shieldsTotal = 0;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: SpinWheelState) => void;

  constructor(gameSessionId: string, settings: SpinWheelSettings, onChange: (state: SpinWheelState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
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
      number: this.players.size + 1,
      joinedAt: new Date().toISOString(),
      eliminatedAt: null,
      eliminatedRound: null,
    });
    this.emitChange();
    return true;
  }

  /**
   * Registers the selected player's comment as their elimination pick during PICKING. Anything
   * invalid (not the selected player, non-numeric text, a number that doesn't map to another
   * still-in player) is a silent no-op — they can just comment again.
   */
  handlePick(handle: string, text: string): boolean {
    if (this.phase !== "PICKING") return false;
    if (handle !== this.selectedHandle) return false;
    const picker = this.players.get(handle);
    if (!picker || picker.eliminatedAt) return false;

    const trimmed = normalizeDigits(text.trim());
    if (!/^\d+$/.test(trimmed)) return false;

    if (trimmed === "00") {
      this.resolveAttack(picker, this.randomTargetExcept(picker), "RANDOM");
      return true;
    }
    if (trimmed === "0") {
      this.withdraw(picker);
      return true;
    }

    const number = Number(trimmed);
    const target = this.activePlayers().find((p) => p.number === number);
    if (!target || target.handle === picker.handle) return false;
    this.resolveAttack(picker, target, "PICK");
    return true;
  }

  /** Single entry point for an incoming comment — mirrors the other engines' shape so the
   *  ingestion layer doesn't need to know which game type it's talking to. */
  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleJoin(handle, displayName, avatarUrl, text);
    this.handlePick(handle, text);
  }

  /** Closes joining, deals the hidden shields, and spins for the first time. Needs 2+ players. */
  begin(): boolean {
    if (this.phase !== "WAITING_FOR_PLAYERS") return false;
    if (this.players.size < 2) return false;
    this.dealShields();
    this.startSpinPhase();
    return true;
  }

  /** Force-ends the session early (e.g. the streamer cancels mid-game). Idempotent. */
  stop(): void {
    this.clearTimer();
    if (this.phase !== "FINISHED") {
      this.phase = "FINISHED";
      this.phaseEndsAt = null;
      this.emitChange();
    }
  }

  getState(): SpinWheelState {
    return {
      gameType: "SPIN_WHEEL",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()],
      round: this.round,
      winner: this.winner,
      selectedHandle: this.selectedHandle,
      lastAction: this.lastAction,
      shieldsTotal: this.shieldsTotal,
      shieldsLeft: this.shields.size,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private static readonly SPIN_DURATION_MS = 5500;
  private static readonly RESULT_DURATION_MS = 5000;
  private static readonly PLAYERS_PER_SHIELD = 5;

  private activePlayers(): SpinWheelPlayer[] {
    return [...this.players.values()].filter((p) => !p.eliminatedAt);
  }

  /** One hidden shield per 5 starting players (10 → 2), dealt to distinct random players. */
  private dealShields(): void {
    const pool = this.activePlayers();
    this.shieldsTotal = Math.floor(pool.length / SpinWheelEngine.PLAYERS_PER_SHIELD);
    for (let i = 0; i < this.shieldsTotal; i++) {
      const unshielded = pool.filter((p) => !this.shields.has(p.handle));
      const lucky = unshielded[Math.floor(Math.random() * unshielded.length)];
      if (lucky) this.shields.add(lucky.handle);
    }
  }

  /** The wheel spins: the server picks the target now; clients animate toward it until phaseEndsAt. */
  private startSpinPhase(): void {
    const actives = this.activePlayers();
    this.round += 1;
    this.phase = "SPINNING";
    this.lastAction = null;
    this.selectedHandle = actives[Math.floor(Math.random() * actives.length)]!.handle;
    this.phaseEndsAt = new Date(Date.now() + SpinWheelEngine.SPIN_DURATION_MS);
    this.clearTimer();
    this.timer = setTimeout(() => this.startPickingPhase(), SpinWheelEngine.SPIN_DURATION_MS);
    this.emitChange();
  }

  /** The wheel stopped: the selected player types a number (or 0 / 00) before the window closes. */
  private startPickingPhase(): void {
    if (this.phase !== "SPINNING") return;
    this.phase = "PICKING";
    this.phaseEndsAt = new Date(Date.now() + this.settings.pickSeconds * 1000);
    this.timer = setTimeout(() => this.onPickTimeout(), this.settings.pickSeconds * 1000);
    this.emitChange();
  }

  /** An AFK picker never stalls the game — the timeout resolves as a random elimination. */
  private onPickTimeout(): void {
    if (this.phase !== "PICKING") return;
    const picker = this.selectedHandle ? this.players.get(this.selectedHandle) : null;
    if (!picker) return;
    this.resolveAttack(picker, this.randomTargetExcept(picker), "TIMEOUT");
  }

  private randomTargetExcept(picker: SpinWheelPlayer): SpinWheelPlayer {
    const pool = this.activePlayers().filter((p) => p.handle !== picker.handle);
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  /** An elimination attempt lands: either the target's hidden shield burns (they survive, the
   *  picker's turn is wasted) or they're out. Both paths show through the RESULT phase. */
  private resolveAttack(picker: SpinWheelPlayer, target: SpinWheelPlayer, via: SpinWheelActionVia): void {
    if (this.shields.has(target.handle)) {
      this.shields.delete(target.handle);
      this.lastAction = { type: "SHIELD_BLOCKED", via, picker, target };
    } else {
      target.eliminatedAt = new Date().toISOString();
      target.eliminatedRound = this.round;
      this.lastAction = { type: "ELIMINATED", via, picker, target };
    }
    this.startResultPhase();
  }

  /** "0": the picker spares everyone and leaves the game themselves (their shield, if any, dies too). */
  private withdraw(picker: SpinWheelPlayer): void {
    picker.eliminatedAt = new Date().toISOString();
    picker.eliminatedRound = this.round;
    this.shields.delete(picker.handle);
    this.lastAction = { type: "WITHDREW", picker };
    this.startResultPhase();
  }

  private startResultPhase(): void {
    this.phase = "RESULT";
    this.phaseEndsAt = new Date(Date.now() + SpinWheelEngine.RESULT_DURATION_MS);
    this.clearTimer();
    this.timer = setTimeout(() => this.afterResult(), SpinWheelEngine.RESULT_DURATION_MS);
    this.emitChange();
  }

  private afterResult(): void {
    if (this.phase !== "RESULT") return;
    const actives = this.activePlayers();
    if (actives.length <= 1) {
      this.finish(actives[0] ?? null);
      return;
    }
    this.startSpinPhase();
  }

  private finish(winner: SpinWheelPlayer | null): void {
    this.clearTimer();
    this.phase = "FINISHED";
    this.winner = winner;
    this.selectedHandle = null;
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
