import { useMemo, useState, useEffect } from "react";
import { INCIDENT_TYPES, INCIDENT_TYPES_BY_ID } from "@/features/report/incidentTypes";
import { useReportPanel } from "@/features/report/useReportPanel";
import { useQuickReportStore } from "@/state/useQuickReportStore";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { AlertTriangle, Circle, Flame, X } from "lucide-react";
import clsx from "clsx";
import { track } from "@/lib/analytics";
import SeveritySelectUnified, { type Severity as SeveritySelectType } from "@/components/SeveritySelectUnified";
import { useIncidentStore } from "@/state/useIncidentStore";

type Severity = "low" | "medium" | "high" | "critical";

const FAB_STYLE = "pointer-events-auto rounded-full shadow-xl ring-1 ring-white/20 px-4 py-[10px] flex items-center gap-2 active:scale-[0.97] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const COLORS = {
  low:      "text-slate-900 bg-yellow-400 hover:bg-yellow-300",
  medium:   "text-slate-900 bg-amber-500 hover:bg-amber-400",
  high:     "text-white bg-red-600 hover:bg-red-500",
  critical: "text-white bg-red-800 hover:bg-red-700",
} as const;

function SeverityFab({
  severity,
  label,
  onClick,
  className,
}: {
  severity: Severity;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const icon =
    severity === "low" ? <Circle className="h-5 w-5" /> :
    severity === "medium" ? <AlertTriangle className="h-5 w-5" /> :
    <Flame className="h-5 w-5" />;

  return (
    <button
      onClick={onClick}
      aria-label={`Report a ${label.toLowerCase()}-risk incident`}
      className={clsx(
        "backdrop-blur-md",
        FAB_STYLE,           // padding, ring, press animation, focus styles
        COLORS[severity],    // ✅ brings back the colors
        className            // for placement from parent
      )}
    >
      {icon}
      <span className="font-semibold text-sm sm:text-base">{label}</span>
    </button>
  );
}

function SeverityGrid({
  severity,
  onPick,
}: {
  severity: Severity;
  onPick: (id: string) => void;
}) {
  const items = useMemo(
    () => INCIDENT_TYPES.filter(t => t.severity === severity),
    [severity]
  );

  // Handle critical case - show empty state if no critical incidents exist
  if (severity === "critical" && items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-400 mb-4">No critical incident types configured yet.</p>
        <button
          onClick={() => onPick("emergency-911")} // fallback to a high severity type
          className="text-blue-400 hover:text-blue-300 underline text-sm"
        >
          Show all types
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4 pb-6 max-h-[80svh] overflow-auto">
      {items.map(t => (
        <button
          key={t.id}
          onClick={() => onPick(t.id)}
          className="glass-card rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 active:scale-[0.98] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <img
            src={t.buttonIcon ?? "/attached_assets/default.png"}
            alt={t.label}
            className="h-10 w-10"
            loading="lazy"
            decoding="async"
          />
          <span className="text-[11px] leading-tight text-center">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function CategorySheets() {
  const [open, setOpen] = useState<Severity | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const rp = useReportPanel();
  const openQuickReport = useQuickReportStore((s) => s.open);
  const setSeverity = useIncidentStore((s) => s.setSeverity);

  // reduce motion: remove press animation if user prefers reduced motion
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const handler = () => {
      document.documentElement.classList.toggle("motion-safe", !mq.matches);
    };
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const onPick = (id: string) => {
    const type = INCIDENT_TYPES_BY_ID[id];
    if (!type) return;
    setOpen(null);
    
    // Open quick report instead of full ReportPanel
    openQuickReport({ type: id, severity: type.severity });
    
    // Analytics tracking
    track("report_start", { typeId: id, severity: type.severity });
  };

  const openSheet = (severity: Severity) => {
    setSeverity(severity);
    setOpen(severity);
    track("severity_sheet_open", { severity });
  };

  const onSeveritySelect = (sev: SeveritySelectType) => {
    if (isOpening) return; // guard against double-taps
    setIsOpening(true);
    setSeverity(sev as any); // The store accepts different severity types
    openSheet(sev);
    // let the animation complete before re-enabling taps
    setTimeout(() => setIsOpening(false), 400);
  };

  // FAB layout now centered horizontally

  return (
    <>
      {/* Mobile/Tablet: Enhanced severity buttons with icons */}
      <section className="lg:hidden px-4 sm:px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+24px)] grid place-items-center md:place-items-start">
        <div className="w-full">
          <h1 className="text-xl md:text-2xl font-bold text-center md:text-left">
            Report Incident
          </h1>
          <p className="mt-2 text-sm text-slate-400 text-center md:text-left">
            Choose a severity level. You'll select the incident type next.
          </p>

          {/* Auto-responsive: vertical on mobile, compact on tablet+ */}
          <div className="mt-8">
            <SeveritySelectUnified
              onSelect={onSeveritySelect}
              criticalStyle="solid"
              layout="auto"
              trackEvent={false} // we already track in openSheet
              vibrate={true}
            />
          </div>
        </div>
      </section>

      {/* LOW */}
      <Drawer open={open === "low"} onOpenChange={(v) => setOpen(v ? "low" : null)}>
        <DrawerContent className="glass-surface rounded-t-2xl z-[61] border border-white/10">
          <DrawerHeader className="flex items-center justify-between px-4">
            <div>
              <DrawerTitle className="text-base font-semibold">Low-risk incidents</DrawerTitle>
              <DrawerDescription className="text-xs opacity-80">Everyday issues & non-emergencies</DrawerDescription>
            </div>
            <DrawerClose className="p-2 rounded-full hover:bg-white/10 active:scale-95">
              <X className="h-5 w-5" />
            </DrawerClose>
          </DrawerHeader>
          <SeverityGrid severity="low" onPick={onPick} />
        </DrawerContent>
      </Drawer>

      {/* MEDIUM */}
      <Drawer open={open === "medium"} onOpenChange={(v) => setOpen(v ? "medium" : null)}>
        <DrawerContent className="glass-surface rounded-t-2xl z-[61] border border-white/10">
          <DrawerHeader className="flex items-center justify-between px-4">
            <div>
              <DrawerTitle className="text-base font-semibold">Medium-risk incidents</DrawerTitle>
              <DrawerDescription className="text-xs opacity-80">Disruptive but not life-threatening</DrawerDescription>
            </div>
            <DrawerClose className="p-2 rounded-full hover:bg-white/10 active:scale-95">
              <X className="h-5 w-5" />
            </DrawerClose>
          </DrawerHeader>
          <SeverityGrid severity="medium" onPick={onPick} />
        </DrawerContent>
      </Drawer>

      {/* HIGH */}
      <Drawer open={open === "high"} onOpenChange={(v) => setOpen(v ? "high" : null)}>
        <DrawerContent className="glass-surface rounded-t-2xl z-[61] border border-white/10">
          <DrawerHeader className="flex items-center justify-between px-4">
            <div>
              <DrawerTitle className="text-base font-semibold">High-risk incidents</DrawerTitle>
              <DrawerDescription className="text-xs opacity-80">Urgent situations — act quickly</DrawerDescription>
            </div>
            <DrawerClose className="p-2 rounded-full hover:bg-white/10 active:scale-95">
              <X className="h-5 w-5" />
            </DrawerClose>
          </DrawerHeader>
          <SeverityGrid severity="high" onPick={onPick} />
        </DrawerContent>
      </Drawer>

      {/* CRITICAL */}
      <Drawer open={open === "critical"} onOpenChange={(v) => setOpen(v ? "critical" : null)}>
        <DrawerContent className="glass-surface rounded-t-2xl z-[61] border border-white/10">
          <DrawerHeader className="flex items-center justify-between px-4">
            <div>
              <DrawerTitle className="text-base font-semibold">Critical incidents</DrawerTitle>
              <DrawerDescription className="text-xs opacity-80">Life-threatening emergencies</DrawerDescription>
            </div>
            <DrawerClose className="p-2 rounded-full hover:bg-white/10 active:scale-95">
              <X className="h-5 w-5" />
            </DrawerClose>
          </DrawerHeader>
          <SeverityGrid severity="critical" onPick={onPick} />
        </DrawerContent>
      </Drawer>
    </>
  );
}