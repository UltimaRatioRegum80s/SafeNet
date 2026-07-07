import { useCallback, useEffect, useMemo, useState } from "react";
import { inSouthernAfrica, fmtCoord, pixelGridSnap } from "@/lib/geo";
import { emitLocationPicked } from "@/lib/events";
import { track } from "@/lib/analytics";

type Refs = {
  mapRef: React.MutableRefObject<any | null>;
  containerRef: React.MutableRefObject<HTMLElement | null>;
};

export function useMapPicking({ mapRef, containerRef }: Refs) {
  const [isPicking, setIsPicking] = useState(false);
  const [ghost, setGhost] = useState<{ lng: number; lat: number } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // External control (optional) if you ever want to start from this side
  const begin = useCallback(() => {
    setIsPicking(true);
    setGhost(null);
    track("pick_start");
  }, []);
  const cancel = useCallback(() => {
    setIsPicking(false);
    setGhost(null);
    track("pick_cancel");
  }, []);
  const confirm = useCallback(() => {
    if (!ghost) return;
    emitLocationPicked(ghost.lat, ghost.lng);
    setIsPicking(false);
    setGhost(null);
    track("pick_confirm", { lat: ghost.lat, lng: ghost.lng });
  }, [ghost]);

  // Listen for external begin-pick events
  useEffect(() => {
    const onBegin = () => {
      setIsPicking(true);
      setGhost(null);
      track("pick_start");
    };
    window.addEventListener("nn:begin-location-pick", onBegin as EventListener);
    return () => window.removeEventListener("nn:begin-location-pick", onBegin as EventListener);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isPicking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      else if (e.key === "Enter" && ghost) confirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPicking, cancel, confirm, ghost]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!isPicking || !map || !container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const latLng = map.containerPointToLatLng({ x, y });
    let next = { lng: latLng.lng, lat: latLng.lat };

    if (!inSouthernAfrica(next)) {
      // optional: toast here
      console.warn("Out of bounds:", next);
      return;
    }

    if (snapEnabled) {
      next = pixelGridSnap(map, next.lng, next.lat, 12);
    }
    setGhost(next);
  }, [containerRef, mapRef, isPicking, snapEnabled]);

  // Ghost screen projection
  const ghostScreen = useMemo(() => {
    const map = mapRef.current;
    if (!ghost || !map?.latLngToContainerPoint) return null;
    const p = map.latLngToContainerPoint({ lat: ghost.lat, lng: ghost.lng });
    return { x: p.x, y: p.y };
  }, [ghost, mapRef]);

  /** Overlay: captures clicks, blocks map interactions while picking */
  const Overlay = useCallback(() => {
    if (!isPicking) return null;
    return (
      <div
        className="absolute inset-0 cursor-crosshair z-[60]"
        onClick={handleOverlayClick}
        onWheel={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      />
    );
  }, [isPicking, handleOverlayClick]);

  /** GhostMarker: shows the pin */
  const GhostMarker = useCallback(() => {
    if (!isPicking || !ghostScreen) return null;
    return (
      <div
        className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-[61]"
        style={{ left: ghostScreen.x, top: ghostScreen.y }}
      >
        <div className="h-6 w-6 rounded-full bg-sky-400 ring-4 ring-white/30 shadow" />
      </div>
    );
  }, [isPicking, ghostScreen]);

  /** Footer: confirm/cancel + snap toggle */
  const Footer = useCallback(() => {
    if (!isPicking) return null;
    return (
      <div className="absolute inset-x-0 bottom-3 px-3 pointer-events-none z-[62]">
        <div
          className="backdrop-blur bg-slate-900/60 border border-slate-700 text-white shadow-lg rounded-2xl px-3 py-2 flex items-center gap-3 justify-between pointer-events-auto"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) / 2 + 0.25rem)" }}
        >
          <div className="text-xs sm:text-sm opacity-90">
            {ghost ? (
              <>Chosen: <span className="font-mono">{fmtCoord(ghost.lat)}, {fmtCoord(ghost.lng)}</span></>
            ) : <>Tap on the map to drop a pin</>}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
              />
              Snap to grid
            </label>

            <button
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition"
              onClick={cancel}
            >
              Cancel (Esc)
            </button>
            <button
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition"
              onClick={confirm}
              disabled={!ghost}
            >
              Confirm (Enter)
            </button>
          </div>
        </div>
      </div>
    );
  }, [isPicking, ghost, snapEnabled, cancel, confirm]);

  return { isPicking, setIsPicking, ghost, Overlay, GhostMarker, Footer, begin, cancel, confirm };
}