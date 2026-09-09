import { ArrowRight, Broadcast, ChartLineUp, GameController, Timer, Trophy, Users } from "@phosphor-icons/react";
import { ButtonLink } from "../components/Button";
import { DashboardShell } from "../components/DashboardShell";
import { EmptyState } from "../components/EmptyState";
import { SkeletonBlock, StatTile } from "../components/StatTile";
import { GAMES } from "../data/games";
import { useAnalytics } from "../lib/usePlatform";

const GAME_NAMES = new Map(GAMES.map((g) => [g.id, { name: g.nameAr, emoji: g.emoji }]));

export default function Analytics() {
  const { summary, loading, error } = useAnalytics();

  const totals = summary?.totals;
  const hasHistory = (totals?.liveSessions ?? 0) > 0;
  const maxGameCount = summary?.gamesByType[0]?.count ?? 0;

  return (
    <DashboardShell
      title="التحليلات"
      description="أرقام محسوبة من جلساتك إنت بس. لسه في بدايتها — بتغطي اللايفات والألعاب والمشاهدين، والباقي بيتضاف مع كل ميزة جديدة."
    >
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={ChartLineUp} title="تعذّر تحميل التحليلات" description={error} />
      ) : !hasHistory ? (
        <EmptyState
          icon={ChartLineUp}
          title="مفيش بيانات لسه"
          description="التحليلات بتتبني من لايفاتك الحقيقية. ابدأ لايف وشغّل لعبة، وأول ما تخلص هتلاقي الأرقام هنا."
          action={
            <ButtonLink to="/live/connect" size="md">
              ابدأ أول لايف
              <ArrowRight size={15} weight="bold" className="rtl:rotate-180" />
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-sm font-semibold text-ink-muted">البث</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={Broadcast} label="إجمالي اللايفات" value={totals!.liveSessions} />
              <StatTile
                icon={Broadcast}
                label="لايفات مكتملة"
                value={totals!.completedLiveSessions}
                hint="بدأت وانتهت بشكل طبيعي"
              />
              <StatTile icon={Timer} label="إجمالي وقت البث" value={`${totals!.totalLiveMinutes} د`} />
              <StatTile
                icon={Timer}
                label="متوسط مدة اللايف"
                value={`${totals!.averageLiveMinutes} د`}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold text-ink-muted">الألعاب والمشاهدين</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={GameController} label="ألعاب اتشغّلت" value={totals!.gamesStarted} />
              <StatTile
                icon={GameController}
                label="ألعاب خلصت"
                value={totals!.gamesFinished}
                hint={
                  totals!.gamesStarted > 0
                    ? `${Math.round((totals!.gamesFinished / totals!.gamesStarted) * 100)}% من اللي بدأ`
                    : undefined
                }
              />
              <StatTile icon={Users} label="مشاهدين مختلفين" value={totals!.uniqueViewers} />
              <StatTile
                icon={Trophy}
                label="إجمالي النقاط"
                value={totals!.totalViewerScore}
                hint={`عبر ${totals!.totalViewerGamesPlayed} مشاركة`}
              />
            </div>
          </section>

          {summary!.gamesByType.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold text-ink-muted">أكتر ألعاب بتشغّلها</h2>
              <div className="space-y-2.5 rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl">
                {summary!.gamesByType.map((row) => {
                  const game = GAME_NAMES.get(row.gameType);
                  const width = maxGameCount > 0 ? (row.count / maxGameCount) * 100 : 0;
                  return (
                    <div key={row.gameType} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm">
                        {game ? `${game.emoji} ${game.name}` : row.gameType}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-primary to-accent"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-left text-sm tabular-nums text-ink-muted">
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
