import { Lightning } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { SpeedWordGameView } from "../components/SpeedWordGameView";
import type { SpeedWordState } from "../lib/liveApi";

export default function SpeedWordControl() {
  const [totalRounds, setTotalRounds] = useState(10);
  const [answerDurationSeconds, setAnswerDurationSeconds] = useState(12);

  return (
    <GameControlShell<SpeedWordState>
      gameType="SPEED_WORD"
      pageTitle="أسرع"
      icon={<Lightning size={20} className="text-accent" weight="fill" />}
      configName="أسرع"
      buildSettings={() => ({ totalRounds, answerDurationSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="عدد الكلمات"
            type="number"
            min={1}
            max={50}
            value={totalRounds}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="مدة الإجابة (ثانية)"
            type="number"
            min={5}
            max={60}
            value={answerDurationSeconds}
            onChange={(e) => setAnswerDurationSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            خلفيات الكلمات بيديرها الأدمن ومشتركة بين كل الاسترييمرز — كل كلمة عربي أو إنجليزي بتاخد خلفية عشوائية
            منها، وأول تعليق يكتبها بالظبط ياخد نقطة. الفائز هو صاحب أعلى نقط لما توقف اللعبة.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <SpeedWordGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "QUESTION" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هتبدأ أول كلمة دلوقتي"
          : state.phase === "QUESTION" || state.phase === "REVEALED"
            ? `كلمة ${state.round} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الكلمات"
      autoBegin
    />
  );
}
