import { Link } from "react-router-dom";
import { Container } from "./Container";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-glass-border py-10">
      <Container className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-right">
        <Logo size="sm" />

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <a href="#features" className="transition-colors hover:text-ink">
            المزايا
          </a>
          <a href="#games" className="transition-colors hover:text-ink">
            الألعاب
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            الأسئلة الشائعة
          </a>
          <Link to="/privacy" className="transition-colors hover:text-ink">
            سياسة الخصوصية
          </Link>
          <Link to="/terms" className="transition-colors hover:text-ink">
            الشروط والأحكام
          </Link>
        </nav>

        <p className="text-xs text-ink-muted/70">© {new Date().getFullYear()} TikGames</p>
      </Container>
    </footer>
  );
}
