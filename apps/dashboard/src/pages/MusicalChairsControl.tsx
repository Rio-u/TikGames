import { Users } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { MusicalChairsGameView } from "../components/MusicalChairsGameView";
import type { MusicalChairsState } from "../lib/liveApi";

export default function MusicalChairsControl() {
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [joinCommand, setJoinCommand] = useState("!ادخل");

  return (
    <GameControlShell<MusicalChairsState>
      gameType="MUSICAL_CHAIRS"
      pageTitle="الكراسي الموسيقية"
      icon={<Users size={20} className="text-accent" />}
      configName="الكراسي الموسيقية"
      buildSettings={() => ({ maxPlayers, joinCommand: joinCommand.trim() || "!ادخل" })}
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
          <p className="text-xs text-ink-muted">
            اللاعبين يدخلوا بكتابة أمر الانضمام، وكل جولة: 7 ثواني موسيقى ثم 5 ثواني لاختيار رقم الكرسي.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <MusicalChairsGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_FOR_PLAYERS"}
      isActivePhase={(state) => state.phase === "RUNNING" || state.phase === "CHOOSING"}
      statusText={(state) =>
        state.phase === "WAITING_FOR_PLAYERS"
          ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers}`
          : state.phase === "RUNNING" || state.phase === "CHOOSING"
            ? `الجولة ${state.round} — باقي ${state.players.filter((p) => !p.eliminatedAt).length} لاعبين${
                state.phase === "CHOOSING" ? " — بيختاروا الكراسي!" : ""
              }`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الجولات"
      beginDisabled={(state) => state.players.length < 2}
    />
  );
}
