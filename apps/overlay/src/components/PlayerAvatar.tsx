import { useState } from "react";

interface PlayerAvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  ring?: boolean;
}

const GRADIENTS = [
  "from-primary to-accent",
  "from-accent to-secondary",
  "from-secondary to-primary",
  "from-purple-400 to-primary",
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]!;
}

export function PlayerAvatar({ displayName, avatarUrl, size = 48, ring = true }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = avatarUrl && !failed;

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-full ${
        ring ? "ring-2 ring-white/20" : ""
      } shadow-glass`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={displayName}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br font-bold text-white ${gradientFor(
            displayName,
          )}`}
          style={{ fontSize: size * 0.4 }}
        >
          {displayName.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
    </div>
  );
}
