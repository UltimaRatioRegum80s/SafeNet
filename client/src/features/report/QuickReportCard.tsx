// client/src/features/report/QuickReportCard.tsx
import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuickReportStore } from "@/state/useQuickReportStore";
import { getCurrentPosition } from "@/lib/geolocation";
import { useCreateIncident } from "./api/useCreateIncident";
import { useLocation } from "wouter";
import { RoutePaths } from "@/router/routePaths";
import { useToast } from "@/hooks/use-toast";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { useIncidentStore } from "@/state/useIncidentStore";
import { useOfflineQueueStore } from "@/state/useOfflineQueueStore";
import { createIncidentMarker, updateMarkerFlags, replaceMarkerId, updateMarkerData } from "@/features/map/createIncidentMarker";
import { submitIncidentQuick } from "../../lib/quickSubmit";
import { useAuthStore } from "@/store/auth";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TAXONOMY_TYPES_BY_ID, resolveToV2Type, getGroupForType } from "./taxonomyV2";
import { INCIDENT_TYPES_BY_ID } from "./incidentTypes"; // Legacy fallback
import { LongPressButton } from "@/components/LongPressButton";

export default function QuickReportCard() {
  const { isOpen, type, severity, note, setNote, close, reset, location, startReportMode, resetReportContext, cancelReportMode, queueReportMode } = useQuickReportStore();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createIncident = useCreateIncident();
  const [isLocating, setIsLocating] = React.useState(false);
  const isDesktop = useIsDesktop();
  const { user } = useAuthStore();

  const [keyboardOffset, setKeyboardOffset] = React.useState(0);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || isDesktop || !isOpen) {
      setKeyboardOffset(0);
      return;
    }

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardOffset(0);
    };
  }, [isDesktop, isOpen]);

  // Check email verification status - fail early
  const isEmailVerified = user?.emailVerified ?? false;

  // Optimistic updates and offline queue
  const addIncident = useIncidentStore((s) => s.addIncident);
  const updateIncidentId = useIncidentStore((s) => s.updateIncidentId);
  const removeIncident = useIncidentStore((s) => s.removeIncident);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);

  // Get label from v2 taxonomy, fallback to legacy, then format
  const getTypeLabel = (typeId: string | undefined): string => {
    if (!typeId) return "Report";
    // Try v2 taxonomy first
    const v2Type = resolveToV2Type(typeId);
    if (v2Type) return v2Type.label;
    // Fallback to legacy
    const legacyType = INCIDENT_TYPES_BY_ID[typeId];
    if (legacyType) return legacyType.label;
    // Format the ID itself
    return typeId.replace(/[._]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };
  
  const label = getTypeLabel(type);
  const group = type ? getGroupForType(type) : null;

  const isBusy = isLocating || createIncident.isPending;

  const onSubmit = async () => {
    if (!type || isBusy) return;

    // Guarantee severity is never null/undefined - default to "low"
    const finalSeverity = severity || "low";
    
    // Debug logging for incident submission
    (window as any).__nnSelectedSeverity = finalSeverity;
    console.debug("🔍 [QUICK_REPORT] submitting with:", {
      type,
      severity: finalSeverity,
      incidentTypeId: type,
      typeFromId: INCIDENT_TYPES_BY_ID[type]
    });

    try {
      setIsLocating(true);
      
      // Get coordinates first for navigation
      let coords: { lat: number; lng: number };
      try {
        coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("No geolocation"));
          const timeout = setTimeout(() => reject(new Error("GPS timeout")), 6000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout);
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (err) => {
              clearTimeout(timeout);
              reject(new Error(err?.message || "GPS failed"));
            },
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
          );
        });
      } catch {
        const center = (window as any).__nnMap?.getCenter?.();
        if (!center) throw new Error("Location unavailable");
        coords = { lat: center.lat, lng: center.lng };
      }
      
      // Use the new quick submit function that handles optimistic dots
      // Support both v2 and legacy type IDs
      const typeLabel = getTypeLabel(type);
      const result = await submitIncidentQuick({
        title: typeLabel,
        description: note?.trim() || `Quick report: ${typeLabel}`,
        category: group?.label || typeLabel,
        type, // Pass the incident type ID (v2 or legacy)
        severity: finalSeverity as "low" | "medium" | "high" | "critical",
      });

      toast({
        title: "Incident reported",
        description: "Thank you for keeping the community safe!",
      });

      console.log("[incident] created -> invalidating incidents, result:", result);
      reset();
      
      // PATCH A: Navigate to map with focus=incidentId for guaranteed centering
      // This works even if GPS is unavailable - the map will center on the incident's stored coordinates
      const incidentId = result?.id;
      const mapUrl = incidentId 
        ? `${RoutePaths.Map}?focus=${incidentId}&highlight=1&severity=${finalSeverity}`
        : `${RoutePaths.Map}?lat=${coords.lat}&lng=${coords.lng}&z=18&highlight=1&severity=${finalSeverity}`;
      setLocation(mapUrl);
      
    } catch (err: any) {
      console.warn("[incident] error", err.message);
      toast({
        title: "Couldn't submit",
        description: err?.message ?? "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <Sheet 
      open={isOpen} 
      onOpenChange={(o) => {
        if (o) {
          // opening - no action needed
        } else {
          close();
          cancelReportMode(); // Clear report mode if sheet closes
        }
      }}
    >
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={`rounded-t-2xl bg-neutral-950 text-white${!isDesktop ? " overflow-y-auto" : ""}`}
        style={
          !isDesktop
            ? {
                transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
                transition: "transform 0.2s ease-out",
                maxHeight: keyboardOffset > 0 ? `calc(90dvh - ${keyboardOffset}px)` : undefined,
              }
            : undefined
        }
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            {label}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-4 w-4 text-white/50 hover:text-white/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-center">
                  <p>Structured safety report. Content is moderated and subject to community safety rules.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SheetTitle>
          {isEmailVerified ? (
            <p className="text-xs text-white/60">
              Optional: add a short note, then submit to pin your location.
            </p>
          ) : (
            <p className="text-xs text-amber-400">
              Email verification required to report incidents
            </p>
          )}
        </SheetHeader>

        {/* Show verification guardrail if email not verified */}
        {!isEmailVerified ? (
          <div className="mt-4">
            <EmailVerificationBanner variant="inline" />
            <SheetFooter className="mt-6">
              <Button variant="ghost" className="text-white/70 hover:text-white" onClick={close}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">Short note (optional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What happened?"
                  className="min-h-[90px] resize-none bg-neutral-900 text-white placeholder:text-white/40 border-white/20"
                  data-testid="input-incident-note"
                />
              </div>

              {/* ⬇️ location row (desktop vs mobile) */}
              <div className="space-y-2">
                {!isDesktop ? (
                  <div className="text-sm text-white/60">
                    Location will be set using your current GPS position
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-neutral-900 p-2">
                    <p className="text-sm text-white/80" aria-live="polite">
                      {location
                        ? `Location set: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                        : "Click the map to set an exact spot"}
                    </p>
                    <Button 
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        queueReportMode();
                        close();
                      }}
                      className="text-white border-white/20"
                    >
                      Drop a pin
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="mt-6 flex flex-col gap-4">
              {/* Long-press quick submit for Critical/SOS types */}
              {group?.id === 'critical' && !isBusy && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <LongPressButton
                    onLongPress={onSubmit}
                    duration={3000}
                    disabled={isBusy || !type || !severity}
                    progressColor="#DC2626"
                  >
                    Hold to Send SOS
                  </LongPressButton>
                  <span className="text-xs text-white/50">Hold for 3 seconds</span>
                </div>
              )}
              
              {/* Standard submit row */}
              <div className="flex items-center gap-2 w-full">
                <Button variant="ghost" type="button" className="text-white/70 hover:text-white" onClick={close}>
                  Cancel
                </Button>
                <Button
                  className="ml-auto bg-blue-500 text-white hover:bg-blue-400"
                  onClick={onSubmit}
                  disabled={isBusy || !type || !severity}
                  data-testid="button-submit-incident"
                >
                  {isBusy ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}