import { PuzzlePiece } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { MazeGameView } from "../components/MazeGameView";
import type { MazeState } from "../lib/liveApi";

export default function MazeControl() {
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [joinCommand, setJoinCommand] = useState("!دخول");
  const [gridSize, setGridSize] = useState(9);
  const [durationSeconds, setDurationSeconds] = useState(180);

  return (
    <GameControlShell<MazeState>
      gameType="MAZE"
      pageTitle="متاهة"
      icon={<PuzzlePiece size={20} className="text-accent" weight="fill" />}
      configName="متاهة"
      buildSettings={() => ({ maxPlayers, joinCommand: joinCommand.trim() || "!دخول", gridSize, durationSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="أقصى عدد لاعبين"
            type="number"
            min={2}
            max={100}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="أمر الانضمام"
            dir="ltr"
            maxLength={30}
            value={joinCommand}
            onChange={(e) => setJoinCommand(e.target.value)}
            className="max-w-xs"
          />
          <Input
            label="حجم المتاهة"
            type="number"
            min={5}
            max={15}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="مدة السباق (ثانية)"
            type="number"
            min={30}
            max={600}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            اللاعبين يتحركوا بكتابة رقم من 1 لـ 4 (فوق/يمين/تحت/شمال)، وكل واحد يقدر يحط فخ واحد بكتابة !فخ — اللي يقع
            فيه يرجع للبداية. أول واحد يوصل للكأس 🏆 يكسب.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <MazeGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_FOR_PLAYERS"}
      isActivePhase={(state) => state.phase === "RACING"}
      statusText={(state) =>
        state.phase === "WAITING_FOR_PLAYERS"
          ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers}`
          : state.phase === "RACING"
            ? `السباق شغال — ${state.players.length} لاعبين`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ السباق"
      beginDisabled={(state) => state.players.length < 2}
    />
  );
}
