import {
  LiveSocketEvents,
  type CapitalsSettings,
  type CapitalsState,
  type DrawingSettings,
  type DrawingState,
  type FlagsSettings,
  type FlagsState,
  type GuessNumberSettings,
  type GuessNumberState,
  type LogosSettings,
  type LogosState,
  type MazeSettings,
  type MazeState,
  type MusicalChairsSettings,
  type MusicalChairsState,
  type SpeedWordSettings,
  type SpeedWordState,
  type SpinWheelSettings,
  type SpinWheelState,
  type TriviaSettings,
  type TriviaState,
  type WouldYouRatherSettings,
  type WouldYouRatherState,
} from "@tikgames/shared-types";
import { Router } from "express";
import { CapitalsEngine } from "../games/capitals.js";
import { DrawingEngine } from "../games/drawing.js";
import { FlagsEngine } from "../games/flags.js";
import { GuessNumberEngine } from "../games/guessNumber.js";
import { LogosEngine } from "../games/logos.js";
import { MazeEngine } from "../games/maze.js";
import { MusicalChairsEngine } from "../games/musicalChairs.js";
import { SpeedWordEngine } from "../games/speedWord.js";
import { SpinWheelEngine } from "../games/spinWheel.js";
import { TriviaEngine } from "../games/trivia.js";
import { WouldYouRatherEngine } from "../games/wouldYouRather.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { incrementViewerRanking } from "../lib/leaderboard.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { activeEngines, broadcastToLive, liveSessionToGameSession, type AnyGameEngine } from "../realtime/registry.js";

const router = Router();

const DEFAULT_MUSICAL_CHAIRS_SETTINGS: MusicalChairsSettings = { maxPlayers: 10, joinCommand: "!ادخل" };
const DEFAULT_TRIVIA_SETTINGS: TriviaSettings = { answerDurationSeconds: 20 };
const DEFAULT_GUESS_NUMBER_SETTINGS: GuessNumberSettings = { secret: "سر", hint: "", durationSeconds: 45 };
const DEFAULT_SPIN_WHEEL_SETTINGS: SpinWheelSettings = { maxPlayers: 15, joinCommand: "!ادخل", pickSeconds: 20 };
const DEFAULT_WOULD_YOU_RATHER_SETTINGS: WouldYouRatherSettings = { voteDurationSeconds: 20 };

// Flat points a viewer's leaderboard tally gets for winning a game with no natural per-round
// score (elimination/single-guess games) — score-bearing games (Trivia/Flags/Capitals/Logos)
// instead pay out via the real per-round score diff, no separate bonus on top.
const WINNER_BONUS_POINTS = 10;
const DEFAULT_FLAGS_SETTINGS: FlagsSettings = { totalRounds: 10, answerDurationSeconds: 15 };
const DEFAULT_CAPITALS_SETTINGS: CapitalsSettings = { totalRounds: 10, answerDurationSeconds: 15 };
const DEFAULT_LOGOS_SETTINGS: LogosSettings = { totalRounds: 10, answerDurationSeconds: 15 };
const DEFAULT_SPEED_WORD_SETTINGS: SpeedWordSettings = { answerDurationSeconds: 12 };
const DEFAULT_MAZE_SETTINGS: MazeSettings = { maxPlayers: 20, joinCommand: "!دخول", gridSize: 9, durationSeconds: 180 };
const DEFAULT_DRAWING_SETTINGS: DrawingSettings = { roundSeconds: 60 };

router.get(
  "/toggles",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gameToggle.findMany({ where: { enabled: false } });
    res.json({ disabled: rows.map((r) => r.gameType) });
  }),
);

// Admin-set dashboard hero title + up to 3 spotlighted games — both independently optional, a
// missing row (or an unset field within it) means "render the dashboard exactly as before this
// feature existed," same fail-open precedent as GameToggle/GameContent.
router.get(
  "/homepage",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const settings = await prisma.homepageSettings.findUnique({ where: { key: "homepage" } });
    res.json({
      heroTitle: settings?.heroTitle ?? null,
      featuredGameTypes: settings?.featuredGameTypes ?? [],
    });
  }),
);

// Admin-set overrides for a game's library-card name/description/cover + control-page bio/rules —
// sparse (only rows an admin has actually edited); the dashboard merges these onto the hardcoded
// GameDefinition defaults in data/games.ts, never the other way around.
router.get(
  "/content",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gameContent.findMany();
    res.json({
      content: rows.map((r) => ({
        gameType: r.gameType,
        nameAr: r.nameAr,
        descriptionAr: r.descriptionAr,
        bioAr: r.bioAr,
        rulesAr: r.rulesAr,
        imageUrl: r.imageUrl,
      })),
    });
  }),
);

async function ownsGameSession(userId: string, gameSessionId: string): Promise<boolean> {
  const gameSession = await prisma.gameSession.findUnique({
    where: { id: gameSessionId },
    include: { liveSession: true },
  });
  return !!gameSession && gameSession.liveSession.userId === userId;
}

router.post(
  "/configs",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { gameType, name, settings } = req.body ?? {};

    if (gameType === "MUSICAL_CHAIRS") {
      const maxPlayers = Number(settings?.maxPlayers ?? DEFAULT_MUSICAL_CHAIRS_SETTINGS.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
        res.status(400).json({ error: "عدد اللاعبين لازم يكون بين 2 و 100" });
        return;
      }

      const joinCommandRaw = settings?.joinCommand ?? DEFAULT_MUSICAL_CHAIRS_SETTINGS.joinCommand;
      const joinCommand = typeof joinCommandRaw === "string" ? joinCommandRaw.trim() : "";
      if (!joinCommand || joinCommand.length > 30) {
        res.status(400).json({ error: "أمر الانضمام لازم يكون من 1 لـ 30 حرف" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "MUSICAL_CHAIRS",
          name: typeof name === "string" && name.trim() ? name.trim() : "الكراسي الموسيقية",
          settings: { maxPlayers, joinCommand } satisfies MusicalChairsSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "TRIVIA") {
      const answerDurationSeconds = Number(settings?.answerDurationSeconds ?? DEFAULT_TRIVIA_SETTINGS.answerDurationSeconds);
      if (!Number.isInteger(answerDurationSeconds) || answerDurationSeconds < 5 || answerDurationSeconds > 120) {
        res.status(400).json({ error: "مدة الإجابة لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "TRIVIA",
          name: typeof name === "string" && name.trim() ? name.trim() : "أسئلة عامة",
          settings: { answerDurationSeconds } satisfies TriviaSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "GUESS_NUMBER") {
      const secretRaw = settings?.secret;
      const secret = typeof secretRaw === "string" ? secretRaw.trim() : "";
      if (!secret || secret.length > 60) {
        res.status(400).json({ error: "لازم تحط رقم أو كلمة سرية من 1 لـ 60 حرف" });
        return;
      }

      const hintRaw = settings?.hint;
      const hint = typeof hintRaw === "string" ? hintRaw.trim().slice(0, 120) : "";

      const durationSeconds = Number(settings?.durationSeconds ?? DEFAULT_GUESS_NUMBER_SETTINGS.durationSeconds);
      if (!Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 300) {
        res.status(400).json({ error: "مدة التخمين لازم تكون بين 10 و 300 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "GUESS_NUMBER",
          name: typeof name === "string" && name.trim() ? name.trim() : "تخمين رقم أو كلمة",
          settings: { secret, hint, durationSeconds } satisfies GuessNumberSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "SPIN_WHEEL") {
      const maxPlayers = Number(settings?.maxPlayers ?? DEFAULT_SPIN_WHEEL_SETTINGS.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
        res.status(400).json({ error: "عدد اللاعبين لازم يكون بين 2 و 100" });
        return;
      }

      const joinCommandRaw = settings?.joinCommand ?? DEFAULT_SPIN_WHEEL_SETTINGS.joinCommand;
      const joinCommand = typeof joinCommandRaw === "string" ? joinCommandRaw.trim() : "";
      if (!joinCommand || joinCommand.length > 30) {
        res.status(400).json({ error: "أمر الانضمام لازم يكون من 1 لـ 30 حرف" });
        return;
      }

      const pickSeconds = Number(settings?.pickSeconds ?? DEFAULT_SPIN_WHEEL_SETTINGS.pickSeconds);
      if (!Number.isInteger(pickSeconds) || pickSeconds < 5 || pickSeconds > 120) {
        res.status(400).json({ error: "مدة اختيار الرقم لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "SPIN_WHEEL",
          name: typeof name === "string" && name.trim() ? name.trim() : "عجلة الحظ",
          settings: { maxPlayers, joinCommand, pickSeconds } satisfies SpinWheelSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "WOULD_YOU_RATHER") {
      const voteDurationSeconds = Number(
        settings?.voteDurationSeconds ?? DEFAULT_WOULD_YOU_RATHER_SETTINGS.voteDurationSeconds,
      );
      if (!Number.isInteger(voteDurationSeconds) || voteDurationSeconds < 5 || voteDurationSeconds > 120) {
        res.status(400).json({ error: "مدة التصويت لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "WOULD_YOU_RATHER",
          name: typeof name === "string" && name.trim() ? name.trim() : "إما / أو",
          settings: { voteDurationSeconds } satisfies WouldYouRatherSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "FLAGS") {
      const totalRounds = Number(settings?.totalRounds ?? DEFAULT_FLAGS_SETTINGS.totalRounds);
      if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 195) {
        res.status(400).json({ error: "عدد الجولات لازم يكون بين 1 و 195" });
        return;
      }

      const answerDurationSeconds = Number(settings?.answerDurationSeconds ?? DEFAULT_FLAGS_SETTINGS.answerDurationSeconds);
      if (!Number.isInteger(answerDurationSeconds) || answerDurationSeconds < 5 || answerDurationSeconds > 120) {
        res.status(400).json({ error: "مدة الإجابة لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "FLAGS",
          name: typeof name === "string" && name.trim() ? name.trim() : "أعلام",
          settings: { totalRounds, answerDurationSeconds } satisfies FlagsSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "CAPITALS") {
      const totalRounds = Number(settings?.totalRounds ?? DEFAULT_CAPITALS_SETTINGS.totalRounds);
      if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 195) {
        res.status(400).json({ error: "عدد الجولات لازم يكون بين 1 و 195" });
        return;
      }

      const answerDurationSeconds = Number(
        settings?.answerDurationSeconds ?? DEFAULT_CAPITALS_SETTINGS.answerDurationSeconds,
      );
      if (!Number.isInteger(answerDurationSeconds) || answerDurationSeconds < 5 || answerDurationSeconds > 120) {
        res.status(400).json({ error: "مدة الإجابة لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "CAPITALS",
          name: typeof name === "string" && name.trim() ? name.trim() : "عواصم",
          settings: { totalRounds, answerDurationSeconds } satisfies CapitalsSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "LOGOS") {
      const totalRounds = Number(settings?.totalRounds ?? DEFAULT_LOGOS_SETTINGS.totalRounds);
      if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 330) {
        res.status(400).json({ error: "عدد الجولات لازم يكون بين 1 و 330" });
        return;
      }

      const answerDurationSeconds = Number(settings?.answerDurationSeconds ?? DEFAULT_LOGOS_SETTINGS.answerDurationSeconds);
      if (!Number.isInteger(answerDurationSeconds) || answerDurationSeconds < 5 || answerDurationSeconds > 120) {
        res.status(400).json({ error: "مدة الإجابة لازم تكون بين 5 و 120 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "LOGOS",
          name: typeof name === "string" && name.trim() ? name.trim() : "شعارات",
          settings: { totalRounds, answerDurationSeconds } satisfies LogosSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "SPEED_WORD") {
      const answerDurationSeconds = Number(
        settings?.answerDurationSeconds ?? DEFAULT_SPEED_WORD_SETTINGS.answerDurationSeconds,
      );
      if (!Number.isInteger(answerDurationSeconds) || answerDurationSeconds < 5 || answerDurationSeconds > 60) {
        res.status(400).json({ error: "مدة الإجابة لازم تكون بين 5 و 60 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "SPEED_WORD",
          name: typeof name === "string" && name.trim() ? name.trim() : "أسرع",
          settings: { answerDurationSeconds } satisfies SpeedWordSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "MAZE") {
      const maxPlayers = Number(settings?.maxPlayers ?? DEFAULT_MAZE_SETTINGS.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 100) {
        res.status(400).json({ error: "عدد اللاعبين لازم يكون بين 2 و 100" });
        return;
      }

      const joinCommandRaw = settings?.joinCommand ?? DEFAULT_MAZE_SETTINGS.joinCommand;
      const joinCommand = typeof joinCommandRaw === "string" ? joinCommandRaw.trim() : "";
      if (!joinCommand || joinCommand.length > 30) {
        res.status(400).json({ error: "أمر الانضمام لازم يكون من 1 لـ 30 حرف" });
        return;
      }

      const gridSize = Number(settings?.gridSize ?? DEFAULT_MAZE_SETTINGS.gridSize);
      if (!Number.isInteger(gridSize) || gridSize < 5 || gridSize > 15) {
        res.status(400).json({ error: "حجم المتاهة لازم يكون بين 5 و 15" });
        return;
      }

      const durationSeconds = Number(settings?.durationSeconds ?? DEFAULT_MAZE_SETTINGS.durationSeconds);
      if (!Number.isInteger(durationSeconds) || durationSeconds < 30 || durationSeconds > 600) {
        res.status(400).json({ error: "مدة السباق لازم تكون بين 30 و 600 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "MAZE",
          name: typeof name === "string" && name.trim() ? name.trim() : "متاهة",
          settings: { maxPlayers, joinCommand, gridSize, durationSeconds } satisfies MazeSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    if (gameType === "DRAWING") {
      const roundSeconds = Number(settings?.roundSeconds ?? DEFAULT_DRAWING_SETTINGS.roundSeconds);
      if (!Number.isInteger(roundSeconds) || roundSeconds < 10 || roundSeconds > 300) {
        res.status(400).json({ error: "مدة الرسم لازم تكون بين 10 و 300 ثانية" });
        return;
      }

      const config = await prisma.gameConfig.create({
        data: {
          userId: req.userId!,
          gameType: "DRAWING",
          name: typeof name === "string" && name.trim() ? name.trim() : "تحدي الرسم",
          settings: { roundSeconds } satisfies DrawingSettings,
        },
      });
      res.status(201).json({ config });
      return;
    }

    res.status(400).json({ error: "النوع ده لسه مش متاح" });
  }),
);

router.get(
  "/configs",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { gameType } = req.query;
    const configs = await prisma.gameConfig.findMany({
      where: {
        userId: req.userId!,
        gameType:
          gameType === "MUSICAL_CHAIRS" ||
          gameType === "TRIVIA" ||
          gameType === "GUESS_NUMBER" ||
          gameType === "SPIN_WHEEL" ||
          gameType === "WOULD_YOU_RATHER" ||
          gameType === "FLAGS" ||
          gameType === "CAPITALS" ||
          gameType === "LOGOS" ||
          gameType === "SPEED_WORD" ||
          gameType === "MAZE" ||
          gameType === "DRAWING"
            ? gameType
            : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ configs });
  }),
);

router.post(
  "/session/start",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { liveSessionId, gameConfigId, gameType } = req.body ?? {};
    if (typeof liveSessionId !== "string") {
      res.status(400).json({ error: "liveSessionId is required" });
      return;
    }
    if (
      gameType !== "MUSICAL_CHAIRS" &&
      gameType !== "TRIVIA" &&
      gameType !== "GUESS_NUMBER" &&
      gameType !== "SPIN_WHEEL" &&
      gameType !== "WOULD_YOU_RATHER" &&
      gameType !== "FLAGS" &&
      gameType !== "CAPITALS" &&
      gameType !== "LOGOS" &&
      gameType !== "SPEED_WORD" &&
      gameType !== "MAZE" &&
      gameType !== "DRAWING"
    ) {
      res.status(400).json({ error: "gameType غير مدعوم" });
      return;
    }

    const toggle = await prisma.gameToggle.findUnique({ where: { gameType } });
    if (toggle && !toggle.enabled) {
      res.status(400).json({ error: "الأدمن أوقف اللعبة دي مؤقتاً" });
      return;
    }

    const liveSession = await prisma.liveSession.findUnique({ where: { id: liveSessionId } });
    if (!liveSession || liveSession.userId !== req.userId) {
      res.status(404).json({ error: "Live session not found" });
      return;
    }

    type AnyGameSettings =
      | MusicalChairsSettings
      | TriviaSettings
      | GuessNumberSettings
      | SpinWheelSettings
      | WouldYouRatherSettings
      | FlagsSettings
      | CapitalsSettings
      | LogosSettings
      | SpeedWordSettings
      | MazeSettings
      | DrawingSettings;
    const defaultSettingsByType: Record<typeof gameType, AnyGameSettings> = {
      MUSICAL_CHAIRS: DEFAULT_MUSICAL_CHAIRS_SETTINGS,
      TRIVIA: DEFAULT_TRIVIA_SETTINGS,
      GUESS_NUMBER: DEFAULT_GUESS_NUMBER_SETTINGS,
      SPIN_WHEEL: DEFAULT_SPIN_WHEEL_SETTINGS,
      WOULD_YOU_RATHER: DEFAULT_WOULD_YOU_RATHER_SETTINGS,
      FLAGS: DEFAULT_FLAGS_SETTINGS,
      CAPITALS: DEFAULT_CAPITALS_SETTINGS,
      LOGOS: DEFAULT_LOGOS_SETTINGS,
      SPEED_WORD: DEFAULT_SPEED_WORD_SETTINGS,
      MAZE: DEFAULT_MAZE_SETTINGS,
      DRAWING: DEFAULT_DRAWING_SETTINGS,
    };
    let settings: AnyGameSettings = defaultSettingsByType[gameType]!;
    let gameConfigIdToUse: string | undefined;
    if (typeof gameConfigId === "string") {
      const gameConfig = await prisma.gameConfig.findUnique({ where: { id: gameConfigId } });
      if (!gameConfig || gameConfig.userId !== req.userId || gameConfig.gameType !== gameType) {
        res.status(404).json({ error: "Game config not found" });
        return;
      }
      settings = gameConfig.settings as unknown as AnyGameSettings;
      gameConfigIdToUse = gameConfig.id;
    }

    let triviaBackgroundPool: string[] = [];
    if (gameType === "TRIVIA") {
      const images = await prisma.triviaBackgroundImage.findMany({ select: { url: true } });
      if (images.length === 0) {
        res.status(400).json({ error: "مفيش خلفيات مرفوعة لسه — لازم الأدمن يرفع صور الأول من صفحة الأدمن" });
        return;
      }
      triviaBackgroundPool = images.map((i) => i.url);
    }

    let musicPool: string[] = [];
    if (gameType === "MUSICAL_CHAIRS") {
      const tracks = await prisma.musicalChairsTrack.findMany({ select: { url: true } });
      musicPool = tracks.map((t) => t.url);
    }

    let speedWordBackgroundPool: string[] = [];
    if (gameType === "SPEED_WORD") {
      const images = await prisma.speedWordBackgroundImage.findMany({ select: { url: true } });
      if (images.length === 0) {
        res.status(400).json({ error: "مفيش خلفيات مرفوعة لسه — لازم الأدمن يرفع صور الأول من صفحة الأدمن" });
        return;
      }
      speedWordBackgroundPool = images.map((i) => i.url);
    }

    // One active game per live session (product decision from the architecture phase).
    const existingGameSessionId = liveSessionToGameSession.get(liveSessionId);
    if (existingGameSessionId) {
      activeEngines.get(existingGameSessionId)?.stop();
      activeEngines.delete(existingGameSessionId);
      liveSessionToGameSession.delete(liveSessionId);
      await prisma.gameSession
        .update({ where: { id: existingGameSessionId }, data: { status: "ENDED", endedAt: new Date() } })
        .catch(() => {});
    }

    const gameSession = await prisma.gameSession.create({
      data: {
        liveSessionId,
        gameConfigId: gameConfigIdToUse,
        gameType,
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });

    // Leaderboard write-through state — fresh per game session (this closure is recreated on
    // every POST /session/start), so a mid-live restart can't double-count or leak a stale tally
    // into the next session: previousScores/countedThisSession track score-bearing games
    // (Trivia/Flags/Capitals/Logos), winnerAwarded guards the flat bonus for winner-only games
    // (Musical Chairs/Spin Wheel/Guess Number) from firing more than once.
    const previousScores = new Map<string, number>();
    const countedThisSession = new Set<string>();
    let winnerAwarded = false;

    const onChange = (
      state:
        | MusicalChairsState
        | TriviaState
        | GuessNumberState
        | SpinWheelState
        | WouldYouRatherState
        | FlagsState
        | CapitalsState
        | LogosState
        | SpeedWordState
        | MazeState
        | DrawingState,
    ) => {
      prisma.gameSession
        .update({ where: { id: gameSession.id }, data: { state: JSON.parse(JSON.stringify(state)) } })
        .catch((err) => console.error("[api] failed to persist game state:", err));
      broadcastToLive(liveSessionId, LiveSocketEvents.GameState, state);

      if (
        state.gameType === "TRIVIA" ||
        state.gameType === "FLAGS" ||
        state.gameType === "CAPITALS" ||
        state.gameType === "LOGOS" ||
        state.gameType === "SPEED_WORD" ||
        state.gameType === "DRAWING"
      ) {
        for (const p of state.players) {
          const delta = p.score - (previousScores.get(p.handle) ?? 0);
          if (delta <= 0) continue;
          previousScores.set(p.handle, p.score);
          const isNewSession = !countedThisSession.has(p.handle);
          countedThisSession.add(p.handle);
          incrementViewerRanking(liveSession.userId, p.handle, p.displayName, p.avatarUrl, delta, isNewSession).catch(
            (err) => console.error("[api] failed to update leaderboard:", err),
          );
        }
      } else if (
        (state.gameType === "MUSICAL_CHAIRS" ||
          state.gameType === "SPIN_WHEEL" ||
          state.gameType === "GUESS_NUMBER" ||
          state.gameType === "MAZE") &&
        state.phase === "FINISHED" &&
        state.winner &&
        !winnerAwarded
      ) {
        winnerAwarded = true;
        const w = state.winner;
        incrementViewerRanking(liveSession.userId, w.handle, w.displayName, w.avatarUrl, WINNER_BONUS_POINTS, true).catch(
          (err) => console.error("[api] failed to update leaderboard:", err),
        );
      }

      if (state.phase === "FINISHED") {
        prisma.gameSession
          .update({ where: { id: gameSession.id }, data: { status: "ENDED", endedAt: new Date() } })
          .catch(() => {});
        // A finished game isn't "active" anymore — drop it from the in-memory registry (after a
        // short grace period, not instantly) so a dashboard refresh or an OBS overlay reconnect
        // *well after* the game ended doesn't replay the old winner screen. The delay matters:
        // deleting synchronously here raced GET /session/:id's DB-fallback path against the
        // fire-and-forget persist above — a request landing in that same instant could read the
        // pre-FINISHED row before the write landed. Anyone already watching already got the
        // FINISHED broadcast above regardless; this timer only affects lookups after the fact.
        setTimeout(() => {
          activeEngines.delete(gameSession.id);
          // Only clear the liveSession -> gameSession mapping if it's still pointing at *this*
          // session — if the streamer already started a new one (e.g. "لعبة جديدة") within the
          // grace period, that mapping now points elsewhere and must not be touched here.
          if (liveSessionToGameSession.get(liveSessionId) === gameSession.id) {
            liveSessionToGameSession.delete(liveSessionId);
          }
        }, 5000);
      }
    };

    const engine: AnyGameEngine =
      gameType === "MUSICAL_CHAIRS"
        ? new MusicalChairsEngine(gameSession.id, settings as MusicalChairsSettings, musicPool, onChange)
        : gameType === "TRIVIA"
          ? new TriviaEngine(gameSession.id, settings as TriviaSettings, triviaBackgroundPool, onChange)
          : gameType === "GUESS_NUMBER"
            ? new GuessNumberEngine(gameSession.id, settings as GuessNumberSettings, onChange)
            : gameType === "SPIN_WHEEL"
              ? new SpinWheelEngine(gameSession.id, settings as SpinWheelSettings, onChange)
              : gameType === "WOULD_YOU_RATHER"
                ? new WouldYouRatherEngine(gameSession.id, settings as WouldYouRatherSettings, onChange)
                : gameType === "FLAGS"
                  ? new FlagsEngine(gameSession.id, settings as FlagsSettings, onChange)
                  : gameType === "CAPITALS"
                    ? new CapitalsEngine(gameSession.id, settings as CapitalsSettings, onChange)
                    : gameType === "LOGOS"
                      ? new LogosEngine(gameSession.id, settings as LogosSettings, onChange)
                      : gameType === "SPEED_WORD"
                        ? new SpeedWordEngine(gameSession.id, settings as SpeedWordSettings, speedWordBackgroundPool, onChange)
                        : gameType === "MAZE"
                          ? new MazeEngine(gameSession.id, settings as MazeSettings, onChange)
                          : new DrawingEngine(gameSession.id, settings as DrawingSettings, onChange);

    activeEngines.set(gameSession.id, engine);
    liveSessionToGameSession.set(liveSessionId, gameSession.id);
    broadcastToLive(liveSessionId, LiveSocketEvents.GameState, engine.getState());

    res.status(201).json({ gameSessionId: gameSession.id, state: engine.getState() });
  }),
);

router.post(
  "/session/:id/begin",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!(await ownsGameSession(req.userId!, req.params.id))) {
      res.status(404).json({ error: "مفيش لعبة شغالة بالـ id ده" });
      return;
    }
    const engine = activeEngines.get(req.params.id);
    if (!engine) {
      res.status(404).json({ error: "مفيش لعبة شغالة بالـ id ده" });
      return;
    }
    const started = engine.begin();
    if (!started) {
      res.status(400).json({ error: "مقدرش يبدأ اللعبة (محتاجة لاعبين أكتر، أو بدأت بالفعل)" });
      return;
    }
    res.json({ state: engine.getState() });
  }),
);

router.post(
  "/session/:id/stop",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!(await ownsGameSession(req.userId!, req.params.id))) {
      res.status(404).json({ error: "مفيش لعبة شغالة بالـ id ده" });
      return;
    }
    activeEngines.get(req.params.id)?.stop();
    res.json({ ok: true });
  }),
);

// Drawing's word changes every round, mid-session — unlike Guess Number's secret (set once, at
// config time via POST /configs), this needs its own in-session endpoint. The word never appears
// in game:state until REVEALED (see DrawingEngine.submitWord); only the streamer, who is the only
// one who can call this (ownership-checked below), ever knows it while DRAWING is live.
router.post(
  "/session/:id/drawing/word",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!(await ownsGameSession(req.userId!, req.params.id))) {
      res.status(404).json({ error: "مفيش لعبة شغالة بالـ id ده" });
      return;
    }
    const engine = activeEngines.get(req.params.id);
    if (!engine || !(engine instanceof DrawingEngine)) {
      res.status(404).json({ error: "مفيش لعبة رسم شغالة بالـ id ده" });
      return;
    }
    const word = typeof req.body?.word === "string" ? req.body.word : "";
    const submitted = engine.submitWord(word);
    if (!submitted) {
      res.status(400).json({ error: "لازم تكتب كلمة (أقل من 40 حرف)، ومنفعش غير وانت في مرحلة الاختيار" });
      return;
    }
    res.json({ ok: true });
  }),
);

router.get(
  "/session/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!(await ownsGameSession(req.userId!, req.params.id))) {
      res.status(404).json({ error: "Game session not found" });
      return;
    }
    const engine = activeEngines.get(req.params.id);
    if (engine) {
      res.json({ state: engine.getState() });
      return;
    }
    const gameSession = await prisma.gameSession.findUnique({ where: { id: req.params.id } });
    res.json({ state: gameSession?.state ?? null });
  }),
);

export default router;
