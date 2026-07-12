import type { MazePlayer, MazeSettings, MazeState } from "@tikgames/shared-types";

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;

const DX: Record<number, number> = { [NORTH]: 0, [EAST]: 1, [SOUTH]: 0, [WEST]: -1 };
const DY: Record<number, number> = { [NORTH]: -1, [EAST]: 0, [SOUTH]: 1, [WEST]: 0 };
const OPPOSITE: Record<number, number> = { [NORTH]: SOUTH, [EAST]: WEST, [SOUTH]: NORTH, [WEST]: EAST };
const DIGIT_TO_DIR: Record<string, number> = { "1": NORTH, "2": EAST, "3": SOUTH, "4": WEST };

/** Randomized recursive backtracker — always produces a "perfect" maze (exactly one path between
 *  any two cells), so the exit is guaranteed reachable from the start. */
function generateMaze(size: number): number[][] {
  const cells: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const visited: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  function carve(x: number, y: number): void {
    visited[y]![x] = true;
    const dirs = [NORTH, EAST, SOUTH, WEST];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j]!, dirs[i]!];
    }
    for (const dir of dirs) {
      const nx = x + DX[dir]!;
      const ny = y + DY[dir]!;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (visited[ny]![nx]) continue;
      cells[y]![x] = (cells[y]![x] ?? 0) | dir;
      cells[ny]![nx] = (cells[ny]![nx] ?? 0) | OPPOSITE[dir]!;
      carve(nx, ny);
    }
  }

  carve(0, 0);
  return cells;
}

/** Arabic-Indic and Persian digits → ASCII, so "٢" counts as moving east. */
function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/**
 * Maze: viewers join by commenting the configured join command (default "!دخول") while
 * WAITING_FOR_PLAYERS. Once RACING, everyone starts at the same cell and moves by commenting
 * 1/2/3/4 (N/E/S/W) — blocked by a wall, or invalid, is a silent no-op. Each player can drop one
 * hidden trap at their current cell via "!فخ"; another player who steps onto it gets sent back to
 * the start. First to reach the exit wins and ends the race immediately.
 */
export class MazeEngine {
  readonly gameSessionId: string;
  private settings: MazeSettings;
  private players = new Map<string, MazePlayer>();
  private phase: MazeState["phase"] = "WAITING_FOR_PLAYERS";
  private winner: MazePlayer | null = null;
  private phaseEndsAt: Date | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (state: MazeState) => void;

  private readonly grid: number[][];
  private readonly start = { x: 0, y: 0 };
  private readonly exit: { x: number; y: number };
  /** "x,y" -> owner handle. Never exposed via getState() — see MazeState.lastTrap's doc comment. */
  private traps = new Map<string, string>();
  private lastTrap: { atX: number; atY: number; victimHandle: string } | null = null;

  constructor(gameSessionId: string, settings: MazeSettings, onChange: (state: MazeState) => void) {
    this.gameSessionId = gameSessionId;
    this.settings = settings;
    this.onChange = onChange;
    this.grid = generateMaze(settings.gridSize);
    this.exit = { x: settings.gridSize - 1, y: settings.gridSize - 1 };
  }

  handleJoin(handle: string, displayName: string, avatarUrl: string | null, text: string): boolean {
    if (this.phase !== "WAITING_FOR_PLAYERS") return false;
    if (!text.trim().startsWith(this.settings.joinCommand)) return false;
    if (this.players.has(handle)) return false;
    if (this.players.size >= this.settings.maxPlayers) return false;

    this.players.set(handle, {
      handle,
      displayName,
      avatarUrl,
      x: this.start.x,
      y: this.start.y,
      hasUsedTrap: false,
    });
    this.emitChange();
    return true;
  }

  /** Drops a single-use trap at the player's current cell — never at the start or exit. */
  handleTrap(handle: string, text: string): boolean {
    if (this.phase !== "RACING") return false;
    if (text.trim() !== "!فخ") return false;
    const player = this.players.get(handle);
    if (!player || player.hasUsedTrap) return false;
    if (player.x === this.start.x && player.y === this.start.y) return false;
    if (player.x === this.exit.x && player.y === this.exit.y) return false;
    const key = `${player.x},${player.y}`;
    if (this.traps.has(key)) return false;

    this.traps.set(key, handle);
    player.hasUsedTrap = true;
    this.emitChange();
    return true;
  }

  handleMove(handle: string, text: string): boolean {
    if (this.phase !== "RACING") return false;
    const player = this.players.get(handle);
    if (!player) return false;

    const trimmed = normalizeDigits(text.trim());
    const dir = DIGIT_TO_DIR[trimmed];
    if (!dir) return false;

    const cellWalls = this.grid[player.y]![player.x]!;
    if ((cellWalls & dir) === 0) return false; // wall blocks this direction

    const nx = player.x + DX[dir]!;
    const ny = player.y + DY[dir]!;

    const trapKey = `${nx},${ny}`;
    const trapOwner = this.traps.get(trapKey);
    if (trapOwner && trapOwner !== handle) {
      this.traps.delete(trapKey);
      player.x = this.start.x;
      player.y = this.start.y;
      this.lastTrap = { atX: nx, atY: ny, victimHandle: handle };
      this.emitChange();
      this.lastTrap = null;
      return true;
    }

    player.x = nx;
    player.y = ny;

    if (nx === this.exit.x && ny === this.exit.y) {
      this.finish(player);
      return true;
    }

    this.emitChange();
    return true;
  }

  handleComment(handle: string, displayName: string, avatarUrl: string | null, text: string): void {
    this.handleJoin(handle, displayName, avatarUrl, text);
    this.handleTrap(handle, text);
    this.handleMove(handle, text);
  }

  /** Closes joining and starts the race. Needs at least 2 players. */
  begin(): boolean {
    if (this.phase !== "WAITING_FOR_PLAYERS") return false;
    if (this.players.size < 2) return false;
    this.phase = "RACING";
    this.phaseEndsAt = new Date(Date.now() + this.settings.durationSeconds * 1000);
    this.timer = setTimeout(() => this.finish(null), this.settings.durationSeconds * 1000);
    this.emitChange();
    return true;
  }

  /** Force-ends the session early (e.g. the streamer cancels mid-race). */
  stop(): void {
    this.clearTimer();
    if (this.phase !== "FINISHED") {
      this.phase = "FINISHED";
      this.phaseEndsAt = null;
      this.emitChange();
    }
  }

  getState(): MazeState {
    return {
      gameType: "MAZE",
      gameSessionId: this.gameSessionId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()],
      round: 1,
      winner: this.winner,
      grid: { size: this.settings.gridSize, cells: this.grid },
      start: this.start,
      exit: this.exit,
      lastTrap: this.lastTrap,
      phaseEndsAt: this.phaseEndsAt ? this.phaseEndsAt.toISOString() : null,
    };
  }

  private finish(winner: MazePlayer | null): void {
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
