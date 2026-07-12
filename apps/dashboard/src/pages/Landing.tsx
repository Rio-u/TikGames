import {
  ArrowRight,
  Broadcast,
  ChatCircleDots,
  Gauge,
  Lightning,
  Play,
  Plus,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { ButtonAnchor, ButtonLink } from "../components/Button";
import { Container } from "../components/Container";
import { CursorGlow } from "../components/CursorGlow";
import { Footer } from "../components/Footer";
import { GAMES } from "../data/games";
import { GameCard } from "../components/GameCard";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Navbar } from "../components/Navbar";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { fadeUp, staggerContainer, viewportOnce } from "../lib/motion";

// Heavy (three.js) — code-split so only the landing page pays for it.
const GLSLHills = lazy(() => import("../components/GLSLHills").then((m) => ({ default: m.GLSLHills })));
const GamesScene = lazy(() =>
  import("../components/GamesScene").then((m) => ({ default: m.GamesScene })),
);

const STEPS = [
  {
    n: "01",
    icon: Sparkle,
    title: "سجّل واحصل على تجربتك",
    desc: "حساب جديد يديك تجربة مجانية 3 أيام بكامل الوصول للمكتبة، من غير أي دفع.",
  },
  {
    n: "02",
    icon: Broadcast,
    title: "اختار لعبة واربط الـ Overlay",
    desc: "اختار من مكتبة الألعاب، واحصل على رابط Overlay تحطه كـ Browser Source في OBS.",
  },
  {
    n: "03",
    icon: Play,
    title: "شغّل اللايف وخلي التعليقات تلعب",
    desc: "المشاهدين يكتبوا في الشات، واللعبة تتفاعل على الشاشة لحظياً قدام عينك.",
  },
];

const FEATURES = [
  {
    icon: Broadcast,
    title: "Overlay شفاف جاهز لـ OBS",
    desc: "رابط واحد تحطه Browser Source، وكل حاجة بتتحدث لحظياً من غير ما تلمس الإعدادات تاني.",
    big: true,
  },
  {
    icon: Lightning,
    title: "استجابة لحظية",
    desc: "كل كومنت بيتحول لحدث في اللعبة على طول عن طريق WebSocket.",
  },
  {
    icon: ShieldCheck,
    title: "حماية من السبام",
    desc: "Rate limiting لكل مشاهد يحمي أي لعبة من محاولات التكرار والتلاعب.",
  },
  {
    icon: Gauge,
    title: "إعدادات كاملة بإيدك",
    desc: "مدة اللعبة، الكلمات المفتاحية، وخيارات كل لعبة قابلة للتعديل من لوحة التحكم.",
  },
  {
    icon: ChatCircleDots,
    title: "تجربة مجانية حقيقية",
    desc: "3 أيام كامل الوصول من غير بطاقة ائتمان، تبدأ لحظة ما تسجّل.",
  },
];

const FAQS = [
  {
    q: "هل لازم أستخدم OBS بالتحديد؟",
    a: "لأ، أي برنامج بث بيدعم Browser Source (زي Streamlabs أو vMix) هيشتغل، لأن الـ Overlay مجرد صفحة ويب شفافة.",
  },
  {
    q: "هيحصل ايه بعد ما التجربة المجانية تخلص؟",
    a: "حسابك يفضل موجود، بس الوصول للألعاب بيتوقف لحد ما الاشتراك يتفعّل.",
  },
  {
    q: "هل TikGames تابع رسمياً لـ TikTok؟",
    a: "لأ، المنصة مستقلة وبتستخدم بروتوكولات مفتوحة المصدر للاتصال باللايف — مش تطبيق رسمي من TikTok.",
  },
  {
    q: "ينفع أدير حسابي من الموبايل؟",
    a: "أيوه، لوحة التحكم شغالة كويس على الموبايل، لكن تشغيل الـ Overlay نفسه بيحتاج جهاز بيشتغل بيه OBS.",
  },
];

function HeroMockup() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-3xl">
      <Tilt strength={9}>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassCard hoverLift={false} className="p-3 shadow-glow">
            <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="mr-2 text-xs text-ink-muted">obs — tikgames-overlay</span>
            </div>
            <div className="grid gap-3 rounded-2xl bg-canvas-elevated/60 p-4 sm:grid-cols-5">
              <div className="rounded-xl border border-glass-border bg-black/20 p-3 sm:col-span-2">
                <p className="mb-2 text-xs font-medium text-ink-muted">شات اللايف</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="rounded-lg bg-white/5 px-2 py-1.5">🔥 سارة: تريفيا!</li>
                  <li className="rounded-lg bg-white/5 px-2 py-1.5">🎮 محمد: 2</li>
                  <li className="rounded-lg bg-white/5 px-2 py-1.5">⚡ نور: انا انا انا</li>
                  <li className="rounded-lg bg-primary/15 px-2 py-1.5 text-accent">✓ يوسف: باريس</li>
                </ul>
              </div>
              <div className="rounded-xl border border-secondary/30 bg-gradient-to-br from-primary/15 to-secondary/10 p-4 sm:col-span-3">
                <p className="mb-3 text-xs font-medium text-accent">تريفيا مباشرة</p>
                <p className="mb-4 text-sm font-semibold">عاصمة فرنسا ايه؟</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-glass-border bg-white/5 px-3 py-2">1. لندن</div>
                  <div className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-accent">
                    2. باريس ✓
                  </div>
                  <div className="rounded-lg border border-glass-border bg-white/5 px-3 py-2">3. روما</div>
                  <div className="rounded-lg border border-glass-border bg-white/5 px-3 py-2">4. برلين</div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </Tilt>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="animate-float absolute -left-4 -top-6 hidden rounded-2xl border border-glass-border bg-canvas-soft/90 px-4 py-2.5 text-xs shadow-glass backdrop-blur-xl sm:block"
      >
        +1 نقطة ليوسف 🏆
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="animate-float-slow absolute -bottom-6 -right-4 hidden rounded-2xl border border-glass-border bg-canvas-soft/90 px-4 py-2.5 text-xs shadow-glass backdrop-blur-xl sm:block"
      >
        🔴 اللايف شغال الآن
      </motion.div>
    </div>
  );
}

function FaqList() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <GlassCard hoverLift={false} className="mx-auto max-w-3xl divide-y divide-glass-border p-2 sm:p-3">
      {FAQS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q} className="p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 text-right"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-sm text-accent/70">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-semibold">{item.q}</span>
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-glass text-accent"
              >
                <Plus size={14} weight="bold" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 pr-9 text-sm leading-relaxed text-ink-muted">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </GlassCard>
  );
}

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <Navbar />

      <CursorGlow className="relative px-4 pb-10 pt-20 sm:pt-28">
        <HeroGlowArc />
        <Suspense fallback={null}>
          <GLSLHills className="absolute inset-x-0 top-0 -z-[5] h-[560px] w-full sm:h-[680px]" />
        </Suspense>
        <Container className="text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs text-ink-muted backdrop-blur-xl"
          >
            <Sparkle size={14} className="text-accent" weight="fill" />
            تجربة مجانية 3 أيام — من غير بطاقة ائتمان
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="text-balance mx-auto max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            حوّل تعليقات لايفك على{" "}
            <span className="bg-gradient-animated bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              TikTok
            </span>{" "}
            لألعاب تفاعلية حية
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-balance text-base text-ink-muted sm:text-lg"
          >
            منصة Overlay جاهزة لـ OBS — مشاهدينك يتفاعلوا بالكومنتات، وإنت تشغّل اللعبة على الشاشة
            لحظياً من غير أي تعقيد تقني.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <ButtonLink to="/register" size="lg">
              جرّب مجاناً الآن
              <ArrowRight size={18} weight="bold" className="rtl:rotate-180" />
            </ButtonLink>
            <ButtonAnchor href="#games" variant="secondary" size="lg" magnetic={false}>
              <Play size={16} weight="fill" />
              شوف الألعاب
            </ButtonAnchor>
          </motion.div>

          <HeroMockup />
        </Container>
      </CursorGlow>

      <section className="px-4 py-24 sm:py-32">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">تشتغل في 3 خطوات</h2>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="relative mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            {STEPS.map((s) => (
              <motion.div key={s.n} variants={fadeUp}>
                <Tilt strength={6}>
                  <GlassCard className="h-full p-7">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/10 text-accent shadow-glow-sm">
                        <s.icon size={20} weight="duotone" />
                      </div>
                      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-extrabold text-transparent">
                        {s.n}
                      </span>
                    </div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
                  </GlassCard>
                </Tilt>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="games" className="relative scroll-mt-24 px-4 py-24 sm:py-32">
        <Suspense fallback={null}>
          <GamesScene className="pointer-events-none absolute inset-x-0 top-10 -z-[5] hidden h-[420px] w-full md:block" />
        </Suspense>
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">مكتبة الألعاب</h2>
            <p className="mt-4 text-ink-muted">
              {GAMES.length} ألعاب جاهزة تتشغّل من لوحة التحكم، وكل واحدة قابلة للتخصيص.
            </p>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {GAMES.map((game) => (
              <motion.div key={game.id} variants={fadeUp}>
                <Tilt strength={6}>
                  <GameCard game={game} />
                </Tilt>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-24 sm:py-32">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">مبني عشان اللايف الحقيقي</h2>
            <p className="mt-4 text-ink-muted">مش ديمو — كل ميزة هنا موجودة عشان مشكلة حصلت فعلاً وإحنا بنشتغل بيها.</p>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className={f.big ? "md:col-span-3" : "md:col-span-1"}
              >
                <Tilt strength={f.big ? 4 : 6}>
                  <GlassCard
                    className={`h-full p-7 ${f.big ? "md:flex md:items-center md:gap-8 md:p-9" : ""}`}
                  >
                    <div className={`relative h-12 w-12 shrink-0 ${f.big ? "mb-5 md:mb-0" : "mb-5"}`}>
                      <div className="animate-spin-slow absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#7C3AED,#C084FC,#7C3AED)] opacity-40 blur-[6px]" />
                      <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/10 text-accent shadow-glow-sm">
                        <f.icon size={22} weight="duotone" />
                      </div>
                    </div>
                    <div>
                      <h3 className={`font-semibold ${f.big ? "text-xl" : "text-base"}`}>{f.title}</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{f.desc}</p>
                    </div>
                  </GlassCard>
                </Tilt>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      <section className="px-4 py-24 sm:py-32">
        <Container>
          <Reveal>
            <Tilt strength={3}>
              <GlassCard hoverLift={false} className="relative overflow-hidden p-10 text-center sm:p-14">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-accent/10"
                />
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs text-ink-muted">
                  خطة واحدة، وضوح كامل
                </span>
                <h2 className="text-balance text-3xl font-bold sm:text-4xl">تجربة مجانية 3 أيام، كامل الوصول</h2>
                <p className="mx-auto mt-4 max-w-lg text-ink-muted">
                  من غير بطاقة ائتمان، ومن غير حدود على المكتبة. الأسعار الرسمية للاشتراك هتتضاف قريب.
                </p>
                <div className="mt-8 flex justify-center">
                  <ButtonLink to="/register" size="lg">
                    ابدأ تجربتك الآن
                    <ArrowRight size={18} weight="bold" className="rtl:rotate-180" />
                  </ButtonLink>
                </div>
              </GlassCard>
            </Tilt>
          </Reveal>
        </Container>
      </section>

      <section id="faq" className="scroll-mt-24 px-4 py-24 sm:py-32">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">أسئلة شائعة</h2>
          </Reveal>

          <Reveal className="mt-14" delay={0.1}>
            <FaqList />
          </Reveal>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
