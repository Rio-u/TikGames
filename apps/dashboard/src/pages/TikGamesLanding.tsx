import {
  ArrowRight,
  ChatCircleDots,
  GameController,
  Lightning,
  Monitor,
  Play,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { ButtonAnchor, ButtonLink } from "../components/Button";
import { Container } from "../components/Container";
import { CursorGlow } from "../components/CursorGlow";
import { Footer } from "../components/Footer";
import { GameCard } from "../components/GameCard";
import { GlassCard } from "../components/GlassCard";
import { HeroGlowArc } from "../components/GlowBackground";
import { Navbar } from "../components/Navbar";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { GAMES } from "../data/games";
import { fadeUp, staggerContainer, viewportOnce } from "../lib/motion";

const STEPS = [
  { n: "01", icon: UsersThree, title: "اربط حساب TikTok", desc: "سجّل دخول واربط قناتك — مرة واحدة وخلاص." },
  { n: "02", icon: GameController, title: "اختار لعبة", desc: "12 لعبة جاهزة، كل واحدة بإعداداتها الخاصة." },
  { n: "03", icon: Monitor, title: "حط الأوفرلاي في OBS", desc: "رابط Browser Source واحد، شفاف بالكامل." },
  { n: "04", icon: ChatCircleDots, title: "خلي الشات يلعب", desc: "المشاهدين بيكتبوا كومنت، واللعبة بتتحرك لحظياً." },
];

/** The comment → server → overlay loop, drawn as three beats. Content is illustrative UI copy,
 *  not claimed data — no invented creator names, counts, or testimonials anywhere on this page. */
function ViewerFlow() {
  const beats = [
    { label: "المشاهد بيشوف", value: "اكتب 1 أو 2", tone: "border-glass-border bg-glass" },
    { label: "المشاهد بيبعت", value: "1", tone: "border-primary/40 bg-primary/15" },
    { label: "الأوفرلاي بيتحدّث", value: "التصويت: 61% / 39%", tone: "border-accent/40 bg-accent/10" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {beats.map((beat, i) => (
        <motion.div
          key={beat.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ delay: i * 0.12, duration: 0.5 }}
          className={`rounded-2xl border p-5 backdrop-blur-xl ${beat.tone}`}
        >
          <p className="mb-2 text-xs text-ink-muted">{beat.label}</p>
          <p className="text-lg font-bold">{beat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

export default function TikGamesLanding() {
  return (
    <div className="relative overflow-x-clip">
      <Navbar />

      <CursorGlow className="relative px-4 pb-10 pt-20 sm:pt-28">
        <HeroGlowArc />
        <Container className="text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs text-ink-muted backdrop-blur-xl"
          >
            <GameController size={14} className="text-accent" weight="fill" />
            منتج من منصة TikGames
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="text-balance mx-auto max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            شات لايفك بقى{" "}
            <span className="bg-gradient-animated bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              هو اللعبة
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-balance text-base text-ink-muted sm:text-lg"
          >
            شغّل ألعاب تفاعلية جوّه بثك المباشر، وخلي مشاهدينك يتنافسوا بالكومنتات بس — من غير
            حساب، ومن غير أي تحميل.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <ButtonLink to="/register" size="lg">
              ابدأ اللعب
              <ArrowRight size={18} weight="bold" className="rtl:rotate-180" />
            </ButtonLink>
            <ButtonAnchor href="#games" variant="secondary" size="lg" magnetic={false}>
              <Play size={16} weight="fill" />
              شوف الألعاب
            </ButtonAnchor>
          </motion.div>
        </Container>
      </CursorGlow>

      {/* --- Game showcase ------------------------------------------------------------ */}
      <section id="games" className="scroll-mt-24 px-4 py-24 sm:py-28">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">مكتبة الألعاب</h2>
            <p className="mt-4 text-ink-muted">
              {GAMES.length} لعبة، كلها بتتلعب بالكومنتات وكلها قابلة للتخصيص من لوحة التحكم.
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

      {/* --- How it works -------------------------------------------------------------- */}
      <section className="px-4 py-24 sm:py-28">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">بيشتغل إزاي</h2>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {STEPS.map((s) => (
              <motion.div key={s.n} variants={fadeUp}>
                <GlassCard className="h-full p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/10 text-accent shadow-glow-sm">
                      <s.icon size={20} weight="duotone" />
                    </div>
                    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-2xl font-extrabold text-transparent">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* --- OBS overlay ---------------------------------------------------------------- */}
      <section className="px-4 py-24 sm:py-28">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-balance text-3xl font-bold sm:text-4xl">
                طبقة شفافة على استريمك
              </h2>
              <p className="mt-5 leading-relaxed text-ink-muted">
                الأوفرلاي صفحة ويب شفافة بتحطها Browser Source في OBS — بتعرض اللعبة واللاعبين
                والعدّاد والترتيب فوق مشهدك، وبتتحدث لحظياً من السيرفر من غير ما تلمسها.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  { icon: Lightning, text: "تحديث لحظي بالـ WebSocket، مش تحديث كل كام ثانية" },
                  { icon: Monitor, text: "خلفية شفافة بالكامل، تتركب فوق أي مشهد" },
                  { icon: Trophy, text: "الترتيب والفائز بيظهروا أوتوماتيك" },
                ].map((row) => (
                  <li key={row.text} className="flex items-center gap-3 text-sm text-ink-muted">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-accent">
                      <row.icon size={16} weight="duotone" />
                    </span>
                    {row.text}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <Tilt strength={7}>
                <GlassCard hoverLift={false} className="p-3 shadow-glow">
                  <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="mr-2 text-xs text-ink-muted">obs — browser source</span>
                  </div>
                  <div className="rounded-2xl bg-[repeating-conic-gradient(#1a1526_0%_25%,#120e1c_0%_50%)] bg-[length:24px_24px] p-4">
                    <div className="grid gap-3 sm:grid-cols-5">
                      <div className="rounded-xl border border-glass-border bg-black/30 p-3 sm:col-span-2">
                        <p className="mb-2 text-[11px] font-medium text-ink-muted">المشاركين</p>
                        <ul className="space-y-1.5 text-[11px]">
                          <li className="rounded-lg bg-white/5 px-2 py-1.5">
                            <bdi>سارة</bdi> — 3
                          </li>
                          <li className="rounded-lg bg-white/5 px-2 py-1.5">
                            <bdi>Youssef</bdi> — 2
                          </li>
                          <li className="rounded-lg bg-white/5 px-2 py-1.5">
                            <bdi>نور</bdi> — 2
                          </li>
                        </ul>
                      </div>
                      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-primary/20 to-secondary/10 p-4 sm:col-span-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[11px] font-medium text-accent">أعلام</p>
                          <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] tabular-nums">
                            00:07
                          </span>
                        </div>
                        <p className="mb-3 text-3xl">🇯🇵</p>
                        <p className="text-sm font-semibold">اكتب اسم الدولة في الشات</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </Tilt>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* --- Viewer experience ---------------------------------------------------------- */}
      <section className="px-4 py-24 sm:py-28">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold sm:text-4xl">تجربة المشاهد</h2>
            <p className="mt-4 text-ink-muted">
              كل اللي المشاهد بيعمله إنه يكتب في الشات — والباقي بيحصل عنده على الشاشة.
            </p>
          </Reveal>
          <div className="mt-12">
            <ViewerFlow />
          </div>
        </Container>
      </section>

      {/* --- CTA -------------------------------------------------------------------------- */}
      <section className="px-4 pb-24 sm:pb-32">
        <Container>
          <Reveal>
            <Tilt strength={3}>
              <GlassCard hoverLift={false} className="relative overflow-hidden p-10 text-center sm:p-14">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-accent/10"
                />
                <h2 className="text-balance text-3xl font-bold sm:text-4xl">
                  خلي لايفك الجاي تفاعلي
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-ink-muted">
                  تجربة مجانية كاملة، من غير بطاقة ائتمان.
                </p>
                <div className="mt-8 flex justify-center">
                  <ButtonLink to="/register" size="lg">
                    ابدأ مجاناً
                    <ArrowRight size={18} weight="bold" className="rtl:rotate-180" />
                  </ButtonLink>
                </div>
              </GlassCard>
            </Tilt>
          </Reveal>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
