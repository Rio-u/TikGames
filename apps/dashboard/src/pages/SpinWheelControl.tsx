import { Spiral } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { SpinWheelGameView } from "../components/SpinWheelGameView";
import type { SpinWheelState } from "../lib/liveApi";

export default function SpinWheelControl() {
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [joinCommand, setJoinCommand] = useState("!ادخل");
  const [pickSeconds, setPickSeconds] = useState(20);

  return (
    <GameControlShell<SpinWheelState>
      gameType="SPIN_WHEEL"
      pageTitle="عجلة الحظ"
      icon={<Spiral size={20} className="text-accent" weight="fill" />}
      configName="عجلة الحظ"
      buildSettings={() => ({ maxPlayers, joinCommand: joinCommand.trim() || "!ادخل", pickSeconds })}
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
            label="مدة اختيار الرقم (ثانية)"
            type="number"
            min={5}
            max={120}
            value={pickSeconds}
            onChange={(e) => setPickSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            العجلة بتختار لاعب، وهو يكتب رقم اللي عايز يطرده (0 ينسحب، 00 طرد عشوائي). كل 5 لاعبين في البداية = درع
            حماية مخفي 🛡️ محدش يعرف مين معاه لحد ما حد يحاول يطرده. آخر ناجي يكسب.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <SpinWheelGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_FOR_PLAYERS"}
      isActivePhase={(state) => state.phase === "SPINNING" || state.phase === "PICKING" || state.phase === "RESULT"}
      statusText={(state) =>
        state.phase === "WAITING_FOR_PLAYERS"
          ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers}`
          : state.phase === "SPINNING" || state.phase === "PICKING" || state.phase === "RESULT"
            ? `الجولة ${state.round} — باقي ${state.players.filter((p) => !p.eliminatedAt).length} لاعبين${
                state.phase === "SPINNING" ? " — العجلة بتلف!" : state.phase === "PICKING" ? " — بيختار ضحيته!" : ""
              }`
            : "خلصت اللعبة"
      }
      beginLabel="لفّ العجلة"
      beginDisabled={(state) => state.players.length < 2}
    />
  );
}
