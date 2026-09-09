import { ArrowClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { COUNTDOWN_DESIGNS, DEFAULT_COUNTDOWN_ID, DesignStage, type Design } from "@tikgames/game-3d";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardShell } from "../components/DashboardShell";
import { adminGetPlatformSettings, adminSetCountdownDesign } from "../lib/adminApi";

/**
 * The pre-roll design picker — admin only, and the choice applies to the whole platform.
 *
 * It is deliberately not a streamer preference. The three seconds before a game is part of how
 * the product looks to every viewer of every stream, so it is set once here and everyone gets it.
 * The two other 3D moments — the in-round timer and the winner celebration — have no variants at
 * all and are not configurable from anywhere.
 *
 * Every card renders the **same component the game renders**, through the same stage and post
 * chain, so this is a real preview rather than a gallery of lookalikes. The cost is nine live
 * WebGL scenes on one page, close to the limit browsers hand out, so a card mounts its canvas
 * only while it is near the viewport and tears it down on the way out.
 */

/** Mounts a card's scene only while it is on or near screen. */
function useNearViewport<T extends HTMLElement>(ref: React.RefObject<T | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(!!entry?.isIntersecting), {
      // A screen of margin either way, so a card is already running by the time it scrolls in.
      rootMargin: "300px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return near;
}

/**
 * One origin for the whole page, so every card sits on the same digit at the same instant.
 * Per-card clocks started whenever that card happened to scroll into view, which meant nine
 * countdowns showing nine different numbers — impossible to compare, which is what this is for.
 */
const PAGE_EPOCH = Date.now();

function useCountdownClock(replayKey: number) {
  const [state, setState] = useState<{ value: number; progress: number; urgent: boolean }>({
    value: 3,
    progress: 0,
    urgent: false,
  });

  useEffect(() => {
    const origin = replayKey > 0 ? Date.now() : PAGE_EPOCH;
    let raf = 0;
    const step = () => {
      // 3 → 2 → 1 → "يلا!": exactly the real pre-roll, so the preview shows the whole beat.
      const cycle = ((Date.now() - origin) / 1000) % 4;
      const value = 3 - Math.floor(cycle);
      setState({ value, progress: cycle - Math.floor(cycle), urgent: value <= 1 });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [replayKey]);

  return state;
}

function DesignCard({
  design,
  index,
  selected,
  busy,
  onSelect,
}: {
  design: Design;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const near = useNearViewport(slot);
  const [replayKey, setReplayKey] = useState(0);
  const clock = useCountdownClock(replayKey);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24, delay: Math.min(index * 0.04, 0.3) }}
      className={`group relative overflow-hidden rounded-3xl border backdrop-blur-xl transition-colors duration-300 ${
        selected
          ? "border-accent/70 bg-accent/[0.07] shadow-[0_0_0_1px_var(--color-accent),0_28px_60px_-32px_var(--color-primary)]"
          : "border-glass-border bg-glass hover:border-primary/60"
      }`}
    >
      <div ref={slot} className="relative aspect-square w-full overflow-hidden">
        {/* A quiet bed so a card that hasn't mounted yet still reads as a slot. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.18),transparent_65%)]" />
        {near && (
          <DesignStage
            design={design}
            value={clock.value <= 0 ? "يلا!" : clock.value}
            progress={clock.progress}
            urgent={clock.urgent}
            // Turned down hard: a full lean would swing the composition out of a card this size.
            parallax={0.12}
          />
        )}

        <span className="pointer-events-none absolute left-4 top-3 font-mono text-[1.6rem] font-bold leading-none text-ink/45 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>

        {selected && (
          <span className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-canvas">
            <CheckCircle size={14} weight="fill" />
            شغّال على المنصة
          </span>
        )}

        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-glass-border bg-canvas/70 px-3 py-1.5 text-xs text-ink-muted opacity-0 backdrop-blur-md transition-opacity duration-200 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <ArrowClockwise size={13} weight="bold" />
          إعادة
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-glass-border/70 p-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">{design.nameAr}</h3>
          <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-widest text-ink-muted/70">{design.name}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{design.descriptionAr}</p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={selected || busy}
          className={`flex-none rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 disabled:opacity-60 ${
            selected
              ? "cursor-default bg-accent/15 text-accent"
              : "border border-glass-border bg-glass text-ink-muted hover:border-accent hover:text-ink"
          }`}
        >
          {selected ? "مختار" : "اختار ده"}
        </button>
      </div>
    </motion.article>
  );
}

export default function DesignLab() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_COUNTDOWN_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminGetPlatformSettings()
      .then((s) => setActiveId(s.countdownDesignId ?? DEFAULT_COUNTDOWN_ID))
      .catch(() => setError("مقدرناش نجيب الإعداد الحالي — اعمل ريفرش."));
  }, []);

  const onSelect = useCallback(
    async (id: string) => {
      const previous = activeId;
      // Optimistic. The badge should move the instant you click, and a failed save rolls it back
      // rather than leaving it advertising a design the platform is not actually using.
      setActiveId(id);
      setBusy(true);
      setError(null);
      try {
        await adminSetCountdownDesign(id);
      } catch {
        setActiveId(previous);
        setError("محفظناش الاختيار — جرّب تاني.");
      } finally {
        setBusy(false);
      }
    },
    [activeId],
  );

  const currentIndex = COUNTDOWN_DESIGNS.findIndex((d) => d.id === activeId);
  const current = currentIndex >= 0 ? COUNTDOWN_DESIGNS[currentIndex] : undefined;

  return (
    <DashboardShell
      title="شكل العد التنازلي"
      description="الشكل اللي بيتشغّل 3 ثواني قبل كل لعبة. الاختيار ده بيتطبّق على المنصة كلها — كل الستريمرز وكل المشاهدين — والستريمر نفسه مش بيقدر يغيّره."
    >
      <div className="w-full">
        <div className="mb-7 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2.5 rounded-2xl border border-glass-border bg-glass px-4 py-2.5 text-sm">
            <span className="text-ink-muted">شغّال حالياً:</span>
            <span className="font-bold">{current?.nameAr ?? "—"}</span>
            <span className="font-mono text-xs text-accent tabular-nums">
              {currentIndex >= 0 ? String(currentIndex + 1).padStart(2, "0") : "—"}
            </span>
          </span>
          {busy && <span className="text-sm text-ink-muted">بنحفظ…</span>}
          {error && (
            <span
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
            >
              <WarningCircle size={16} weight="fill" />
              {error}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {COUNTDOWN_DESIGNS.map((design, i) => (
            <DesignCard
              key={design.id}
              design={design}
              index={i}
              selected={design.id === activeId}
              busy={busy}
              onSelect={() => void onSelect(design.id)}
            />
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-muted">
          العدّاد اللي جوه اللعبة نفسها (اللي بيعدّ مع كل سؤال) وشاشة الفائز ليهم شكل واحد ثابت،
          مش بيتغيّروا من هنا.
        </p>
      </div>
    </DashboardShell>
  );
}
