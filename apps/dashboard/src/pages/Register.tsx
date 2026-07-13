import { CheckCircle } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DiscordIcon, TiktokIcon } from "../components/BrandIcons";
import { Button, ButtonAnchor } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { OAuthDivider } from "../components/OAuthDivider";
import { Spinner } from "../components/Spinner";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { discordAuthUrl, getAuthMethods, tiktokAuthUrl, type AuthMethods } from "../lib/api";
import { useAuth } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [methods, setMethods] = useState<AuthMethods>({ emailPassword: true, tiktok: true, discord: true });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    getAuthMethods()
      .then(setMethods)
      .catch(() => {});
  }, []);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!displayName.trim()) errors.displayName = "من فضلك اكتب اسمك";
    if (!USERNAME_RE.test(username)) errors.username = "3-20 حرف، إنجليزي وأرقام و _ بس";
    if (!EMAIL_RE.test(email)) errors.email = "الإيميل مش صحيح";
    if (password.length < 8) errors.password = "8 أحرف على الأقل";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(email, password, displayName, username, turnstileToken);
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
          <h1 className="mb-1 text-center text-xl font-bold">إنشاء حساب جديد</h1>
          <p className="mb-6 text-center text-sm text-ink-muted">
            تجربة مجانية لعدد من الألعاب، كامل الوصول، من غير بطاقة ائتمان
          </p>

          {(methods.tiktok || methods.discord) && (
            <>
              <div className="space-y-2.5">
                {methods.tiktok && (
                  <ButtonAnchor href={tiktokAuthUrl()} variant="secondary" size="lg" magnetic={false} className="w-full">
                    <TiktokIcon size={18} />
                    التسجيل بحساب TikTok
                  </ButtonAnchor>
                )}
                {methods.discord && (
                  <ButtonAnchor href={discordAuthUrl()} variant="secondary" size="lg" magnetic={false} className="w-full">
                    <DiscordIcon size={18} />
                    التسجيل بحساب Discord
                  </ButtonAnchor>
                )}
              </div>

              {methods.emailPassword && <OAuthDivider />}
            </>
          )}

          {methods.emailPassword ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                label="الاسم"
                name="displayName"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={fieldErrors.displayName}
              />
              <Input
                label="اسم المستخدم"
                name="username"
                autoComplete="username"
                dir="ltr"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                error={fieldErrors.username}
              />
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />

              <TurnstileWidget onToken={setTurnstileToken} />

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
                    <Spinner /> جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} weight="bold" /> ابدأ التجربة المجانية
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-ink-muted">
                عندك حساب؟{" "}
                <Link to="/login" className="text-accent hover:underline">
                  سجّل دخول
                </Link>
              </p>
            </form>
          ) : (
            !methods.tiktok &&
            !methods.discord && (
              <p className="text-center text-sm text-ink-muted">التسجيل متوقف مؤقتاً — حاول تاني بعدين.</p>
            )
          )}
        </GlassCard>
      </div>
    </div>
  );
}
