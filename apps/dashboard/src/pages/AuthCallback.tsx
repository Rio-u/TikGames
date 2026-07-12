import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";
import { exchangeOAuthCode } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setError("رابط الدخول ناقص، جرب تاني.");
      return;
    }

    exchangeOAuthCode(code)
      .then((data) => {
        loginWithTokens(data);
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
      });
  }, [searchParams, navigate, loginWithTokens]);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <HeroGlowArc />
      <GlassCard hoverLift={false} className="w-full max-w-sm p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo withText={false} size="lg" />
        </div>
        {error ? (
          <>
            <p role="alert" className="mb-4 text-sm text-red-300">
              {error}
            </p>
            <Link to="/login" className="text-sm text-accent hover:underline">
              ارجع لتسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <Spinner className="mx-auto mb-4 h-6 w-6 text-accent" />
            <p className="text-sm text-ink-muted">بنكمّل تسجيل الدخول...</p>
          </>
        )}
      </GlassCard>
    </div>
  );
}
