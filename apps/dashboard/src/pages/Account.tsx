import { CheckCircle, Key, WarningCircle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DiscordIcon, TiktokIcon } from "../components/BrandIcons";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { GlassCard } from "../components/GlassCard";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { changePasswordRequest, redeemCode, startDiscordLink, startTikTokLink, unlinkDiscord, unlinkTikTok } from "../lib/api";
import { useAuth } from "../lib/auth";

function subscriptionLabel(status: string): string {
  switch (status) {
    case "TRIAL":
      return "تجربة مجانية";
    case "ACTIVE":
      return "مشترك";
    case "EXPIRED":
      return "الاشتراك منتهي";
    case "SUSPENDED":
      return "الحساب موقوف";
    default:
      return status;
  }
}

function ConnectionRow({
  icon,
  label,
  connected,
  canUnlink,
  busy,
  onConnect,
  onDisconnect,
}: {
  icon: ReactNode;
  label: string;
  connected: boolean;
  canUnlink: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-glass-border bg-canvas-elevated/40 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-xs ${connected ? "text-emerald-400" : "text-ink-muted"}`}>
          {connected ? "متصل ✓" : "لسه مربوطش"}
        </p>
      </div>
      {connected ? (
        <Button variant="secondary" size="md" magnetic={false} disabled={busy || !canUnlink} onClick={onDisconnect}>
          فك الربط
        </Button>
      ) : (
        <Button variant="secondary" size="md" magnetic={false} disabled={busy} onClick={onConnect}>
          اربط
        </Button>
      )}
    </div>
  );
}

export default function Account() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [linkBusy, setLinkBusy] = useState<"discord" | "tiktok" | null>(null);
  const [linkNotice, setLinkNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  useEffect(() => {
    const linked = searchParams.get("linked");
    const linkError = searchParams.get("link_error");
    if (linked) {
      refreshUser();
      setLinkNotice({
        kind: "success",
        text: linked === "discord" ? "اترّبط حساب Discord بنجاح" : "اترّبط حساب TikTok بنجاح",
      });
      navigate("/account", { replace: true });
    } else if (linkError) {
      setLinkNotice({
        kind: "error",
        text: linkError.startsWith("discord")
          ? "حساب Discord ده مربوط بحساب TikGames تاني بالفعل"
          : "حساب TikTok ده مربوط بحساب TikGames تاني بالفعل",
      });
      navigate("/account", { replace: true });
    }
  }, []);

  if (!user) return null;

  const sub = user.subscription;
  const trialGamesLeft = sub ? Math.max(0, sub.trialGamesLimit - sub.trialGamesUsed) : 0;
  const trialProgress = sub && sub.trialGamesLimit > 0 ? Math.min(100, (sub.trialGamesUsed / sub.trialGamesLimit) * 100) : 0;

  async function handleConnect(provider: "discord" | "tiktok") {
    setLinkBusy(provider);
    setLinkNotice(null);
    try {
      const { url } = provider === "discord" ? await startDiscordLink() : await startTikTokLink();
      window.location.href = url;
    } catch (err) {
      setLinkNotice({ kind: "error", text: err instanceof Error ? err.message : "حصل خطأ غير متوقع" });
      setLinkBusy(null);
    }
  }

  async function handleDisconnect(provider: "discord" | "tiktok") {
    setLinkBusy(provider);
    setLinkNotice(null);
    try {
      if (provider === "discord") await unlinkDiscord();
      else await unlinkTikTok();
      await refreshUser();
    } catch (err) {
      setLinkNotice({ kind: "error", text: err instanceof Error ? err.message : "حصل خطأ غير متوقع" });
    } finally {
      setLinkBusy(null);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    setSavingPassword(true);
    try {
      await changePasswordRequest({
        currentPassword: user?.hasPassword ? currentPassword : undefined,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      await refreshUser();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleRedeemCode(e: FormEvent) {
    e.preventDefault();
    setRedeemError(null);
    setRedeemSuccess(null);
    setRedeeming(true);
    try {
      const result = await redeemCode(redeemCodeInput.trim());
      setRedeemSuccess(`تمت إضافة ${result.gamesGranted} ألعاب لحسابك 🎉`);
      setRedeemCodeInput("");
      await refreshUser();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setRedeeming(false);
    }
  }

  const canUnlinkDiscord = user.hasPassword || user.tiktokConnected;
  const canUnlinkTikTok = user.hasPassword || user.discordConnected;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-glass-border bg-canvas/70 backdrop-blur-2xl">
        <Container className="flex items-center justify-between py-4">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <Link to="/dashboard" className="text-sm text-ink-muted hover:text-ink">
            رجوع للداشبورد
          </Link>
        </Container>
      </header>

      <Container className="max-w-2xl space-y-6 py-10">
        <Reveal>
          <h1 className="text-2xl font-bold">حسابي</h1>
          <p className="mt-1.5 text-sm text-ink-muted">الاشتراك، الحسابات المربوطة، وكلمة السر.</p>
        </Reveal>

        {linkNotice && (
          <Reveal delay={0.02}>
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                linkNotice.kind === "success"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400/30 bg-red-500/10 text-red-300"
              }`}
            >
              {linkNotice.kind === "success" ? <CheckCircle size={18} /> : <WarningCircle size={18} />}
              {linkNotice.text}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.05}>
          <GlassCard hoverLift={false} className="p-6 sm:p-8">
            <p className="mb-1 text-sm text-ink-muted">حالة الاشتراك</p>
            <p className="text-2xl font-bold">
              {sub ? subscriptionLabel(sub.status) : "—"}
              {sub?.status === "TRIAL" && (
                <span className="mr-2 text-sm font-normal text-ink-muted">
                  باقي {trialGamesLeft} من {sub.trialGamesLimit} ألعاب مجانية
                </span>
              )}
            </p>
            {sub?.status === "TRIAL" && (
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${trialProgress}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-glow-sm"
                />
              </div>
            )}
          </GlassCard>
        </Reveal>

        <Reveal delay={0.065}>
          <GlassCard hoverLift={false} className="p-6 sm:p-8">
            <h2 className="mb-4 font-semibold">استخدام كود</h2>
            <form onSubmit={handleRedeemCode} className="flex max-w-sm flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="كود التفعيل"
                  dir="ltr"
                  value={redeemCodeInput}
                  onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <Button type="submit" variant="secondary" size="md" magnetic={false} disabled={redeeming || !redeemCodeInput.trim()}>
                {redeeming ? "جاري التفعيل..." : "فعّل الكود"}
              </Button>
            </form>
            {redeemError && (
              <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {redeemError}
              </p>
            )}
            {redeemSuccess && (
              <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {redeemSuccess}
              </p>
            )}
          </GlassCard>
        </Reveal>

        <Reveal delay={0.08}>
          <GlassCard hoverLift={false} className="p-6 sm:p-8">
            <h2 className="mb-4 font-semibold">الحسابات المربوطة</h2>
            <div className="space-y-3">
              <ConnectionRow
                icon={<TiktokIcon size={20} className="text-ink-muted" />}
                label="TikTok"
                connected={user.tiktokConnected}
                canUnlink={canUnlinkTikTok}
                busy={linkBusy === "tiktok"}
                onConnect={() => handleConnect("tiktok")}
                onDisconnect={() => handleDisconnect("tiktok")}
              />
              <ConnectionRow
                icon={<DiscordIcon size={20} className="text-ink-muted" />}
                label="Discord"
                connected={user.discordConnected}
                canUnlink={canUnlinkDiscord}
                busy={linkBusy === "discord"}
                onConnect={() => handleConnect("discord")}
                onDisconnect={() => handleDisconnect("discord")}
              />
            </div>
            {((user.discordConnected && !canUnlinkDiscord) || (user.tiktokConnected && !canUnlinkTikTok)) && (
              <p className="mt-3 text-xs text-ink-muted">
                مينفعش تفك ربط آخر طريقة دخول لحسابك — اعمل باسورد الأول أو اربط حساب تاني.
              </p>
            )}
          </GlassCard>
        </Reveal>

        <Reveal delay={0.11}>
          <GlassCard hoverLift={false} className="p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Key size={18} className="text-accent" />
              <h2 className="font-semibold">{user.hasPassword ? "تغيير كلمة السر" : "عمل كلمة سر"}</h2>
            </div>
            {!user.hasPassword && (
              <p className="mb-4 text-xs text-ink-muted">
                حسابك متعمل بـ TikTok/Discord من غير باسورد — اعمل واحدة عشان تقدر تدخل بالإيميل كمان.
              </p>
            )}
            <form onSubmit={handleChangePassword} className="max-w-sm space-y-3">
              {user.hasPassword && (
                <Input
                  label="كلمة السر الحالية"
                  type="password"
                  dir="ltr"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              )}
              <Input
                label="كلمة السر الجديدة"
                type="password"
                dir="ltr"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button type="submit" variant="secondary" size="md" magnetic={false} disabled={savingPassword}>
                {savingPassword ? "جاري الحفظ..." : "احفظ"}
              </Button>
              {passwordError && (
                <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  اتحفظت كلمة السر
                </p>
              )}
            </form>
          </GlassCard>
        </Reveal>
      </Container>
    </div>
  );
}
