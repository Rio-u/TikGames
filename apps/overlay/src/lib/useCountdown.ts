import { useEffect, useState } from "react";

/** Ticks down the seconds left until `endsAt`, off a server-authoritative timestamp. */
export function useCountdown(endsAt: string | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(null);
      return;
    }
    const targetMs = new Date(endsAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [endsAt]);

  return secondsLeft;
}
