export function GlowBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-canvas" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgb(124 58 237 / 25%), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, rgb(168 85 247 / 12%), transparent 60%)",
        }}
      />
      <div className="absolute -left-40 -top-40 h-[420px] w-[420px] animate-float-slow rounded-full bg-primary/30 blur-[120px]" />
      <div className="absolute -right-32 top-1/3 h-[360px] w-[360px] animate-float rounded-full bg-secondary/20 blur-[110px]" />
      <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] animate-glow-pulse rounded-full bg-accent/15 blur-[100px]" />
      <div className="noise-overlay" />
    </div>
  );
}

export function HeroGlowArc() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-[1100px] -translate-x-1/2 -translate-y-1/3"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-[110px]"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 50%, #7C3AED 0%, #C084FC 35%, transparent 60%, #A855F7 85%, #7C3AED 100%)",
        }}
      />
      <div className="absolute inset-x-[8%] top-[38%] h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
    </div>
  );
}
