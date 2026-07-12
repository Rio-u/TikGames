interface ChairIconProps {
  size?: number;
  className?: string;
}

/**
 * Hand-drawn chair silhouette rather than a hotlinked image — this overlay runs inside OBS as a
 * live Browser Source, so it can't depend on a third-party image URL staying up mid-broadcast.
 */
export function ChairIcon({ size = 40, className = "" }: ChairIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 20V10a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <rect x="10" y="19" width="28" height="11" rx="3" fill="currentColor" opacity="0.9" />
      <path
        d="M11 30v9a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M37 30v9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M9 24h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
