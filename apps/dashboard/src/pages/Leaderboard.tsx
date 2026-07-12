import { Trophy } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Container } from "../components/Container";
import { DashboardHeader } from "../components/DashboardHeader";
import { GlassCard } from "../components/GlassCard";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { Reveal } from "../components/Reveal";
import { getLeaderboard, type ViewerRankingEntry } from "../lib/leaderboardApi";

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function RankRow({ entry, rank }: { entry: ViewerRankingEntry; rank: number }) {
  const medalled = rank < 3;
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${medalled ? "bg-white/5" : ""}`}>
      <span className={`w-6 shrink-0 text-center text-lg font-black ${medalled ? MEDAL_COLORS[rank] : "text-ink-muted"}`}>
        {rank + 1}
      </span>
      <PlayerAvatar displayName={entry.displayName} avatarUrl={entry.avatarUrl} size={40} ring={false} />
      <div className="min-w-0 flex-1">
        <bdi className="block truncate text-sm font-medium">{entry.displayName}</bdi>
        <p className="truncate text-xs text-ink-muted" dir="ltr">
          @{entry.viewerHandle}
        </p>
      </div>
      <div className="shrink-0 text-left">
        <p className="text-lg font-bold text-accent" dir="ltr">
          {entry.totalScore.toLocaleString("en-US")}
        </p>
        <p className="text-xs text-ink-muted">{entry.gamesPlayed} لعبة</p>
      </div>
    </div>
  );
}

/**
 * Every viewer who's ever scored in one of this streamer's lives, ranked by accumulated points —
 * scoped entirely to the logged-in streamer (`GET /leaderboard` filters by `streamerId` server-
 * side), so the same TikTok handle's rank here has nothing to do with their rank on any other
 * streamer's page.
 */
export default function Leaderboard() {
  const [rankings, setRankings] = useState<ViewerRankingEntry[] | null>(null);

  useEffect(() => {
    getLeaderboard()
      .then((data) => setRankings(data.rankings))
      .catch(() => setRankings([]));
  }, []);

  return (
    <div className="min-h-dvh">
      <DashboardHeader />

      <Container className="space-y-8 py-10">
        <Reveal>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Trophy size={26} weight="fill" className="text-accent" />
            ترتيب المشاهدين
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">نقاط كل مشاهد لعب في لايفاتك — من أول ما بدأت.</p>
        </Reveal>

        <Reveal delay={0.05}>
          <GlassCard hoverLift={false} className="p-4 sm:p-6">
            {rankings === null && <p className="p-6 text-center text-sm text-ink-muted">جاري التحميل...</p>}
            {rankings?.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-muted">
                لسه محدش لعب في لايف من لايفاتك — الترتيب هيظهر هنا أول ما حد يلعب.
              </p>
            )}
            {rankings && rankings.length > 0 && (
              <div className="divide-y divide-glass-border">
                {rankings.map((entry, i) => (
                  <RankRow key={entry.id} entry={entry} rank={i} />
                ))}
              </div>
            )}
          </GlassCard>
        </Reveal>
      </Container>
    </div>
  );
}
