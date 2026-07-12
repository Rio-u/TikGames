import type {
  CapitalsState,
  FlagsState,
  GuessNumberState,
  LogosState,
  MazeState,
  MusicalChairsState,
  SpeedWordState,
  SpinWheelState,
  TriviaState,
  WouldYouRatherState,
} from "@tikgames/shared-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CapitalsOverlay } from "../components/CapitalsOverlay";
import { type ChatItem } from "../components/ChatStrip";
import { FlagsOverlay } from "../components/FlagsOverlay";
import { GuessNumberOverlay } from "../components/GuessNumberOverlay";
import { LogosOverlay } from "../components/LogosOverlay";
import { MazeOverlay } from "../components/MazeOverlay";
import { MusicalChairsOverlay } from "../components/MusicalChairsOverlay";
import { SpeedWordOverlay } from "../components/SpeedWordOverlay";
import { SpinWheelOverlay } from "../components/SpinWheelOverlay";
import { TriviaOverlay } from "../components/TriviaOverlay";
import { WouldYouRatherOverlay } from "../components/WouldYouRatherOverlay";
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
  | MazeState;

export default function OverlayRoom() {
  const { overlayToken } = useParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);

  useEffect(() => {
    if (!overlayToken) return;
    const socket = connectOverlaySocket(overlayToken);
    socket.on("game:state", (state: GameState) => setGameState(state));
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
    return () => {
      socket.disconnect();
    };
  }, [overlayToken]);

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
  return <MusicalChairsOverlay state={gameState} chat={chat} />;
}
