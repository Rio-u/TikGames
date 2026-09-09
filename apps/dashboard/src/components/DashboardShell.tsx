import {
  Broadcast,
  ChartLineUp,
  CreditCard,
  GameController,
  Gauge,
  Gear,
  List,
  Monitor,
  SquaresFour,
  Trophy,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  /** Also treat these path prefixes as "this item is active" — a game control page under
   *  /live/trivia should still light up TikGames in the sidebar, not leave nothing selected. */
  alsoMatches?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "المنصة",
    items: [
      { to: "/dashboard", label: "نظرة عامة", icon: Gauge },
      { to: "/live/connect", label: "اللايف", icon: Broadcast, alsoMatches: ["/live/simulate"] },
    ],
  },
  {
    title: "المنتجات",
    items: [
      {
        to: "/dashboard/tikgames",
        label: "TikGames",
        icon: GameController,
        // Every game control page lives under /live/<game>; they belong to TikGames, not to the
        // live section, so they're matched here explicitly rather than by prefix.
        alsoMatches: [
          "/live/musical-chairs",
          "/live/trivia",
          "/live/guess-number",
          "/live/spin-wheel",
          "/live/would-you-rather",
          "/live/flags",
          "/live/capitals",
          "/live/logos",
          "/live/speed-word",
          "/live/maze",
          "/live/drawing",
          "/live/word-round",
        ],
      },
      { to: "/tools", label: "كل الأدوات", icon: SquaresFour },
      { to: "/overlays", label: "الأوفرلايز", icon: Monitor },
      { to: "/leaderboard", label: "ترتيب المشاهدين", icon: Trophy },
      { to: "/analytics", label: "التحليلات", icon: ChartLineUp },
    ],
  },
  {
    title: "الحساب",
    items: [
      { to: "/subscription", label: "الاشتراك", icon: CreditCard },
      { to: "/account", label: "الإعدادات", icon: Gear },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.to) return true;
  return (item.alsoMatches ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav className="space-y-7">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted/60">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
                      active
                        ? "bg-primary/15 font-semibold text-ink"
                        : "text-ink-muted hover:bg-glass hover:text-ink"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-y-1 right-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-accent"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <item.icon
                      size={18}
                      weight={active ? "fill" : "regular"}
                      className={active ? "text-accent" : "text-ink-muted group-hover:text-ink"}
                    />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * The platform chrome every signed-in page sits inside: persistent sidebar on desktop, a
 * slide-over on mobile, and the existing DashboardHeader on top. Pages supply only their own
 * content — nothing here knows about games specifically, which is the point: a second product
 * becomes one more NAV_GROUPS entry.
 */
export function DashboardShell({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // Route changes must close the slide-over — otherwise tapping a link on mobile navigates
  // underneath a menu that stays open on top of the page you just asked for.
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      <DashboardHeader />

      <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-4 py-6 sm:px-6">
        <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] w-60 shrink-0 overflow-y-auto lg:block">
          <SidebarNav />
        </aside>

        <main className="min-w-0 flex-1 pb-16">
          {(title || actions) && (
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-label="فتح القائمة"
                  className="mt-0.5 rounded-xl border border-glass-border bg-glass p-2 text-ink-muted transition-colors hover:text-ink lg:hidden"
                >
                  <List size={18} weight="bold" />
                </button>
                <div>
                  {title && <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>}
                  {description && (
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-50 w-72 overflow-y-auto border-l border-glass-border bg-canvas-soft p-5 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-semibold">القائمة</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="rounded-lg p-1.5 text-ink-muted transition-colors hover:text-ink"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
