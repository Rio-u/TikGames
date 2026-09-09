import { CheckCircle, Clock, CreditCard, Gift, Info, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { DashboardShell } from "../components/DashboardShell";
import { Input } from "../components/Input";
import { redeemCode, type SubscriptionInfo } from "../lib/api";
import { useAuth } from "../lib/auth";

const STATUS_VIEW: Record<
  SubscriptionInfo["status"],
  { label: string; tone: string; ring: string; description: string }
> = {
  TRIAL: {
    label: "تجربة مجانية",
    tone: "text-accent",
    ring: "border-accent/30 bg-accent/10",
    description: "عندك وصول كامل للمكتبة خلال فترة التجربة.",
  },
  ACTIVE: {
    label: "اشتراك فعّال",
    tone: "text-emerald-300",
    ring: "border-emerald-400/30 bg-emerald-500/10",
    description: "كل المنتجات المتاحة مفتوحة لحسابك.",
  },
  EXPIRED: {
    label: "انتهت الصلاحية",
    tone: "text-amber-300",
    ring: "border-amber-400/30 bg-amber-500/10",
    description: "حسابك موجود زي ما هو، بس تشغيل الألعاب متوقف لحد ما الاشتراك يتفعّل.",
  },
  SUSPENDED: {
    label: "موقوف",
    tone: "text-red-300",
    ring: "border-red-400/30 bg-red-500/10",
    description: "الحساب موقوف من الإدارة. كلّم الدعم لو ده مش متوقع.",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!user) return null;

  const subscription = user.subscription;
  const view = subscription ? STATUS_VIEW[subscription.status] : null;
  const gamesLeft = subscription
    ? Math.max(0, subscription.trialGamesLimit - subscription.trialGamesUsed)
    : 0;
  const usedPercent =
    subscription && subscription.trialGamesLimit > 0
      ? Math.min(100, (subscription.trialGamesUsed / subscription.trialGamesLimit) * 100)
      : 0;

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await redeemCode(code.trim());
      setMessage({
        kind: "ok",
        text: `تم! اتضافت ${result.gamesGranted} لعبة لرصيدك (الإجمالي دلوقتي ${result.trialGamesLimit}).`,
      });
      setCode("");
      await refreshUser();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "الكود مش صحيح",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="الاشتراك"
      description="حالة حسابك ورصيدك. التفعيل حالياً بيتم يدوياً من الإدارة — الدفع الأوتوماتيكي هيتضاف من غير ما تحتاج تعمل حاجة."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {subscription && view ? (
            <div className={`rounded-3xl border p-6 backdrop-blur-xl ${view.ring}`}>
              <div className="mb-4 flex items-center gap-2.5">
                {subscription.status === "ACTIVE" || subscription.status === "TRIAL" ? (
                  <CheckCircle size={22} weight="fill" className={view.tone} />
                ) : (
                  <WarningCircle size={22} weight="fill" className={view.tone} />
                )}
                <h2 className={`text-xl font-bold ${view.tone}`}>{view.label}</h2>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{view.description}</p>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-glass-border bg-glass p-4">
                  <dt className="mb-1 text-xs text-ink-muted">نهاية التجربة</dt>
                  <dd className="text-sm font-semibold">{formatDate(subscription.trialEndsAt)}</dd>
                </div>
                <div className="rounded-2xl border border-glass-border bg-glass p-4">
                  <dt className="mb-1 text-xs text-ink-muted">نهاية الفترة الحالية</dt>
                  <dd className="text-sm font-semibold">
                    {formatDate(subscription.currentPeriodEnd)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-2xl border border-glass-border bg-glass p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">رصيد الألعاب</span>
                  <span className="font-semibold tabular-nums">
                    {subscription.trialGamesUsed} / {subscription.trialGamesLimit}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-primary to-accent transition-[width] duration-500"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {gamesLeft > 0 ? `فاضل ${gamesLeft} لعبة` : "الرصيد خلص"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl">
              <p className="text-sm text-ink-muted">مفيش اشتراك مرتبط بالحساب ده.</p>
            </div>
          )}

          <form
            onSubmit={handleRedeem}
            className="rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <Gift size={20} weight="duotone" className="text-accent" />
              <h2 className="font-bold">عندك كود؟</h2>
            </div>
            <p className="mb-4 text-sm text-ink-muted">
              اكتب كود التفعيل هنا وهيتضاف لرصيدك على طول.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  label="كود التفعيل"
                  name="redemptionCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="TIK-XXXX-XXXX"
                  dir="ltr"
                />
              </div>
              <Button
                type="submit"
                size="md"
                className="sm:mt-7"
                disabled={submitting || !code.trim()}
              >
                {submitting ? "بيتفعّل..." : "فعّل الكود"}
              </Button>
            </div>
            {message && (
              <p
                className={`mt-3 text-sm ${message.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}
              >
                {message.text}
              </p>
            )}
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard size={20} weight="duotone" className="text-accent" />
              <h2 className="font-bold">الدفع</h2>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              مفيش بوابة دفع مربوطة دلوقتي. التفعيل بيتم يدوياً من الإدارة، وأي اشتراك مفعّل
              بالطريقة دي بيفضل شغال زي ما هو لما الدفع الأوتوماتيكي ينزل.
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-glass-border bg-canvas-elevated/60 p-3">
              <Info size={15} weight="fill" className="mt-0.5 shrink-0 text-ink-muted" />
              <p className="text-xs leading-relaxed text-ink-muted">
                مش هيتطلب منك أي بيانات بطاقة في الوقت الحالي.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <Clock size={20} weight="duotone" className="text-accent" />
              <h2 className="font-bold">محتاج مساعدة؟</h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-ink-muted">
              لو التجربة خلصت أو محتاج رصيد إضافي، ابعتلنا من صفحة الحساب.
            </p>
            <ButtonLink to="/account" variant="secondary" size="md" magnetic={false}>
              صفحة الحساب
            </ButtonLink>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
