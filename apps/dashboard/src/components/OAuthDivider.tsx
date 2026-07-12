export function OAuthDivider({ label = "أو بالإيميل" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
      <div className="h-px flex-1 bg-glass-border" />
      {label}
      <div className="h-px flex-1 bg-glass-border" />
    </div>
  );
}
