import { cn } from "@/lib/utils";
import { Target, List } from "lucide-react";

type Props = {
  onLocate: () => void;
  onToggleList: () => void;
  hidden?: boolean;      // pass isIncidentSheetOpen || false
  className?: string;
};

export default function BottomCenterDock({
  onLocate,
  onToggleList,
  hidden = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-1/2 -translate-x-1/2 z-[54]",
        // keep clear of attribution & home bar
        "bottom-[calc(env(safe-area-inset-bottom)+72px)] md:bottom-[calc(env(safe-area-inset-bottom)+80px)]",
        "transition-opacity duration-150",
        hidden ? "opacity-0 pointer-events-none" : "opacity-100",
        className
      )}
      role="group"
      aria-label="Map utilities"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLocate}
          aria-label="Recenter on my location"
          className="nn-fab h-12 w-12 focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="dock-recenter"
        >
          <Target className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleList}
          aria-label="Open incidents list"
          className="nn-fab h-12 w-12 focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="dock-incidents"
        >
          <List className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}