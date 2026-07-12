import { FlagBanner } from "@phosphor-icons/react";
import { useState } from "react";
import { FlagsGameView } from "../components/FlagsGameView";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import type { FlagsState } from "../lib/liveApi";

export default function FlagsControl() {
  const [totalRounds, setTotalRounds] = useState(10);
  const [answerDurationSeconds, setAnswerDurationSeconds] = useState(15);

  return (
    <GameControlShell<FlagsState>
      gameType="FLAGS"
      pageTitle="أعلام"
      icon={<FlagBanner size={20} className="text-accent" weight="fill" />}
      configName="أعلام"
      buildSettings={() => ({ totalRounds, answerDurationSeconds })}
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
          <p className="text-xs text-ink-muted">
            كل جولة يظهر علم دولة، وأول تعليق باسم الدولة الصح ياخد نقطة — اللعبة بتخلص تلقائي بعد آخر جولة، والفائز
            صاحب أعلى نقط.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <FlagsGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "QUESTION" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هيبدأ أول علم دلوقتي"
          : state.phase === "QUESTION" || state.phase === "REVEALED"
            ? `الجولة ${state.round} / ${state.settings.totalRounds} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الأعلام"
      autoBegin
    />
  );
}
