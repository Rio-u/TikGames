import type { Icon } from "@phosphor-icons/react";

/** Skeleton block for any loading panel — never leave a card blank while a fetch is in flight. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
}

/**
 * One number plus its label. `loading` renders the skeleton in place of the value so the tile
 * keeps its size and the grid doesn't reflow when the data lands.
 */
export function StatTile({
  icon: IconComponent,
  label,
  value,
  hint,
  loading = false,
}: {
  icon: Icon;
  label: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-ink-muted">
        <IconComponent size={16} weight="duotone" className="text-accent" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading ? (
        <SkeletonBlock className="h-8 w-20" />
      ) : (
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
