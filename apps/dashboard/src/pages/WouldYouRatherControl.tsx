import { Scales } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { Input } from "../components/Input";
import { WouldYouRatherGameView } from "../components/WouldYouRatherGameView";
import type { WouldYouRatherState } from "../lib/liveApi";

export default function WouldYouRatherControl() {
  const [voteDurationSeconds, setVoteDurationSeconds] = useState(20);

  return (
    <GameControlShell<WouldYouRatherState>
      gameType="WOULD_YOU_RATHER"
      pageTitle="إما / أو"
      icon={<Scales size={20} className="text-accent" weight="fill" />}
      configName="إما / أو"
      buildSettings={() => ({ voteDurationSeconds })}
      renderSettings={() => (
        <>
          <Input
            label="مدة التصويت (ثانية)"
            type="number"
            min={5}
            max={120}
            value={voteDurationSeconds}
            onChange={(e) => setVoteDurationSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-muted">
            كل سؤال بيعرض خيارين على الشاشة والمشاهدين يصوتوا بكتابة 1 أو 2 في الشات — مفيش ترتيب ولا فائز، المتعة في
            نتيجة التصويت نفسها. الأسئلة من النظام وبتتبدل تلقائياً لحد ما توقف اللعبة.
          </p>
        </>
      )}
      renderGameView={(state, chat, onNewRound) => (
        <WouldYouRatherGameView state={state} chat={chat} onNewRound={onNewRound} />
      )}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "VOTING" || state.phase === "RESULTS"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هيبدأ أول سؤال دلوقتي"
          : state.phase === "VOTING" || state.phase === "RESULTS"
            ? `سؤال ${state.round} — ${state.votesA + state.votesB} صوت`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ الأسئلة"
      autoBegin
    />
  );
}
