import { useState } from "react";
import clsx from "clsx";
import { Smile, AlertTriangle, Flame, Zap } from "lucide-react";
import { track } from "@/lib/analytics";

export type Severity = "low" | "medium" | "high" | "critical";

type Props = {
  onSelect: (v: Severity) => void;
  criticalStyle?: "solid" | "ring";
  className?: string;
  trackEvent?: boolean;
  vibrate?: boolean;
};

export default function SeveritySelectCompact({
  onSelect,
  criticalStyle = "solid",
  className,
  trackEvent = true,
  vibrate = true,
}: Props) {
  const [selected, setSelected] = useState<Severity | null>(null);

  const click = (v: Severity) => {
    if (trackEvent) {
      try { track("severity_sheet_open", { severity: v }); } catch {}
    }
    if (vibrate && navigator.vibrate) navigator.vibrate(8);
    setSelected(v);
    onSelect(v);
  };

  const baseNeutral =
    "h-12 rounded-full font-semibold text-sm transition-all shadow-sm " +
    "bg-slate-200/90 text-slate-900 flex items-center justify-center gap-2 px-4 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const Item = ({
    children, className, checked, onClick, ariaLabel,
  }: {
    children: React.ReactNode;
    className?: string;
    checked: boolean;
    onClick: () => void;
    ariaLabel: string;
  }) => (
    <button
      role="radio"
      aria-label={ariaLabel}
      aria-checked={checked}
      className={clsx("w-full", baseNeutral, className)}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div
      role="radiogroup"
      aria-label="Choose incident severity"
      className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-xl", className)}
    >
      <Item ariaLabel="Low severity" checked={selected === "low"} onClick={() => click("low")} className="ring-2 ring-yellow-400">
        <Smile className="w-5 h-5" aria-hidden />
        <span>Low</span>
      </Item>

      <Item ariaLabel="Medium severity" checked={selected === "medium"} onClick={() => click("medium")} className="ring-2 ring-amber-600">
        <AlertTriangle className="w-5 h-5" aria-hidden />
        <span>Medium</span>
      </Item>

      <Item ariaLabel="High severity" checked={selected === "high"} onClick={() => click("high")} className="ring-2 ring-red-500">
        <Flame className="w-5 h-5" aria-hidden />
        <span>High</span>
      </Item>

      {criticalStyle === "solid" ? (
        <Item ariaLabel="Critical severity" checked={selected === "critical"} onClick={() => click("critical")}
          className={clsx("bg-red-700 text-white", "focus-visible:ring-red-400")}
        >
          <Zap className="w-5 h-5" aria-hidden />
          <span>Critical</span>
        </Item>
      ) : (
        <Item ariaLabel="Critical severity" checked={selected === "critical"} onClick={() => click("critical")} className="ring-4 ring-red-600">
          <Zap className="w-5 h-5" aria-hidden />
          <span>Critical</span>
        </Item>
      )}
    </div>
  );
}