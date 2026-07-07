import { useState } from "react";
import clsx from "clsx";
import { Smile, AlertTriangle, Flame, Zap } from "lucide-react";

export type Severity = "low" | "medium" | "high" | "critical";

type Layout = "vertical" | "compact" | "auto";

type Props = {
  onSelect: (v: Severity) => void;
  /** "solid" = filled red, "ring" = neutral + thick red ring */
  criticalStyle?: "solid" | "ring";
  /** vertical | compact | auto (vertical on <sm, compact on ≥sm) */
  layout?: Layout;
  className?: string;
  trackEvent?: boolean;
  vibrate?: boolean;
};

export default function SeveritySelectUnified({
  onSelect,
  criticalStyle = "solid",
  layout = "auto",
  className,
  trackEvent = true,
  vibrate = true,
}: Props) {
  const [selected, setSelected] = useState<Severity | null>(null);

  const click = (v: Severity) => {
    if (trackEvent) {
      try { (window as any).track?.("severity_sheet_open", { severity: v }); } catch {}
    }
    if (vibrate && navigator.vibrate) navigator.vibrate(8);
    setSelected(v);
    onSelect(v);
  };

  // Shared button bases (modern polish: soft elevation, hover glow, tap scale)
  const baseNeutralVertical =
    "h-14 w-full rounded-full font-semibold text-base " +
    "bg-slate-200/90 text-slate-900 flex items-center justify-center gap-2 " +
    "shadow-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const baseNeutralCompact =
    "h-12 rounded-full font-semibold text-sm " +
    "bg-slate-200/90 text-slate-900 flex items-center justify-center gap-2 px-4 " +
    "shadow-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const Vertical = (
    <div
      role="radiogroup"
      aria-label="Choose incident severity"
      className={clsx("w-full max-w-sm space-y-4", className)}
    >
      <button
        role="radio"
        aria-checked={selected === "low"}
        onClick={() => click("low")}
        className={clsx(
          baseNeutralVertical,
          "ring-2 ring-yellow-400 hover:shadow-md hover:shadow-yellow-400/25"
        )}
      >
        <Smile className="w-5 h-5 text-yellow-600" aria-hidden />
        Low
      </button>

      <button
        role="radio"
        aria-checked={selected === "medium"}
        onClick={() => click("medium")}
        className={clsx(
          baseNeutralVertical,
          "ring-2 ring-amber-600 hover:shadow-md hover:shadow-amber-600/25"
        )}
      >
        <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
        Medium
      </button>

      <button
        role="radio"
        aria-checked={selected === "high"}
        onClick={() => click("high")}
        className={clsx(
          baseNeutralVertical,
          "ring-2 ring-red-500 hover:shadow-md hover:shadow-red-500/25"
        )}
      >
        <Flame className="w-5 h-5 text-red-600" aria-hidden />
        High
      </button>

      {criticalStyle === "solid" ? (
        <button
          role="radio"
          aria-checked={selected === "critical"}
          onClick={() => click("critical")}
          className={clsx(
            "h-14 w-full rounded-full font-semibold text-base flex items-center justify-center gap-2",
            "bg-red-700 text-white shadow-md hover:shadow-lg hover:shadow-red-600/30",
            "motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          )}
        >
          <Zap className="w-5 h-5" aria-hidden />
          Critical
        </button>
      ) : (
        <button
          role="radio"
          aria-checked={selected === "critical"}
          onClick={() => click("critical")}
          className={clsx(
            baseNeutralVertical,
            "ring-4 ring-red-600 hover:shadow-md hover:shadow-red-600/25"
          )}
        >
          <Zap className="w-5 h-5 text-red-600" aria-hidden />
          Critical
        </button>
      )}
    </div>
  );

  const Compact = (
    <div
      role="radiogroup"
      aria-label="Choose incident severity"
      className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-xl", className)}
    >
      {/* Low */}
      <button
        role="radio"
        aria-label="Low severity"
        aria-checked={selected === "low"}
        onClick={() => click("low")}
        className={clsx(
          "w-full",
          baseNeutralCompact,
          "ring-2 ring-yellow-400 hover:shadow-md hover:shadow-yellow-400/25"
        )}
      >
        <Smile className="w-5 h-5 text-yellow-600" aria-hidden />
        <span>Low</span>
      </button>

      {/* Medium */}
      <button
        role="radio"
        aria-label="Medium severity"
        aria-checked={selected === "medium"}
        onClick={() => click("medium")}
        className={clsx(
          "w-full",
          baseNeutralCompact,
          "ring-2 ring-amber-600 hover:shadow-md hover:shadow-amber-600/25"
        )}
      >
        <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
        <span>Medium</span>
      </button>

      {/* High */}
      <button
        role="radio"
        aria-label="High severity"
        aria-checked={selected === "high"}
        onClick={() => click("high")}
        className={clsx(
          "w-full",
          baseNeutralCompact,
          "ring-2 ring-red-500 hover:shadow-md hover:shadow-red-500/25"
        )}
      >
        <Flame className="w-5 h-5 text-red-600" aria-hidden />
        <span>High</span>
      </button>

      {/* Critical */}
      {criticalStyle === "solid" ? (
        <button
          role="radio"
          aria-label="Critical severity"
          aria-checked={selected === "critical"}
          onClick={() => click("critical")}
          className={clsx(
            "w-full",
            baseNeutralCompact,
            "bg-red-700 text-white hover:shadow-lg hover:shadow-red-600/30 focus-visible:ring-red-400"
          )}
        >
          <Zap className="w-5 h-5" aria-hidden />
          <span>Critical</span>
        </button>
      ) : (
        <button
          role="radio"
          aria-label="Critical severity"
          aria-checked={selected === "critical"}
          onClick={() => click("critical")}
          className={clsx(
            "w-full",
            baseNeutralCompact,
            "ring-4 ring-red-600 hover:shadow-md hover:shadow-red-600/25"
          )}
        >
          <Zap className="w-5 h-5 text-red-600" aria-hidden />
          <span>Critical</span>
        </button>
      )}
    </div>
  );

  if (layout === "vertical") return Vertical;
  if (layout === "compact") return Compact;

  // auto: vertical on <sm, compact on ≥sm (render both, show/hide via responsive classes)
  return (
    <>
      <div className="sm:hidden">{Vertical}</div>
      <div className="hidden sm:block">{Compact}</div>
    </>
  );
}