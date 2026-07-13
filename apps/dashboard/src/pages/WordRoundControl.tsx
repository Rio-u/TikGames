import { PuzzlePiece } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { WordRoundGameView } from "../components/WordRoundGameView";
import type { WordRoundState } from "../lib/liveApi";

export default function WordRoundControl() {
  const [totalRounds, setTotalRounds] = useState(8);
  const [roundSeconds, setRoundSeconds] = useState(45);

  return (
    <GameControlShell<WordRoundState>
      gameType="WORD_ROUND"
      pageTitle="جولة كلمات"
      icon={<PuzzlePiece size={20} className="text-accent" weight="fill" />}
      configName="جولة كلمات"
      buildSettings={() => ({ totalRounds, roundSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="عدد الجولات"
            type="number"
            min={1}
            max={12}
            value={totalRounds}
            onChange={(e) => setTotalRounds(Number(e.target.value))}
            className="max-w-xs"
          />
          <Input
            label="مدة الجولة (ثانية)"
            type="number"
            min={20}
            max={120}
            value={roundSeconds}
            onChange={(e) => setRoundSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            كل جولة يظهر حرف مميز وحروف زيادة، وأي حد في الشات يكتب كلمة صحيحة فيها الحرف المميز ياخد نقط على قد طول
            الكلمة — أي عدد من اللاعبين ممكن يسجلوا في نفس الجولة، واللعبة بتخلص تلقائي بعد آخر جولة، والفائز صاحب أعلى نقط.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => (
        <WordRoundGameView state={state} chat={chat} onNewRound={onNewRound} />
      )}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "PUZZLE" || state.phase === "REVEALED"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هتبدأ أول جولة دلوقتي"
          : state.phase === "PUZZLE" || state.phase === "REVEALED"
            ? `الجولة ${state.round} / ${state.settings.totalRounds} — ${state.players.length} لاعبين سجلوا نقط`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ جولة الكلمات"
      autoBegin
    />
  );
}
