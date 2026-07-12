import { ArrowClockwise, ShieldCheck, SignOut, Trophy, UserCircle } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { LiveSession } from "../lib/liveApi";
import { useLiveSession } from "../lib/useLiveSession";
import { Button } from "./Button";
import { Container } from "./Container";
import { Logo } from "./Logo";

const STATUS_STYLES: Record<LiveSession["status"], { dot: string; pill: string; label: string; pulse?: boolean }> = {
  LIVE: { dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300", label: "متصل ✓" },
  CONNECTING: { dot: "bg-amber-400", pill: "bg-amber-500/15 text-amber-300", label: "بيتصل...", pulse: true },
  PENDING: { dot: "bg-amber-400", pill: "bg-amber-500/15 text-amber-300", label: "بيتصل...", pulse: true },
  ERROR: { dot: "bg-red-400", pill: "bg-red-500/15 text-red-300", label: "خطأ في الاتصال" },
  ENDED: { dot: "bg-ink-muted", pill: "bg-glass text-ink-muted", label: "مش متصل" },
};

const NOT_CONNECTED: { dot: string; pill: string; label: string; pulse?: boolean } = {
  dot: "bg-ink-muted",
  pill: "bg-glass text-ink-muted",
  label: "مش متصل",
};

/** Small live-connected-or-not indicator + refresh button, next to the avatar block — the
 *  entry point into `/live/connect` now that the full connect flow lives on its own page. */
function LiveStatusPill() {
  const { liveSession, loadingLiveSession, refetch } = useLiveSession();
  const style = liveSession ? STATUS_STYLES[liveSession.status] : NOT_CONNECTED;

  return (
    <div className="flex items-center gap-1">
      <Link
        to="/live/connect"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${style.pill}`}
      >
        <span className={`relative flex h-2 w-2 ${style.dot} rounded-full`}>
          {style.pulse && <span className={`absolute inset-0 animate-ping rounded-full ${style.dot} opacity-75`} />}
        </span>
        {style.label}
      </Link>
      <motion.button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          refetch();
        }}
        aria-label="تحديث حالة اللايف"
        animate={loadingLiveSession ? { rotate: 360 } : { rotate: 0 }}
        transition={loadingLiveSession ? { duration: 0.8, repeat: Infinity, ease: "linear" } : undefined}
        className="rounded-full border border-glass-border bg-glass p-1.5 text-ink-muted transition-colors duration-200 hover:text-ink"
      >
        <ArrowClockwise size={14} weight="bold" />
      </motion.button>
    </div>
  );
}

/** Shared authed-app header — logo, nav, live-status pill, avatar/account block, admin/logout.
 *  Zero props: reads `useAuth()` itself, so every page just drops in `<DashboardHeader />`. */
export function DashboardHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-canvas/70 backdrop-blur-2xl">
      <Container className="flex items-center justify-between py-4">
        <div className="flex items-center gap-6">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <Link
            to="/leaderboard"
            className="hidden items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold text-accent shadow-glow-sm transition-all duration-300 hover:scale-105 hover:bg-accent/20 hover:shadow-glow sm:flex"
          >
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="flex"
            >
              <Trophy size={16} weight="fill" />
            </motion.span>
            الترتيب
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <LiveStatusPill />
          <Link to="/account" className="hidden items-center gap-2 sm:flex">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-8 w-8 rounded-full border border-glass-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <p className="text-sm text-ink">{user.displayName}</p>
              <p className="text-xs text-ink-muted" dir="ltr">
                @{user.username}
              </p>
            </div>
          </Link>
          <Link to="/account" className="sm:hidden">
            <Button variant="secondary" size="md" magnetic={false}>
              <UserCircle size={16} weight="bold" />
            </Button>
          </Link>
          {user.role === "ADMIN" && (
            <Link to="/d7admind7">
              <Button variant="secondary" size="md" magnetic={false}>
                <ShieldCheck size={16} weight="bold" />
                لوحة الأدمن
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="md" magnetic={false} onClick={logout}>
            <SignOut size={16} weight="bold" />
            خروج
          </Button>
        </div>
      </Container>
    </header>
  );
}
