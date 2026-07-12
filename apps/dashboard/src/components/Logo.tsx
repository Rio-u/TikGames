const SIZES = {
  sm: { img: "h-6 w-6", text: "text-base" },
  md: { img: "h-8 w-8", text: "text-lg" },
  lg: { img: "h-12 w-12", text: "text-2xl" },
} as const;

export function Logo({
  size = "md",
  withText = true,
  className = "",
}: {
  size?: keyof typeof SIZES;
  withText?: boolean;
  className?: string;
}) {
  const { img, text } = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="TikGames"
        className={`${img} shrink-0 object-contain drop-shadow-[0_0_14px_rgba(192,132,252,0.45)]`}
      />
      {withText && (
        <span className={`font-bold ${text}`}>
          <span className="text-ink">Tik</span>
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Games
          </span>
        </span>
      )}
    </span>
  );
}
