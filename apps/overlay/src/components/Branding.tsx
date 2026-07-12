export function Branding() {
  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-1.5 rounded-full border border-glass-border bg-canvas-soft/70 px-3 py-1.5 text-xs text-ink-muted backdrop-blur-md">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-primary to-accent" />
      <span>
        <span className="text-ink">Tik</span>
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Games</span>
      </span>
    </div>
  );
}
