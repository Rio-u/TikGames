import { SignIn } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DiscordIcon, TiktokIcon } from "../components/BrandIcons";
import { Button, ButtonAnchor } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { OAuthDivider } from "../components/OAuthDivider";
import { Spinner } from "../components/Spinner";
import { discordAuthUrl, tiktokAuthUrl } from "../lib/api";
import { useAuth } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  tiktok_auth_failed: "الدخول بحساب TikTok فشل، جرب تاني أو استخدم الإيميل",
  discord_auth_failed: "الدخول بحساب Discord فشل، جرب تاني أو استخدم الإيميل",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = OAUTH_ERROR_MESSAGES[searchParams.get("error") ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) errors.email = "الإيميل مش صحيح";
    if (!password) errors.password = "اكتب كلمة المرور";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "حصل خطأ غير متوقع، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <HeroGlowArc />
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo size="lg" />
        </Link>

        <GlassCard hoverLift={false} className="p-7">
          <h1 className="mb-1 text-center text-xl font-bold">تسجيل الدخول</h1>
          <p className="mb-6 text-center text-sm text-ink-muted">أهلاً بيك تاني في TikGames</p>

          {oauthError && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
            >
              {oauthError}
            </p>
          )}

          <div className="space-y-2.5">
            <ButtonAnchor href={tiktokAuthUrl()} variant="secondary" size="lg" magnetic={false} className="w-full">
              <TiktokIcon size={18} />
              الدخول بحساب TikTok
            </ButtonAnchor>
            <ButtonAnchor href={discordAuthUrl()} variant="secondary" size="lg" magnetic={false} className="w-full">
              <DiscordIcon size={18} />
              الدخول بحساب Discord
            </ButtonAnchor>
          </div>

          <OAuthDivider />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="الإيميل"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />
            <Input
              label="كلمة المرور"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />

            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {formError}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? (
                <>
                  <Spinner /> جاري الدخول...
                </>
              ) : (
                <>
                  <SignIn size={18} weight="bold" /> دخول
                </>
              )}
            </Button>

            <p className="text-center text-sm text-ink-muted">
              مفيش حساب؟{" "}
              <Link to="/register" className="text-accent hover:underline">
                سجّل واحد جديد
              </Link>
            </p>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
