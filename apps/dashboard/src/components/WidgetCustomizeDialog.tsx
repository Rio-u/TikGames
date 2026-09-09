import type { OverlayField, OverlayWidgetDefinition, OverlayWidgetSettings } from "@tikgames/shared-types";
import { ArrowCounterClockwise, Eye, Sliders, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Button } from "./Button";
import { WidgetPreview } from "./WidgetPreview";

/**
 * Generic settings editor: it renders whatever `fields` the widget declares, so adding an option
 * to a widget is a catalog edit in shared-types and nothing here changes.
 *
 * The live preview is the real overlay page in an iframe (`?preview=1`), not a mock — what the
 * streamer tunes here is exactly what OBS will render, including the animations.
 */
export function WidgetCustomizeDialog({
  widget,
  settings,
  previewUrl,
  saving,
  onChange,
  onSave,
  onReset,
  onClose,
}: {
  widget: OverlayWidgetDefinition;
  settings: OverlayWidgetSettings;
  previewUrl: string | null;
  saving: boolean;
  onChange: (settings: OverlayWidgetSettings) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // Escape closes — a modal you can only leave with the mouse is a small cruelty.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Freeze the page underneath while the dialog is open.
   *
   * Without this, a wheel gesture over the dialog scrolls the gallery behind it: once the
   * settings panel hits its end the scroll *chains* to the page, and anywhere that isn't the
   * panel never had a scrollable ancestor to begin with. Closing the dialog then left the user
   * somewhere else entirely on a long list of widget cards.
   *
   * The scrollbar is compensated with padding so the page doesn't visibly jump sideways as it
   * locks and unlocks.
   */
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingInlineEnd;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPadding;
    };
  }, []);

  function set(key: string, value: string | number | boolean) {
    onChange({ ...settings, [key]: value });
  }

  /** A few handy presets beside the picker — most people want a brand colour, not a colour wheel. */
  const COLOR_SWATCHES = ["#a855f7", "#f43f5e", "#fbbf24", "#22d3ee", "#34d399", "#ffffff", "#0f0a1e"];

  function renderField(field: OverlayField) {
    const value = settings[field.key] ?? field.default;

    switch (field.type) {
      case "COLOR":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-glass-border">
                <span className="absolute inset-0" style={{ background: String(value) }} />
                <input
                  type="color"
                  value={String(value)}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <input
                type="text"
                dir="ltr"
                value={String(value)}
                onChange={(e) => set(field.key, e.target.value)}
                className="w-28 rounded-xl border border-glass-border bg-canvas-elevated px-2.5 py-2 font-mono text-xs outline-none transition-colors focus:border-accent"
              />
              <div className="flex gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => set(field.key, swatch)}
                    aria-label={swatch}
                    className={`h-6 w-6 rounded-lg border transition-transform hover:scale-110 ${
                      String(value).toLowerCase() === swatch
                        ? "border-accent ring-2 ring-accent/40"
                        : "border-white/15"
                    }`}
                    style={{ background: swatch }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case "NUMBER":
        return (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={field.min ?? 0}
              max={field.max ?? 100}
              value={Number(value)}
              onChange={(e) => set(field.key, Number(e.target.value))}
              className="range-input flex-1"
            />
            <input
              type="number"
              min={field.min}
              max={field.max}
              value={Number(value)}
              onChange={(e) => set(field.key, Number(e.target.value))}
              className="w-20 rounded-xl border border-glass-border bg-canvas-elevated px-2.5 py-2 text-sm tabular-nums outline-none transition-colors focus:border-accent"
            />
          </div>
        );
      case "TOGGLE":
        return (
          <button
            type="button"
            onClick={() => set(field.key, !value)}
            role="switch"
            aria-checked={value === true}
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
              value ? "bg-gradient-to-r from-primary to-accent" : "bg-white/12"
            }`}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
              // RTL: "on" sits at the leading (right) edge.
              style={value ? { right: 4 } : { right: 26 }}
            />
          </button>
        );
      case "SELECT":
        return (
          <select
            value={String(value)}
            onChange={(e) => set(field.key, e.target.value)}
            className="w-full rounded-xl border border-glass-border bg-canvas-elevated px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelAr}
              </option>
            ))}
          </select>
        );
      case "TEXT":
      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => set(field.key, e.target.value)}
            className="w-full rounded-xl border border-glass-border bg-canvas-elevated px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        );
    }
  }

  // Toggles read better as a compact row (label beside the switch); everything else stacks with
  // its label above. Splitting them is what stops the panel looking like a wall of form rows.
  const toggles = widget.fields.filter((f) => f.type === "TOGGLE");
  const rest = widget.fields.filter((f) => f.type !== "TOGGLE");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-glass-border bg-canvas-soft shadow-glass"
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-glass-border bg-gradient-to-l from-primary/10 to-transparent px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/10 text-accent shadow-glow-sm">
                <Sliders size={20} weight="duotone" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{widget.nameAr}</h2>
                <p className="text-xs text-ink-muted">
                  المقاس المقترح في OBS:{" "}
                  <span dir="ltr" className="tabular-nums">
                    {widget.recommendedSize.width}×{widget.recommendedSize.height}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="shrink-0 rounded-xl border border-glass-border bg-glass p-2 text-ink-muted transition-colors hover:bg-glass-strong hover:text-ink"
            >
              <X size={16} weight="bold" />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_minmax(320px,42%)]">
            {/* overscroll-contain stops a wheel gesture that reaches the end of this panel from
                continuing into the page behind the dialog. */}
            <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain border-glass-border p-6 lg:border-l">
              {rest.length > 0 && (
                <section className="space-y-5">
                  {rest.map((field) => (
                    <div key={field.key}>
                      <label className="mb-2 block text-sm font-medium">{field.labelAr}</label>
                      {renderField(field)}
                      {field.hintAr && (
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{field.hintAr}</p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {toggles.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted/60">
                    خيارات
                  </p>
                  <div className="divide-y divide-glass-border overflow-hidden rounded-2xl border border-glass-border bg-glass">
                    {toggles.map((field) => (
                      <div key={field.key} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{field.labelAr}</p>
                          {field.hintAr && (
                            <p className="mt-0.5 text-xs text-ink-muted">{field.hintAr}</p>
                          )}
                        </div>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain bg-canvas p-5">
              <div className="mb-3 flex items-center gap-2">
                <Eye size={15} weight="duotone" className="text-accent" />
                <p className="text-sm font-semibold">معاينة حية</p>
              </div>
              <WidgetPreview
                key={previewUrl ?? "none"}
                url={previewUrl}
                width={widget.recommendedSize.width}
                height={widget.recommendedSize.height}
                maxHeight={420}
              />
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                دي صفحة الأوفرلاي نفسها بتشتغل ببيانات تجريبية — التغييرات بتبان هنا على طول من
                غير ما تحفظ. على الاستريم بتشتغل بهدايا وكومنتات مشاهدينك الحقيقيين.
              </p>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-glass-border bg-canvas-soft px-6 py-4">
            <Button variant="ghost" size="md" onClick={onReset}>
              <ArrowCounterClockwise size={15} weight="bold" />
              رجّع الافتراضي
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" magnetic={false} onClick={onClose}>
                إلغاء
              </Button>
              <Button size="md" onClick={onSave} disabled={saving}>
                {saving ? "بيتحفظ..." : "احفظ"}
              </Button>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
