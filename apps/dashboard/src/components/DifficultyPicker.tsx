import type { GeoDifficulty } from "@tikgames/shared-types";

/**
 * Difficulty for the geography games (Flags, Capitals).
 *
 * Three buttons rather than a `<select>`: the streamer sets this once while the chat is already
 * waiting, and each level needs a line of explanation to be a real choice — which country list
 * you get is not something anyone can infer from the word "medium".
 */

const LEVELS: { id: GeoDifficulty; label: string; detail: string }[] = [
  {
    id: "easy",
    label: "سهل",
    detail: "الدول العربية كلها + أشهر دول أوروبا",
  },
  {
    id: "medium",
    label: "متوسط",
    detail: "أوروبا كلها + الشرق الأوسط + آسيا + أمريكا الشمالية + 5 دول أفريقية",
  },
  {
    id: "hard",
    label: "صعب",
    detail: "العالم كله — 195 دولة بما فيها أفريقيا وأمريكا الجنوبية وأوقيانوسيا",
  },
];

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: GeoDifficulty;
  onChange: (next: GeoDifficulty) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">مستوى الصعوبة</p>
      <div role="radiogroup" aria-label="مستوى الصعوبة" className="flex flex-col gap-2">
        {LEVELS.map((level) => {
          const active = level.id === value;
          return (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(level.id)}
              className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-start transition-colors duration-200 ${
                active
                  ? "border-accent bg-accent/10"
                  : "border-glass-border bg-glass hover:border-primary/60"
              }`}
            >
              <span className={`text-sm font-bold ${active ? "text-accent" : "text-ink"}`}>
                {level.label}
              </span>
              <span className="mt-0.5 text-xs leading-relaxed text-ink-muted">{level.detail}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        اختار على قد مستوى الناس في الشات — المتوسط هو الافتراضي وهو اللي بيمشي مع أغلب اللايفات.
      </p>
    </div>
  );
}
