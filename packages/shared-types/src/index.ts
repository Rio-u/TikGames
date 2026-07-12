// --- Live source abstraction ---------------------------------------------------
// TikTok has no official API for live comments — apps/tiktok-connector wraps the unofficial
// `tiktok-live-connector` library. This contract exists so apps/api never talks to TikTok
// directly: a future `kick-connector` service (Kick has a real, documented events API) can
// implement the same shape without touching apps/api.

export type LiveSourcePlatform = "TIKTOK" | "KICK";

export interface NormalizedViewer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface LiveCommentEvent {
  type: "comment";
  liveSessionId: string;
  viewer: NormalizedViewer;
  text: string;
  at: string;
}

export interface LiveGiftEvent {
  type: "gift";
  liveSessionId: string;
  viewer: NormalizedViewer;
  giftId: string;
  repeatCount: number;
  at: string;
}

export interface LiveLikeEvent {
  type: "like";
  liveSessionId: string;
  viewer: NormalizedViewer;
  count: number;
  at: string;
}

export interface LiveFollowEvent {
  type: "follow";
  liveSessionId: string;
  viewer: NormalizedViewer;
  at: string;
}

export type LiveEvent = LiveCommentEvent | LiveGiftEvent | LiveLikeEvent | LiveFollowEvent;

export type LiveConnectionStatus = "CONNECTING" | "LIVE" | "ENDED" | "ERROR";

export interface LiveStatusUpdate {
  liveSessionId: string;
  status: LiveConnectionStatus;
  message?: string;
}

export interface LiveAlert {
  liveSessionId: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  detail?: unknown;
}

/**
 * Room-level stats (not a viewer action like the events above) — live viewer count plus
 * best-effort profile info for the channel currently being watched. Deliberately never
 * persisted: `viewerCount` ticks every time TikTok fires a room-user update (every few seconds
 * while live), so this is relayed straight through, not written to the database on every tick
 * the way `LiveStatusUpdate` is. Any field can be `null` — the connector's `roomInfo` is an
 * untyped, unofficial API surface, so a client showing this must hide a stat it doesn't have
 * rather than fake a value.
 */
export interface LiveRoomStats {
  liveSessionId: string;
  viewerCount: number | null;
  followerCount: number | null;
  avatarUrl: string | null;
  displayName: string | null;
}

/**
 * Contract every live-chat source (TikTok today, Kick later) implements. A connector is an
 * event emitter with (at minimum) these four events: "event" (LiveEvent), "status"
 * (LiveStatusUpdate), "alert" (LiveAlert), "roomStats" (LiveRoomStats) — kept as a comment
 * rather than strict `on()` overloads since the real implementation is a plain Node EventEmitter
 * subclass.
 */
export interface LiveSourceConnector {
  platform: LiveSourcePlatform;
  watch(liveSessionId: string, channelUsername: string): Promise<void>;
  unwatch(liveSessionId: string): Promise<void>;
}

// --- Internal connector <-> API socket contract ---------------------------------

export const INTERNAL_NAMESPACE = "/internal";

export const InternalSocketEvents = {
  WatchStart: "watch:start",
  WatchStop: "watch:stop",
  LiveEvent: "live:event",
  LiveStatus: "live:status",
  LiveAlert: "live:alert",
  LiveRoomStats: "live:roomStats",
} as const;

export interface WatchStartCommand {
  liveSessionId: string;
  channelUsername: string;
}

export interface WatchStopCommand {
  liveSessionId: string;
}

// --- Game engine shared types ----------------------------------------------------

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
  | "MAZE"
  | "DRAWING";

export const GAME_TYPES: GameType[] = [
  "MUSICAL_CHAIRS",
  "TRIVIA",
  "GUESS_NUMBER",
  "SPIN_WHEEL",
  "WOULD_YOU_RATHER",
  "FLAGS",
  "CAPITALS",
  "LOGOS",
  "SPEED_WORD",
  "MAZE",
  "DRAWING",
];

export interface MusicalChairsSettings {
  maxPlayers: number;
  /** Chat command that registers a join during WAITING_FOR_PLAYERS, e.g. "!ادخل". */
  joinCommand: string;
}

export type MusicalChairsPhase = "WAITING_FOR_PLAYERS" | "RUNNING" | "CHOOSING" | "FINISHED";

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
  phase: MusicalChairsPhase;
  settings: MusicalChairsSettings;
  players: MusicalChairsPlayer[];
  round: number;
  winner: MusicalChairsPlayer | null;
  /** Players who ended up without a chair when the last CHOOSING window closed (can be more than one). */
  lastEliminated: MusicalChairsPlayer[];
  /** Chairs available this round (always one fewer than players still in). */
  chairCount: number;
  /** Claims made so far in the current CHOOSING window; reset every round. */
  chairClaims: MusicalChairsChairClaim[];
  /** When the current phase (RUNNING music / CHOOSING window) ends, server-authoritative. */
  phaseEndsAt: string | null;
  /** Admin-curated track picked once for this session, played client-side while phase is RUNNING. Null if the pool was empty. */
  musicUrl: string | null;
}

// --- Trivia game engine -----------------------------------------------------------

export interface TriviaSettings {
  answerDurationSeconds: number;
}

export type TriviaPhase = "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";

export interface TriviaPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface TriviaState {
  gameType: "TRIVIA";
  gameSessionId: string;
  phase: TriviaPhase;
  settings: TriviaSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: TriviaPlayer[];
  round: number;
  question: string | null;
  backgroundUrl: string | null;
  correctAnswer: string | null;
  lastWinner: TriviaPlayer | null;
  winner: TriviaPlayer | null;
  phaseEndsAt: string | null;
}

// --- Guess Number/Word game engine -------------------------------------------------

export interface GuessNumberSettings {
  /** The secret itself. Stored in GameConfig for the streamer's own reuse, but this exact field
   *  never appears in GuessNumberState.settings (see GuessNumberPublicSettings) or gets
   *  broadcast to anyone — the engine only ever exposes it via the top-level `secret` field,
   *  and only once phase is FINISHED. */
  secret: string;
  /** Optional clue shown to viewers, e.g. "حيوان أليف" for the secret "قطة". */
  hint: string;
  durationSeconds: number;
}

/** What actually goes out over the wire in GuessNumberState.settings — secret redacted. */
export type GuessNumberPublicSettings = Omit<GuessNumberSettings, "secret">;

export type GuessNumberPhase = "WAITING_TO_START" | "GUESSING" | "FINISHED";

export interface GuessNumberPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  attempts: number;
}

export interface GuessNumberState {
  gameType: "GUESS_NUMBER";
  gameSessionId: string;
  phase: GuessNumberPhase;
  settings: GuessNumberPublicSettings;
  /** Everyone who has guessed at least once, ranked by attempts (most persistent first). */
  players: GuessNumberPlayer[];
  round: number;
  winner: GuessNumberPlayer | null;
  /** The secret itself — null until FINISHED (won or timed out), then revealed for everyone. */
  secret: string | null;
  phaseEndsAt: string | null;
}

// --- Spin Wheel (عجلة الحظ) game engine ---------------------------------------------

export interface SpinWheelSettings {
  maxPlayers: number;
  /** Chat command that registers a join during WAITING_FOR_PLAYERS, e.g. "!ادخل". */
  joinCommand: string;
  /** How long the selected player gets to type a target number before the system picks randomly. */
  pickSeconds: number;
}

export type SpinWheelPhase = "WAITING_FOR_PLAYERS" | "SPINNING" | "PICKING" | "RESULT" | "FINISHED";

export interface SpinWheelPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** Permanent 1-based number (join order) — what a picker types to eliminate this player. */
  number: number;
  joinedAt: string;
  eliminatedAt: string | null;
  eliminatedRound: number | null;
}

/** How the current round's elimination came about — drives the RESULT-phase reveal. */
export type SpinWheelActionVia = "PICK" | "RANDOM" | "TIMEOUT";

export type SpinWheelAction =
  | { type: "ELIMINATED"; via: SpinWheelActionVia; picker: SpinWheelPlayer; target: SpinWheelPlayer }
  | { type: "SHIELD_BLOCKED"; via: SpinWheelActionVia; picker: SpinWheelPlayer; target: SpinWheelPlayer }
  | { type: "WITHDREW"; picker: SpinWheelPlayer };

export interface SpinWheelState {
  gameType: "SPIN_WHEEL";
  gameSessionId: string;
  phase: SpinWheelPhase;
  settings: SpinWheelSettings;
  players: SpinWheelPlayer[];
  round: number;
  winner: SpinWheelPlayer | null;
  /** Whom the wheel landed on this round — set when SPINNING starts; clients time the wheel
   *  animation to land on this player exactly at phaseEndsAt. */
  selectedHandle: string | null;
  /** What resolved the last PICKING phase — rendered big during RESULT. */
  lastAction: SpinWheelAction | null;
  /** Shield counts are public (builds tension); *who* holds them stays engine-private and only
   *  ever surfaces through a SHIELD_BLOCKED action. */
  shieldsTotal: number;
  shieldsLeft: number;
  phaseEndsAt: string | null;
}

// --- Would You Rather (إما / أو) game engine -----------------------------------------

export interface WouldYouRatherSettings {
  voteDurationSeconds: number;
}

export type WouldYouRatherPhase = "WAITING_TO_START" | "VOTING" | "RESULTS" | "FINISHED";

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
  phase: WouldYouRatherPhase;
  settings: WouldYouRatherSettings;
  round: number;
  /** No roster and no scoring in this game — always null, FINISHED just shows a wrap-up card. */
  winner: WouldYouRatherVoter | null;
  optionA: WouldYouRatherOption | null;
  optionB: WouldYouRatherOption | null;
  votesA: number;
  votesB: number;
  /** Newest-first, capped — enough to render a little avatar pile under each card. */
  recentVotersA: WouldYouRatherVoter[];
  recentVotersB: WouldYouRatherVoter[];
  /** Which side won the vote — set while RESULTS shows, null otherwise. */
  resultSide: "A" | "B" | "TIE" | null;
  phaseEndsAt: string | null;
}

// --- Flags (أعلام) game engine -------------------------------------------------------

export interface FlagsSettings {
  /** How many flags this session shows before it auto-finishes — this game is round-bounded,
   *  unlike Trivia's open-ended "runs until stopped". */
  totalRounds: number;
  answerDurationSeconds: number;
}

export type FlagsPhase = "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";

export interface FlagsPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface FlagsState {
  gameType: "FLAGS";
  gameSessionId: string;
  phase: FlagsPhase;
  settings: FlagsSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: FlagsPlayer[];
  round: number;
  /** ISO 3166-1 alpha-2 country code, lowercase — clients render it via `flag-icons`' `fi-<code>`
   *  class, never an emoji (Windows/Chrome and OBS's Chromium Embedded Framework routinely fail
   *  to render Unicode flag emoji, silently falling back to the two-letter code as plain text). */
  countryCode: string | null;
  countryName: string | null;
  lastWinner: FlagsPlayer | null;
  winner: FlagsPlayer | null;
  phaseEndsAt: string | null;
}

// --- Capitals (عواصم) game engine ----------------------------------------------------

export interface CapitalsSettings {
  /** How many countries this session asks about before it auto-finishes — same round-bounded
   *  shape as Flags, this game's closest sibling. */
  totalRounds: number;
  answerDurationSeconds: number;
}

export type CapitalsPhase = "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";

export interface CapitalsPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface CapitalsState {
  gameType: "CAPITALS";
  gameSessionId: string;
  phase: CapitalsPhase;
  settings: CapitalsSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: CapitalsPlayer[];
  round: number;
  /** ISO 3166-1 alpha-2 country code — clients reuse Flags' own `/flags/<code>.svg` assets, no
   *  separate image set to manage. */
  countryCode: string | null;
  countryName: string | null;
  capitalName: string | null;
  lastWinner: CapitalsPlayer | null;
  winner: CapitalsPlayer | null;
  phaseEndsAt: string | null;
}

// --- Logos (شعارات) game engine -------------------------------------------------------

export interface LogosSettings {
  /** How many logos this session shows before it auto-finishes — same round-bounded shape as
   *  Flags/Capitals. */
  totalRounds: number;
  answerDurationSeconds: number;
}

export type LogosPhase = "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";

export interface LogosPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface LogosState {
  gameType: "LOGOS";
  gameSessionId: string;
  phase: LogosPhase;
  settings: LogosSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: LogosPlayer[];
  round: number;
  /** `simple-icons` slug — clients render `/logos/<slug>.svg`. */
  logoSlug: string | null;
  brandName: string | null;
  lastWinner: LogosPlayer | null;
  winner: LogosPlayer | null;
  phaseEndsAt: string | null;
}

// --- Speed Word (أسرع) game engine ----------------------------------------------------

export interface SpeedWordSettings {
  answerDurationSeconds: number;
}

export type SpeedWordPhase = "WAITING_TO_START" | "QUESTION" | "REVEALED" | "FINISHED";

export interface SpeedWordPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface SpeedWordState {
  gameType: "SPEED_WORD";
  gameSessionId: string;
  phase: SpeedWordPhase;
  settings: SpeedWordSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: SpeedWordPlayer[];
  round: number;
  /** The word itself is never hidden — unlike Trivia's question/answer split, what's shown *is*
   *  the target text a viewer races to retype, so there's no separate "correctAnswer" field. */
  word: string | null;
  backgroundUrl: string | null;
  lastWinner: SpeedWordPlayer | null;
  winner: SpeedWordPlayer | null;
  phaseEndsAt: string | null;
}

// --- Maze (متاهة) game engine ---------------------------------------------------------

export interface MazeSettings {
  maxPlayers: number;
  /** Chat command that registers a join during WAITING_FOR_PLAYERS, e.g. "!دخول". */
  joinCommand: string;
  /** Maze is gridSize × gridSize cells. */
  gridSize: number;
  /** Safety cap — if nobody reaches the exit in time, the race ends with no winner. */
  durationSeconds: number;
}

export type MazePhase = "WAITING_FOR_PLAYERS" | "RACING" | "FINISHED";

export interface MazePlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  x: number;
  y: number;
  /** Each player gets exactly one trap for the whole race. */
  hasUsedTrap: boolean;
}

export interface MazeState {
  gameType: "MAZE";
  gameSessionId: string;
  phase: MazePhase;
  settings: MazeSettings;
  players: MazePlayer[];
  round: number;
  winner: MazePlayer | null;
  /** One 4-bit wall-bitmask per cell: 1=N open, 2=E open, 4=S open, 8=W open. Generated once per
   *  session as a perfect maze (recursive backtracker), so it's always solvable. */
  grid: { size: number; cells: number[][] };
  start: { x: number; y: number };
  exit: { x: number; y: number };
  /** Traps themselves are never in this state (like GuessNumberState.secret pre-FINISHED) — there
   *  is no per-namespace filtering anywhere in this codebase, so a trap visible to its owner would
   *  be visible to everyone. This field only flashes for one broadcast when a trap triggers, then
   *  self-clears, carrying no owner identity — just enough for a "💥" effect. */
  lastTrap: { atX: number; atY: number; victimHandle: string } | null;
  phaseEndsAt: string | null;
}

// --- Drawing (تحدي الرسم) game engine --------------------------------------------------

export interface DrawingSettings {
  roundSeconds: number;
}

export type DrawingPhase = "WAITING_TO_START" | "PICKING" | "DRAWING" | "REVEALED" | "FINISHED";

export interface DrawingPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

export interface DrawingState {
  gameType: "DRAWING";
  gameSessionId: string;
  phase: DrawingPhase;
  settings: DrawingSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: DrawingPlayer[];
  round: number;
  /** The word the streamer is drawing this round — never set until REVEALED (correct guess or
   *  timeout). Never appears in settings either: there's no per-namespace filtering anywhere in
   *  this codebase, so a word visible to the streamer but hidden from viewers can't ride inside
   *  the one game:state payload broadcast to both — it has to be absent until reveal, same
   *  pattern as GuessNumberState.secret, just re-applied every round instead of once. */
  word: string | null;
  lastWinner: DrawingPlayer | null;
  winner: DrawingPlayer | null;
  phaseEndsAt: string | null;
}

// --- Dashboard / overlay socket contract ------------------------------------------

export const LiveSocketEvents = {
  GameState: "game:state",
  ChatComment: "chat:comment",
  ConnectorAlert: "connector:alert",
  RoomStats: "live:roomStats",
  DrawStroke: "draw:stroke",
} as const;
