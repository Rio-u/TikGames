import type {
  CapitalsState,
  DrawingState,
  FlagsState,
  GuessNumberState,
  LogosState,
  MazeState,
  MusicalChairsState,
  SpeedWordState,
  SpinWheelState,
  TriviaState,
  WordRoundState,
  WouldYouRatherState,
} from "@tikgames/shared-types";
import { LiveSocketEvents, type GameCountdownPayload } from "@tikgames/shared-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CapitalsOverlay } from "../components/CapitalsOverlay";
import { type ChatItem } from "../components/ChatStrip";
import { DrawingOverlay, type StrokeMessage } from "../components/DrawingOverlay";
import { FlagsOverlay } from "../components/FlagsOverlay";
import { GuessNumberOverlay } from "../components/GuessNumberOverlay";
import { LogosOverlay } from "../components/LogosOverlay";
import { MazeOverlay } from "../components/MazeOverlay";
import { MusicalChairsOverlay } from "../components/MusicalChairsOverlay";
import { SpeedWordOverlay } from "../components/SpeedWordOverlay";
import { SpinWheelOverlay } from "../components/SpinWheelOverlay";
import { TriviaOverlay } from "../components/TriviaOverlay";
import { WordRoundOverlay } from "../components/WordRoundOverlay";
import { WouldYouRatherOverlay } from "../components/WouldYouRatherOverlay";
import { PreRollCountdown } from "../components/three/Countdown3D";
import { connectOverlaySocket } from "../lib/socket";

type GameState =
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
  | DrawingState
  | WordRoundState;

export default function OverlayRoom() {
  const { overlayToken } = useParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [strokes, setStrokes] = useState<Map<string, StrokeMessage>>(new Map());
  /** ISO end of the 3·2·1 pre-roll, from the server's game:countdown broadcast. */
  const [countdownEndsAt, setCountdownEndsAt] = useState<string | null>(null);

  useEffect(() => {
    if (!overlayToken) return;
    const socket = connectOverlaySocket(overlayToken);
    socket.on("game:state", (state: GameState) => {
      setGameState((prev) => {
        // A new round (or a new session entirely) starts with a blank canvas — clear stays local
        // to the receiving client, so this is the only reliable place to reset between rounds.
        if (prev?.gameSessionId !== state.gameSessionId || (prev?.round ?? 0) !== state.round) {
          setStrokes(new Map());
        }
        // The state that follows begin() is the authoritative "we're live now" signal — clear the
        // pre-roll on it rather than trusting this client's own clock to have reached zero.
        if (prev && prev.phase !== state.phase) setCountdownEndsAt(null);
        return state;
      });
    });
    socket.on(LiveSocketEvents.GameCountdown, (payload: GameCountdownPayload) => {
      setCountdownEndsAt(payload.endsAt);
    });
    socket.on("chat:comment", (payload: { viewer: { handle: string; displayName: string }; text: string; at: string }) => {
      // Newest first (prepend) — the shared convention every chat list renders directly, newest
      // at the reading-start position, so nothing needs its own auto-scroll-to-latest logic.
      setChat((prev) =>
        [
          { id: `${payload.at}-${payload.viewer.handle}-${Math.random()}`, displayName: payload.viewer.displayName, text: payload.text },
          ...prev,
        ].slice(0, 30),
      );
    });
    socket.on("draw:stroke", (msg: StrokeMessage) => {
      setStrokes((prev) => {
        const next = new Map(prev);
        if (msg.kind === "clear") next.clear();
        else if (msg.kind === "undo") next.delete(msg.id);
        else next.set(msg.id, msg);
        return next;
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [overlayToken]);

  // The branch chain became a function so the pre-roll can render over whichever overlay is
  // active, instead of being duplicated into all twelve of them.
  function renderGame() {
    if (gameState?.gameType === "TRIVIA") {
      return <TriviaOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "GUESS_NUMBER") {
      return <GuessNumberOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "SPIN_WHEEL") {
      return <SpinWheelOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "WOULD_YOU_RATHER") {
      return <WouldYouRatherOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "FLAGS") {
      return <FlagsOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "CAPITALS") {
      return <CapitalsOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "LOGOS") {
      return <LogosOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "SPEED_WORD") {
      return <SpeedWordOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "MAZE") {
      return <MazeOverlay state={gameState} chat={chat} />;
    }
    if (gameState?.gameType === "DRAWING") {
      return <DrawingOverlay state={gameState} chat={chat} strokes={strokes} />;
    }
    if (gameState?.gameType === "WORD_ROUND") {
      return <WordRoundOverlay state={gameState} chat={chat} />;
    }
    return <MusicalChairsOverlay state={gameState} chat={chat} />;
  }

  return (
    <>
      {renderGame()}
      {/* No positioned ancestor on purpose: `absolute inset-0` then resolves against the initial
          containing block, i.e. the full browser source, without wrapping (and so re-laying out)
          any of the game overlays underneath. */}
      {countdownEndsAt && (
        <PreRollCountdown endsAt={countdownEndsAt} onDone={() => setCountdownEndsAt(null)} />
      )}
    </>
  );
}
