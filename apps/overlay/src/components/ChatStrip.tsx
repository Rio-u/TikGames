import { ChatCircleDots } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";

export interface ChatItem {
  id: string;
  displayName: string;
  text: string;
}

/** `items` is newest-first — rendered directly in that order (RTL puts the first DOM child on
 *  the right, so the latest comment naturally lands at the reading-start side of the strip). */
export function ChatStrip({ items }: { items: ChatItem[] }) {
  const recent = items.slice(0, 6);
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-glass-border bg-canvas-soft/60 px-4 shadow-glass backdrop-blur-xl">
      <ChatCircleDots size={18} className="shrink-0 text-accent" />
      <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {recent.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs"
            >
              <bdi className="font-semibold text-accent">{m.displayName}</bdi>
              <span className="max-w-[160px] truncate text-ink-muted">{m.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {recent.length === 0 && <span className="text-xs text-ink-muted">شات اللايف هيظهر هنا...</span>}
      </div>
    </div>
  );
}
