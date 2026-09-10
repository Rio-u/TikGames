import { Compass } from "@phosphor-icons/react";
import type { GeoDifficulty } from "@tikgames/shared-types";
import { useState } from "react";
import { CapitalsGameView } from "../components/CapitalsGameView";
import { DifficultyPicker } from "../components/DifficultyPicker";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import type { CapitalsState } from "../lib/liveApi";

export default function CapitalsControl() {
  const [totalRounds, setTotalRounds] = useState(10);
  const [answerDurationSeconds, setAnswerDurationSeconds] = useState(15);
  const [difficulty, setDifficulty] = useState<GeoDifficulty>("medium");

  return (
    <GameControlShell<CapitalsState>
      gameType="CAPITALS"
      pageTitle="عواصم"
      icon={<Compass size={20} className="text-cyan-400" weight="fill" />}
      configName="عواصم"
      buildSettings={() => ({ totalRounds, answerDurationSeconds, difficulty })}
      renderSettings={() => (
        <>
          <Input
            label="عدد الجولات"
            type="number"
            min={1}
            max={195}
            value={totalRounds}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="مدة الإجابة (ثانية)"
            type="number"
            min={5}
            max={120}
            value={answerDurationSeconds}
            onChange={(e) => setAnswerDurationSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <p className="text-xs text-ink-muted">
            كل جولة يظهر علم وأسم دولة، وأول تعليق بعاصمتها الصح ياخد نقطة — اللعبة بتخلص تلقائي بعد آخر جولة، والفائز
            صاحب أعلى نقط.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <CapitalsGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "QUESTION" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هتبدأ أول دولة دلوقتي"
          : state.phase === "QUESTION" || state.phase === "REVEALED"
            ? `الجولة ${state.round} / ${state.settings.totalRounds} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الأسئلة"
      autoBegin
    />
  );
}
