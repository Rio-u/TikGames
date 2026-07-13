import type { DrawingPlayer, DrawingState } from "@tikgames/shared-types";
import {
  ArrowCounterClockwise,
  Circle as CircleIcon,
  Eraser,
  Eye,
  EyeSlash,
  Minus,
  PaintBrush,
  Square,
  Trash,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCountdown } from "../lib/useCountdown";
import { ChatBox, type ChatItem } from "./ChatBox";
import { NoWinnerScreen } from "./NoWinnerScreen";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
type ToolKind = "freehand" | "line" | "rect" | "circle";
interface Point {
  x: number;
  y: number;
}
interface Stroke {
  id: string;
  kind: ToolKind;
  color: string;
  size: number;
  points: Point[];
}
export interface StrokeMessage {
  id: string;
  kind: ToolKind | "clear" | "undo";
  color?: string;
  size?: number;
  points?: Point[];
}

const COLORS = ["#0a0a0a", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#7c3aed", "#ec4899", "#78350f"];
const SIZES: { label: string; value: number }[] = [
  { label: "رفيع", value: 6 },
  { label: "متوسط", value: 16 },
  { label: "سميك", value: 32 },
];

// The canvas's pixel buffer is always exactly CANVAS_WIDTH×CANVAS_HEIGHT (set via the width/height
// attributes below), matching the wire-protocol's normalized coordinate space 1:1 — no separate
// scale factor needed; the CSS display size is free to differ and the browser stretches the buffer.
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = stroke.points;
  if (pts.length === 0) return;

  if (stroke.kind === "freehand") {
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  } else if (pts.length >= 2) {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (stroke.kind === "line") {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (stroke.kind === "rect") {
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (stroke.kind === "circle") {
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function redraw(canvas: HTMLCanvasElement, strokes: Map<string, Stroke>) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes.values()) drawStroke(ctx, stroke);
}

/** The streamer's own canvas: pointer input renders locally at zero latency and is also emitted
 *  over the socket for the overlay — it never needs to listen for its own strokes back. */
function DrawingCanvas({ onStroke, disabled }: { onStroke: (msg: StrokeMessage) => void; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Map<string, Stroke>>(new Map());
  const activeStrokeRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(SIZES[1]!.value);
  const [tool, setTool] = useState<ToolKind>("freehand");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, strokesRef.current);
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return { x: Math.max(0, Math.min(CANVAS_WIDTH, x)), y: Math.max(0, Math.min(CANVAS_HEIGHT, y)) };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointFromEvent(e);
    const stroke: Stroke = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind: tool, color, size, points: [point] };
    activeStrokeRef.current = stroke;
    drawingRef.current = true;
    strokesRef.current.set(stroke.id, stroke);
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, strokesRef.current);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !activeStrokeRef.current) return;
    const point = pointFromEvent(e);
    const stroke = activeStrokeRef.current;
    if (stroke.kind === "freehand") stroke.points.push(point);
    else stroke.points = [stroke.points[0]!, point];
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, strokesRef.current);
    onStroke({ id: stroke.id, kind: stroke.kind, color: stroke.color, size: stroke.size, points: stroke.points });
  }

  function handlePointerUp() {
    if (!drawingRef.current || !activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    onStroke({ id: stroke.id, kind: stroke.kind, color: stroke.color, size: stroke.size, points: stroke.points });
    drawingRef.current = false;
    activeStrokeRef.current = null;
  }

  function handleClear() {
    strokesRef.current.clear();
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, strokesRef.current);
    onStroke({ id: `clear-${Date.now()}`, kind: "clear" });
  }

  function handleUndo() {
    const keys = [...strokesRef.current.keys()];
    const lastId = keys[keys.length - 1];
    if (!lastId) return;
    strokesRef.current.delete(lastId);
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, strokesRef.current);
    onStroke({ id: lastId, kind: "undo" });
  }

  const TOOL_BUTTONS: { tool: ToolKind; icon: typeof PaintBrush; label: string }[] = [
    { tool: "freehand", icon: PaintBrush, label: "قلم" },
    { tool: "line", icon: Minus, label: "خط" },
    { tool: "rect", icon: Square, label: "مربع" },
    { tool: "circle", icon: CircleIcon, label: "دايرة" },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-glass-border bg-canvas-elevated/60 px-3 py-2">
        {TOOL_BUTTONS.map(({ tool: t, icon: Icon, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            aria-label={label}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              tool === t ? "bg-accent text-white" : "bg-white/5 text-ink-muted hover:bg-white/10"
            }`}
          >
            <Icon size={18} weight={tool === t ? "fill" : "regular"} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setTool("freehand");
            setColor("#ffffff");
            setSize(28);
          }}
          aria-label="ممحاة"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-ink-muted transition-colors hover:bg-white/10"
        >
          <Eraser size={18} />
        </button>
        <span className="mx-1 h-6 w-px bg-glass-border" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            style={{ backgroundColor: c }}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform ${
              color === c ? "scale-110 border-accent" : "border-white/20"
            }`}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-glass-border" />
        {SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSize(s.value)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              size === s.value ? "bg-accent/20 ring-1 ring-accent" : "bg-white/5 hover:bg-white/10"
            }`}
            aria-label={s.label}
          >
            <span className="rounded-full bg-current" style={{ width: s.value / 2.5, height: s.value / 2.5 }} />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-glass-border" />
        <button
          type="button"
          onClick={handleUndo}
          aria-label="تراجع"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-ink-muted transition-colors hover:bg-white/10"
        >
          <ArrowCounterClockwise size={18} />
        </button>
        <button
          type="button"
          onClick={handleClear}
          aria-label="امسح الكل"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
        >
          <Trash size={18} />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`aspect-[14/9] w-[min(64vw,980px)] touch-none rounded-2xl border-2 border-glass-border shadow-glass ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
        }`}
      />
    </div>
  );
}

function wordCacheKey(gameSessionId: string): string {
  return `tikgames_drawing_word_${gameSessionId}`;
}

function WordPicker({ gameSessionId, onSubmit }: { gameSessionId: string; onSubmit: (word: string) => void }) {
  const [word, setWord] = useState("");
  const [reveal, setReveal] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-glass-border bg-canvas-elevated/50 p-8 text-center"
    >
      <p className="text-5xl">🎨</p>
      <h3 className="text-xl font-bold">دورك ترسم! اختار كلمة</h3>
      <p className="text-sm text-ink-muted">
        الكلمة دي محدش هيشوفها غيرك — متبانش على شاشتك حتى، عشان لو حد شايف سكرينك بالغلط. الشات هيحاول يخمنها من رسمتك.
      </p>
      <div className="relative w-full">
        <input
          dir="rtl"
          type={reveal ? "text" : "password"}
          autoComplete="off"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={40}
          placeholder="اكتب الكلمة هنا..."
          className="w-full rounded-xl border border-glass-border bg-canvas-elevated/60 px-4 py-2.5 pl-11 text-center text-sm text-ink outline-none focus:border-accent focus:shadow-glow-sm"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "اخفي الكلمة" : "اظهر الكلمة"}
          className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
        >
          {reveal ? <EyeSlash size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <button
        type="button"
        disabled={!word.trim()}
        onClick={() => {
          const trimmed = word.trim();
          if (!trimmed) return;
          localStorage.setItem(wordCacheKey(gameSessionId), trimmed);
          onSubmit(trimmed);
        }}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        ابدأ الرسم
      </button>
    </motion.div>
  );
}

function ParticipantsPanel({ players }: { players: DrawingPlayer[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-xs font-bold text-accent">{p.score}</span>
        </div>
      ))}
      {players.length === 0 && <p className="text-sm text-ink-muted">لسه محدش سجّل نقط</p>}
    </div>
  );
}

const MEDAL_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function LeaderboardPanel({ players }: { players: DrawingPlayer[] }) {
  const ranked = [...players].sort((a, b) => b.score - a.score).slice(0, 10);
  return (
    <div className="flex min-h-0 flex-[1.2] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-accent" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>{i + 1}</span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={30} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-xs font-bold text-accent">{p.score}</span>
        </div>
      ))}
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش سجّل نقط</p>}
    </div>
  );
}

export function DrawingGameView({
  state,
  chat,
  onNewRound,
  onSubmitWord,
  onStroke,
}: {
  state: DrawingState;
  chat: ChatItem[];
  onNewRound: () => void;
  onSubmitWord: (word: string) => void;
  onStroke: (msg: StrokeMessage) => void;
}) {
  const secondsLeft = useCountdown(state.phase === "DRAWING" ? state.phaseEndsAt : null);
  const [cachedWord, setCachedWord] = useState<string | null>(null);
  const [wordRevealed, setWordRevealed] = useState(false);

  useEffect(() => {
    if (state.phase === "DRAWING") {
      setCachedWord(localStorage.getItem(wordCacheKey(state.gameSessionId)));
    } else {
      setWordRevealed(false);
    }
  }, [state.phase, state.gameSessionId]);

  const roundPhases = state.phase === "PICKING" || state.phase === "DRAWING" || state.phase === "REVEALED";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state.phase === "WAITING_TO_START" && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink-muted">
              جاري التحضير...
            </motion.div>
          )}

          {roundPhases && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />

              <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="rounded-full bg-white/10 px-3 py-1">دور {state.round}</span>
                  {secondsLeft !== null && (
                    <span className="rounded-full bg-accent/15 px-3 py-1.5 text-lg font-extrabold text-accent">{secondsLeft}</span>
                  )}
                  {state.phase === "DRAWING" && cachedWord && (
                    <button
                      type="button"
                      onClick={() => setWordRevealed((v) => !v)}
                      className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
                    >
                      {wordRevealed ? <Eye size={14} /> : <EyeSlash size={14} />}
                      {wordRevealed ? `الكلمة: ${cachedWord}` : "اضغط لإظهار الكلمة"}
                    </button>
                  )}
                  {state.phase === "REVEALED" && state.word && (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300">
                      الكلمة كانت: {state.word}
                    </span>
                  )}
                </div>

                {state.phase === "PICKING" && <WordPicker gameSessionId={state.gameSessionId} onSubmit={onSubmitWord} />}
                {(state.phase === "DRAWING" || state.phase === "REVEALED") && (
                  <DrawingCanvas onStroke={onStroke} disabled={state.phase !== "DRAWING"} />
                )}

                {state.phase === "REVEALED" && state.lastWinner && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-accent"
                  >
                    🎉 <bdi>{state.lastWinner.displayName}</bdi> خمّن صح!
                  </motion.p>
                )}
              </div>

              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} />
                <ChatBox items={chat} />
              </div>
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="relative grid h-full w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-[280px_1fr_280px]"
            >
              <ParticipantsPanel players={state.players} />
              {state.winner ? (
                <WinnerCelebration
                  displayName={state.winner.displayName}
                  avatarUrl={state.winner.avatarUrl}
                  handle={state.winner.handle}
                  subtitle="🎨 أحسن رسّام (تخمين) في تحدي الرسم"
                />
              ) : (
                <div className="flex items-center justify-center">
                  <NoWinnerScreen message="اتوقفت اللعبة قبل ما حد يسجّل نقط 😅" onNewRound={onNewRound} />
                </div>
              )}
              <div className="flex min-h-0 flex-col gap-4">
                <LeaderboardPanel players={state.players} />
                <ChatBox items={chat} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
