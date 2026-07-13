import { ShieldCheck } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DiscordIcon } from "../components/BrandIcons";
import { Button, ButtonAnchor } from "../components/Button";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { OAuthDivider } from "../components/OAuthDivider";
import { Spinner } from "../components/Spinner";
import { discordAuthUrl } from "../lib/api";
import { useAuth } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A separate, unlinked-from-anywhere login entry point for the admin panel — deliberately NOT
 * gated by AuthMethodToggle (those exist to stop public signup spam, not to lock an admin out of
 * their own recovery path) and not discoverable from the public site, same obfuscated-URL
 * convention as /d7admind7 itself. Login only, no registration.
 */
export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      const user = await login(email, password);
      navigate(user.role === "ADMIN" ? "/d7admind7" : "/dashboard");
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
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo size="lg" />
        </div>

        <GlassCard hoverLift={false} className="p-7">
          <div className="mb-1 flex items-center justify-center gap-2">
            <ShieldCheck size={20} className="text-accent" weight="fill" />
            <h1 className="text-xl font-bold">دخول الإدارة</h1>
          </div>
          <p className="mb-6 text-center text-sm text-ink-muted">للأدمن بس</p>

          <ButtonAnchor href={discordAuthUrl()} variant="secondary" size="lg" magnetic={false} className="w-full">
            <DiscordIcon size={18} />
            الدخول بحساب Discord
          </ButtonAnchor>

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
                "دخول"
              )}
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
