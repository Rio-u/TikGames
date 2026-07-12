import { authedFetch, parseJsonOrThrow } from "./apiClient";

export type GameType =
  | "MUSICAL_CHAIRS"
  | "TRIVIA"
  | "GUESS_NUMBER"
  | "SPIN_WHEEL"
  | "WOULD_YOU_RATHER"
  | "FLAGS"
  | "CAPITALS"
  | "LOGOS"
  | "SPEED_WORD"
  | "MAZE";

export interface LiveSession {
  id: string;
  channelUsername: string;
  status: "PENDING" | "CONNECTING" | "LIVE" | "ENDED" | "ERROR";
  overlayToken: string;
  startedAt: string | null;
}

export interface MusicalChairsSettings {
  maxPlayers: number;
  joinCommand: string;
}

export interface TriviaSettings {
  answerDurationSeconds: number;
}

/** What the server actually sends back — the secret itself never appears here. */
export interface GuessNumberPublicSettings {
  hint: string;
  durationSeconds: number;
}

/** What the settings form builds and POSTs when creating a config — secret included. */
export interface GuessNumberSettings extends GuessNumberPublicSettings {
  secret: string;
}

export interface SpinWheelSettings {
  maxPlayers: number;
  joinCommand: string;
  pickSeconds: number;
}

export interface WouldYouRatherSettings {
  voteDurationSeconds: number;
}

export interface FlagsSettings {
  totalRounds: number;
  answerDurationSeconds: number;
}

export interface CapitalsSettings {
  totalRounds: number;
  answerDurationSeconds: number;
}

export interface LogosSettings {
  totalRounds: number;
  answerDurationSeconds: number;
}

export interface SpeedWordSettings {
  answerDurationSeconds: number;
}

export interface MazeSettings {
  maxPlayers: number;
  joinCommand: string;
  gridSize: number;
  durationSeconds: number;
}

export type GameConfig =
  | { id: string; name: string; gameType: "MUSICAL_CHAIRS"; settings: MusicalChairsSettings }
  | { id: string; name: string; gameType: "TRIVIA"; settings: TriviaSettings }
  | { id: string; name: string; gameType: "GUESS_NUMBER"; settings: GuessNumberSettings }
  | { id: string; name: string; gameType: "SPIN_WHEEL"; settings: SpinWheelSettings }
  | { id: string; name: string; gameType: "WOULD_YOU_RATHER"; settings: WouldYouRatherSettings }
  | { id: string; name: string; gameType: "FLAGS"; settings: FlagsSettings }
  | { id: string; name: string; gameType: "CAPITALS"; settings: CapitalsSettings }
  | { id: string; name: string; gameType: "LOGOS"; settings: LogosSettings }
  | { id: string; name: string; gameType: "SPEED_WORD"; settings: SpeedWordSettings };

export interface MusicalChairsPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  eliminatedAt: string | null;
  eliminatedRound: number | null;
}

export interface MusicalChairsChairClaim {
  chairNumber: number;
  handle: string;
}

export interface MusicalChairsState {
  gameType: "MUSICAL_CHAIRS";
  gameSessionId: string;
  phase: "WAITING_FOR_PLAYERS" | "RUNNING" | "CHOOSING" | "FINISHED";
  settings: MusicalChairsSettings;
  players: MusicalChairsPlayer[];
  round: number;
  winner: MusicalChairsPlayer | null;
  lastEliminated: MusicalChairsPlayer[];
  chairCount: number;
  chairClaims: MusicalChairsChairClaim[];
  phaseEndsAt: string | null;
  musicUrl: string | null;
}

export interface TriviaPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface TriviaState {
  gameType: "TRIVIA";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";
  settings: TriviaSettings;
  players: TriviaPlayer[];
  round: number;
  question: string | null;
  backgroundUrl: string | null;
  correctAnswer: string | null;
  lastWinner: TriviaPlayer | null;
  winner: TriviaPlayer | null;
  phaseEndsAt: string | null;
}

export interface GuessNumberPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  attempts: number;
}

export interface GuessNumberState {
  gameType: "GUESS_NUMBER";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "GUESSING" | "FINISHED";
  settings: GuessNumberPublicSettings;
  players: GuessNumberPlayer[];
  round: number;
  winner: GuessNumberPlayer | null;
  secret: string | null;
  phaseEndsAt: string | null;
}

export interface SpinWheelPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  number: number;
  joinedAt: string;
  eliminatedAt: string | null;
  eliminatedRound: number | null;
}

export type SpinWheelAction =
  | { type: "ELIMINATED"; via: "PICK" | "RANDOM" | "TIMEOUT"; picker: SpinWheelPlayer; target: SpinWheelPlayer }
  | { type: "SHIELD_BLOCKED"; via: "PICK" | "RANDOM" | "TIMEOUT"; picker: SpinWheelPlayer; target: SpinWheelPlayer }
  | { type: "WITHDREW"; picker: SpinWheelPlayer };

export interface SpinWheelState {
  gameType: "SPIN_WHEEL";
  gameSessionId: string;
  phase: "WAITING_FOR_PLAYERS" | "SPINNING" | "PICKING" | "RESULT" | "FINISHED";
  settings: SpinWheelSettings;
  players: SpinWheelPlayer[];
  round: number;
  winner: SpinWheelPlayer | null;
  selectedHandle: string | null;
  lastAction: SpinWheelAction | null;
  shieldsTotal: number;
  shieldsLeft: number;
  phaseEndsAt: string | null;
}

export interface WouldYouRatherOption {
  label: string;
  emoji: string;
}

export interface WouldYouRatherVoter {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WouldYouRatherState {
  gameType: "WOULD_YOU_RATHER";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "VOTING" | "RESULTS" | "FINISHED";
  settings: WouldYouRatherSettings;
  round: number;
  winner: WouldYouRatherVoter | null;
  optionA: WouldYouRatherOption | null;
  optionB: WouldYouRatherOption | null;
  votesA: number;
  votesB: number;
  recentVotersA: WouldYouRatherVoter[];
  recentVotersB: WouldYouRatherVoter[];
  resultSide: "A" | "B" | "TIE" | null;
  phaseEndsAt: string | null;
}

export interface FlagsPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface FlagsState {
  gameType: "FLAGS";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";
  settings: FlagsSettings;
  players: FlagsPlayer[];
  round: number;
  countryCode: string | null;
  countryName: string | null;
  lastWinner: FlagsPlayer | null;
  winner: FlagsPlayer | null;
  phaseEndsAt: string | null;
}

export interface CapitalsPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface CapitalsState {
  gameType: "CAPITALS";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";
  settings: CapitalsSettings;
  players: CapitalsPlayer[];
  round: number;
  countryCode: string | null;
  countryName: string | null;
  capitalName: string | null;
  lastWinner: CapitalsPlayer | null;
  winner: CapitalsPlayer | null;
  phaseEndsAt: string | null;
}

export interface LogosPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface LogosState {
  gameType: "LOGOS";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";
  settings: LogosSettings;
  players: LogosPlayer[];
  round: number;
  logoSlug: string | null;
  brandName: string | null;
  lastWinner: LogosPlayer | null;
  winner: LogosPlayer | null;
  phaseEndsAt: string | null;
}

export interface SpeedWordPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface SpeedWordState {
  gameType: "SPEED_WORD";
  gameSessionId: string;
  phase: "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";
  settings: SpeedWordSettings;
  players: SpeedWordPlayer[];
  round: number;
  word: string | null;
  backgroundUrl: string | null;
  lastWinner: SpeedWordPlayer | null;
  winner: SpeedWordPlayer | null;
  phaseEndsAt: string | null;
}

export interface MazePlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  x: number;
  y: number;
  hasUsedTrap: boolean;
}

export interface MazeState {
  gameType: "MAZE";
  gameSessionId: string;
  phase: "WAITING_FOR_PLAYERS" | "RACING" | "FINISHED";
  settings: MazeSettings;
  players: MazePlayer[];
  round: number;
  winner: MazePlayer | null;
  grid: { size: number; cells: number[][] };
  start: { x: number; y: number };
  exit: { x: number; y: number };
  lastTrap: { atX: number; atY: number; victimHandle: string } | null;
  phaseEndsAt: string | null;
}

export type GameState =
  | MusicalChairsState
  | TriviaState
  | GuessNumberState
  | SpinWheelState
  | WouldYouRatherState
  | FlagsState
  | CapitalsState
  | LogosState
  | SpeedWordState
  | MazeState;

export async function startLive(channelUsername: string) {
  const res = await authedFetch("/live/start", {
    method: "POST",
    body: JSON.stringify({ channelUsername }),
  });
  return parseJsonOrThrow(res) as Promise<{
    liveSessionId: string;
    overlayToken: string;
    channelUsername: string;
    status: LiveSession["status"];
  }>;
}

export async function stopLive() {
  const res = await authedFetch("/live/stop", { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function getCurrentLive() {
  const res = await authedFetch("/live/current");
  return parseJsonOrThrow(res) as Promise<{ liveSession: LiveSession | null }>;
}

export async function simulateComment(liveSessionId: string, viewerHandle: string, text: string, displayName?: string) {
  const res = await authedFetch(`/live/${liveSessionId}/simulate-comment`, {
    method: "POST",
    body: JSON.stringify({ viewerHandle, text, displayName }),
  });
  return parseJsonOrThrow(res);
}

export async function createGameConfig(
  gameType: GameType,
  name: string,
  settings:
    | MusicalChairsSettings
    | TriviaSettings
    | GuessNumberSettings
    | SpinWheelSettings
    | WouldYouRatherSettings
    | FlagsSettings
    | CapitalsSettings
    | LogosSettings
    | SpeedWordSettings,
) {
  const res = await authedFetch("/games/configs", {
    method: "POST",
    body: JSON.stringify({ gameType, name, settings }),
  });
  return parseJsonOrThrow(res) as Promise<{ config: GameConfig }>;
}

export async function listGameConfigs(gameType: GameType) {
  const res = await authedFetch(`/games/configs?gameType=${gameType}`);
  return parseJsonOrThrow(res) as Promise<{ configs: GameConfig[] }>;
}

export async function startGameSession(liveSessionId: string, gameType: GameType, gameConfigId?: string) {
  const res = await authedFetch("/games/session/start", {
    method: "POST",
    body: JSON.stringify({ liveSessionId, gameType, gameConfigId }),
  });
  return parseJsonOrThrow(res) as Promise<{ gameSessionId: string; state: GameState }>;
}

export async function beginGameSession(gameSessionId: string) {
  const res = await authedFetch(`/games/session/${gameSessionId}/begin`, { method: "POST" });
  return parseJsonOrThrow(res) as Promise<{ state: GameState }>;
}

export async function stopGameSession(gameSessionId: string) {
  const res = await authedFetch(`/games/session/${gameSessionId}/stop`, { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function getGameSessionState(gameSessionId: string) {
  const res = await authedFetch(`/games/session/${gameSessionId}`);
  return parseJsonOrThrow(res) as Promise<{ state: GameState | null }>;
}

/** Game types the admin has temporarily switched off — checked by the library grid and each
 *  control page before letting a streamer start a new session (the server enforces this too;
 *  this is purely so the UI can reflect it instead of surfacing a raw 400). */
export async function getDisabledGameTypes() {
  const res = await authedFetch("/games/toggles");
  return parseJsonOrThrow(res) as Promise<{ disabled: string[] }>;
}

export interface GameContentEntry {
  gameType: GameType;
  nameAr: string | null;
  descriptionAr: string | null;
  bioAr: string | null;
  rulesAr: string | null;
  imageUrl: string | null;
}

/** Admin-set overrides for a game's name/description/cover/bio/rules — sparse, only entries an
 *  admin has actually edited. See mergeGameContent for how these combine with the hardcoded
 *  GameDefinition defaults in data/games.ts. */
export async function getGameContent() {
  const res = await authedFetch("/games/content");
  return parseJsonOrThrow(res) as Promise<{ content: GameContentEntry[] }>;
}

export interface HomepageSettings {
  heroTitle: string | null;
  featuredGameTypes: GameType[];
}

/** Admin-set dashboard hero title + up to 3 spotlighted games — both independently optional. */
export async function getHomepageSettings() {
  const res = await authedFetch("/games/homepage");
  return parseJsonOrThrow(res) as Promise<HomepageSettings>;
}
