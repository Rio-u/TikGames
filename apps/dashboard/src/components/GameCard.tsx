import { ArrowRight, Clock, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameDefinition } from "../data/games";
import { GlassCard } from "./GlassCard";

export function GameCard({
  game,
  to,
  variant = "featured",
  disabledReason,
  className = "",
}: {
  game: GameDefinition;
  /** If provided, the whole card links here — a game that's actually playable. */
  to?: string;
  /** "featured" (default): the big showcase card for playable games. "compact": a small, quiet
   *  tile for "coming soon" entries — same component so both stay visually related. */
  variant?: "featured" | "compact";
  /** Set when an admin has temporarily switched this game off. Overrides a "featured" card into
   *  a muted, non-clickable state showing this message instead of the normal CTA. */
  disabledReason?: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  // Reset on every URL change, not just on mount — `game.imageUrl` starts as the hardcoded
  // default (data/games.ts) and gets swapped to an admin-uploaded override once useGameContent()
  // resolves a moment later. Without this, a broken hardcoded placeholder (several games don't
  // actually have one checked in) permanently latches imgError=true from that first failed load,
  // and the card is then stuck on the emoji fallback forever even after a perfectly valid new URL
  // arrives — the "image flickers in then disappears" bug.
  useEffect(() => {
    setImgError(false);
  }, [game.imageUrl]);
  const showImage = !imgError;
  const blocked = !!disabledReason;

  if (variant === "compact") {
    return (
      <GlassCard hoverLift={false} className={`h-full overflow-hidden ${className}`}>
        <div className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${game.gradient}`}>
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 14px)",
            }}
          />
          <div className="absolute h-16 w-16 rounded-full bg-white/25 blur-2xl" />
          <span className="relative text-5xl opacity-85 drop-shadow-lg">{game.emoji}</span>
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-glass-border bg-canvas-soft/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted backdrop-blur-md">
            <Clock size={11} />
            قريباً
          </span>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-bold">{game.nameAr}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted/80">{game.descriptionAr}</p>
        </div>
      </GlassCard>
    );
  }

  const isLink = !!to && !blocked;

  const content = (
    <GlassCard className={`group h-full overflow-hidden ${blocked ? "opacity-80" : ""} ${className}`}>
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${game.gradient} ${blocked ? "grayscale-[0.5]" : ""}`}
      >
        {showImage && (
          <img
            src={game.imageUrl}
            alt={game.nameAr}
            loading="lazy"
            onError={() => setImgError(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${isLink ? "group-hover:scale-110" : ""}`}
          />
        )}
        {!showImage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="absolute h-28 w-28 animate-glow-pulse rounded-full bg-white/25 blur-3xl" />
            <span className="animate-float relative text-8xl opacity-95 drop-shadow-[0_0_25px_rgba(255,255,255,0.35)]">
              {game.emoji}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/15 to-transparent" />
        <span
          className={`absolute left-4 top-4 flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md ${
            blocked
              ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
              : to
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-glass-border bg-canvas-soft/80 text-ink-muted"
          }`}
        >
          {blocked && <WarningCircle size={13} weight="fill" />}
          {blocked ? "متوقفة مؤقتاً" : to ? "جاهزة ✓" : "قريباً"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="mb-2 text-lg font-bold">{game.nameAr}</h3>
        <p className="mb-4 text-sm leading-relaxed text-ink-muted">{game.descriptionAr}</p>
        {isLink && (
          <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-white shadow-glow-sm transition-transform duration-300 group-hover:scale-105">
            شغّلها دلوقتي
            <ArrowRight size={13} weight="bold" className="rtl:rotate-180" />
          </span>
        )}
        {blocked && (
          <p className="mt-auto flex items-center gap-1.5 text-xs font-medium text-amber-300/90">
            <WarningCircle size={14} weight="fill" />
            {disabledReason}
          </p>
        )}
      </div>
    </GlassCard>
  );

  if (isLink) {
    return (
      <Link to={to} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
