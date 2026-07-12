import { CircleNotch } from "@phosphor-icons/react";

export function Spinner({ className = "" }: { className?: string }) {
  return <CircleNotch className={`animate-spin ${className}`} weight="bold" aria-hidden="true" />;
}
