import { ArrowCounterClockwise, Crown, House } from "@phosphor-icons/react";
import { Button, ButtonLink } from "./Button";

/**
 * FINISHED-phase fallback for the "nobody actually won" case (streamer stopped early, or a
 * timer ran out with no one scoring) — every game's own reveal moment is WinnerCelebration, this
 * is what shows instead when `state.winner` is null. Dashboard only: the overlay stays a passive
 * viewer with no buttons, so it keeps its own plain message-only card.
 */
export function NoWinnerScreen({ message, onNewRound }: { message: string; onNewRound: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border border-glass-border bg-canvas-elevated/40 p-12 text-center">
      <Crown size={56} className="text-ink-muted" />
      <p className="max-w-sm text-lg text-ink-muted">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onNewRound}>
          <ArrowCounterClockwise size={16} weight="bold" />
          ابدأ دور جديد
        </Button>
        <ButtonLink to="/dashboard" variant="secondary" magnetic={false}>
          <House size={16} weight="bold" />
          الرجوع للداشبورد
        </ButtonLink>
      </div>
    </div>
  );
}
