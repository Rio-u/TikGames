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
  /** Display name of the gift ("Rose", "Galaxy", ...). Null when TikTok didn't send one — this
   *  is an undocumented payload, so every enrichment field here is optional by construction. */
  giftName: string | null;
  /** Diamond value of ONE unit of this gift. Multiply by repeatCount for the transaction total.
   *  0 when unknown — never guess a value, a wrong coin count corrupts every leaderboard downstream. */
  coins: number;
  imageUrl: string | null;
  /**
   * Streakable gifts (roses and friends) fire an event per tick while the viewer holds the
   * button, each one repeating the running total. Counting every tick multiplies a single
   * 10-rose streak into 55 roses. Only a tick with this flag set is the final, authoritative
   * one; non-streakable gifts arrive already finished. Consumers MUST ignore unfinished ticks
   * when totalling, and may use them for live animation only.
   */
  isStreakFinished: boolean;
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
  | "DRAWING"
  | "WORD_ROUND";

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
  "WORD_ROUND",
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
  /** How many rounds before the game auto-finishes and crowns a winner. Every game is
   *  round-bounded now: an open-ended game only ever reached FINISHED if the streamer happened
   *  to press stop, so the winner screen simply never appeared in normal play. */
  totalRounds: number;
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

/**
 * How wide a slice of the world a geography game draws from.
 *
 * The point is the chat, not the country list: a room that can name Egypt and France will sit in
 * silence through Kiribati, and one that wants a challenge is bored by another round of France.
 * `medium` is the default because it is the band most live rooms can actually play.
 */
export type GeoDifficulty = "easy" | "medium" | "hard";

export const GEO_DIFFICULTIES: GeoDifficulty[] = ["easy", "medium", "hard"];

export interface FlagsSettings {
  /** How many flags this session shows before it auto-finishes. */
  totalRounds: number;
  answerDurationSeconds: number;
  difficulty: GeoDifficulty;
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
  difficulty: GeoDifficulty;
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
  /** How many rounds before the game auto-finishes and crowns a winner. Every game is
   *  round-bounded now: an open-ended game only ever reached FINISHED if the streamer happened
   *  to press stop, so the winner screen simply never appeared in normal play. */
  totalRounds: number;
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
  /** How many words the streamer draws before the game auto-finishes and crowns a winner. */
  totalRounds: number;
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

// --- Word Round (جولة كلمات) game engine ----------------------------------------------

export interface WordRoundSettings {
  /** How many puzzles this session shows before it auto-finishes — same round-bounded shape
   *  as Flags/Capitals, this game's closest sibling. */
  totalRounds: number;
  roundSeconds: number;
}

export type WordRoundPhase = "WAITING_TO_START" | "PUZZLE" | "REVEALED" | "FINISHED";

export interface WordRoundPlayer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

/** One word claimed during the current puzzle — first correct submission of a given word wins
 *  it, so this doubles as the round's "already claimed" list and its live progress feed. */
export interface WordRoundFoundWord {
  word: string;
  handle: string;
  displayName: string;
  points: number;
}

export interface WordRoundState {
  gameType: "WORD_ROUND";
  gameSessionId: string;
  phase: WordRoundPhase;
  settings: WordRoundSettings;
  /** Everyone who has scored at least one point, ranked highest-first. */
  players: WordRoundPlayer[];
  round: number;
  /** The letter every valid word must contain this round. */
  centralLetter: string | null;
  /** The rest of this round's available letters (centralLetter itself is not repeated here). */
  extraLetters: string[];
  foundWords: WordRoundFoundWord[];
  /** The full valid-word list for this round's puzzle — unlike centralLetter/extraLetters (the
   *  public prompt), this is the actual answer key, so it stays hidden until REVEALED/FINISHED,
   *  same reveal-gate pattern as GuessNumberState.secret and DrawingState.word: there's no
   *  per-namespace filtering anywhere in this codebase, so it has to be absent from the payload
   *  itself rather than just hidden client-side, or reading the socket traffic would be a free
   *  answer key. */
  allWords: string[] | null;
  winner: WordRoundPlayer | null;
  phaseEndsAt: string | null;
}

// --- Dashboard / overlay socket contract ------------------------------------------

export const LiveSocketEvents = {
  GameState: "game:state",
  ChatComment: "chat:comment",
  ConnectorAlert: "connector:alert",
  RoomStats: "live:roomStats",
  DrawStroke: "draw:stroke",
  GameCountdown: "game:countdown",
} as const;

/**
 * The 3·2·1 pre-roll that plays before every game, broadcast once by POST
 * /games/session/:id/begin. The server really does hold `engine.begin()` for this long, so the
 * countdown is the actual wait rather than an animation running over an already-live round.
 *
 * It is its own event rather than a phase on every game's state because a phase would have meant
 * adding one to all twelve engines and all twelve phase unions for a purely presentational beat
 * that behaves identically in each. `begin()` is called from exactly one place, which is what
 * makes a single central broadcast possible.
 *
 * `endsAt` is an ISO timestamp on the server clock — the same contract as `phaseEndsAt` — so both
 * frontends count down against the server, not their own.
 */
export interface GameCountdownPayload {
  gameSessionId: string;
  endsAt: string;
  /**
   * Which pre-roll design to play, from the platform-wide admin setting.
   *
   * Carried on the broadcast rather than fetched or stored client-side, because the dashboard and
   * the overlay are separate origins that cannot share browser storage — and because sending it
   * with the countdown guarantees both are showing the same design in the same three seconds.
   * Null falls back to the registry default.
   */
  countdownDesignId: string | null;
}

/** How long that pre-roll runs. Shared so the API and both frontends can't drift apart. */
export const GAME_PRE_ROLL_MS = 3000;

// --- Platform product catalog ------------------------------------------------------
//
// The platform is the creator's operating system for their live; a *product* is one
// application running inside it. TikGames is the first — it is deliberately NOT special-cased
// anywhere in this contract, so the second product (alerts, widgets, ...) plugs in by adding a
// catalog entry and its own routes, not by touching the platform shell.

export type ProductId =
  | "TIKGAMES"
  | "ALERTS"
  | "WIDGETS"
  | "OVERLAYS"
  | "LEADERBOARDS"
  | "ANALYTICS";

/** AVAILABLE = shipped and usable. BETA = usable, rough edges. COMING_SOON = catalog entry only;
 *  never let one of these render as if it works (see the "no fake functionality" rule). */
export type ProductStatus = "AVAILABLE" | "BETA" | "COMING_SOON";

export type ProductCategory = "ENGAGEMENT" | "OVERLAY" | "INSIGHTS" | "AUTOMATION";

export interface ProductDefinition {
  id: ProductId;
  nameAr: string;
  /** One short line for the card — what it does, not how. */
  taglineAr: string;
  descriptionAr: string;
  status: ProductStatus;
  category: ProductCategory;
  /** Key into the dashboard's own icon map — shared-types stays framework-free, so no JSX here. */
  icon: string;
  /** Tailwind gradient stops used for the product's card/badge accent. */
  gradient: string;
  /** In-app route once signed in. Undefined for COMING_SOON entries. */
  dashboardRoute?: string;
  /** Public marketing page, if the product has one of its own. */
  marketingRoute?: string;
  /** Whether the product needs an active LiveSession before it can do anything. */
  requiresLive: boolean;
}

/** Per-user view of one product: the catalog entry plus whether *this* creator can open it. */
export interface ProductAccess extends ProductDefinition {
  unlocked: boolean;
  /** Arabic, user-facing. Null when unlocked. */
  lockedReasonAr: string | null;
}

export const PRODUCT_CATALOG: ProductDefinition[] = [
  {
    id: "TIKGAMES",
    nameAr: "TikGames",
    taglineAr: "حوّل شات لايفك للعبة جماعية.",
    descriptionAr:
      "مكتبة ألعاب تفاعلية بتتلعب من كومنتات اللايف مباشرة — المشاهد بيشارك من غير ما يعمل حساب أو ينزّل حاجة، وإنت بتتحكم من الداشبورد والنتيجة بتتعرض على الاستريم.",
    status: "AVAILABLE",
    category: "ENGAGEMENT",
    icon: "games",
    gradient: "from-violet-500/35 via-purple-600/20 to-canvas-elevated",
    // The in-app hub and the public marketing page are two different pages with two different
    // audiences, so they get two different paths — /tikgames sells it, /dashboard/tikgames runs it.
    dashboardRoute: "/dashboard/tikgames",
    marketingRoute: "/tikgames",
    requiresLive: true,
  },
  {
    id: "OVERLAYS",
    nameAr: "الأوفرلايز",
    taglineAr: "طبقة شفافة جاهزة لـ OBS.",
    descriptionAr:
      "رابط Browser Source واحد بيعرض المنتج الشغال دلوقتي على الاستريم، محمي بتوكن ومربوط لحظياً بالسيرفر.",
    status: "AVAILABLE",
    category: "OVERLAY",
    icon: "overlay",
    gradient: "from-sky-500/35 via-cyan-600/20 to-canvas-elevated",
    dashboardRoute: "/overlays",
    requiresLive: true,
  },
  {
    id: "LEADERBOARDS",
    nameAr: "ترتيب المشاهدين",
    taglineAr: "تتبّع أنشط ناس في قناتك.",
    descriptionAr:
      "نقاط تراكمية لكل مشاهد عبر كل اللايفات والألعاب، عشان تكافئ اللي بيلعب باستمرار مش اللي كسب مرة واحدة.",
    status: "AVAILABLE",
    category: "INSIGHTS",
    icon: "trophy",
    gradient: "from-amber-500/35 via-orange-600/20 to-canvas-elevated",
    dashboardRoute: "/leaderboard",
    requiresLive: false,
  },
  {
    id: "ANALYTICS",
    nameAr: "تحليلات اللايف",
    taglineAr: "افهم إيه اللي بيشتغل فعلاً.",
    descriptionAr:
      "مدة اللايفات، عدد المشاركين، الألعاب اللي خلصت، ومعدل التفاعل — بيانات حقيقية من جلساتك إنت، مش أرقام تجريبية.",
    status: "BETA",
    category: "INSIGHTS",
    icon: "chart",
    gradient: "from-emerald-500/35 via-teal-600/20 to-canvas-elevated",
    dashboardRoute: "/analytics",
    requiresLive: false,
  },
  {
    id: "ALERTS",
    nameAr: "تنبيهات اللايف",
    taglineAr: "رد فعل على الهدايا والمتابعات.",
    descriptionAr:
      "تنبيهات متحركة على الاستريم لما حد يبعت هدية أو يتابعك أو يعمل لايك — بتستهلك نفس أحداث اللايف الموحّدة اللي الألعاب بتستهلكها.",
    status: "COMING_SOON",
    category: "ENGAGEMENT",
    icon: "bell",
    gradient: "from-rose-500/35 via-pink-600/20 to-canvas-elevated",
    requiresLive: true,
  },
  {
    id: "WIDGETS",
    nameAr: "widgets الاستريم",
    taglineAr: "عدّادات وأهداف على الشاشة.",
    descriptionAr:
      "عناصر صغيرة تحطها في مشهد OBS — عدّاد متابعين، هدف هدايا، آخر داعم — بتتحدث لحظياً زي الأوفرلاي بالظبط.",
    status: "COMING_SOON",
    category: "OVERLAY",
    icon: "widget",
    gradient: "from-indigo-500/35 via-blue-600/20 to-canvas-elevated",
    requiresLive: true,
  },
];

export function getProduct(id: ProductId): ProductDefinition | undefined {
  return PRODUCT_CATALOG.find((p) => p.id === id);
}

// --- Overlay widget gallery --------------------------------------------------------
//
// The game overlay (/o/:token) renders whichever game is running. These widgets are the other
// half: small, independent browser sources the streamer positions separately in OBS, each with
// its own URL. Splitting them per-widget instead of one big overlay is what makes free
// positioning possible — a single combined layer can only ever be placed as one rectangle.

export type OverlayWidgetId =
  | "CHAT"
  | "GIFT_FEED"
  | "TOP_GIFTERS"
  | "TOP_LIKERS"
  | "VIEWER_COUNT"
  | "LIKE_FOUNTAIN"
  | "GIFT_CANNON"
  | "GIFT_FIREWORK"
  | "GIFT_GOAL"
  | "COIN_JAR"
  | "RANKING"
  | "TIMER"
  | "SOCIAL_ROTATOR"
  | "LAST_FOLLOWER";

export type OverlayWidgetCategory = "CHAT" | "GIFTS" | "RANKING" | "EFFECTS" | "UTILITY";

/** What live data a widget consumes. Used by the gallery to warn "this needs a running live"
 *  before the streamer copies a URL that would render an empty box on stream. */
export type OverlayWidgetFeed = "COMMENTS" | "GIFTS" | "LIKES" | "FOLLOWS" | "ROOM" | "POINTS" | "NONE";

export type OverlayFieldType = "COLOR" | "NUMBER" | "TEXT" | "TOGGLE" | "SELECT";

export interface OverlayField {
  key: string;
  labelAr: string;
  type: OverlayFieldType;
  default: string | number | boolean;
  min?: number;
  max?: number;
  /** SELECT only. */
  options?: { value: string; labelAr: string }[];
  hintAr?: string;
}

export interface OverlayWidgetDefinition {
  id: OverlayWidgetId;
  nameAr: string;
  descriptionAr: string;
  category: OverlayWidgetCategory;
  feed: OverlayWidgetFeed;
  /** Suggested OBS browser-source size, shown on the card so nobody has to guess. */
  recommendedSize: { width: number; height: number };
  /** Customisable fields, rendered generically by the dashboard's customise dialog. */
  fields: OverlayField[];
  /** Whether the "Test" button can fake this widget's data. Config-only widgets can't. */
  testable: boolean;
  /** Widgets that accumulate their own counter and can be zeroed independently (the jar). Shows
   *  a reset control on the gallery card and enables POST /overlays/reset/:widgetId. */
  resettable?: boolean;
  noteAr?: string;
}

/** Fields nearly every widget shares. Spread first so a widget's own fields come after them. */
const COMMON_FIELDS: OverlayField[] = [
  { key: "accent", labelAr: "اللون الأساسي", type: "COLOR", default: "#a855f7" },
  { key: "textColor", labelAr: "لون النص", type: "COLOR", default: "#ffffff" },
  { key: "bgOpacity", labelAr: "شفافية الخلفية", type: "NUMBER", default: 35, min: 0, max: 100, hintAr: "0 = شفاف تماماً" },
  { key: "fontSize", labelAr: "حجم الخط", type: "NUMBER", default: 18, min: 10, max: 64 },
  {
    key: "font",
    labelAr: "الخط",
    type: "SELECT",
    default: "cairo",
    options: [
      { value: "cairo", labelAr: "Cairo (عربي)" },
      { value: "tajawal", labelAr: "Tajawal (عربي)" },
      { value: "system", labelAr: "خط النظام" },
    ],
  },
];

export const OVERLAY_WIDGET_CATALOG: OverlayWidgetDefinition[] = [
  {
    id: "CHAT",
    nameAr: "الشات",
    descriptionAr: "بيعرض كومنتات اللايف أول بأول على الاستريم.",
    category: "CHAT",
    feed: "COMMENTS",
    recommendedSize: { width: 420, height: 640 },
    testable: true,
    noteAr: "خلي عرض الـ Browser Source ضيّق (حوالي 400px) عشان السطور ماتتفردش.",
    fields: [
      ...COMMON_FIELDS,
      { key: "maxMessages", labelAr: "أقصى عدد رسائل", type: "NUMBER", default: 12, min: 3, max: 40 },
      { key: "showAvatars", labelAr: "إظهار الصور", type: "TOGGLE", default: true },
      { key: "hideAfterSeconds", labelAr: "إخفاء الرسالة بعد (ثانية)", type: "NUMBER", default: 0, min: 0, max: 300, hintAr: "0 = تفضل ظاهرة" },
    ],
  },
  {
    id: "GIFT_FEED",
    nameAr: "آخر الهدايا",
    descriptionAr: "قائمة بآخر الهدايا اللي وصلتك، بصورة الهدية واسم صاحبها.",
    category: "GIFTS",
    feed: "GIFTS",
    recommendedSize: { width: 420, height: 480 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "maxItems", labelAr: "أقصى عدد هدايا", type: "NUMBER", default: 8, min: 1, max: 25 },
      { key: "showCoins", labelAr: "إظهار قيمة الكوينز", type: "TOGGLE", default: true },
    ],
  },
  {
    id: "TOP_GIFTERS",
    nameAr: "أعلى الداعمين",
    descriptionAr: "ترتيب أكتر مشاهدين صرفوا كوينز في اللايف الحالي.",
    category: "RANKING",
    feed: "GIFTS",
    recommendedSize: { width: 380, height: 420 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "topCount", labelAr: "عدد المراكز", type: "NUMBER", default: 5, min: 3, max: 20 },
      { key: "showCoins", labelAr: "إظهار الكوينز", type: "TOGGLE", default: true },
      { key: "titleAr", labelAr: "العنوان", type: "TEXT", default: "أعلى الداعمين" },
    ],
  },
  {
    id: "TOP_LIKERS",
    nameAr: "أعلى اللايكات",
    descriptionAr: "ترتيب أكتر مشاهدين عملوا لايك في اللايف الحالي.",
    category: "RANKING",
    feed: "LIKES",
    recommendedSize: { width: 380, height: 420 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "topCount", labelAr: "عدد المراكز", type: "NUMBER", default: 5, min: 3, max: 20 },
      { key: "titleAr", labelAr: "العنوان", type: "TEXT", default: "أعلى اللايكات" },
    ],
  },
  {
    id: "VIEWER_COUNT",
    nameAr: "عدد المشاهدين",
    descriptionAr: "عدد المشاهدين الحاليين في اللايف.",
    category: "UTILITY",
    feed: "ROOM",
    recommendedSize: { width: 260, height: 90 },
    testable: true,
    noteAr: "الرقم بيتحدّث كل كام ثانية من TikTok، ومش دايماً بيكون متاح.",
    fields: [
      ...COMMON_FIELDS,
      { key: "showFollowers", labelAr: "إظهار عدد المتابعين", type: "TOGGLE", default: false },
      { key: "labelAr", labelAr: "النص", type: "TEXT", default: "مشاهد" },
    ],
  },
  {
    id: "LIKE_FOUNTAIN",
    nameAr: "نافورة اللايكات",
    descriptionAr: "قلوب بتطلع من تحت الشاشة كل ما المشاهدين يعملوا لايك.",
    category: "EFFECTS",
    feed: "LIKES",
    recommendedSize: { width: 1920, height: 1080 },
    testable: true,
    fields: [
      { key: "accent", labelAr: "لون القلوب", type: "COLOR", default: "#f43f5e" },
      { key: "intensity", labelAr: "كثافة القلوب", type: "NUMBER", default: 4, min: 1, max: 12, hintAr: "قلوب لكل دفعة لايكات" },
      { key: "riseSeconds", labelAr: "مدة الطلوع (ثانية)", type: "NUMBER", default: 4, min: 1, max: 12 },
      { key: "sizePx", labelAr: "حجم القلب", type: "NUMBER", default: 34, min: 12, max: 96 },
    ],
  },
  {
    id: "GIFT_CANNON",
    nameAr: "مدفع الهدايا",
    descriptionAr: "صورة المشاهد بتطير على الشاشة مع الهدية اللي بعتها.",
    category: "EFFECTS",
    feed: "GIFTS",
    recommendedSize: { width: 1920, height: 1080 },
    testable: true,
    fields: [
      { key: "accent", labelAr: "لون الإطار", type: "COLOR", default: "#a855f7" },
      { key: "textColor", labelAr: "لون النص", type: "COLOR", default: "#ffffff" },
      { key: "flightSeconds", labelAr: "مدة الطيران (ثانية)", type: "NUMBER", default: 5, min: 2, max: 15 },
      { key: "avatarSize", labelAr: "حجم الصورة", type: "NUMBER", default: 78, min: 32, max: 200 },
      { key: "showGiftName", labelAr: "إظهار اسم الهدية", type: "TOGGLE", default: true },
    ],
  },
  {
    id: "GIFT_FIREWORK",
    nameAr: "ألعاب نارية",
    descriptionAr:
      "الهدية بتطلع لفوق ورا شعلة، وعند القمة بتنفجر لحلقة من نفس الهدية مع شرار ملوّن.",
    category: "EFFECTS",
    feed: "GIFTS",
    recommendedSize: { width: 1920, height: 1080 },
    testable: true,
    noteAr: "حطها فوق كل حاجة في المشهد — بتاخد الشاشة كلها وخلفيتها شفافة.",
    fields: [
      { key: "trailColor", labelAr: "لون الشعلة", type: "COLOR", default: "#fbbf24" },
      { key: "giftSize", labelAr: "حجم الهدية", type: "NUMBER", default: 96, min: 32, max: 240 },
      { key: "ringCount", labelAr: "عدد الهدايا في الانفجار", type: "NUMBER", default: 14, min: 4, max: 30 },
      { key: "burstRadius", labelAr: "اتساع الانفجار", type: "NUMBER", default: 190, min: 60, max: 500 },
      { key: "riseSeconds", labelAr: "مدة الطلوع (ثانية)", type: "NUMBER", default: 1, min: 1, max: 5 },
      { key: "burstSeconds", labelAr: "مدة الانفجار (ثانية)", type: "NUMBER", default: 2, min: 1, max: 6 },
      {
        key: "minCoins",
        labelAr: "أقل عدد كوينز يشغّلها",
        type: "NUMBER",
        default: 0,
        min: 0,
        max: 100000,
        hintAr: "0 = أي هدية تشغّلها. ارفعه لو الهدايا الصغيرة بتملى الشاشة.",
      },
      { key: "showSparks", labelAr: "شرار ملوّن في النص", type: "TOGGLE", default: true },
    ],
  },
  {
    id: "GIFT_GOAL",
    nameAr: "هدف الهدايا",
    descriptionAr: "شريط تقدّم بيتملى بكوينز الهدايا لحد ما توصل للهدف.",
    category: "GIFTS",
    feed: "GIFTS",
    recommendedSize: { width: 640, height: 130 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "goalCoins", labelAr: "الهدف بالكوينز", type: "NUMBER", default: 1000, min: 1, max: 10000000 },
      { key: "titleAr", labelAr: "عنوان الهدف", type: "TEXT", default: "هدف اللايف" },
      { key: "showNumbers", labelAr: "إظهار الأرقام", type: "TOGGLE", default: true },
    ],
  },
  {
    id: "COIN_JAR",
    nameAr: "برطمان الكوينز",
    descriptionAr:
      "برطمان زجاجي على الاستريم بيتملى كوينز مع كل هدية — الكوينز بتقع جواه وتتكوّم، وعدّاد تحته بيجمّع الحصيلة.",
    category: "GIFTS",
    feed: "GIFTS",
    recommendedSize: { width: 420, height: 560 },
    testable: true,
    // Its own counter, separate from the goal widget's: emptying the jar for a new segment must
    // not silently wipe the stream's gift goal too.
    resettable: true,
    noteAr: "العدّاد بتاع البرطمان مستقل عن هدف الهدايا — تفضيه مبيأثرش على الهدف.",
    fields: [
      // No glass/coin colour pickers: the jar and coin are supplied artwork, not drawn shapes,
      // so a colour control here would be a knob that does nothing.
      { key: "textColor", labelAr: "لون النص", type: "COLOR", default: "#ffffff" },
      { key: "bgOpacity", labelAr: "شفافية خلفية العدّاد", type: "NUMBER", default: 45, min: 0, max: 100 },
      {
        key: "goalCoins",
        labelAr: "البرطمان يتملى عند",
        type: "NUMBER",
        default: 1000,
        min: 10,
        max: 10000000,
        hintAr: "عدد الكوينز اللي يعتبر البرطمان اتملى بيها",
      },
      { key: "coinsPerGift", labelAr: "كوينز متحركة لكل هدية", type: "NUMBER", default: 6, min: 1, max: 25 },
      { key: "showCounter", labelAr: "إظهار العدّاد", type: "TOGGLE", default: true },
      { key: "showGoal", labelAr: "إظهار الهدف جنب العدّاد", type: "TOGGLE", default: false },
      { key: "showGiftInJar", labelAr: "صورة الهدية تقع في البرطمان", type: "TOGGLE", default: true },
      { key: "showSenderCard", labelAr: "إظهار كارت الباعت تحت البرطمان", type: "TOGGLE", default: true },
      {
        key: "senderCardSeconds",
        labelAr: "الكارت يختفي بعد (ثانية)",
        type: "NUMBER",
        default: 5,
        min: 1,
        max: 60,
      },
      { key: "labelAr", labelAr: "نص فوق البرطمان", type: "TEXT", default: "" },
      {
        key: "font",
        labelAr: "الخط",
        type: "SELECT",
        default: "cairo",
        options: [
          { value: "cairo", labelAr: "Cairo (عربي)" },
          { value: "tajawal", labelAr: "Tajawal (عربي)" },
          { value: "system", labelAr: "خط النظام" },
        ],
      },
      { key: "fontSize", labelAr: "حجم الخط", type: "NUMBER", default: 20, min: 10, max: 48 },
    ],
  },
  {
    id: "RANKING",
    nameAr: "الترتيب التراكمي",
    descriptionAr: "أعلى المشاهدين نقاطاً عبر كل لايفاتك، مش اللايف الحالي بس.",
    category: "RANKING",
    feed: "POINTS",
    recommendedSize: { width: 380, height: 460 },
    testable: false,
    noteAr: "بيقرأ من ترتيب المشاهدين التراكمي، فبيفضل ظاهر حتى من غير لايف شغال.",
    fields: [
      ...COMMON_FIELDS,
      { key: "topCount", labelAr: "عدد المراكز", type: "NUMBER", default: 10, min: 3, max: 25 },
      { key: "titleAr", labelAr: "العنوان", type: "TEXT", default: "الترتيب" },
    ],
  },
  {
    id: "TIMER",
    nameAr: "المؤقّت",
    descriptionAr: "عدّاد تنازلي بتتحكم فيه من لوحة التحكم.",
    category: "UTILITY",
    feed: "NONE",
    recommendedSize: { width: 320, height: 120 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "labelAr", labelAr: "النص فوق العدّاد", type: "TEXT", default: "" },
      { key: "warnAtSeconds", labelAr: "يتحوّل أحمر عند (ثانية)", type: "NUMBER", default: 10, min: 0, max: 600 },
    ],
  },
  {
    id: "SOCIAL_ROTATOR",
    nameAr: "دوّار السوشيال",
    descriptionAr: "حساباتك على السوشيال بتظهر بالتناوب في ركن الشاشة.",
    category: "UTILITY",
    feed: "NONE",
    recommendedSize: { width: 420, height: 110 },
    testable: false,
    fields: [
      ...COMMON_FIELDS,
      { key: "handles", labelAr: "الحسابات", type: "TEXT", default: "", hintAr: "افصل بينهم بفاصلة، مثال: tiktok:@me, instagram:@me" },
      { key: "rotateSeconds", labelAr: "مدة كل حساب (ثانية)", type: "NUMBER", default: 6, min: 2, max: 60 },
    ],
  },
  {
    id: "LAST_FOLLOWER",
    nameAr: "آخر متابع",
    descriptionAr: "بيعرض اسم وصورة آخر واحد تابعك في اللايف.",
    category: "UTILITY",
    feed: "FOLLOWS",
    recommendedSize: { width: 380, height: 110 },
    testable: true,
    fields: [
      ...COMMON_FIELDS,
      { key: "labelAr", labelAr: "النص", type: "TEXT", default: "آخر متابع" },
      { key: "hideAfterSeconds", labelAr: "إخفاء بعد (ثانية)", type: "NUMBER", default: 0, min: 0, max: 600, hintAr: "0 = يفضل ظاهر" },
    ],
  },
];

export function getOverlayWidget(id: string): OverlayWidgetDefinition | undefined {
  return OVERLAY_WIDGET_CATALOG.find((w) => w.id === id);
}

/** Resolved settings for one widget: the definition's defaults with the streamer's overrides on top. */
export type OverlayWidgetSettings = Record<string, string | number | boolean>;

export function overlayWidgetDefaults(def: OverlayWidgetDefinition): OverlayWidgetSettings {
  const out: OverlayWidgetSettings = {};
  for (const field of def.fields) out[field.key] = field.default;
  return out;
}

// --- Widget socket contract --------------------------------------------------------

export const WidgetSocketEvents = {
  /** Full snapshot, sent once on connect so a widget added mid-stream isn't blank. */
  Snapshot: "widget:snapshot",
  /** One gift transaction (already de-duplicated for streaks). */
  Gift: "widget:gift",
  /** A batch of likes from one viewer. */
  Like: "widget:like",
  Follow: "widget:follow",
  /** Rolling totals: top gifters, top likers, goal progress. */
  Totals: "widget:totals",
  /** Streamer-driven countdown state. */
  Timer: "widget:timer",
} as const;

export interface WidgetGiftPayload {
  viewer: NormalizedViewer;
  giftName: string | null;
  imageUrl: string | null;
  coins: number;
  repeatCount: number;
  totalCoins: number;
  at: string;
}

export interface WidgetLikePayload {
  viewer: NormalizedViewer;
  count: number;
  at: string;
}

export interface WidgetFollowPayload {
  viewer: NormalizedViewer;
  at: string;
}

export interface WidgetRankRow {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  value: number;
}

export interface WidgetTotals {
  topGifters: WidgetRankRow[];
  topLikers: WidgetRankRow[];
  totalCoins: number;
  totalLikes: number;
  /** The coin jar's own running total. Tracks the same gifts as `totalCoins` but can be zeroed
   *  on its own, so emptying the jar between segments doesn't reset the stream's gift goal. */
  jarCoins: number;
}

export interface WidgetTimerState {
  /** ISO instant the countdown ends. Null when no timer is running. Server-authoritative, same
   *  rule as every game's phaseEndsAt — the widget must never run its own independent clock. */
  endsAt: string | null;
  label: string;
  running: boolean;
}

export interface WidgetSnapshot {
  totals: WidgetTotals;
  recentGifts: WidgetGiftPayload[];
  lastFollower: WidgetFollowPayload | null;
  timer: WidgetTimerState;
}
