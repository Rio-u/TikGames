import { useEffect, useRef, useState } from "react";

/**
 * Inline live preview of a widget: the real overlay page in an iframe, scaled down to fit
 * whatever box it's given.
 *
 * Two things make this safe to put on a grid of a dozen cards:
 *  - It mounts only once scrolled into view, and unmounts when scrolled well away. Each preview
 *    opens a real socket to the overlay namespace, so twelve eagerly-mounted iframes would mean
 *    twelve live connections and twelve animating pages competing for the same main thread.
 *  - It renders the iframe at the widget's true pixel size and CSS-scales it, rather than
 *    letting the page reflow into a narrow box. A widget designed for 1920×1080 laid out at
 *    340px wide would look nothing like what OBS shows, which defeats the point of a preview.
 */
export function WidgetPreview({
  url,
  width,
  height,
  /** Fixed box height. Every card in a row gets the same one so the grid stays even — a preview
   *  sized to its widget's own aspect made neighbouring cards wildly different heights. */
  maxHeight = 200,
  className = "",
}: {
  url: string | null;
  width: number;
  height: number;
  maxHeight?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);
  const [visible, setVisible] = useState(false);

  // Keep the scale correct across window resizes and sidebar collapses, not just first paint.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const available = el.clientWidth;
      if (available > 0) setScale(Math.min(1, available / width));
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!!entry?.isIntersecting),
      // A generous margin so a preview is already running by the time it's actually on screen,
      // instead of visibly booting up as the user scrolls onto it.
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scaledHeight = height * scale;
  // Scaled shorter than the box (a wide, short widget like the goal bar): centre it vertically
  // instead of pinning it to the top, which left an obvious dead band under it. Taller than the
  // box (a chat column): pin to the top and let the rest crop — the top is where content lands.
  const offsetY = scaledHeight < maxHeight ? (maxHeight - scaledHeight) / 2 : 0;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-glass-border ${className}`}
      style={{
        height: maxHeight,
        // Checkerboard stands in for transparency, so the streamer can judge contrast the way
        // they'd see it over a real scene.
        background: "repeating-conic-gradient(#191426 0% 25%, #100c1a 0% 50%) 0 0 / 18px 18px",
      }}
    >
      {url && visible ? (
        <iframe
          src={url}
          title="معاينة"
          tabIndex={-1}
          scrolling="no"
          className="pointer-events-none absolute right-0 border-0"
          style={{
            width,
            height,
            top: offsetY,
            transform: `scale(${scale})`,
            // RTL page, so the scale anchor is the right edge — a left origin would push the
            // preview off the card.
            transformOrigin: "top right",
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center">
          <p className="text-xs text-ink-muted">بتحمّل...</p>
        </div>
      )}
    </div>
  );
}
