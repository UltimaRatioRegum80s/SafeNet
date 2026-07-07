/**
 * CategorySheetsV2 - Mobile incident type selector using Taxonomy v2
 * 
 * Phase 3B Item 5: Single-page scrollable layout with group headers.
 * All types visible on one page, organized by group. Tapping a type
 * opens QuickReportCard directly with correct severity derivation.
 * 
 * Task 8: Press-and-hold (2s) on any type button submits directly,
 * bypassing the QuickReportCard. Critical/Emergency 3s SOS hold is unchanged.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuickReportStore } from "@/state/useQuickReportStore";
import { track } from "@/lib/analytics";
import { 
  TAXONOMY_GROUPS, 
  TAXONOMY_GROUP_ORDER, 
  TYPES_BY_GROUP,
  deriveSeverityFromGroup,
  type TaxonomyGroupId,
  type TaxonomyType
} from "./taxonomyV2";
import { cn } from "@/lib/utils";
import { submitIncidentQuick } from "@/lib/quickSubmit";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { RoutePaths } from "@/router/routePaths";
import { resolveToV2Type, getGroupForType } from "./taxonomyV2";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/locationStore";
import { pickQueryLocation } from "@/lib/useDeviceLocation";

const GROUP_COLORS: Record<TaxonomyGroupId, { bg: string; border: string; text: string; headerBg: string }> = {
  services: { 
    bg: 'bg-amber-100 dark:bg-amber-500/10', 
    border: 'border-amber-300 dark:border-amber-500/30', 
    text: 'text-amber-700 dark:text-amber-400',
    headerBg: 'bg-amber-500'
  },
  nabor_note: { 
    bg: 'bg-cyan-100 dark:bg-cyan-500/10', 
    border: 'border-cyan-300 dark:border-cyan-500/30', 
    text: 'text-cyan-700 dark:text-cyan-400',
    headerBg: 'bg-cyan-500'
  },
  emergency: { 
    bg: 'bg-orange-100 dark:bg-orange-600/10', 
    border: 'border-orange-300 dark:border-orange-600/30', 
    text: 'text-orange-700 dark:text-orange-400',
    headerBg: 'bg-orange-600'
  },
  critical: { 
    bg: 'bg-red-100 dark:bg-red-600/10', 
    border: 'border-red-300 dark:border-red-600/30', 
    text: 'text-red-700 dark:text-red-400',
    headerBg: 'bg-red-600'
  },
};

const HOLD_DURATION = 2000; // 2 seconds for direct submit
const MOVE_THRESHOLD = 10; // px — cancel hold if finger moves more than this

interface TypeButtonProps {
  type: TaxonomyType;
  groupId: TaxonomyGroupId;
  onClick: () => void;
  onHoldComplete: (typeId: string, groupId: TaxonomyGroupId) => void;
  isSubmitting: boolean;
  holdEnabled: boolean;
}

function TypeButton({ 
  type, 
  groupId,
  onClick,
  onHoldComplete,
  isSubmitting,
  holdEnabled,
}: TypeButtonProps) {
  const colors = GROUP_COLORS[groupId];
  const isCustom = type.isCustom;

  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didFireRef = useRef(false);
  const movedRef = useRef(false); // tracks whether touch moved beyond threshold

  const cancelHold = useCallback((keepFiredFlag = false) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    setIsHolding(false);
    setHoldProgress(0);
    if (!keepFiredFlag) didFireRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const animate = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
    setHoldProgress(progress);
    if (progress < 100) {
      animRef.current = requestAnimationFrame(animate);
    }
  }, []);

  const startHold = useCallback((clientX: number, clientY: number) => {
    if (isSubmitting || !holdEnabled) return;
    didFireRef.current = false;
    movedRef.current = false;
    startPosRef.current = { x: clientX, y: clientY };
    startTimeRef.current = Date.now();
    setIsHolding(true);
    setHoldProgress(0);

    if (navigator.vibrate) navigator.vibrate(20);

    animRef.current = requestAnimationFrame(animate);

    timerRef.current = window.setTimeout(() => {
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      setIsHolding(false);
      setHoldProgress(0);
      didFireRef.current = true;
      if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
      onHoldComplete(type.id, groupId);
    }, HOLD_DURATION);
  }, [isSubmitting, holdEnabled, animate, onHoldComplete, type.id, groupId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    startHold(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD) cancelHold();
  };

  const handleMouseUp = () => {
    if (didFireRef.current) {
      cancelHold(true); // keep fired flag so subsequent click is suppressed
      return;
    }
    cancelHold();
  };

  const handleClick = () => {
    if (didFireRef.current) {
      didFireRef.current = false; // clear after suppressing this click
      return;
    }
    if (movedRef.current) {
      movedRef.current = false; // clear after suppressing scroll-induced click
      return;
    }
    onClick();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startHold(t.clientX, t.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startPosRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startPosRef.current.x;
    const dy = t.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      movedRef.current = true; // mark as moved so click is suppressed
      cancelHold();
    }
  };

  const handleTouchEnd = () => {
    if (didFireRef.current) {
      cancelHold(true); // keep the fired flag so the subsequent click is suppressed
      return;
    }
    cancelHold();
  };

  const circumference = 2 * Math.PI * 30;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;
  
  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => cancelHold()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => cancelHold()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl",
        "min-h-[90px]",
        "active:scale-95 transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-white/50",
        "select-none",
        "border",
        colors.bg,
        colors.border,
        isSubmitting && "opacity-60 cursor-not-allowed"
      )}
      disabled={isSubmitting}
      data-testid={`type-button-${type.id}`}
    >
      {/* Hold progress ring overlay — 72×72 (50% larger than original 48×48) */}
      {isHolding && (
        <svg
          className="absolute inset-0 m-auto -rotate-90 pointer-events-none"
          width="72"
          height="72"
          viewBox="0 0 72 72"
          style={{ zIndex: 10 }}
        >
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="4"
          />
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke={groupId === 'critical' ? '#DC2626' : groupId === 'emergency' ? '#EA580C' : '#2563EB'}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      )}

      <div 
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
          isCustom && "border-2 border-dashed",
          isHolding && "scale-90 transition-transform duration-100"
        )}
        style={{ 
          backgroundColor: `${type.color}30`,
          borderColor: isCustom ? type.color : 'transparent'
        }}
      >
        {isCustom ? "+" : type.label.charAt(0)}
      </div>
      <span className="text-xs text-center text-gray-800 dark:text-white/90 font-medium leading-tight line-clamp-2">
        {type.label}
      </span>
    </button>
  );
}

function GroupSection({ 
  groupId, 
  onTypeSelect,
  onHoldComplete,
  isAnySubmitting,
}: { 
  groupId: TaxonomyGroupId;
  onTypeSelect: (typeId: string, groupId: TaxonomyGroupId) => void;
  onHoldComplete: (typeId: string, groupId: TaxonomyGroupId) => void;
  isAnySubmitting: boolean;
}) {
  const group = TAXONOMY_GROUPS[groupId];
  const types = TYPES_BY_GROUP[groupId];
  const colors = GROUP_COLORS[groupId];
  const holdEnabled = true;
  
  return (
    <section className="mb-6">
      {/* Group Header - Visual context only, not interactive */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg mb-3",
        colors.headerBg
      )}>
        <span className="text-lg">{group.emoji}</span>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-sm">{group.label}</h2>
          <p className="text-xs text-white/80">{group.description}</p>
        </div>
      </div>
      
      {/* Type Grid */}
      <div className="grid grid-cols-3 gap-2">
        {types.map((type) => (
          <TypeButton
            key={type.id}
            type={type}
            groupId={groupId}
            onClick={() => onTypeSelect(type.id, groupId)}
            onHoldComplete={onHoldComplete}
            isSubmitting={isAnySubmitting}
            holdEnabled={holdEnabled}
          />
        ))}
      </div>
    </section>
  );
}

export default function CategorySheetsV2() {
  const openQuickReport = useQuickReportStore((s) => s.open);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const [activeSubmitId, setActiveSubmitId] = useState<string | null>(null);

  // Reduce motion preference
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

  const handleTypeSelect = (typeId: string, groupId: TaxonomyGroupId) => {
    const severity = deriveSeverityFromGroup(groupId);
    
    // Open quick report with the selected type
    openQuickReport({ type: typeId, severity });
    
    // Analytics tracking
    track("report_start", { typeId, groupId, severity, source: "single_page_v2" });
  };

  const handleHoldComplete = useCallback(async (typeId: string, groupId: TaxonomyGroupId) => {
    // Email verification guard
    const isEmailVerified = user?.emailVerified ?? false;
    if (!isEmailVerified) {
      toast({
        title: "Email verification required",
        description: "Please verify your email to report incidents.",
        variant: "destructive",
      });
      return;
    }

    // Seed localStorage with the location store's coords before calling submitIncidentQuick.
    // quickSubmit.ts falls back to nn:last-gps when GPS is unavailable; this ensures
    // the location already tracked by the app (currentLocation / lastGoodLocation) is
    // available even on the Report page where __nnMap is null.
    const { currentLocation, lastGoodLocation } = useLocationStore.getState();
    const storeCoords = pickQueryLocation({ currentLocation, lastGoodLocation });

    if (storeCoords) {
      // Store has fresh/stale coords — seed localStorage so quickSubmit fallback finds them.
      try {
        localStorage.setItem("nn:last-gps", JSON.stringify({
          lat: storeCoords.lat,
          lng: storeCoords.lng,
          t: Date.now(),
        }));
      } catch { /* ignore storage errors */ }
    } else {
      // Store has no coords. Check whether quickSubmit's own localStorage fallbacks
      // (nn:last-gps or nn:last-incident within 1 hour) can cover this. If nothing
      // is available, bail early with a clear message instead of a 10s GPS timeout.
      const ONE_HOUR = 3_600_000;
      let hasCachedFallback = false;
      try {
        const lastGps = localStorage.getItem("nn:last-gps");
        if (lastGps) {
          const p = JSON.parse(lastGps);
          if (p.lat && p.lng && Date.now() - p.t < ONE_HOUR) hasCachedFallback = true;
        }
      } catch { /* ignore */ }
      if (!hasCachedFallback) {
        try {
          const lastIncident = localStorage.getItem("nn:last-incident");
          if (lastIncident) {
            const p = JSON.parse(lastIncident);
            if (p.lat && p.lng && Date.now() - p.t < ONE_HOUR) hasCachedFallback = true;
          }
        } catch { /* ignore */ }
      }
      if (!hasCachedFallback) {
        toast({
          title: "Location unavailable",
          description: "Enable GPS or set your location on the map first.",
          variant: "destructive",
        });
        return;
      }
    }

    const severity = deriveSeverityFromGroup(groupId);
    const v2Type = resolveToV2Type(typeId);
    const typeLabel = v2Type?.label ?? typeId.replace(/[._]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    const group = getGroupForType(typeId);

    track("report_hold_submit", { typeId, groupId, severity, source: "hold_direct_v2" });

    setActiveSubmitId(typeId);
    try {
      const result = await submitIncidentQuick({
        title: typeLabel,
        description: `Quick report: ${typeLabel}`,
        category: group?.label ?? typeLabel,
        type: typeId,
        severity: severity as "low" | "medium" | "high" | "critical",
      });

      toast({
        title: "Incident reported",
        description: "Thank you for keeping the community safe!",
      });

      const incidentId = result?.id;
      // Prefer focus-by-id (map will center on stored coords).
      // Fall back to lat/lng/z params matching the normal submit flow.
      let mapUrl: string;
      if (incidentId) {
        mapUrl = `${RoutePaths.Map}?focus=${incidentId}&highlight=1&severity=${severity}`;
      } else {
        // Attempt to read last-known GPS for fallback centering
        let lat: string | undefined;
        let lng: string | undefined;
        try {
          const raw = localStorage.getItem("nn:last-gps");
          if (raw) {
            const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
            if (parsed.lat && parsed.lng) {
              lat = parsed.lat.toFixed(6);
              lng = parsed.lng.toFixed(6);
            }
          }
        } catch { /* ignore */ }
        if (lat && lng) {
          mapUrl = `${RoutePaths.Map}?lat=${lat}&lng=${lng}&z=18&highlight=1&severity=${severity}`;
        } else {
          mapUrl = `${RoutePaths.Map}?highlight=1&severity=${severity}`;
        }
      }
      setLocation(mapUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Check your connection and try again.";
      toast({
        title: "Couldn't submit",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActiveSubmitId(null);
    }
  }, [user, toast, setLocation]);

  return (
    <section className="lg:hidden px-4 sm:px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="w-full max-w-md mx-auto">
        {/* Page Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold">
            Report Incident
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select the type of incident to report
          </p>
        </div>

        {/* Single scrollable list of all groups and types */}
        <div className="space-y-2">
          {TAXONOMY_GROUP_ORDER.map((groupId) => (
            <GroupSection
              key={groupId}
              groupId={groupId}
              onTypeSelect={handleTypeSelect}
              onHoldComplete={handleHoldComplete}
              isAnySubmitting={activeSubmitId !== null}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
