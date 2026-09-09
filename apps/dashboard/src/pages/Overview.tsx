import {
  ArrowRight,
  Broadcast,
  ChartLineUp,
  CheckCircle,
  Clock,
  GameController,
  Plugs,
  Sparkle,
  TiktokLogo,
  Timer,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../components/Button";
import { DashboardShell } from "../components/DashboardShell";
import { EmptyState } from "../components/EmptyState";
import { ProductCard } from "../components/ProductCard";
import { SkeletonBlock, StatTile } from "../components/StatTile";
import { useAuth } from "../lib/auth";
import type { LiveSession } from "../lib/liveApi";
import { useLiveSession } from "../lib/useLiveSession";
import { useAnalytics, useProducts } from "../lib/usePlatform";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "مساء الخير";
  if (hour < 12) return "صباح الخير";
  if (hour < 18) return "يومك سعيد";
  return "مساء الخير";
}

const LIVE_STATUS: Record<
  LiveSession["status"],
  { label: string; tone: string; dot: string; pulse?: boolean }
> = {
  LIVE: { label: "اللايف شغال", tone: "text-emerald-300", dot: "bg-emerald-400", pulse: true },
  CONNECTING: { label: "بيتصل...", tone: "text-amber-300", dot: "bg-amber-400", pulse: true },
  PENDING: { label: "بيتصل...", tone: "text-amber-300", dot: "bg-amber-400", pulse: true },
  ERROR: { label: "الاتصال فشل", tone: "text-red-300", dot: "bg-red-400" },
  ENDED: { label: "اللايف خلص", tone: "text-ink-muted", dot: "bg-ink-muted" },
};

/** A single connection fact — TikTok linked, live running, ... Deliberately shows failures as
 *  failures (§49): a red row is more useful than a row that quietly says nothing. */
function StatusRow({
  ok,
  label,
  value,
  action,
}: {
  ok: boolean | null;
  label: string;
  value: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-glass-border/60 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {ok === null ? (
          <SkeletonBlock className="h-4 w-4 rounded-full" />
        ) : ok ? (
          <CheckCircle size={17} weight="fill" className="shrink-0 text-emerald-400" />
        ) : (
          <WarningCircle size={17} weight="fill" className="shrink-0 text-amber-400" />
        )}
        <span className="truncate text-sm text-ink-muted">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-medium">{value}</span>
        {action && (
          <Link to={action.to} className="text-xs font-semibold text-accent hover:underline">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const { liveSession, loadingLiveSession } = useLiveSession();
  const { products, loading: loadingProducts } = useProducts();
  const { summary, loading: loadingAnalytics } = useAnalytics();

  if (!user) return null;

  const firstName = user.displayName.split(" ")[0];
  const live = liveSession ? LIVE_STATUS[liveSession.status] : null;
  const subscription = user.subscription;
  const featuredProducts = products.filter((p) => p.status !== "COMING_SOON").slice(0, 3);
  const hasHistory = (summary?.totals.liveSessions ?? 0) > 0;

  const subscriptionLabel = !subscription
    ? "مفيش اشتراك"
    : subscription.status === "TRIAL"
      ? `تجربة — ${Math.max(0, subscription.trialGamesLimit - subscription.trialGamesUsed)} لعبة متبقية`
      : subscription.status === "ACTIVE"
        ? "اشتراك فعّال"
        : subscription.status === "EXPIRED"
          ? "التجربة خلصت"
          : "موقوف";

  return (
    <DashboardShell
      title={`${getGreeting()}، ${firstName} 👋`}
      description="ده مركز التحكم بتاعك — حالة اللايف، الأدوات الشغالة، وملخص نشاطك كله في مكان واحد."
      actions={
        liveSession && liveSession.status !== "ENDED" ? (
          <ButtonLink to="/dashboard/tikgames" size="md">
            <GameController size={16} weight="fill" />
            شغّل لعبة
          </ButtonLink>
        ) : (
          <ButtonLink to="/live/connect" size="md">
            <Broadcast size={16} weight="fill" />
            ابدأ لايف
          </ButtonLink>
        )
      }
    >
      <div className="space-y-8">
        {/* --- Live + connection state ------------------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl lg:col-span-2"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/12 via-transparent to-accent/8"
            />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-ink-muted">حالة اللايف</p>
                {loadingLiveSession ? (
                  <SkeletonBlock className="h-8 w-44" />
                ) : live && liveSession ? (
                  <div className="flex items-center gap-2.5">
                    <span className={`relative flex h-2.5 w-2.5 rounded-full ${live.dot}`}>
                      {live.pulse && (
                        <span
                          className={`absolute inset-0 animate-ping rounded-full ${live.dot} opacity-75`}
                        />
                      )}
                    </span>
                    <span className={`text-xl font-bold ${live.tone}`}>{live.label}</span>
                    <span className="text-sm text-ink-muted" dir="ltr">
                      <bdi>@{liveSession.channelUsername}</bdi>
                    </span>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-ink-muted">مفيش لايف شغال</p>
                )}
              </div>
              <div className="flex gap-2">
                <ButtonLink to="/live/connect" variant="secondary" size="md" magnetic={false}>
                  <Plugs size={15} weight="bold" />
                  إدارة اللايف
                </ButtonLink>
                {liveSession && liveSession.status !== "ENDED" && (
                  <ButtonLink to="/live/simulate" variant="secondary" size="md" magnetic={false}>
                    محاكاة كومنتات
                  </ButtonLink>
                )}
              </div>
            </div>

            <div className="mt-5">
              <StatusRow
                ok={user.tiktokConnected}
                label="حساب TikTok"
                value={user.tiktokConnected ? "مربوط" : "مش مربوط"}
                action={user.tiktokConnected ? undefined : { to: "/account", label: "اربطه" }}
              />
              <StatusRow
                ok={loadingLiveSession ? null : !!liveSession && liveSession.status !== "ENDED"}
                label="جلسة لايف"
                value={liveSession && liveSession.status !== "ENDED" ? "نشطة" : "مفيش"}
              />
              <StatusRow
                ok={subscription ? subscription.status === "TRIAL" || subscription.status === "ACTIVE" : false}
                label="الاشتراك"
                value={subscriptionLabel}
                action={{ to: "/subscription", label: "التفاصيل" }}
              />
            </div>
          </motion.div>

          {/* --- TikGames product promo (§30) --------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="relative flex flex-col overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-primary/18 via-glass to-accent/10 p-6 backdrop-blur-xl"
          >
            <span className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative mb-3 flex items-center gap-2">
              <GameController size={22} weight="fill" className="text-accent" />
              <span className="font-bold">TikGames</span>
            </div>
            <p className="relative text-sm leading-relaxed text-ink-muted">
              حوّل شات لايفك للعبة جماعية — المشاهد بيلعب بكومنت، من غير حساب ولا تحميل.
            </p>
            <ul className="relative mt-4 space-y-1.5 text-xs text-ink-muted">
              <li className="flex items-center gap-2">
                <Sparkle size={12} weight="fill" className="text-accent" />
                12 لعبة تفاعلية
              </li>
              <li className="flex items-center gap-2">
                <Sparkle size={12} weight="fill" className="text-accent" />
                تفاعل لحظي على الاستريم
              </li>
              <li className="flex items-center gap-2">
                <Sparkle size={12} weight="fill" className="text-accent" />
                المشاهد مش محتاج حساب
              </li>
            </ul>
            <div className="relative mt-auto pt-5">
              <ButtonLink to="/dashboard/tikgames" size="md" className="w-full">
                افتح TikGames
                <ArrowRight size={15} weight="bold" className="rtl:rotate-180" />
              </ButtonLink>
            </div>
          </motion.div>
        </div>

        {/* --- Activity summary ------------------------------------------------------- */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ChartLineUp size={20} weight="fill" className="text-accent" />
              ملخص نشاطك
            </h2>
            <Link to="/analytics" className="text-xs font-semibold text-accent hover:underline">
              كل التحليلات
            </Link>
          </div>

          {!loadingAnalytics && !hasHistory ? (
            <EmptyState
              icon={Broadcast}
              title="لسه مافيش لايف"
              description="أول ما تبدأ لايف وتشغّل لعبة، الأرقام هنا هتتملي من جلساتك إنت — مش أرقام تجريبية."
              action={
                <ButtonLink to="/live/connect" size="md">
                  ابدأ أول لايف
                  <ArrowRight size={15} weight="bold" className="rtl:rotate-180" />
                </ButtonLink>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={Broadcast}
                label="عدد اللايفات"
                value={summary?.totals.liveSessions ?? 0}
                loading={loadingAnalytics}
              />
              <StatTile
                icon={Timer}
                label="إجمالي وقت البث"
                value={`${summary?.totals.totalLiveMinutes ?? 0} د`}
                hint={
                  summary && summary.totals.averageLiveMinutes > 0
                    ? `متوسط ${summary.totals.averageLiveMinutes} دقيقة للايف`
                    : undefined
                }
                loading={loadingAnalytics}
              />
              <StatTile
                icon={GameController}
                label="ألعاب اتشغّلت"
                value={summary?.totals.gamesStarted ?? 0}
                hint={
                  summary ? `${summary.totals.gamesFinished} خلصت لآخرها` : undefined
                }
                loading={loadingAnalytics}
              />
              <StatTile
                icon={Users}
                label="مشاهدين شاركوا"
                value={summary?.totals.uniqueViewers ?? 0}
                loading={loadingAnalytics}
              />
            </div>
          )}
        </section>

        {/* --- Recent sessions -------------------------------------------------------- */}
        {hasHistory && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Clock size={20} weight="fill" className="text-accent" />
              آخر الجلسات
            </h2>
            <div className="overflow-x-auto rounded-3xl border border-glass-border bg-glass backdrop-blur-xl">
              <table className="w-full min-w-[560px] text-right text-sm">
                <thead className="border-b border-glass-border text-xs text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">القناة</th>
                    <th className="px-5 py-3 font-medium">الحالة</th>
                    <th className="px-5 py-3 font-medium">المدة</th>
                    <th className="px-5 py-3 font-medium">ألعاب</th>
                    <th className="px-5 py-3 font-medium">مشاركين</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.recentSessions.map((session) => (
                    <tr key={session.id} className="border-b border-glass-border/50 last:border-b-0">
                      <td className="px-5 py-3" dir="ltr">
                        <bdi>@{session.channelUsername}</bdi>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">
                        {LIVE_STATUS[session.status]?.label ?? session.status}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-ink-muted">
                        {session.durationMinutes !== null ? `${session.durationMinutes} د` : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{session.gamesPlayed}</td>
                      <td className="px-5 py-3 tabular-nums">{session.participants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* --- Product ecosystem ------------------------------------------------------ */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkle size={20} weight="fill" className="text-accent" />
              أدواتك
            </h2>
            <Link to="/tools" className="text-xs font-semibold text-accent hover:underline">
              كل الأدوات
            </Link>
          </div>
          {loadingProducts ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonBlock className="h-56" />
              <SkeletonBlock className="h-56" />
              <SkeletonBlock className="h-56" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {!user.tiktokConnected && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
            <div className="flex items-center gap-3">
              <TiktokLogo size={22} weight="fill" className="text-amber-300" />
              <div>
                <p className="text-sm font-semibold">اربط حساب TikTok بتاعك</p>
                <p className="text-xs text-ink-muted">
                  الربط بيخلي اسمك وصورتك يظهروا في الأوفرلاي، وبيسهّل بدء اللايف.
                </p>
              </div>
            </div>
            <Link to="/account">
              <Button variant="secondary" size="md" magnetic={false}>
                اربط دلوقتي
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
