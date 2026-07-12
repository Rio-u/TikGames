import type { LiveRoomStats } from "@tikgames/shared-types";
import { ArrowClockwise, Broadcast, Check, Eye, Flask, Heart, MonitorPlay, PencilSimple, StopCircle, X } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Button, ButtonLink } from "../components/Button";
import { Container } from "../components/Container";
import { DashboardHeader } from "../components/DashboardHeader";
import { GlassCard } from "../components/GlassCard";
import { Input } from "../components/Input";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { startLive, stopLive, type LiveSession } from "../lib/liveApi";
import { connectDashboardSocket } from "../lib/socket";
import { useLiveSession } from "../lib/useLiveSession";

const OVERLAY_URL = import.meta.env.VITE_OVERLAY_URL ?? "http://localhost:5174";

const STATUS_STYLES: Record<LiveSession["status"], { dot: string; pill: string; label: string; pulse?: boolean }> = {
  LIVE: { dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300", label: "لايف دلوقتي ✓" },
  CONNECTING: { dot: "bg-amber-400", pill: "bg-amber-500/15 text-amber-300", label: "بيتصل...", pulse: true },
  PENDING: { dot: "bg-amber-400", pill: "bg-amber-500/15 text-amber-300", label: "بيتصل...", pulse: true },
  ERROR: { dot: "bg-red-400", pill: "bg-red-500/15 text-red-300", label: "خطأ في الاتصال" },
  ENDED: { dot: "bg-ink-muted", pill: "bg-glass text-ink-muted", label: "مش متصل" },
};

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-glass-border bg-canvas-elevated/60 px-5 py-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-glow-sm">
        {icon}
      </div>
      <div className="leading-tight">
        <p className="text-2xl font-black" dir="ltr">
          {value.toLocaleString("en-US")}
        </p>
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

/**
 * The full TikTok connect/disconnect experience, moved off the dashboard onto its own page —
 * the header keeps only a small status pill + refresh. Restyled as a bold hero: profile picture,
 * follower count, live viewer count, driven by the "live:roomStats" relay from the connector.
 */
export default function LiveConnect() {
  const { user } = useAuth();
  const { liveSession, setLiveSession, loadingLiveSession, refetch } = useLiveSession();
  const [roomStats, setRoomStats] = useState<LiveRoomStats | null>(null);
  const [channelUsername, setChannelUsername] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editValue, setEditValue] = useState("");

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connectDashboardSocket();
    socketRef.current = socket;

    socket.on("live:status", (status: { liveSessionId: string; status: LiveSession["status"] }) => {
      setLiveSession((prev) => (prev && prev.id === status.liveSessionId ? { ...prev, status: status.status } : prev));
    });

    socket.on("live:roomStats", (stats: LiveRoomStats) => {
      setRoomStats((prev) => (prev && prev.liveSessionId !== stats.liveSessionId ? prev : { ...prev, ...stats }));
    });

    return () => {
      socket.disconnect();
    };
  }, [setLiveSession]);

  useEffect(() => {
    const socket = socketRef.current;
    const liveSessionId = liveSession?.id;
    if (!socket || !liveSessionId) return;

    const rejoin = () => socket.emit("join", liveSessionId);
    rejoin();
    // Re-join on every reconnect, not just the initial mount — socket.io rooms don't survive one.
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [liveSession?.id]);

  // A fresh live session means any previously-cached room stats belong to a different stream.
  useEffect(() => {
    setRoomStats(null);
  }, [liveSession?.id]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    if (!channelUsername.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      await startLive(channelUsername.trim());
      await refetch();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "حصل خطأ غير متوقع، جرب تاني");
    } finally {
      setConnecting(false);
    }
  }

  function startEditingUsername() {
    if (!liveSession) return;
    setEditValue(liveSession.channelUsername);
    setConnectError(null);
    setEditingUsername(true);
  }

  async function handleSaveUsername(e: FormEvent) {
    e.preventDefault();
    if (!editValue.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      // Same endpoint as the initial connect — retries the existing live session (same row, same
      // overlayToken) with a corrected channel username instead of ending it and losing OBS's link.
      await startLive(editValue.trim());
      await refetch();
      setEditingUsername(false);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "حصل خطأ غير متوقع، جرب تاني");
    } finally {
      setConnecting(false);
    }
  }

  async function handleRetry() {
    if (!liveSession) return;
    setConnecting(true);
    setConnectError(null);
    try {
      // Re-runs the connect attempt for the same username against the same live session — the
      // one thing the header's refresh button doesn't do (that only re-fetches the stored status,
      // it never asks the connector to try again), which is why a stuck ERROR needed this.
      await startLive(liveSession.channelUsername);
      await refetch();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "حصل خطأ غير متوقع، جرب تاني");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setStopping(true);
    try {
      await stopLive();
      await refetch();
    } finally {
      setStopping(false);
    }
  }

  if (!user) return null;

  const connected = !!liveSession && liveSession.status !== "ENDED";
  const style = liveSession ? STATUS_STYLES[liveSession.status] : STATUS_STYLES.ENDED;

  return (
    <div className="min-h-dvh">
      <DashboardHeader />

      <Container className="space-y-8 py-10">
        <Reveal>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Broadcast size={28} weight="fill" className="text-accent" />
            اربط حسابك على تيك توك
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">اربط يوزرك، ابدأ اللايف، وشغّل الألعاب من أي صفحة تانية.</p>
        </Reveal>

        {!connected && (
          <Reveal delay={0.05}>
            <GlassCard hoverLift={false} className="mx-auto max-w-lg overflow-hidden p-8 text-center">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
              <div className="relative">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary shadow-glow">
                  <Broadcast size={34} weight="fill" className="text-white" />
                </div>
                <h2 className="mt-5 text-xl font-bold">مش متصل دلوقتي</h2>
                <p className="mt-1.5 text-sm text-ink-muted">اكتب يوزر تيك توك بتاعك وابدأ اللايف عشان تقدر تشغّل الألعاب.</p>
                <form onSubmit={handleConnect} className="mt-6 space-y-3 text-right">
                  <Input
                    label="يوزر تيك توك"
                    dir="ltr"
                    placeholder="username"
                    value={channelUsername}
                    onChange={(e) => setChannelUsername(e.target.value)}
                    disabled={connecting || loadingLiveSession}
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={connecting || !channelUsername.trim()}>
                    <Broadcast size={16} weight="fill" />
                    {connecting ? "جاري الاتصال..." : "ابدأ اللايف"}
                  </Button>
                  {connectError && (
                    <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {connectError}
                    </p>
                  )}
                </form>
              </div>
            </GlassCard>
          </Reveal>
        )}

        {connected && liveSession && (
          <Reveal delay={0.05}>
            <GlassCard hoverLift={false} className="relative overflow-hidden p-8 sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-accent/25" />
              <div className="relative flex flex-col items-center gap-6 text-center">
                <div className="relative">
                  <PlayerAvatar
                    displayName={roomStats?.displayName ?? liveSession.channelUsername}
                    avatarUrl={roomStats?.avatarUrl ?? user.avatarUrl}
                    size={112}
                  />
                  <span
                    className={`absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-glass ${style.pill}`}
                  >
                    <span className={`relative flex h-2 w-2 ${style.dot} rounded-full`}>
                      {style.pulse && <span className={`absolute inset-0 animate-ping rounded-full ${style.dot} opacity-75`} />}
                    </span>
                    {style.label}
                  </span>
                </div>

                {editingUsername ? (
                  <form onSubmit={handleSaveUsername} className="w-full max-w-xs space-y-2">
                    <Input
                      label="يوزر تيك توك"
                      dir="ltr"
                      placeholder="username"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      disabled={connecting}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button type="submit" size="md" className="flex-1" disabled={connecting || !editValue.trim()}>
                        <Check size={16} weight="bold" />
                        {connecting ? "جاري الحفظ..." : "حفظ"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        magnetic={false}
                        onClick={() => {
                          setEditingUsername(false);
                          setConnectError(null);
                        }}
                        disabled={connecting}
                      >
                        <X size={16} weight="bold" />
                      </Button>
                    </div>
                    {connectError && (
                      <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {connectError}
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black" dir="ltr">
                      @{liveSession.channelUsername}
                    </h2>
                    <button
                      type="button"
                      onClick={startEditingUsername}
                      aria-label="غيّر يوزر تيك توك"
                      className="rounded-full border border-glass-border bg-glass p-1.5 text-ink-muted transition-colors duration-200 hover:text-ink"
                    >
                      <PencilSimple size={14} weight="bold" />
                    </button>
                  </div>
                )}

                {!editingUsername && (roomStats?.followerCount != null || roomStats?.viewerCount != null) && (
                  <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                    {roomStats?.followerCount != null && (
                      <StatTile icon={<Heart size={20} weight="fill" />} label="متابعين" value={roomStats.followerCount} />
                    )}
                    {roomStats?.viewerCount != null && (
                      <StatTile icon={<Eye size={20} weight="fill" />} label="بيتفرجوا دلوقتي" value={roomStats.viewerCount} />
                    )}
                  </div>
                )}

                {!editingUsername && connectError && (
                  <p role="alert" className="max-w-md rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {connectError}
                  </p>
                )}

                {!editingUsername && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {liveSession.status === "ERROR" && (
                    <Button size="md" onClick={handleRetry} disabled={connecting}>
                      <ArrowClockwise size={16} weight="bold" />
                      {connecting ? "جاري إعادة المحاولة..." : "إعادة المحاولة"}
                    </Button>
                  )}
                  <ButtonLink to="/dashboard" variant="secondary" size="md" magnetic={false}>
                    اختار لعبة
                  </ButtonLink>
                  <a href={`${OVERLAY_URL}/o/${liveSession.overlayToken}`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="md" magnetic={false}>
                      <MonitorPlay size={16} />
                      شاشة الـ Overlay
                    </Button>
                  </a>
                  <ButtonLink to="/live/simulate" variant="secondary" size="md" magnetic={false}>
                    <Flask size={16} />
                    صفحة الاختبار
                  </ButtonLink>
                  <Button variant="secondary" size="md" magnetic={false} onClick={handleDisconnect} disabled={stopping}>
                    <StopCircle size={16} />
                    {stopping ? "جاري الإنهاء..." : "إنهاء اللايف"}
                  </Button>
                </div>
                )}
              </div>
            </GlassCard>
          </Reveal>
        )}
      </Container>
    </div>
  );
}
