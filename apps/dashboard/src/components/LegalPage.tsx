import type { ReactNode } from "react";
import { Container } from "./Container";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { Reveal } from "./Reveal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative overflow-x-clip">
      <Navbar />
      <Container className="py-20">
        <Reveal className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-muted [&_strong]:text-ink">
            {children}
          </div>
        </Reveal>
      </Container>
      <Footer />
    </div>
  );
}
