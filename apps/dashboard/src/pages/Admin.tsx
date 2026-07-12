import {
  Bell,
  Broadcast,
  CaretDown,
  ChartLineUp,
  Check,
  ClipboardText,
  GameController,
  Image,
  MusicNotes,
  ShieldCheck,
  Star,
  ToggleLeft,
  Trash,
  UserPlus,
  Users,
} from "@phosphor-icons/react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  adminActivateSubscription,
  adminClearGameContentImage,
  adminDeleteMusicTrack,
  adminDeleteSpeedWordImage,
  adminDeleteTriviaImage,
  adminGetAnalytics,
  adminGetHomepageSettings,
  adminListAlerts,
  adminListGameContent,
  adminListGameToggles,
  adminListLogs,
  adminListMusicTracks,
  adminListSpeedWordImages,
  adminListTriviaImages,
  adminListUsers,
  adminResolveAlert,
  adminSetGameToggle,
  adminSuspendSubscription,
  adminUpdateGameContent,
  adminUpdateHomepageSettings,
  adminUploadGameContentImage,
  adminUploadMusicTracks,
  adminUploadSpeedWordImages,
  adminUploadTriviaImages,
  type AdminAlert,
  type AdminAnalytics,
  type AdminGameContentEntry,
  type AdminLogEntry,
  type AdminUser,
  type GameToggle,
  type MusicTrack,
} from "../lib/adminApi";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { GlassCard } from "../components/GlassCard";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { GAMES, type GameDefinition } from "../data/games";

type Tab = "games" | "analytics" | "users" | "alerts" | "logs";

const TABS: { id: Tab; label: string; icon: typeof Image }[] = [
  { id: "games", label: "محتوى الألعاب", icon: Image },
  { id: "analytics", label: "التحليلات", icon: ChartLineUp },
  { id: "users", label: "المستخدمين والاشتراكات", icon: Users },
  { id: "alerts", label: "التنبيهات", icon: Bell },
  { id: "logs", label: "سجل النشاط", icon: ClipboardText },
];

const GAME_LABELS: Record<string, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.nameAr]));

const SUB_LABELS: Record<string, string> = {
  TRIAL: "تجربة مجانية",
  ACTIVE: "مشترك",
  EXPIRED: "الاشتراك منتهي",
  SUSPENDED: "موقوف",
};

const SEVERITY_STYLES: Record<AdminAlert["severity"], string> = {
  INFO: "bg-glass text-ink-muted",
  WARNING: "bg-amber-500/15 text-amber-400",
  CRITICAL: "bg-red-500/15 text-red-300",
};

function HomepageSettingsCard() {
  const [heroTitle, setHeroTitle] = useState("");
  const [featured, setFeatured] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminGetHomepageSettings()
      .then((data) => {
        setHeroTitle(data.heroTitle ?? "");
        setFeatured(data.featuredGameTypes);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleFeatured(gameId: string) {
    setSaved(false);
    setFeatured((prev) => {
      if (prev.includes(gameId)) return prev.filter((id) => id !== gameId);
      if (prev.length >= 3) return prev;
      return [...prev, gameId];
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminUpdateHomepageSettings(heroTitle, featured);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const buildableGames = GAMES.filter((g) => g.route);

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2">
        <Star size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">تنظيم صفحة الداشبورد</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        عنوان رئيسي كبير فوق مكتبة الألعاب، واختَر لحد 3 ألعاب تتعرض بشكل مميز فوق القائمة الكاملة. سيب العنوان فاضي
        عشان يختفي، وسيب اختيار الألعاب فاضي عشان يفضل شكل المكتبة زي ما هو.
      </p>

      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="space-y-5">
          <Input
            label="العنوان الرئيسي"
            name="heroTitle"
            value={heroTitle}
            onChange={(e) => {
              setHeroTitle(e.target.value);
              setSaved(false);
            }}
            placeholder="مثلاً: ألعاب اللايف بتاعتك"
            maxLength={120}
          />

          <div>
            <p className="mb-2 text-sm text-ink-muted">
              الألعاب المميزة ({featured.length}/3)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {buildableGames.map((game) => {
                const isFeatured = featured.includes(game.id);
                const disabled = !isFeatured && featured.length >= 3;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => toggleFeatured(game.id)}
                    disabled={disabled}
                    aria-pressed={isFeatured}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                      isFeatured
                        ? "border-accent bg-accent/10 shadow-glow-sm"
                        : "border-glass-border bg-canvas-elevated/40 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl">{game.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{game.nameAr}</span>
                    {isFeatured && <Star size={18} weight="fill" className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
            {saved && <span className="text-sm text-emerald-400">اتحفظ ✓</span>}
            {error && <span className="text-sm text-red-300">{error}</span>}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function GameTogglesCard() {
  const [toggles, setToggles] = useState<GameToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);

  function refresh() {
    adminListGameToggles()
      .then((data) => setToggles(data.toggles))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function toggle(gameType: string, next: boolean) {
    setBusyType(gameType);
    try {
      await adminSetGameToggle(gameType, next);
      setToggles((prev) => prev.map((t) => (t.gameType === gameType ? { ...t, enabled: next } : t)));
    } finally {
      setBusyType(null);
    }
  }

  const buildableGames = GAMES.filter((g) => g.route);
  const enabledByType = new Map(toggles.map((t) => [t.gameType, t.enabled]));

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2">
        <ToggleLeft size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">تفعيل وإيقاف الألعاب</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        لعبة موقوفة هنا مبيقدرش أي استرير يبدأها من جديد — أي جلسة شغالة دلوقتي مش بتتأثر.
      </p>

      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {buildableGames.map((game) => {
            const enabled = enabledByType.get(game.id) ?? true;
            return (
              <div key={game.id} className="flex items-center gap-3 rounded-xl border border-glass-border bg-canvas-elevated/40 p-3">
                <span className="text-2xl">{game.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{game.nameAr}</p>
                  <p className={`text-xs ${enabled ? "text-emerald-400" : "text-amber-400"}`}>
                    {enabled ? "شغالة للاسترييمرز" : "متوقفة مؤقتاً"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(game.id, !enabled)}
                  disabled={busyType === game.id}
                  aria-pressed={enabled}
                  aria-label={`${enabled ? "أوقف" : "فعّل"} ${game.nameAr}`}
                  className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-200 disabled:opacity-50 ${
                    enabled ? "justify-end bg-emerald-500" : "justify-start bg-glass-strong"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="h-5 w-5 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

function trackFileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url);
  } catch {
    return url;
  }
}

function MusicTracksCard() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    adminListMusicTracks()
      .then((data) => setTracks(data.tracks))
      .catch((err) => setError(err instanceof Error ? err.message : "حصل خطأ"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await adminUploadMusicTracks(Array.from(files));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الملفات");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    await adminDeleteMusicTrack(id).catch(() => refresh());
  }

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2">
        <MusicNotes size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">موسيقى الكراسي الموسيقية</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        كل جلسة كراسي موسيقية بتختار مقطوعة عشوائية من هنا وتشغلها وقت دوران الكراسي. من غير مقطوعات هنا اللعبة بتشتغل من
        غير صوت.
      </p>

      <input
        type="file"
        accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.ogg,.wav,.m4a"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="block w-full max-w-xs text-sm text-ink-muted file:ml-3 file:rounded-full file:border-0 file:bg-glass file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink file:hover:bg-glass-strong"
      />
      {uploading && <p className="mt-1.5 text-xs text-ink-muted">بيرفع...</p>}
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="mt-5 space-y-2">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-glass-border bg-canvas-elevated/40 p-3">
              <MusicNotes size={18} className="shrink-0 text-accent" />
              <p className="min-w-0 flex-1 truncate text-xs text-ink-muted" dir="ltr">
                {trackFileName(t.url)}
              </p>
              <audio controls src={t.url} className="h-8 max-w-[220px] shrink-0" />
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                aria-label="شيل المقطوعة"
                className="shrink-0 rounded-full border border-glass-border bg-glass p-2 text-ink-muted transition-colors hover:text-red-300"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
          {tracks.length === 0 && <p className="text-sm text-ink-muted">لسه مفيش مقطوعات — ارفع أول مقطوعة فوق.</p>}
        </div>
      )}
    </GlassCard>
  );
}

function GameContentRow({
  game,
  entry,
  open,
  onToggle,
  onSaved,
}: {
  game: GameDefinition;
  entry: AdminGameContentEntry | undefined;
  open: boolean;
  onToggle: () => void;
  onSaved: (updated: AdminGameContentEntry) => void;
}) {
  const [nameAr, setNameAr] = useState(entry?.nameAr ?? "");
  const [descriptionAr, setDescriptionAr] = useState(entry?.descriptionAr ?? "");
  const [bioAr, setBioAr] = useState(entry?.bioAr ?? "");
  const [rulesAr, setRulesAr] = useState(entry?.rulesAr ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const saveSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Both save actions were silently succeeding with zero visible feedback — the only way to tell
  // anything happened was the "معدّل" pill (invisible if the admin only touched fields that were
  // already non-empty) or the row header text (invisible unless they edited the name itself).
  // A flashed "تم الحفظ ✓" that auto-clears is the fix — never leave a stale "saved" state lying
  // around if the admin reopens/re-edits the row later.
  useEffect(() => {
    return () => {
      if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);
      if (uploadSuccessTimer.current) clearTimeout(uploadSuccessTimer.current);
    };
  }, []);

  // Re-seed only when the row is opened, not on every `entry` update — the image upload's own
  // response also refreshes `entry` (it comes back through the same onSaved → parent `content`
  // state), and keying this on `entry` would silently wipe out text the admin already typed but
  // hasn't saved yet, the moment they upload a cover image mid-edit.
  useEffect(() => {
    if (!open) return;
    setNameAr(entry?.nameAr ?? "");
    setDescriptionAr(entry?.descriptionAr ?? "");
    setBioAr(entry?.bioAr ?? "");
    setRulesAr(entry?.rulesAr ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const edited = !!(entry?.nameAr || entry?.descriptionAr || entry?.bioAr || entry?.rulesAr || entry?.imageUrl);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const { content } = await adminUpdateGameContent(game.id, { nameAr, descriptionAr, bioAr, rulesAr });
      onSaved(content);
      setSaveSuccess(true);
      if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);
      saveSuccessTimer.current = setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "حصل خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const { content } = await adminUploadGameContentImage(game.id, file);
      onSaved(content);
      setUploadSuccess(true);
      if (uploadSuccessTimer.current) clearTimeout(uploadSuccessTimer.current);
      uploadSuccessTimer.current = setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleClearImage() {
    const { content } = await adminClearGameContentImage(game.id);
    if (content) onSaved(content);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-canvas-elevated/40">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-right">
        <span className="text-xl">{game.emoji}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry?.nameAr ?? game.nameAr}</span>
        {edited && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">معدّل</span>}
        <CaretDown size={16} className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-glass-border p-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <div className="aspect-[21/9] w-full overflow-hidden rounded-lg border border-glass-border bg-canvas-soft">
              {entry?.imageUrl ? (
                <img src={entry.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-ink-muted">
                  لا توجد صورة مخصصة
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-xs text-ink-muted file:ml-2 file:rounded-full file:border-0 file:bg-glass file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink file:hover:bg-glass-strong"
            />
            {uploading && <p className="text-[11px] text-ink-muted">بيرفع...</p>}
            {uploadSuccess && (
              <p className="flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-300">
                <Check size={13} weight="bold" />
                اتحفظت الصورة
              </p>
            )}
            {uploadError && (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
                {uploadError}
              </p>
            )}
            {entry?.imageUrl && (
              <button type="button" onClick={handleClearImage} className="text-[11px] text-red-300 hover:underline">
                حذف الصورة
              </button>
            )}
          </div>

          <div className="space-y-3">
            <Input
              label="اسم اللعبة"
              name={`gameContentName-${game.id}`}
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={game.nameAr}
            />
            <div>
              <label className="mb-1.5 block text-sm text-ink-muted">الوصف (يظهر في مكتبة الألعاب)</label>
              <textarea
                rows={2}
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder={game.descriptionAr}
                className="w-full rounded-xl border border-glass-border bg-canvas-elevated/60 px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/50 focus:border-accent focus:shadow-glow-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-ink-muted">شرح اللعبة (يظهر في صفحة الإعدادات)</label>
              <textarea
                rows={4}
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-canvas-elevated/60 px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/50 focus:border-accent focus:shadow-glow-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-ink-muted">قواعد التشغيل (سطر لكل قاعدة)</label>
              <textarea
                rows={4}
                value={rulesAr}
                onChange={(e) => setRulesAr(e.target.value)}
                placeholder={"اكتب قاعدة في كل سطر\nمثال: كل جولة 15 ثانية"}
                className="w-full rounded-xl border border-glass-border bg-canvas-elevated/60 px-4 py-2.5 text-sm text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/50 focus:border-accent focus:shadow-glow-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button size="md" magnetic={false} onClick={handleSave} disabled={saving} className="!px-4 !py-2 !text-xs">
                {saving ? "جاري الحفظ..." : "حفظ"}
              </Button>
              {saveSuccess && (
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-300">
                  <Check size={14} weight="bold" />
                  تم الحفظ
                </p>
              )}
              {saveError && <p className="text-xs text-red-300">{saveError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GameContentCard() {
  const [content, setContent] = useState<AdminGameContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openType, setOpenType] = useState<string | null>(null);

  function refresh() {
    adminListGameContent()
      .then((data) => setContent(data.content))
      .finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  const byType = new Map(content.map((c) => [c.gameType, c]));

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2">
        <Image size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">بيانات ومحتوى الألعاب</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        الاسم والوصف وصورة الغلاف بتظهر في مكتبة الألعاب — وشرح اللعبة وقواعد التشغيل بتظهر في صفحة إعدادات اللعبة قبل ما
        الستريمر يبدأها. سيب أي حقل فاضي عشان يفضل يستخدم القيمة الافتراضية.
      </p>
      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {GAMES.map((game) => (
            <GameContentRow
              key={game.id}
              game={game}
              entry={byType.get(game.id)}
              open={openType === game.id}
              onToggle={() => setOpenType((t) => (t === game.id ? null : game.id))}
              onSaved={(updated) => setContent((prev) => prev.map((c) => (c.gameType === game.id ? updated : c)))}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

interface PoolImage {
  id: string;
  url: string;
}

/** Shared "grid of admin-uploaded images, one platform-wide pool" pattern — Trivia's background
 *  pool was the sole instance until Speed Word needed the identical shape, which is exactly the
 *  point this project's "extract once reused by 2+" rule says to pull it out (see CLAUDE.md). */
function ImagePoolCard({
  title,
  description,
  listFn,
  uploadFn,
  deleteFn,
}: {
  title: string;
  description: string;
  listFn: () => Promise<{ images: PoolImage[] }>;
  uploadFn: (files: File[]) => Promise<{ images: PoolImage[] }>;
  deleteFn: (id: string) => Promise<{ ok: true }>;
}) {
  const [images, setImages] = useState<PoolImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listFn()
      .then((data) => setImages(data.images))
      .catch((err) => setError(err instanceof Error ? err.message : "حصل خطأ"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFn(Array.from(files));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الصور");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    await deleteFn(id).catch(() => refresh());
  }

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2">
        <Image size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">{description}</p>

      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="block w-full max-w-xs text-sm text-ink-muted file:ml-3 file:rounded-full file:border-0 file:bg-glass file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink file:hover:bg-glass-strong"
      />
      {uploading && <p className="mt-1.5 text-xs text-ink-muted">بيرفع...</p>}
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-glass-border">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                aria-label="شيل الصورة"
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash size={22} />
              </button>
            </div>
          ))}
          {images.length === 0 && <p className="col-span-full text-sm text-ink-muted">لسه مفيش صور — ارفع أول خلفية فوق.</p>}
        </div>
      )}
    </GlassCard>
  );
}

function GamesTab() {
  return (
    <div className="space-y-6">
      <HomepageSettingsCard />

      <GameTogglesCard />

      <GameContentCard />

      <MusicTracksCard />

      <ImagePoolCard
        title="خلفيات لعبة أسئلة عامة"
        description="كل الصور هنا مشتركة بين كل الاسترييمرز — كل سؤال بياخد خلفية عشوائية منها. أي تعديل هنا بيطبق على أي لعبة تتشغّل من دلوقتي."
        listFn={adminListTriviaImages}
        uploadFn={adminUploadTriviaImages}
        deleteFn={adminDeleteTriviaImage}
      />

      <ImagePoolCard
        title="خلفيات لعبة أسرع"
        description="كل الصور هنا مشتركة بين كل الاسترييمرز — كل كلمة بتاخد خلفية عشوائية منها. أي تعديل هنا بيطبق على أي لعبة تتشغّل من دلوقتي."
        listFn={adminListSpeedWordImages}
        uploadFn={adminUploadSpeedWordImages}
        deleteFn={adminDeleteSpeedWordImage}
      />
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    adminListUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err instanceof Error ? err.message : "حصل خطأ"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function activate(userId: string) {
    setBusyId(userId);
    try {
      await adminActivateSubscription(userId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ");
    } finally {
      setBusyId(null);
    }
  }

  async function suspend(userId: string) {
    setBusyId(userId);
    try {
      await adminSuspendSubscription(userId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2">
        <Users size={20} className="text-accent" weight="fill" />
        <h2 className="font-semibold">المستخدمين ({users.length})</h2>
      </div>

      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b border-glass-border text-xs text-ink-muted">
                <th className="py-2 pl-3 font-medium">الاسم</th>
                <th className="py-2 pl-3 font-medium">اليوزر</th>
                <th className="py-2 pl-3 font-medium" dir="ltr">
                  الإيميل
                </th>
                <th className="py-2 pl-3 font-medium">الدور</th>
                <th className="py-2 pl-3 font-medium">الاشتراك</th>
                <th className="py-2 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-glass-border/60">
                  <td className="py-2.5 pl-3">
                    <bdi>{u.displayName}</bdi>
                  </td>
                  <td className="py-2.5 pl-3 text-ink-muted" dir="ltr">
                    @{u.username}
                  </td>
                  <td className="py-2.5 pl-3 text-ink-muted" dir="ltr">
                    {u.email}
                  </td>
                  <td className="py-2.5 pl-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "ADMIN" ? "bg-accent/15 text-accent" : "bg-glass text-ink-muted"}`}>
                      {u.role === "ADMIN" ? "أدمن" : "استرير"}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.subscription?.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : u.subscription?.status === "SUSPENDED"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-glass text-ink-muted"
                      }`}
                    >
                      {u.subscription ? SUB_LABELS[u.subscription.status] : "—"}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1.5">
                      {u.subscription?.status !== "ACTIVE" && (
                        <Button size="md" magnetic={false} disabled={busyId === u.id} onClick={() => activate(u.id)} className="!px-3 !py-1 !text-xs">
                          فعّل
                        </Button>
                      )}
                      {u.subscription?.status !== "SUSPENDED" && (
                        <Button variant="secondary" size="md" magnetic={false} disabled={busyId === u.id} onClick={() => suspend(u.id)} className="!px-3 !py-1 !text-xs">
                          علّق
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [filter, setFilter] = useState<AdminAlert["status"] | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    adminListAlerts(filter === "ALL" ? undefined : filter)
      .then((data) => setAlerts(data.alerts))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [filter]);

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await adminResolveAlert(id);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-accent" weight="fill" />
          <h2 className="font-semibold">التنبيهات</h2>
        </div>
        <div className="flex gap-1.5">
          {(["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"] as const).map((s) => (
            <Button
              key={s}
              size="md"
              variant={filter === s ? "primary" : "secondary"}
              magnetic={false}
              onClick={() => setFilter(s)}
              className="!px-3 !py-1.5 !text-xs"
            >
              {s === "OPEN" ? "مفتوح" : s === "ACKNOWLEDGED" ? "قيد المتابعة" : s === "RESOLVED" ? "اتحل" : "الكل"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-glass-border bg-canvas-elevated/40 p-3">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[a.severity]}`}>{a.severity}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.message}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {a.source} — {new Date(a.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              {a.status !== "RESOLVED" && (
                <Button size="md" magnetic={false} disabled={busyId === a.id} onClick={() => resolve(a.id)} className="!px-3 !py-1 !text-xs shrink-0">
                  حل
                </Button>
              )}
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-ink-muted">مفيش تنبيهات دلوقتي.</p>}
        </div>
      )}
    </GlassCard>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: number;
  icon: typeof Image;
  tone?: "accent" | "emerald" | "amber" | "red";
}) {
  const toneClasses: Record<string, string> = {
    accent: "text-accent bg-accent/15",
    emerald: "text-emerald-400 bg-emerald-500/15",
    amber: "text-amber-400 bg-amber-500/15",
    red: "text-red-300 bg-red-500/15",
  };
  return (
    <div className="rounded-2xl border border-glass-border bg-canvas-elevated/40 p-4">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${toneClasses[tone]}`}>
        <Icon size={18} weight="fill" />
      </div>
      <p className="text-2xl font-extrabold">{value.toLocaleString("ar-EG")}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetAnalytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassCard hoverLift={false} className="p-6 sm:p-8">
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      </GlassCard>
    );
  }
  if (!data) {
    return (
      <GlassCard hoverLift={false} className="p-6 sm:p-8">
        <p className="text-sm text-ink-muted">حصل خطأ في تحميل الإحصائيات</p>
      </GlassCard>
    );
  }

  const maxTypeCount = Math.max(1, ...data.gameSessions.byType.map((g) => g.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="إجمالي المستخدمين" value={data.users.total} icon={Users} tone="accent" />
        <StatCard label="مستخدمين جدد (٧ أيام)" value={data.users.new7d} icon={UserPlus} tone="emerald" />
        <StatCard label="لايف شغال دلوقتي" value={data.liveSessions.live} icon={Broadcast} tone="emerald" />
        <StatCard label="إجمالي جلسات اللايف" value={data.liveSessions.total} icon={Broadcast} tone="accent" />
        <StatCard label="ألعاب اتلعبت" value={data.gameSessions.total} icon={GameController} tone="accent" />
        <StatCard label="ألعاب آخر ٧ أيام" value={data.gameSessions.last7d} icon={GameController} tone="emerald" />
        <StatCard label="تنبيهات مفتوحة" value={data.alerts.open} icon={Bell} tone={data.alerts.open > 0 ? "amber" : "accent"} />
        <StatCard
          label="تنبيهات حرجة"
          value={data.alerts.criticalOpen}
          icon={Bell}
          tone={data.alerts.criticalOpen > 0 ? "red" : "accent"}
        />
      </div>

      <GlassCard hoverLift={false} className="p-6 sm:p-8">
        <h2 className="mb-4 font-semibold">الاشتراكات</h2>
        <div className="flex flex-wrap gap-3">
          {data.subscriptions.map((s) => (
            <span key={s.status} className="rounded-full border border-glass-border bg-canvas-elevated/40 px-3 py-1.5 text-sm">
              {SUB_LABELS[s.status] ?? s.status}: <span className="font-bold">{s.count}</span>
            </span>
          ))}
          {data.subscriptions.length === 0 && <p className="text-sm text-ink-muted">لسه مفيش اشتراكات</p>}
        </div>
      </GlassCard>

      <GlassCard hoverLift={false} className="p-6 sm:p-8">
        <h2 className="mb-4 font-semibold">الألعاب حسب النوع</h2>
        <div className="space-y-2.5">
          {data.gameSessions.byType.map((g) => (
            <div key={g.gameType} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-ink-muted">{GAME_LABELS[g.gameType] ?? g.gameType}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-glass">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${(g.count / maxTypeCount) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-bold">{g.count}</span>
            </div>
          ))}
          {data.gameSessions.byType.length === 0 && <p className="text-sm text-ink-muted">لسه مفيش ألعاب اتلعبت</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    adminListLogs()
      .then((data) => setLogs(data.logs))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  return (
    <GlassCard hoverLift={false} className="p-6 sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardText size={20} className="text-accent" weight="fill" />
          <h2 className="font-semibold">سجل نشاط الأدمن ({logs.length})</h2>
        </div>
        <Button size="md" variant="secondary" magnetic={false} onClick={refresh} className="!px-3 !py-1.5 !text-xs">
          تحديث
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">جاري التحميل...</p>
      ) : (
        <div className="max-h-[560px] space-y-2 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-glass-border bg-canvas-elevated/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent">{l.action}</span>
                <span className="text-xs text-ink-muted">{new Date(l.createdAt).toLocaleString("ar-EG")}</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                الأدمن: <bdi>{l.adminUser?.displayName ?? l.adminUserId}</bdi>
                {l.targetUser && (
                  <>
                    {" "}
                    — الهدف: <bdi>{l.targetUser.displayName}</bdi>
                  </>
                )}
              </p>
              {!!l.metadata && (
                <pre dir="ltr" className="mt-1.5 overflow-x-auto rounded-lg bg-black/20 p-2 text-[11px] text-ink-muted">
                  {JSON.stringify(l.metadata)}
                </pre>
              )}
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-ink-muted">لسه مفيش نشاط مسجل.</p>}
        </div>
      )}
    </GlassCard>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>("games");

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

      <Container className="space-y-6 py-10">
        <Reveal>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-accent" weight="fill" />
            <h1 className="text-2xl font-bold">لوحة الأدمن</h1>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            إدارة الألعاب والمستخدمين والتنبيهات، وتحليلات ونشاط كامل للمنصة — الصفحة دي للأدمن بس.
          </p>
        </Reveal>

        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button key={id} size="md" variant={tab === id ? "primary" : "secondary"} magnetic={false} onClick={() => setTab(id)}>
              <Icon size={16} weight={tab === id ? "fill" : "regular"} />
              {label}
            </Button>
          ))}
        </div>

        {tab === "games" && <GamesTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "logs" && <LogsTab />}
      </Container>
    </div>
  );
}
