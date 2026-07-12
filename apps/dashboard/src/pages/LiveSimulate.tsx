import { ChatCircleDots, PaperPlaneTilt } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { GlassCard } from "../components/GlassCard";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { ACCESS_TOKEN_KEY, useAuth } from "../lib/auth";
import { simulateComment, type GameState } from "../lib/liveApi";
import { connectDashboardSocket } from "../lib/socket";
import { useLiveSession } from "../lib/useLiveSession";

interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
}

/** A generic one-line status label per game type — this is the internal test page, not a real
 *  control page, so it doesn't need each game's full statusText treatment, just something
 *  accurate. Branches explicitly on gameType rather than relying on phase-literal narrowing,
 *  which silently breaks any time a new game's phase set happens to overlap another's. */
function gameStatusText(state: GameState): string {
  if (state.phase === "FINISHED") return "خلصت اللعبة";

  switch (state.gameType) {
    case "MUSICAL_CHAIRS":
      return state.phase === "WAITING_FOR_PLAYERS"
        ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers} — أمر الانضمام: ${state.settings.joinCommand}`
        : `الجولة ${state.round} — باقي ${state.players.filter((p) => !p.eliminatedAt).length} لاعبين${
            state.phase === "CHOOSING" ? ` — اكتب رقم من 1 لـ ${state.chairCount}` : " — الموسيقى شغالة"
          }`;
    case "TRIVIA":
      return state.phase === "WAITING_TO_START"
        ? "هيبدأ أول سؤال دلوقتي"
        : state.phase === "QUESTION"
          ? `سؤال ${state.round} — اكتب إجابتك`
          : `سؤال ${state.round} — الإجابة: ${state.correctAnswer}`;
    case "GUESS_NUMBER":
      return state.phase === "WAITING_TO_START" ? "هتبدأ اللعبة دلوقتي" : "اكتب تخمينك في الشات";
    case "SPIN_WHEEL":
      return state.phase === "WAITING_FOR_PLAYERS"
        ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers} — أمر الانضمام: ${state.settings.joinCommand}`
        : `الجولة ${state.round}${state.phase === "PICKING" ? " — بيختار ضحيته" : ""}`;
    case "WOULD_YOU_RATHER":
      return state.phase === "WAITING_TO_START"
        ? "هيبدأ أول سؤال دلوقتي"
        : `سؤال ${state.round} — اكتب 1 أو 2`;
    case "FLAGS":
      return state.phase === "WAITING_TO_START"
        ? "هيبدأ أول علم دلوقتي"
        : state.phase === "QUESTION"
          ? `جولة ${state.round} / ${state.settings.totalRounds} — اكتب اسم الدولة`
          : `جولة ${state.round} / ${state.settings.totalRounds} — الإجابة: ${state.countryName}`;
    case "CAPITALS":
      return state.phase === "WAITING_TO_START"
        ? "هتبدأ أول دولة دلوقتي"
        : state.phase === "QUESTION"
          ? `جولة ${state.round} / ${state.settings.totalRounds} — عاصمة ${state.countryName}؟`
          : `جولة ${state.round} / ${state.settings.totalRounds} — الإجابة: ${state.capitalName}`;
    case "LOGOS":
      return state.phase === "WAITING_TO_START"
        ? "هيبدأ أول شعار دلوقتي"
        : state.phase === "QUESTION"
          ? `جولة ${state.round} / ${state.settings.totalRounds} — اكتب اسم الماركة`
          : `جولة ${state.round} / ${state.settings.totalRounds} — الإجابة: ${state.brandName}`;
    case "SPEED_WORD":
      return state.phase === "WAITING_TO_START"
        ? "هتبدأ أول كلمة دلوقتي"
        : state.phase === "QUESTION"
          ? `كلمة ${state.round} — اكتبها بالظبط`
          : `كلمة ${state.round} — الكلمة: ${state.word}`;
    case "MAZE":
      return state.phase === "WAITING_FOR_PLAYERS"
        ? `بانتظار اللاعبين — ${state.players.length} / ${state.settings.maxPlayers} — أمر الانضمام: ${state.settings.joinCommand}`
        : "السباق شغال — اكتب 1 لـ 4 عشان تتحرك، !فخ عشان تحط فخ";
  }
}

/**
 * Its own page (not a card inside a game's control page) on purpose: once a game starts, that
 * page goes fullscreen and covers itself, so there'd be no way to reach the simulate form from
 * there. Open this in a second tab next to the fullscreen game / overlay and keep testing from
 * here.
 */
export default function LiveSimulate() {
  const { user } = useAuth();
  const { liveSession, loadingLiveSession } = useLiveSession();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatFeed, setChatFeed] = useState<ChatMessage[]>([]);

  const [simHandle, setSimHandle] = useState(() => `test_viewer_${Math.floor(Math.random() * 9000 + 1000)}`);
  const [simText, setSimText] = useState("!ادخل");
  const [simError, setSimError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return;

    const socket = connectDashboardSocket();
    socketRef.current = socket;

    socket.on("game:state", (state: GameState) => setGameState(state));
    socket.on("chat:comment", (payload: { viewer: { handle: string; displayName: string }; text: string; at: string }) => {
      setChatFeed((prev) =>
        [
          { id: `${payload.at}-${payload.viewer.handle}-${Math.random()}`, displayName: payload.viewer.displayName, text: payload.text },
          ...prev,
        ].slice(0, 50),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    const liveSessionId = liveSession?.id;
    if (!socket || !liveSessionId) return;

    const rejoin = () => socket.emit("join", liveSessionId);
    rejoin();
    // Re-join on every reconnect, not just the initial mount — see GameControlShell for why.
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [liveSession?.id]);

  async function handleSimulate(e: FormEvent) {
    e.preventDefault();
    if (!liveSession || !simHandle.trim() || !simText.trim()) return;
    setSimError(null);
    try {
      await simulateComment(liveSession.id, simHandle.trim(), simText.trim());
      // Each simulated viewer can only join once (dedup by handle), so roll a fresh one for the
      // next click instead of leaving the same value — avoids silent no-op resubmits.
      setSimHandle(`test_viewer_${Math.floor(Math.random() * 9000 + 1000)}`);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "حصل خطأ غير متوقع، جرب تاني");
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-glass-border bg-canvas/70 backdrop-blur-2xl">
        <Container className="flex items-center justify-between py-4">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <Link to="/dashboard" className="text-sm text-ink-muted hover:text-ink">
            رجوع للداشبورد
          </Link>
        </Container>
      </header>

      <Container className="space-y-8 py-10">
        <Reveal>
          <h1 className="text-2xl font-bold">صفحة الاختبار</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            ابعت كومنتات وهمية من هنا، وتابع اللعبة في تاب تاني (صفحة اللايف أو شاشة الـ Overlay) — بتتحدث لحظياً.
          </p>
        </Reveal>

        {!loadingLiveSession && !liveSession && (
          <Reveal delay={0.05}>
            <GlassCard hoverLift={false} className="p-6 text-center">
              <p className="text-sm text-ink-muted">مفيش لايف شغال دلوقتي.</p>
              <Link to="/live/connect" className="mt-3 inline-block">
                <Button size="md">اربط حسابك</Button>
              </Link>
            </GlassCard>
          </Reveal>
        )}

        {liveSession && (
          <>
            <Reveal delay={0.05}>
              <GlassCard hoverLift={false} className="flex flex-wrap items-center gap-3 p-4">
                <span className="rounded-full border border-glass-border bg-glass px-3 py-1 text-xs">
                  @{liveSession.channelUsername}
                </span>
                {gameState ? (
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                    {gameStatusText(gameState)}
                  </span>
                ) : (
                  <span className="rounded-full bg-glass px-3 py-1 text-xs text-ink-muted">مفيش لعبة شغالة دلوقتي</span>
                )}
              </GlassCard>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <GlassCard hoverLift={false} className="p-6">
                  <h3 className="mb-3 text-sm font-semibold">ابعت كومنت وهمي</h3>
                  <p className="mb-4 text-xs text-ink-muted">
                    اكتب أمر الانضمام أو رقم الكرسي (الكراسي الموسيقية)، أو إجابة السؤال (أسئلة عامة) — بالظبط زي المشاهد الحقيقي.
                  </p>
                  <form onSubmit={handleSimulate} className="space-y-3">
                    <Input label="اسم المشاهد" dir="ltr" value={simHandle} onChange={(e) => setSimHandle(e.target.value)} />
                    <Input label="الكومنت" value={simText} onChange={(e) => setSimText(e.target.value)} />
                    <Button type="submit" variant="secondary" size="md" magnetic={false} className="w-full">
                      <PaperPlaneTilt size={16} />
                      ابعت
                    </Button>
                    {simError && (
                      <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {simError}
                      </p>
                    )}
                  </form>
                </GlassCard>

                <GlassCard hoverLift={false} className="flex max-h-96 flex-col p-6">
                  <div className="mb-3 flex shrink-0 items-center gap-2">
                    <ChatCircleDots size={18} className="text-accent" />
                    <h3 className="text-sm font-semibold">شات اللايف</h3>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                    {chatFeed.length === 0 && <p className="text-xs text-ink-muted">لسه مفيش كومنتات.</p>}
                    {chatFeed.map((m) => (
                      <div key={m.id} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
                        <bdi className="font-medium text-accent">{m.displayName}</bdi>
                        <span className="text-ink-muted">: {m.text}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </Reveal>
          </>
        )}
      </Container>
    </div>
  );
}
