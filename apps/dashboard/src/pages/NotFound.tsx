import { ArrowRight } from "@phosphor-icons/react";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { ButtonLink } from "../components/Button";
import { Logo } from "../components/Logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <HeroGlowArc />
      <GlassCard hoverLift={false} className="max-w-md p-10 text-center">
        <div className="mb-6 flex justify-center">
          <Logo withText={false} size="lg" />
        </div>
        <p className="bg-gradient-to-r from-primary to-accent bg-clip-text text-6xl font-extrabold text-transparent">
          404
        </p>
        <h1 className="mt-4 text-xl font-bold">الصفحة مش موجودة</h1>
        <p className="mt-2 text-sm text-ink-muted">
          يمكن الرابط غلط أو الصفحة اتنقلت. ارجع للصفحة الرئيسية وكمّل من هناك.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink to="/">
            <ArrowRight size={18} weight="bold" className="rtl:rotate-180" />
            الصفحة الرئيسية
          </ButtonLink>
        </div>
      </GlassCard>
    </div>
  );
}
