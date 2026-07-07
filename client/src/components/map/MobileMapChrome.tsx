import React, { useState } from "react";
import { Home, FilePlus2, Newspaper, Minus, Plus, Sun, Moon, Navigation } from "lucide-react";

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  mode: "light" | "dark";
  onToggleMode: () => void;
  onNav?: (dest: "home" | "report" | "feed") => void;
  onMyLocation?: () => void;
  canReport?: boolean;
};

export default function MobileMapChrome({
  onZoomIn,
  onZoomOut,
  mode,
  onToggleMode,
  onNav,
  onMyLocation,
  canReport = false,
}: Props) {
  const [isLocating, setIsLocating] = useState(false);

  const handleLocationClick = async () => {
    if (!onMyLocation || isLocating) return;
    
    setIsLocating(true);
    try {
      await onMyLocation();
    } finally {
      setIsLocating(false);
    }
  };
  // wrapper uses pointer-events-none so the map remains draggable except on buttons
  return (
    <div className="md:hidden pointer-events-none">
      {/* Top Nav - positioned for safe area and thumb reach */}
      <div
        className={
          [
            "fixed left-4 right-4 z-[60] pointer-events-auto",
            "rounded-2xl shadow-lg border",
            "backdrop-blur-md bg-gray-800/95 dark:bg-background/95",
            "flex items-center justify-between px-3 py-2",
            "mt-[max(env(safe-area-inset-top),1rem)]",
            "border-gray-700 dark:border-border",
          ].join(" ")
        }
      >
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700/80 dark:hover:bg-muted/80 active:scale-95 transition-all duration-200 min-h-[44px] bg-gray-700/60 dark:bg-primary/10 hover:bg-gray-600/80 dark:hover:bg-primary/20 text-white dark:text-foreground"
          onClick={() => onNav?.("home")}
        >
          <Home size={18} /> Home
        </button>
        <button
          title={canReport ? "Report an incident" : "Enable GPS to report"}
          disabled={!canReport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-all duration-200 min-h-[44px] bg-gray-700/60 dark:bg-primary/10 text-white dark:text-foreground disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-gray-600/80 dark:enabled:hover:bg-primary/20"
          onClick={() => canReport && onNav?.("report")}
        >
          <FilePlus2 size={18} /> Report
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700/80 dark:hover:bg-muted/80 active:scale-95 transition-all duration-200 min-h-[44px] bg-gray-700/60 dark:bg-primary/10 hover:bg-gray-600/80 dark:hover:bg-primary/20 text-white dark:text-foreground"
          onClick={() => onNav?.("feed")}
        >
          <Newspaper size={18} /> Feed
        </button>
      </div>

      {/* Right stack: zoom + theme - positioned for optimal thumb reach */}
      <div className="fixed right-4 bottom-[20vh] z-[60] flex flex-col gap-3 pointer-events-auto">
        <button
          aria-label="Zoom in"
          className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground"
          onClick={onZoomIn}
        >
          <Plus size={22} />
        </button>
        <button
          aria-label="Zoom out"
          className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground"
          onClick={onZoomOut}
        >
          <Minus size={22} />
        </button>
        <div className="h-2" /> {/* Spacer for better visual separation */}
        <button
          aria-label="My location"
          className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground disabled:opacity-50"
          onClick={handleLocationClick}
          disabled={isLocating}
        >
          <Navigation 
            size={22} 
            className={isLocating ? "animate-spin" : ""} 
          />
        </button>
        <button
          aria-label="Toggle theme"
          className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground"
          onClick={onToggleMode}
        >
          {mode === "light" ? <Moon size={22} /> : <Sun size={22} />}
        </button>
      </div>
    </div>
  );
}