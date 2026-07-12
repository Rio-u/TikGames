import type { DrawingPlayer, DrawingState } from "@tikgames/shared-types";
import { Crown, Trophy, Users } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useCountdown } from "../lib/useCountdown";
import { Branding } from "./Branding";
import { ChatStrip, type ChatItem } from "./ChatStrip";
import { PlayerAvatar } from "./PlayerAvatar";
import { WinnerCelebration } from "./WinnerCelebration";

export type { ChatItem };

const CANVAS_SIZE = 1000;
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

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, canvasPx: number) {
  const scale = canvasPx / CANVAS_SIZE;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.size * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = stroke.points;
  if (pts.length === 0) return;

  if (stroke.kind === "freehand") {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x * scale;
      const y = p.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  } else if (pts.length >= 2) {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (stroke.kind === "line") {
      ctx.beginPath();
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
    } else if (stroke.kind === "rect") {
      ctx.strokeRect(
        Math.min(a.x, b.x) * scale,
        Math.min(a.y, b.y) * scale,
        Math.abs(b.x - a.x) * scale,
        Math.abs(b.y - a.y) * scale,
      );
    } else if (stroke.kind === "circle") {
      const r = Math.hypot((b.x - a.x) * scale, (b.y - a.y) * scale);
      ctx.beginPath();
      ctx.arc(a.x * scale, a.y * scale, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function redraw(canvas: HTMLCanvasElement, strokes: Map<string, Stroke>) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  for (const stroke of strokes.values()) drawStroke(ctx, stroke, size);
}

/** Read-only — viewers never draw, this just replays whatever draw:stroke events arrive. */
function ReadOnlyCanvas({ strokes }: { strokes: Map<string, StrokeMessage> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rendered = new Map<string, Stroke>();
    for (const [id, msg] of strokes) {
      if (msg.kind === "clear" || msg.kind === "undo") continue;
      rendered.set(id, { id, kind: msg.kind, color: msg.color ?? "#000000", size: msg.size ?? 6, points: msg.points ?? [] });
    }
    redraw(canvas, rendered);
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      className="aspect-square h-[min(50vh,480px)] w-[min(50vh,480px)] rounded-2xl border-2 border-glass-border shadow-glass"
    />
  );
}

function ParticipantsPanel({ players }: { players: DrawingPlayer[] }) {
  return (
    <div className="flex max-h-[60vh] w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Users size={16} className="text-accent" weight="fill" />
        اللاعبين ({players.length})
      </div>
      {players.map((p) => (
        <div key={p.handle} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={28} ring={false} />
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
    <div className="flex max-h-[60vh] w-full flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-soft/70 p-4 shadow-glass backdrop-blur-2xl">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy size={16} className="text-accent" weight="fill" />
        الترتيب
      </div>
      {ranked.map((p, i) => (
        <div key={p.handle} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i < 3 ? "bg-white/5" : ""}`}>
          <span className={`w-4 shrink-0 text-center text-xs font-bold ${i < 3 ? MEDAL_COLORS[i] : "text-ink-muted"}`}>{i + 1}</span>
          <PlayerAvatar displayName={p.displayName} avatarUrl={p.avatarUrl} size={28} ring={false} />
          <bdi className="truncate text-sm">{p.displayName}</bdi>
          <span className="mr-auto shrink-0 text-xs font-bold text-accent">{p.score}</span>
        </div>
      ))}
      {ranked.length === 0 && <p className="text-sm text-ink-muted">لسه محدش سجّل نقط</p>}
    </div>
  );
}

export function DrawingOverlay({
  state,
  chat,
  strokes,
}: {
  state: DrawingState | null;
  chat: ChatItem[];
  strokes: Map<string, StrokeMessage>;
}) {
  const secondsLeft = useCountdown(state?.phase === "DRAWING" ? state.phaseEndsAt : null);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Branding />
      </div>
    );
  }

  const roundPhases = state.phase === "PICKING" || state.phase === "DRAWING" || state.phase === "REVEALED";

  return (
    <div className="relative flex min-h-screen flex-col gap-4 p-6">
      <div className="flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {roundPhases && (
            <motion.div
              key="round"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid w-full max-w-6xl grid-cols-[220px_1fr_220px] items-center gap-5"
            >
              <ParticipantsPanel players={state.players} />

              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="rounded-full bg-white/10 px-3 py-1">دور {state.round}</span>
                  {secondsLeft !== null && (
                    <span className="rounded-full bg-accent/15 px-3 py-1.5 text-lg font-extrabold text-accent">{secondsLeft}</span>
                  )}
                  {state.phase === "REVEALED" && state.word && (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300">
                      الكلمة كانت: {state.word}
                    </span>
                  )}
                </div>

                {state.phase === "PICKING" ? (
                  <div className="flex h-[min(50vh,480px)] w-[min(50vh,480px)] flex-col items-center justify-center gap-3 rounded-2xl border border-glass-border bg-canvas-soft/70 text-center shadow-glass backdrop-blur-2xl">
                    <p className="text-4xl">🎨</p>
                    <p className="text-ink-muted">الستريمر بيختار كلمة يرسمها...</p>
                  </div>
                ) : (
                  <ReadOnlyCanvas strokes={strokes} />
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

              <LeaderboardPanel players={state.players} />
            </motion.div>
          )}

          {state.phase === "FINISHED" && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="grid w-full max-w-6xl grid-cols-[220px_1fr_220px] items-center gap-5"
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
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-3xl border border-glass-border bg-canvas-soft/70 p-8 shadow-glass backdrop-blur-2xl">
                    <Crown size={40} className="mx-auto mb-3 text-ink-muted" />
                    <p className="text-ink-muted">اتوقفت اللعبة قبل ما حد يسجّل نقط</p>
                  </div>
                </div>
              )}
              <LeaderboardPanel players={state.players} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatStrip items={chat} />
      <Branding />
    </div>
  );
}
