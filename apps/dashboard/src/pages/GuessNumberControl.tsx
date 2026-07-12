import { LockKey, MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { GameControlShell } from "../components/GameControlShell";
import { GuessNumberGameView } from "../components/GuessNumberGameView";
import { Input } from "../components/Input";
import type { GuessNumberState } from "../lib/liveApi";

export default function GuessNumberControl() {
  const [secret, setSecret] = useState("");
  const [hint, setHint] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(45);

  return (
    <GameControlShell<GuessNumberState>
      gameType="GUESS_NUMBER"
      pageTitle="تخمين رقم أو كلمة"
      icon={<MagnifyingGlass size={20} className="text-accent" weight="fill" />}
      configName="تخمين رقم أو كلمة"
      buildSettings={() => ({ secret: secret.trim(), hint: hint.trim(), durationSeconds })}
      renderSettings={() => (
        <>
          <div>
            <Input
              label="الرقم أو الكلمة السرية"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              maxLength={60}
              className="max-w-sm"
            />
            <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
              <LockKey size={13} />
              سرية تماماً — محدش هيشوفها غيرك، هتتكشف بس لما حد يخمنها صح
            </p>
          </div>
          <Input
            label="تلميح (اختياري)"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={120}
            className="max-w-sm"
          />
          <Input
            label="مدة التخمين (ثانية)"
            type="number"
            min={10}
            max={300}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value))}
            className="max-w-xs"
          />
        </>
      )}
      renderGameView={(state, chat, onNewRound) => <GuessNumberGameView state={state} chat={chat} onNewRound={onNewRound} />}
      isWaitingPhase={(state) => state.phase === "WAITING_TO_START"}
      isActivePhase={(state) => state.phase === "GUESSING"}
      statusText={(state) =>
        state.phase === "WAITING_TO_START"
          ? "هيبدأ التخمين دلوقتي"
          : state.phase === "GUESSING"
            ? `${state.players.length} بيحاولوا`
            : "خلصت اللعبة"
      }
      beginLabel="ابدأ التخمين"
      autoBegin
    />
  );
}
