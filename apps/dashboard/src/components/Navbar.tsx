import { List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, ButtonLink } from "./Button";
import { Container } from "./Container";
import { Logo } from "./Logo";

/** `hash` entries point at sections that live on the homepage; `route` entries are real pages.
 *  Once the marketing site is more than one page, a bare "#faq" is wrong everywhere except "/",
 *  so hash entries get rewritten to "/#faq" when the navbar renders on any other route. */
const NAV_LINKS: { label: string; hash?: string; route?: string }[] = [
  { label: "الأدوات", hash: "#ecosystem" },
  { label: "TikGames", route: "/tikgames" },
  { label: "المزايا", hash: "#features" },
  { label: "الأسئلة الشائعة", hash: "#faq" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  function hashHref(hash: string): string {
    return onHome ? hash : `/${hash}`;
  }

  return (
    <header className="sticky top-4 z-50 px-4">
      <Container className="!px-0">
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between rounded-full border border-glass-border bg-canvas-soft/70 px-4 py-2.5 shadow-glass backdrop-blur-2xl sm:px-6"
        >
          <Link to="/">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) =>
              link.route ? (
                <Link
                  key={link.label}
                  to={link.route}
                  className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={hashHref(link.hash!)}
                  className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <ButtonLink to="/dashboard" size="md">
                  لوحة التحكم
                </ButtonLink>
                <Button variant="ghost" size="md" onClick={logout}>
                  خروج
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  تسجيل الدخول
                </Link>
                <ButtonLink to="/register" size="md">
                  ابدأ مجاناً
                </ButtonLink>
              </>
            )}
          </div>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-glass-border text-ink md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <List size={18} />}
          </button>
        </motion.div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-3 max-w-[1240px] rounded-3xl border border-glass-border bg-canvas-soft/90 p-4 shadow-glass backdrop-blur-2xl md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) =>
                link.route ? (
                  <Link
                    key={link.label}
                    to={link.route}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-sm text-ink-muted transition-colors hover:bg-glass hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={hashHref(link.hash!)}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-sm text-ink-muted transition-colors hover:bg-glass hover:text-ink"
                  >
                    {link.label}
                  </a>
                ),
              )}
              <div className="mt-2 flex flex-col gap-2 border-t border-glass-border pt-3">
                {user ? (
                  <ButtonLink to="/dashboard" className="w-full" onClick={() => setOpen(false)}>
                    لوحة التحكم
                  </ButtonLink>
                ) : (
                  <>
                    <ButtonLink to="/register" className="w-full" onClick={() => setOpen(false)}>
                      ابدأ مجاناً
                    </ButtonLink>
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className="rounded-full px-4 py-2.5 text-center text-sm text-ink-muted hover:text-ink"
                    >
                      تسجيل الدخول
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
