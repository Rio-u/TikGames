import type { DrawingState } from "@tikgames/shared-types";
import { PaintBrush } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { DrawingGameView, type StrokeMessage } from "../components/DrawingGameView";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { submitDrawingWord } from "../lib/liveApi";
import { connectDashboardSocket } from "../lib/socket";
import { useLiveSession } from "../lib/useLiveSession";

export default function DrawingControl() {
  const [totalRounds, setTotalRounds] = useState(5);
  const [roundSeconds, setRoundSeconds] = useState(60);
  const { liveSession } = useLiveSession();

  // Strokes bypass the game:state pipeline entirely (see apps/api/src/realtime/socket.ts) — a
  // second, independent socket connection just for emitting them, kept out of GameControlShell
  // since it's the only game that needs this. The drawer never needs to listen for their own
  // strokes back, only emit.
  const strokeSocketRef = useRef<Socket | null>(null);
  useEffect(() => {
    const socket = connectDashboardSocket();
    strokeSocketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const socket = strokeSocketRef.current;
    const liveSessionId = liveSession?.id;
    if (!socket || !liveSessionId) return;
    const rejoin = () => socket.emit("join", liveSessionId);
    rejoin();
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [liveSession?.id]);

  function handleStroke(msg: StrokeMessage) {
    const socket = strokeSocketRef.current;
    const liveSessionId = liveSession?.id;
    if (!socket || !liveSessionId) return;
    socket.emit("draw:stroke", { ...msg, liveSessionId });
  }

  return (
    <GameControlShell<DrawingState>
      gameType="DRAWING"
      pageTitle="تحدي الرسم"
      icon={<PaintBrush size={20} className="text-accent" weight="fill" />}
      configName="تحدي الرسم"
      buildSettings={() => ({ totalRounds, roundSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="عدد الكلمات"
            type="number"
            min={1}
            max={20}
            value={totalRounds}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="مدة الرسم (ثانية)"
            type="number"
            min={10}
            max={300}
            value={roundSeconds}
            onChange={(e) => setRoundSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            كل دور بتختار كلمة وترسمها، والشات يحاول يخمنها بالكتابة — أول تخمين صح ياخد نقطة. الدور بيتقفل تلقائي لو
            الوقت خلص من غير حد يخمن. مفيش عدد محدد من الأدوار — اللعبة بتفضل شغالة لحد ما توقفها.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => (
        <DrawingGameView
          state={state}
          chat={chat}
          onNewRound={onNewRound}
          onSubmitWord={(word) => submitDrawingWord(state.gameSessionId, word).catch(() => {})}
          onStroke={handleStroke}
        />
      )}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "PICKING" || state.phase === "DRAWING" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "PICKING"
          ? "استنى — اختار كلمة عشان تبدأ"
          : state.phase === "DRAWING"
            ? `دور ${state.round} — بترسم دلوقتي`
            : state.phase === "REVEALED"
              ? `دور ${state.round} — الكلمة اتكشفت`
              : "خلصت اللعبة"
      }
      beginLabel="ابدأ اللعبة"
      autoBegin
    />
  );
}
