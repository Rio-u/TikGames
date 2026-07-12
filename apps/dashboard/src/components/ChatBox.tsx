import { ChatCircleDots } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

export interface ChatItem {
  id: string;
  displayName: string;
  text: string;
}

/** `items` is newest-first — rendered directly in that order so the latest comment always sits
 *  at the top, right where the container starts (no auto-scroll-to-bottom needed). */
export function ChatBox({ items }: { items: ChatItem[] }) {
  const recent = items.slice(0, 40);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-glass-border bg-canvas-elevated/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <ChatCircleDots size={16} className="text-accent" />
        شات اللايف
      </div>
      <AnimatePresence initial={false}>
        {recent.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-sm"
          >
            <bdi className="font-medium text-accent">{m.displayName}</bdi>
            <span className="text-ink-muted">: {m.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {recent.length === 0 && <p className="text-sm text-ink-muted">شات اللايف هيظهر هنا...</p>}
    </div>
  );
}
