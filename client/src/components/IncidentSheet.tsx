import React, { useMemo, useState, useRef } from "react";
import { Drawer } from "vaul";
import IncidentList, { IncidentMarker } from "@/components/IncidentList";
import { useIncidentStore } from "@/state/useIncidentStore";
import { snapTo, clamp } from "@/components/dragSheet";
import { cn } from "@/lib/utils";

export default function IncidentSheet({
  open,
  onOpenChange,
  items,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: IncidentMarker[];
  onSelect: (id: string) => void;
}) {
  const [height, setHeight] = useState<"peek" | "half" | "full">("peek");

  // store-backed filters
  const severity = useIncidentStore((s) => s.severity);
  const setSeverity = useIncidentStore((s) => s.setSeverity);
  const inViewOnly = useIncidentStore((s) => s.inViewOnly);
  const toggleInViewOnly = useIncidentStore((s) => s.toggleInViewOnly);
  const timeRange = useIncidentStore((s) => s.timeRange);
  const setTimeRange = useIncidentStore((s) => s.setTimeRange);

  // derive pixel snap points (responsive)
  const { peekPx, halfPx, fullPx } = useMemo(() => {
    const vh = (typeof window !== "undefined" ? window.innerHeight : 900);
    return { peekPx: 96, halfPx: Math.round(vh * 0.52), fullPx: Math.round(vh * 0.80) };
  }, []);

  // live height while dragging (pixels). When null, use state-based height.
  const [dragPx, setDragPx] = useState<number | null>(null);

  // pointer tracking
  const startY = useRef(0);
  const startH = useRef(0);
  const snaps = useMemo(() => [peekPx, halfPx, fullPx], [peekPx, halfPx, fullPx]);

  const onHandlePointerDown: React.PointerEventHandler = (e) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    // current height in px:
    startH.current = height === "peek" ? peekPx : height === "half" ? halfPx : fullPx;
    setDragPx(startH.current);
  };
  const onHandlePointerMove: React.PointerEventHandler = (e) => {
    if (dragPx == null) return;
    const dy = startY.current - e.clientY; // dragging up increases height
    const next = clamp(startH.current + dy, peekPx, fullPx);
    setDragPx(next);
  };
  const onHandlePointerUp: React.PointerEventHandler = (e) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (dragPx == null) return;
    const snapped = snapTo(dragPx, snaps);
    setDragPx(null);
    setHeight(snapped === fullPx ? "full" : snapped === halfPx ? "half" : "peek");
  };

  // computed height style
  const hPx = dragPx ?? (height === "peek" ? peekPx : height === "half" ? halfPx : fullPx);
  
  // determine if sheet is expanded (≥50% for overlay behavior)
  const isExpanded = useMemo(() => {
    const currentHeight = hPx;
    const maxHeight = fullPx;
    return (currentHeight / maxHeight) >= 0.5;
  }, [hPx, fullPx]);

  // client-side filter is already applied upstream; we only render UI here
  const shown = useMemo(() => items, [items]);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} modal={false} shouldScaleBackground={false}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Portal>
        <Drawer.Overlay className={cn(
          "fixed inset-0 z-[54] transition-opacity",
          // Make overlay conditional based on expansion
          isExpanded 
            ? "bg-black/10 dark:bg-black/40" 
            : "pointer-events-none bg-transparent"
        )} />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[55] pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="mx-auto max-w-md" style={{ height: hPx, transition: dragPx ? "none" : "height 180ms" }}>
            <div className={cn(
              "mx-3 h-full flex flex-col relative rounded-t-3xl border will-change-transform",
              // DARK MODE — leave exactly as before
              "dark:bg-background/60 dark:backdrop-blur-md dark:border-white/10",
              // LIGHT MODE — solid, readable surface (no blur needed)
              "bg-white/98 border-border/60 shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
            )}>
              
              {/* Handle with drag */}
              <button
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                className="flex justify-center pt-2 w-full touch-none" 
                aria-label="Resize incidents panel"
              >
                <div className="h-1.5 w-12 rounded-full bg-foreground/30 dark:bg-white/30" />
              </button>

              {/* Header row with In-view toggle */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-base font-semibold text-foreground dark:text-white">Recent Incidents</div>
                {/* mobile-only visibility; desktop has filters elsewhere */}
                <label className="text-xs text-foreground/80 dark:text-white/70 flex items-center gap-2 md:hidden">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={inViewOnly}
                    onChange={toggleInViewOnly}
                  />
                  In view
                </label>
              </div>

              {/* Severity chips (mobile-first) */}
              <div className="px-3 pb-2 flex gap-2 overflow-x-auto md:hidden">
                {(["all", "low", "medium", "high", "emergency"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                      severity === s
                        ? "bg-foreground text-white dark:bg-white dark:text-black border-foreground dark:border-white shadow-sm"
                        : "bg-black/5 dark:bg-white/10 text-foreground/85 dark:text-white/85 border-border/50 dark:border-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Time range segmented control (mobile-first) */}
              <div className="px-3 pb-2 md:hidden">
                <div className="inline-flex rounded-xl overflow-hidden border border-border/40 bg-muted/20">
                  {(["all", "1hour", "6hours", "12hours"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeRange(t)}
                      className={`px-3 py-1.5 text-xs font-medium border-r border-border/20 last:border-r-0 ${
                        timeRange === t ? "bg-foreground text-white dark:bg-white dark:text-black shadow-sm" : "text-foreground/85 dark:text-white/85"
                      }`}
                    >
                      {t === "all" ? "All" : t === "1hour" ? "1h" : t === "6hours" ? "6h" : "12h"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shared list */}
              <div className="min-h-0 flex-1 content-visibility-auto contain-intrinsic-size-[600px]">
                <IncidentList items={shown} onSelect={onSelect} />
              </div>

              {/* Subtle top shadow to signal scroll */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-3xl
                              shadow-[0_8px_12px_-8px_rgba(0,0,0,0.35)] dark:shadow-[0_8px_12px_-8px_rgba(0,0,0,0.8)]" />
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}