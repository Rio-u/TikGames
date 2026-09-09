import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/**
 * The house style for "there is nothing here yet". Used instead of rendering an empty grid —
 * a blank panel reads as a broken page, and inventing placeholder rows to fill it would be
 * worse (see the no-fake-data rule).
 */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className = "",
}: {
  icon: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-glass-border bg-glass/40 px-6 py-14 text-center ${className}`}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 text-accent">
        <IconComponent size={26} weight="duotone" />
      </div>
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
