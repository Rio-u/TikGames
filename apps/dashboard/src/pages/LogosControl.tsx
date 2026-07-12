import { Storefront } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { LogosGameView } from "../components/LogosGameView";
import type { LogosState } from "../lib/liveApi";

export default function LogosControl() {
  const [totalRounds, setTotalRounds] = useState(10);
  const [answerDurationSeconds, setAnswerDurationSeconds] = useState(15);

  return (
    <GameControlShell<LogosState>
      gameType="LOGOS"
      pageTitle="شعارات"
      icon={<Storefront size={20} className="text-amber-400" weight="fill" />}
      configName="شعارات"
      buildSettings={() => ({ totalRounds, answerDurationSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="عدد الجولات"
            type="number"
            min={1}
            max={330}
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
            كل جولة يظهر شعار ماركة، وأول تعليق باسمها الصح ياخد نقطة — اللعبة بتخلص تلقائي بعد آخر جولة، والفائز
            صاحب أعلى نقط.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <LogosGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "QUESTION" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هيبدأ أول شعار دلوقتي"
          : state.phase === "QUESTION" || state.phase === "REVEALED"
            ? `الجولة ${state.round} / ${state.settings.totalRounds} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الأسئلة"
      autoBegin
    />
  );
}
