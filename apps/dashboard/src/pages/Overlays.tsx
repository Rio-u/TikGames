import type {
  OverlayWidgetCategory,
  OverlayWidgetDefinition,
  OverlayWidgetSettings,
} from "@tikgames/shared-types";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Broadcast,
  Check,
  Copy,
  Info,
  Monitor,
  PlayCircle,
  ShieldCheck,
  Sliders,
  Timer as TimerIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { DashboardShell } from "../components/DashboardShell";
import { EmptyState } from "../components/EmptyState";
import { SkeletonBlock } from "../components/StatTile";
import { WidgetCustomizeDialog } from "../components/WidgetCustomizeDialog";
import { WidgetPreview } from "../components/WidgetPreview";
import { widgetIcon } from "../data/widgetIcons";
import {
  getWidgetGallery,
  resetWidgetSettings,
  resetWidgetState,
  saveWidgetSettings,
  setOverlayTimer,
  testWidget,
  type WidgetGalleryResponse,
} from "../lib/overlaysApi";

const OVERLAY_BASE = import.meta.env.VITE_OVERLAY_URL ?? "http://localhost:5174";

const CATEGORY_LABELS: Record<OverlayWidgetCategory, string> = {
  CHAT: "الشات",
  GIFTS: "الهدايا",
  RANKING: "الترتيب",
  EFFECTS: "تأثيرات على الشاشة",
  UTILITY: "أدوات",
};

const CATEGORY_ORDER: OverlayWidgetCategory[] = ["GIFTS", "RANKING", "CHAT", "EFFECTS", "UTILITY"];

const OBS_STEPS = [
  "في OBS اضغط + تحت Sources واختار Browser.",
  "الصق رابط الودجت في خانة URL.",
  "حط العرض والارتفاع بالمقاس المكتوب على الكارت.",
  "فعّل «Shutdown source when not visible» عشان الودجت ماتستهلكش وهي مخفية.",
];

/** The real OBS URL. Needs a live session, because the token is the session. */
function widgetUrl(token: string, widgetId: string): string {
  return `${OVERLAY_BASE}/w/${token}/${widgetId}`;
}

/**
 * A preview URL. Deliberately independent of any live session: it uses the reserved `preview`
 * token, carries the settings in the URL, and the overlay fills it with demo activity. That way
 * the gallery shows every widget in motion — and the customise dialog reflects unsaved edits —
 * without the streamer having to go live first.
 */
function widgetPreviewUrl(widgetId: string, settings: OverlayWidgetSettings | undefined): string {
  const query = new URLSearchParams({ preview: "1", s: JSON.stringify(settings ?? {}) });
  return `${OVERLAY_BASE}/w/preview/${widgetId}?${query.toString()}`;
}

function WidgetCard({
  widget,
  token,
  settings,
  previewNonce,
  onCustomize,
}: {
  widget: OverlayWidgetDefinition;
  token: string | null;
  settings: OverlayWidgetSettings | undefined;
  previewNonce: number;
  onCustomize: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [tested, setTested] = useState(false);
  const [emptied, setEmptied] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const IconComponent = widgetIcon(widget.id);
  const url = token ? widgetUrl(token, widget.id) : null;
  // The nonce is what makes a save in the customise dialog show up on the card behind it:
  // changing the src remounts the iframe with the new settings.
  const preview = `${widgetPreviewUrl(widget.id, settings)}&v=${previewNonce}`;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL field stays selectable as a fallback.
    }
  }

  async function runTest() {
    setTestError(null);
    try {
      await testWidget(widget.id);
      setTested(true);
      window.setTimeout(() => setTested(false), 2000);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "الاختبار فشل");
      window.setTimeout(() => setTestError(null), 4000);
    }
  }

  async function runReset() {
    setTestError(null);
    try {
      await resetWidgetState(widget.id);
      setEmptied(true);
      window.setTimeout(() => setEmptied(false), 2000);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "التفريغ فشل");
      window.setTimeout(() => setTestError(null), 4000);
    }
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-glass-border bg-glass backdrop-blur-xl transition-colors duration-300 hover:border-white/20"
    >
      {/* --- Live preview, inline ---------------------------------------------------- */}
      <div className="relative p-3 pb-0">
        <WidgetPreview
          url={preview}
          width={widget.recommendedSize.width}
          height={widget.recommendedSize.height}
          maxHeight={188}
        />
        <span
          dir="ltr"
          className="pointer-events-none absolute bottom-2 left-5 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] tabular-nums text-ink-muted backdrop-blur-sm"
        >
          {widget.recommendedSize.width}×{widget.recommendedSize.height}
        </span>
      </div>

      {/* --- Identity ----------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/10 text-accent">
            <IconComponent size={17} weight="duotone" />
          </span>
          {/* No "testable" chip: nearly every widget is, so the badge was noise — the presence
              of the جرّب button below already says it, in the place you'd act on it. */}
          <h3 className="min-w-0 flex-1 truncate font-bold">{widget.nameAr}</h3>
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">{widget.descriptionAr}</p>

        {widget.noteAr && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-ink-muted">
            <Info size={13} weight="fill" className="mt-0.5 shrink-0" />
            {widget.noteAr}
          </p>
        )}

        {/* --- URL + actions ---------------------------------------------------------- */}
        <div className="mt-auto pt-4">
          {url && (
            <div className="mb-2.5 flex items-center gap-1.5 rounded-xl border border-glass-border bg-canvas-elevated px-1 py-1">
              <input
                readOnly
                value={url}
                dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[11px] text-ink-muted outline-none"
              />
              <button
                type="button"
                onClick={copy}
                aria-label="انسخ الرابط"
                className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-glass hover:text-ink"
              >
                {copied ? (
                  <Check size={14} weight="bold" className="text-emerald-400" />
                ) : (
                  <Copy size={14} weight="bold" />
                )}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              magnetic={false}
              className="flex-1"
              onClick={onCustomize}
            >
              <Sliders size={14} weight="bold" />
              تخصيص
            </Button>
            {widget.testable && (
              <Button
                variant="secondary"
                size="md"
                magnetic={false}
                onClick={runTest}
                disabled={!url}
              >
                {tested ? (
                  <>
                    <Check size={14} weight="bold" className="text-emerald-400" />
                    اتبعت
                  </>
                ) : (
                  <>
                    <PlayCircle size={14} weight="bold" />
                    جرّب
                  </>
                )}
              </Button>
            )}

            {widget.resettable && (
              <Button
                variant="secondary"
                size="md"
                magnetic={false}
                onClick={runReset}
                disabled={!url}
              >
                {emptied ? (
                  <>
                    <Check size={14} weight="bold" className="text-emerald-400" />
                    اتفضّى
                  </>
                ) : (
                  <>
                    <ArrowCounterClockwise size={14} weight="bold" />
                    فضّي
                  </>
                )}
              </Button>
            )}
          </div>

          {testError && <p className="mt-2 text-xs text-amber-300">{testError}</p>}
        </div>
      </div>
    </motion.div>
  );
}

/** The TIMER widget has no data of its own — it's driven from here. */
function TimerControl({ disabled }: { disabled: boolean }) {
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function apply(seconds: number) {
    setBusy(true);
    setMessage(null);
    try {
      await setOverlayTimer(seconds, label);
      setMessage(seconds > 0 ? "العدّاد اشتغل" : "العدّاد اتوقف");
      window.setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <TimerIcon size={18} weight="duotone" className="text-accent" />
        <h3 className="font-bold">تشغيل المؤقّت</h3>
      </div>
      <p className="mb-4 text-sm text-ink-muted">
        العدّاد بيظهر في ودجت «المؤقّت». المدة بتتحسب من السيرفر، فلو الودجت اتقفلت وفتحت تاني
        بتكمّل من نفس المكان.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-xs text-ink-muted">المدة (دقيقة)</label>
          <input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-24 rounded-xl border border-glass-border bg-canvas-elevated px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div className="min-w-40 flex-1">
          <label className="mb-1.5 block text-xs text-ink-muted">النص (اختياري)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثال: باقي على الجولة"
            className="w-full rounded-xl border border-glass-border bg-canvas-elevated px-3 py-2 text-sm"
          />
        </div>
        <Button size="md" onClick={() => apply(minutes * 60)} disabled={busy || disabled}>
          شغّل
        </Button>
        <Button variant="secondary" size="md" magnetic={false} onClick={() => apply(0)} disabled={busy || disabled}>
          وقّف
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    </div>
  );
}

export default function Overlays() {
  const [data, setData] = useState<WidgetGalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<OverlayWidgetDefinition | null>(null);
  const [draft, setDraft] = useState<OverlayWidgetSettings>({});
  // Debounced copy of the draft. The preview URL carries the settings, so reacting to every
  // keystroke or slider step would remount the iframe dozens of times a second and strobe.
  const [debouncedDraft, setDebouncedDraft] = useState<OverlayWidgetSettings>({});
  const [saving, setSaving] = useState(false);
  // Bumped on every save so the preview iframe remounts and picks up the new settings.
  const [previewNonce, setPreviewNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getWidgetGallery());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل الودجتس");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedDraft(draft), 350);
    return () => window.clearTimeout(id);
  }, [draft]);

  function openCustomize(widget: OverlayWidgetDefinition) {
    const current = { ...(data?.settings[widget.id] ?? {}) };
    setEditing(widget);
    setDraft(current);
    setDebouncedDraft(current);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const result = await saveWidgetSettings(editing.id, draft);
      setData((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, [editing.id]: result.settings } } : prev,
      );
      setDraft(result.settings);
      setPreviewNonce((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "الحفظ فشل");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!editing) return;
    const result = await resetWidgetSettings(editing.id);
    setData((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, [editing.id]: result.settings } } : prev,
    );
    setDraft(result.settings);
    setPreviewNonce((n) => n + 1);
  }

  const token = data?.overlayToken ?? null;
  const grouped = new Map<OverlayWidgetCategory, OverlayWidgetDefinition[]>();
  for (const widget of data?.widgets ?? []) {
    const bucket = grouped.get(widget.category) ?? [];
    bucket.push(widget);
    grouped.set(widget.category, bucket);
  }

  return (
    <DashboardShell
      title="معرض الأوفرلايز"
      description="كل ودجت رابط مستقل تحطه Browser Source لوحده في OBS — كده تقدر تحرّك كل حاجة وتحجّمها براحتك بدل طبقة واحدة كبيرة."
      actions={
        <ButtonLink to="/dashboard/tikgames" variant="secondary" size="md" magnetic={false}>
          أوفرلاي الألعاب
        </ButtonLink>
      }
    >
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonBlock key={i} className="h-64" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={Monitor} title="تعذّر تحميل الودجتس" description={error} />
      ) : (
        <div className="space-y-8">
          {!token && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
              <div className="flex items-center gap-3">
                <Broadcast size={22} weight="fill" className="text-amber-300" />
                <div>
                  <p className="text-sm font-semibold">مفيش لايف شغال</p>
                  <p className="text-xs text-ink-muted">
                    المعاينات تحت شغالة ببيانات تجريبية، وتقدر تظبط كل الإعدادات من دلوقتي —
                    بس روابط OBS نفسها مربوطة بتوكن جلسة اللايف فبتتولد أول ما تبدأ لايف.
                  </p>
                </div>
              </div>
              <ButtonLink to="/live/connect" size="md">
                ابدأ لايف
                <ArrowRight size={15} weight="bold" className="rtl:rotate-180" />
              </ButtonLink>
            </div>
          )}

          {token && (
            <p className="flex items-start gap-2 rounded-2xl border border-glass-border bg-glass p-4 text-xs leading-relaxed text-ink-muted">
              <ShieldCheck size={15} weight="fill" className="mt-0.5 shrink-0 text-emerald-400" />
              الروابط دي فيها توكن جلستك — أي حد معاه يقدر يشوف الودجتس، فمتظهرهاش على الشاشة ولا
              تشاركها في الشات. الودجتس نفسها للقراءة بس، مش بتقدر تغيّر أي حاجة في حسابك.
            </p>
          )}

          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
            <section key={category}>
              <h2 className="mb-4 text-sm font-semibold text-ink-muted">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {grouped.get(category)!.map((widget) => (
                  <WidgetCard
                    key={widget.id}
                    widget={widget}
                    token={token}
                    settings={data?.settings[widget.id]}
                    previewNonce={previewNonce}
                    onCustomize={() => openCustomize(widget)}
                  />
                ))}
              </div>
            </section>
          ))}

          <TimerControl disabled={!token} />

          <div className="rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl">
            <h2 className="mb-4 font-bold">تحطها في OBS إزاي</h2>
            <ol className="space-y-3">
              {OBS_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-ink-muted">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {editing && (
        <WidgetCustomizeDialog
          widget={editing}
          settings={draft}
          previewUrl={widgetPreviewUrl(editing.id, debouncedDraft)}
          saving={saving}
          onChange={setDraft}
          onSave={save}
          onReset={reset}
          onClose={() => setEditing(null)}
        />
      )}
    </DashboardShell>
  );
}
