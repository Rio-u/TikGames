import { Play, Sparkle, StopCircle, WarningCircle, X } from "@phosphor-icons/react";
import { LiveSocketEvents, type GameCountdownPayload } from "@tikgames/shared-types";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
import { ACCESS_TOKEN_KEY, useAuth } from "../lib/auth";
import { PreRollCountdown } from "@tikgames/game-3d";
import {
  beginGameSession,
  createGameConfig,
  getGameSessionState,
  startGameSession,
  stopGameSession,
  type GameState,
  type GameType,
  type CapitalsSettings,
  type DrawingSettings,
  type FlagsSettings,
  type GuessNumberSettings,
  type LogosSettings,
  type MazeSettings,
  type MusicalChairsSettings,
  type SpeedWordSettings,
  type SpinWheelSettings,
  type TriviaSettings,
  type WouldYouRatherSettings,
} from "../lib/liveApi";
import { connectDashboardSocket } from "../lib/socket";
import { useDisabledGames } from "../lib/useDisabledGames";
import { useGameContent } from "../lib/useGameContent";
import { useLiveSession } from "../lib/useLiveSession";
import { Button } from "./Button";
import type { ChatItem } from "./ChatBox";
import { Container } from "./Container";
import { GlassCard } from "./GlassCard";
import { Logo } from "./Logo";
import { Reveal } from "./Reveal";

/**
 * The shared template every game's control page is built on: a settings card before it starts,
 * a fullscreen view once it does, with the begin/stop/new-game/exit lifecycle wired up the same
 * way for all of them. A new game only needs to supply the pieces below — the settings fields,
 * its game-view component, and how to read its own phase names — everything else (live-session
 * guard, sockets, chat feed, start/begin/stop plumbing) is handled once, here.
 */
export interface GameControlShellProps<TState extends GameState> {
  gameType: GameType;
  pageTitle: string;
  icon: ReactNode;
  /** Name stored on the GameConfig row (shown in "my configs" lists elsewhere later). */
  configName: string;
  buildSettings: () =>
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
  renderSettings: () => ReactNode;
  /** `onNewRound` is the same handler behind the header's "لعبة جديدة" button — pass it to
   *  `NoWinnerScreen` (or any other in-view "play again" affordance) instead of duplicating the
   *  start-a-new-session flow. */
  renderGameView: (state: TState, chat: ChatItem[], onNewRound: () => void) => ReactNode;
  isWaitingPhase: (state: TState) => boolean;
  isActivePhase: (state: TState) => boolean;
  statusText: (state: TState) => string;
  beginLabel: string;
  beginDisabled?: (state: TState) => boolean;
  /** Set when the game's "waiting" phase serves no real purpose (no roster to build — Trivia,
   *  Guess Number) — "ابدأ اللعبة" immediately begins instead of landing on a screen with its own
   *  separate begin button. Leave unset for games where waiting is functional (Musical Chairs'
   *  WAITING_FOR_PLAYERS is an actual join step, not just an API artifact). */
  autoBegin?: boolean;
}

interface ChatMessage extends ChatItem {
  handle: string;
  at: string;
}

export function GameControlShell<TState extends GameState>({
  gameType,
  pageTitle,
  icon,
  configName,
  buildSettings,
  renderSettings,
  renderGameView,
  isWaitingPhase,
  isActivePhase,
  statusText,
  beginLabel,
  beginDisabled,
  autoBegin,
}: GameControlShellProps<TState>) {
  const { user } = useAuth();
  const { liveSession, loadingLiveSession } = useLiveSession();
  const disabledGames = useDisabledGames();
  const gameDisabled = disabledGames.has(gameType);
  const gameContent = useGameContent();
  const content = gameContent.get(gameType);

  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TState | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [chatFeed, setChatFeed] = useState<ChatMessage[]>([]);
  /** ISO end of the 3·2·1 pre-roll, from the server's game:countdown broadcast. */
  const [countdownEndsAt, setCountdownEndsAt] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  // True while handleStartGame's auto-begin chain is in flight — see there for why.
  const suppressWaitingRef = useRef(false);
  const isWaitingPhaseRef = useRef(isWaitingPhase);
  isWaitingPhaseRef.current = isWaitingPhase;

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return;

    const socket = connectDashboardSocket();
    socketRef.current = socket;

    socket.on("game:state", (state: GameState) => {
      if (state.gameType !== gameType) return;
      // While auto-begin is in flight, a "waiting" broadcast can arrive over the socket before
      // the begin() call resolves (they race independently) — drop it so the fullscreen view
      // never flashes the waiting screen we're about to skip past anyway.
      if (suppressWaitingRef.current && isWaitingPhaseRef.current(state as TState)) return;
      // The pre-roll ends when the game actually starts, not when the local clock says 3s —
      // the state that follows begin() is the authoritative "we're live now" signal.
      if (!isWaitingPhaseRef.current(state as TState)) setCountdownEndsAt(null);
      setGameState(state as TState);
      setGameSessionId(state.gameSessionId);
    });

    socket.on(LiveSocketEvents.GameCountdown, (payload: GameCountdownPayload) => {
      setCountdownEndsAt(payload.endsAt);
    });

    socket.on("chat:comment", (payload: { viewer: { handle: string; displayName: string }; text: string; at: string }) => {
      // Newest first (prepend) — ChatBox/ChatStrip render this order directly, newest at the
      // reading-start position, so nothing needs its own auto-scroll-to-latest logic.
      setChatFeed((prev) =>
        [
          {
            id: `${payload.at}-${payload.viewer.handle}-${Math.random()}`,
            handle: payload.viewer.handle,
            displayName: payload.viewer.displayName,
            text: payload.text,
            at: payload.at,
          },
          ...prev,
        ].slice(0, 50),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [gameType]);

  useEffect(() => {
    const socket = socketRef.current;
    const liveSessionId = liveSession?.id;
    if (!socket || !liveSessionId) return;

    const rejoin = () => socket.emit("join", liveSessionId);
    rejoin();
    // socket.io rooms don't survive a reconnect — without this, a dropped connection (network
    // blip, tab throttled in the background, ...) silently stops game:state/chat:comment delivery
    // until the page is reloaded, since only "connect" (not the initial mount) re-runs this.
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [liveSession?.id]);

  async function handleStartGame() {
    if (!liveSession) return;
    setStartingGame(true);
    setGameError(null);
    if (autoBegin) suppressWaitingRef.current = true;
    try {
      const { config } = await createGameConfig(gameType, configName, buildSettings());
      const res = await startGameSession(liveSession.id, gameType, config.id);
      let state = res.state as TState;
      if (autoBegin) {
        const begun = await beginGameSession(res.gameSessionId);
        setCountdownEndsAt(begun.countdownEndsAt);
        state = begun.state as TState;
      }
      setGameSessionId(res.gameSessionId);
      setGameState(state);
    } catch (err) {
      setGameError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setStartingGame(false);
      suppressWaitingRef.current = false;
    }
  }

  async function handleBegin() {
    if (!gameSessionId) return;
    try {
      const res = await beginGameSession(gameSessionId);
      setCountdownEndsAt(res.countdownEndsAt);
      setGameState(res.state as TState);
    } catch (err) {
      setGameError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    }
  }

  async function handleStopGame() {
    if (!gameSessionId) return;
    await stopGameSession(gameSessionId).catch(() => {});
    const fresh = await getGameSessionState(gameSessionId).catch(() => null);
    if (fresh?.state) setGameState(fresh.state as TState);
  }

  function handleExitGame() {
    setGameState(null);
    setGameSessionId(null);
  }

  if (!user) return null;

  // During the pre-roll the game is neither waiting nor running — the server is holding it. Both
  // buttons would be wrong: "ابدأ" would re-trigger a game that's already starting, and "وقف"
  // would target a session that hasn't begun. Hide them until the countdown resolves.
  const counting = countdownEndsAt !== null;
  const beginVisible = !counting && !!gameState && isWaitingPhase(gameState);
  const stopVisible = !counting && !!gameState && isActivePhase(gameState);

  return (
    <>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-glass-border bg-canvas/70 backdrop-blur-2xl">
          <Container className="flex items-center justify-between py-4">
            <Link to="/dashboard">
              <Logo />
            </Link>
            <Link to="/dashboard" className="text-sm text-ink-muted hover:text-ink">
              رجوع للداشبورد
            </Link>
          </Container>
        </header>

        <Container className="space-y-8 py-10">
          <Reveal>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {icon}
              {pageTitle}
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">إعدادات اللعبة دي بس — شغّل اللايف من صفحة الربط الأول لو لسه مبدأتش.</p>
          </Reveal>

          {!loadingLiveSession && !liveSession && (
            <Reveal delay={0.05}>
              <GlassCard hoverLift={false} className="p-6 text-center">
                <p className="text-sm text-ink-muted">لازم تبدأ اللايف الأول من صفحة الربط قبل ما تقدر تشغّل اللعبة.</p>
                <Link to="/live/connect" className="mt-3 inline-block">
                  <Button size="md">اربط حسابك</Button>
                </Link>
              </GlassCard>
            </Reveal>
          )}

          {liveSession && !gameState && gameDisabled && (
            <Reveal delay={0.1}>
              <GlassCard hoverLift={false} className="flex items-start gap-3 p-6 sm:p-8">
                <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <h2 className="font-semibold text-amber-300">اللعبة دي متوقفة مؤقتاً</h2>
                  <p className="mt-1 text-sm text-ink-muted">الأدمن أوقف اللعبة دي مؤقتاً — جرب تاني بعدين.</p>
                </div>
              </GlassCard>
            </Reveal>
          )}

          {liveSession && !gameState && !gameDisabled && (
            <Reveal delay={0.1}>
              <GlassCard hoverLift={false} className="p-6 sm:p-8">
                <div className="flex flex-col gap-4">{renderSettings()}</div>
                <Button onClick={handleStartGame} disabled={startingGame} className="mt-4 self-start">
                  <Sparkle size={16} weight="fill" />
                  {startingGame ? "جاري البدء..." : "ابدأ اللعبة"}
                </Button>
                {gameError && (
                  <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {gameError}
                  </p>
                )}
              </GlassCard>
            </Reveal>
          )}

          {liveSession && !gameState && !gameDisabled && (content?.imageUrl || content?.bioAr || content?.rulesAr) && (
            <Reveal delay={0.15}>
              <GlassCard hoverLift={false} className="overflow-hidden p-0">
                {content?.imageUrl && (
                  <div className="aspect-[21/9] w-full overflow-hidden">
                    <img src={content.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                )}
                {(content?.bioAr || content?.rulesAr) && (
                  <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
                    {content?.bioAr && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-ink-muted">شرح اللعبة</h3>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{content.bioAr}</p>
                      </div>
                    )}
                    {content?.rulesAr && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-ink-muted">قواعد التشغيل</h3>
                        <ul className="space-y-1.5 text-sm leading-relaxed text-ink">
                          {content.rulesAr
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                <span>{line}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </Reveal>
          )}
        </Container>
      </div>

      {/* Fullscreen game — takes over the whole tab the moment a game exists, and stays fullscreen
          across the setup -> running -> finished -> (new game) loop. */}
      {gameState && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-canvas p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {icon}
              <h2 className="font-semibold">{pageTitle}</h2>
              <span className="text-sm text-ink-muted">{statusText(gameState)}</span>
            </div>
            <div className="flex items-center gap-2">
              {beginVisible && (
                <Button size="md" onClick={handleBegin} disabled={beginDisabled?.(gameState)}>
                  <Play size={14} weight="fill" />
                  {beginLabel}
                </Button>
              )}
              {stopVisible && (
                <Button variant="secondary" size="md" magnetic={false} onClick={handleStopGame}>
                  <StopCircle size={14} />
                  وقف اللعبة
                </Button>
              )}
              {gameState.phase === "FINISHED" && (
                <Button size="md" magnetic={false} onClick={handleStartGame} disabled={startingGame}>
                  <Sparkle size={14} weight="fill" />
                  {startingGame ? "جاري البدء..." : "لعبة جديدة"}
                </Button>
              )}
              <button
                type="button"
                onClick={handleExitGame}
                aria-label="رجوع للوحة التحكم"
                className="rounded-full border border-glass-border bg-glass p-2 text-ink-muted transition-colors duration-200 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {gameError && (
            <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {gameError}
            </p>
          )}

          <div className="relative flex min-h-0 flex-1 flex-col">
            {renderGameView(gameState, chatFeed, handleStartGame)}
            {countdownEndsAt && (
              <PreRollCountdown endsAt={countdownEndsAt} onDone={() => setCountdownEndsAt(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
