import { Question } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { TriviaGameView } from "../components/TriviaGameView";
import type { TriviaState } from "../lib/liveApi";

export default function TriviaControl() {
  const [answerDurationSeconds, setAnswerDurationSeconds] = useState(20);

  return (
    <GameControlShell<TriviaState>
      gameType="TRIVIA"
      pageTitle="أسئلة عامة"
      icon={<Question size={20} className="text-accent" weight="fill" />}
      configName="أسئلة عامة"
      buildSettings={() => ({ answerDurationSeconds })}
      renderSettings={() => (
        <>
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
            خلفيات الأسئلة بيديرها الأدمن ومشتركة بين كل الاسترييمرز — أول سؤال بياخد خلفية عشوائية منها، والفائز
            هو صاحب أعلى نقط لما توقف اللعبة.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <TriviaGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "QUESTION" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هيبدأ أول سؤال دلوقتي"
          : state.phase === "QUESTION" || state.phase === "REVEALED"
            ? `سؤال ${state.round} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الأسئلة"
      autoBegin
    />
  );
}
