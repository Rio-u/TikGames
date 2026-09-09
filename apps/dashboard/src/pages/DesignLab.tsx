import { ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import {
  COUNTDOWN_DESIGNS,
  DesignStage,
  VICTORY_DESIGNS,
  useCountdownSelection,
  useVictorySelection,
  type Design,
} from "@tikgames/game-3d";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "../components/DashboardShell";
import { saveDesignPrefs } from "../lib/liveApi";

/**
 * The 3D visual library — the page where the streamer chooses which countdown scene and which
 * victory scene the game uses.
 *
 * Two things make this a real preview rather than a gallery of lookalikes:
 *
 * 1. Every card renders the **same component the game renders**, through the same `DesignStage`,
 *    with the same post-processing. What you see here is literally what plays on stream.
 * 2. Each card drives its own clock, so countdowns actually count and victories actually play.
 *
 * The cost of that is eighteen live WebGL scenes on one page, which browsers will not give you —
 * contexts are capped around sixteen and the ones past the cap come back null. So a card only
 * mounts its canvas while it is near the viewport (see `useNearViewport`) and tears it down
 * again on the way out, which keeps the live count to whatever fits on screen.
 */

type Category = "countdown" | "victory";

/** Mounts a card's scene only while it is on or near screen. */
function useNearViewport<T extends HTMLElement>(ref: React.RefObject<T>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setNear(!!entry?.isIntersecting),
      // A screen of margin either way, so a card is already running by the time it scrolls in.
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return near;
}

/**
 * One origin for the whole page, so every card is on the same beat.
 *
 * Per-card clocks started whenever that card happened to scroll into view, which meant nine
 * countdowns showing nine different digits and nine victories at nine different points of their
 * entrance — impossible to compare, which is the only thing this page is for.
 */
const PAGE_EPOCH = Date.now();

/** Countdown cards tick 5→1 forever; victory cards play their entrance and hold, or replay. */
function useSceneClock(category: Category, replayKey: number) {
  const [state, setState] = useState({ value: 5 as number | string, progress: 0, urgent: false });

  useEffect(() => {
    // A replay restarts from now; otherwise every card shares the page epoch.
    const origin = replayKey > 0 ? Date.now() : PAGE_EPOCH;
    let raf = 0;
    const step = () => {
      const elapsed = (Date.now() - origin) / 1000;
      if (category === "countdown") {
        const second = elapsed % 5;
        const value = 5 - Math.floor(second);
        setState({ value, progress: second - Math.floor(second), urgent: value <= 3 });
      } else {
        // 2.6s entrance then a 3.4s hold: long enough to actually read the settled composition,
        // which is what a viewer looks at for most of a real celebration.
        const cycle = elapsed % 6;
        setState({ value: "1", progress: Math.min(cycle / 2.6, 1), urgent: false });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [category, replayKey]);

  return state;
}

function DesignCard({
  design,
  index,
  category,
  selected,
  onSelect,
}: {
  design: Design;
  index: number;
  category: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const near = useNearViewport(slot);
  const [replayKey, setReplayKey] = useState(0);
  const clock = useSceneClock(category, replayKey);

  return (
    <motion.article
      layout
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
        {/* A quiet gradient bed so a card that hasn't mounted yet still reads as a slot. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.18),transparent_65%)]" />
        {near && (
          <DesignStage
            design={design}
            value={clock.value}
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
            المستخدم حالياً
          </span>
        )}

        {category === "victory" && (
          <button
            type="button"
            onClick={() => setReplayKey((k) => k + 1)}
            className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-glass-border bg-canvas/70 px-3 py-1.5 text-xs text-ink-muted opacity-0 backdrop-blur-md transition-opacity duration-200 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <ArrowClockwise size={13} weight="bold" />
            إعادة
          </button>
        )}
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
          disabled={selected}
          className={`flex-none rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 ${
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
  const [tab, setTab] = useState<Category>("countdown");
  const [countdownId, selectCountdown] = useCountdownSelection();
  const [victoryId, selectVictory] = useVictorySelection();

  const designs = tab === "countdown" ? COUNTDOWN_DESIGNS : VICTORY_DESIGNS;
  const activeId = tab === "countdown" ? countdownId : victoryId;
  const select = tab === "countdown" ? selectCountdown : selectVictory;

  // Index as well as design: the number is what the card shows and what the streamer quotes.
  const current = useMemo(() => {
    const ci = COUNTDOWN_DESIGNS.findIndex((d) => d.id === countdownId);
    const vi = VICTORY_DESIGNS.findIndex((d) => d.id === victoryId);
    return {
      countdown: { design: COUNTDOWN_DESIGNS[ci], index: ci },
      victory: { design: VICTORY_DESIGNS[vi], index: vi },
    };
  }, [countdownId, victoryId]);

  const onSelect = useCallback(
    (id: string) => {
      select(id);
      // Mirrored to the account so the overlay — a different origin, which cannot read this
      // browser's storage — gets it too. Fire-and-forget: the local selection has already
      // applied, and a failed sync must not block the picker.
      const next = {
        countdown: tab === "countdown" ? id : countdownId,
        victory: tab === "victory" ? id : victoryId,
      };
      void saveDesignPrefs(next.countdown, next.victory).catch(() => {});
    },
    [select, tab, countdownId, victoryId],
  );

  return (
    <DashboardShell
      title="أشكال العد التنازلي والفوز"
      description="كل كارت بيشغّل نفس المشهد اللي هينزل في اللعب بالظبط — مش صورة ولا فيديو. اختار واحد من كل قسم، والاختيار بيتحفظ على الجهاز ده وبيتطبّق على الداشبورد والأوفرلاي على طول."
    >
      <div className="w-full">
        {/* What is live right now, for both categories at once — you shouldn't have to switch
            tabs to remember what you picked. */}
        <div className="mb-7 flex flex-wrap gap-3">
          {([
            ["العد التنازلي", current.countdown, "countdown"],
            ["الفوز", current.victory, "victory"],
          ] as const).map(([label, entry, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex items-center gap-2.5 rounded-2xl border border-glass-border bg-glass px-4 py-2.5 text-sm transition-colors duration-200 hover:border-accent/60"
            >
              <span className="text-ink-muted">{label}:</span>
              <span className="font-bold">{entry.design?.nameAr ?? "—"}</span>
              <span className="font-mono text-xs text-accent tabular-nums">
                {String(entry.index + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-7 border-b border-glass-border/70 pb-4">
        <div role="tablist" className="inline-flex gap-1 rounded-full border border-glass-border bg-glass p-1">
          {([
            ["countdown", "العد التنازلي", COUNTDOWN_DESIGNS.length],
            ["victory", "الفوز", VICTORY_DESIGNS.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-colors duration-200 ${
                tab === key ? "bg-accent text-canvas" : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
              <span className="ms-2 font-mono text-xs opacity-70 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
        >
          {designs.map((design, i) => (
            <DesignCard
              key={design.id}
              design={design}
              index={i}
              category={tab}
              selected={design.id === activeId}
              onSelect={() => onSelect(design.id)}
            />
          ))}
        </motion.div>
      </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
