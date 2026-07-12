import { motion, useMotionValue, useSpring } from "framer-motion";
import { type MouseEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const MotionLink = motion(Link);

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className = ""): string {
  const base =
    "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color] duration-300 ease-out select-none disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-primary to-secondary text-white shadow-glow-sm hover:shadow-glow hover:scale-[1.03] active:scale-[0.97]",
    secondary:
      "bg-glass backdrop-blur-xl border border-glass-border text-ink hover:bg-glass-strong hover:border-white/20 active:scale-[0.97]",
    ghost: "text-ink-muted hover:text-ink active:scale-[0.97]",
  };
  const sizes: Record<ButtonSize, string> = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-[15px]",
  };
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

function useRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function addRipple(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev, { id, x, y, size }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }

  const rippleLayer = (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full bg-white/25 animate-[ripple_600ms_ease-out]"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </span>
  );

  return { addRipple, rippleLayer };
}

function useMagnetic(strength: number) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });

  function onMouseMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left - rect.width / 2) / rect.width) * strength);
    y.set(((e.clientY - rect.top - rect.height / 2) / rect.height) * strength);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return { x: springX, y: springY, onMouseMove, onMouseLeave };
}

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function Button({
  variant = "primary",
  size = "md",
  magnetic = variant === "primary",
  className,
  children,
  type = "button",
  disabled,
  onClick,
}: ButtonProps) {
  const mag = useMagnetic(8);
  const { addRipple, rippleLayer } = useRipple();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    addRipple(e);
    onClick?.(e);
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      style={magnetic ? { x: mag.x, y: mag.y } : undefined}
      onMouseMove={magnetic ? mag.onMouseMove : undefined}
      onMouseLeave={magnetic ? mag.onMouseLeave : undefined}
      className={buttonClasses(variant, size, className)}
    >
      {children}
      {rippleLayer}
    </motion.button>
  );
}

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  magnetic = variant === "primary",
  className,
  children,
  onClick,
}: ButtonLinkProps) {
  const mag = useMagnetic(8);
  const { addRipple, rippleLayer } = useRipple();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    addRipple(e);
    onClick?.(e);
  }

  return (
    <MotionLink
      to={to}
      onClick={handleClick}
      style={magnetic ? { x: mag.x, y: mag.y } : undefined}
      onMouseMove={magnetic ? mag.onMouseMove : undefined}
      onMouseLeave={magnetic ? mag.onMouseLeave : undefined}
      className={buttonClasses(variant, size, className)}
    >
      {children}
      {rippleLayer}
    </MotionLink>
  );
}

interface ButtonAnchorProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
}

/** For same-page hash anchors (e.g. href="#games") — a router `Link` won't trigger native scroll-to-id. */
export function ButtonAnchor({
  href,
  variant = "primary",
  size = "md",
  magnetic = variant === "primary",
  className,
  children,
}: ButtonAnchorProps) {
  const mag = useMagnetic(8);
  const { addRipple, rippleLayer } = useRipple();

  return (
    <motion.a
      href={href}
      onClick={addRipple}
      style={magnetic ? { x: mag.x, y: mag.y } : undefined}
      onMouseMove={magnetic ? mag.onMouseMove : undefined}
      onMouseLeave={magnetic ? mag.onMouseLeave : undefined}
      className={buttonClasses(variant, size, className)}
    >
      {children}
      {rippleLayer}
    </motion.a>
  );
}
