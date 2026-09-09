import { VictoryCelebration } from "@tikgames/game-3d";

/**
 * The FINISHED-state payoff moment, shared by every game so winning always feels the same.
 *
 * A thin pass-through to `VictoryCelebration` in @tikgames/game-3d, kept as its own component
 * because twenty-five game views import this name — changing the celebration should never mean
 * touching twenty-five files.
 *
 * Unlike everything else in the 3D system this one has no variants and nothing to choose: it is
 * full-screen, it shows the winner's photo and name, and it looks the same in every game.
 */
export function WinnerCelebration({
  displayName,
  avatarUrl,
  handle,
  subtitle,
}: {
  displayName: string;
  avatarUrl: string | null;
  handle: string;
  subtitle?: string;
}) {
  return (
    <VictoryCelebration
      displayName={displayName}
      avatarUrl={avatarUrl}
      handle={handle}
      subtitle={subtitle}
    />
  );
}
