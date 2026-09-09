import type { ProductAccess } from "@tikgames/shared-types";
import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { productIcon } from "../data/productIcons";

const STATUS_BADGE: Record<ProductAccess["status"], { label: string; className: string }> = {
  AVAILABLE: { label: "متاح", className: "bg-emerald-500/15 text-emerald-300" },
  BETA: { label: "تجريبي", className: "bg-amber-500/15 text-amber-300" },
  COMING_SOON: { label: "قريباً", className: "bg-glass text-ink-muted" },
};

/**
 * One product in the ecosystem grid. Renders as a link only when the server said `unlocked` and
 * the product actually has a route — a COMING_SOON card must never look clickable, since the
 * whole point of the status is to not pretend an unfinished product works.
 */
export function ProductCard({ product }: { product: ProductAccess }) {
  const IconComponent = productIcon(product.icon);
  const badge = STATUS_BADGE[product.status];
  const openable = product.unlocked && !!product.dashboardRoute;

  const card = (
    <motion.div
      whileHover={openable ? { y: -5 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border border-glass-border bg-glass p-6 backdrop-blur-xl transition-shadow duration-300 ${
        openable ? "hover:shadow-glow-sm" : "opacity-75"
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${product.gradient} opacity-40 blur-2xl`}
      />

      <div className="relative mb-4 flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/10 text-accent shadow-glow-sm">
          <IconComponent size={22} weight="duotone" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <h3 className="relative text-lg font-bold">{product.nameAr}</h3>
      <p className="relative mt-1 text-sm font-medium text-accent/90">{product.taglineAr}</p>
      <p className="relative mt-3 text-sm leading-relaxed text-ink-muted">{product.descriptionAr}</p>

      <div className="relative mt-auto pt-5">
        {openable ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            افتحه
            <ArrowRight size={14} weight="bold" className="rtl:rotate-180" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <LockSimple size={13} weight="fill" />
            {product.lockedReasonAr ?? "غير متاح دلوقتي"}
          </span>
        )}
      </div>
    </motion.div>
  );

  if (openable && product.dashboardRoute) {
    return (
      <Link to={product.dashboardRoute} className="block h-full">
        {card}
      </Link>
    );
  }
  return card;
}
