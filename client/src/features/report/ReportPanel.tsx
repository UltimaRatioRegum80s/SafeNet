import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useReportPanel } from "./useReportPanel";
import { RoutePaths } from "@/router/routePaths";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/ImageUpload";
import { useEnhancedLocation } from "@/hooks/useEnhancedLocation";
import { useIncidentStore } from "@/state/useIncidentStore";
import { beginLocationPick, emitLocationPicked } from "@/lib/events";

type CreateIncidentDTO = {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description?: string;
  isAnonymous: boolean;
  lat?: number;
  lng?: number;
  photos?: string[];
};

// 30s soft cooldown between submits
const COOLDOWN_MS = 30_000;
const COOLDOWN_KEY = "nn:lastIncidentSubmitAt";

export default function ReportPanel() {
  const { open, selected, close } = useReportPanel();
  const [pathname, setLocation] = useLocation();
  const [isAnonymous, setAnonymous] = useState(false); // default OFF per spec
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lastSubmitAt, setLastSubmitAt] = useState<number | null>(() => {
    const v = localStorage.getItem(COOLDOWN_KEY);
    return v ? Number(v) : null;
  });
  const [now, setNow] = useState(() => Date.now());
  const { toast } = useToast();

  const { coords, requestPermission, isPermissionGranted, refinedCoords, setRefinedCoords, permission } = useEnhancedLocation({
    autoStart: false,
    requestPermission: false
  });
  
  // Optimistic updates
  const addIncident = useIncidentStore((s) => s.addIncident);
  const reconcileIncident = useIncidentStore((s) => s.reconcileIncident);

  useEffect(() => {
    if (open && !isPermissionGranted && requestPermission) {
      requestPermission();
    }
  }, [open, isPermissionGranted, requestPermission]);
  
  // Close panel on route changes to prevent dangling overlays
  useEffect(() => {
    close();
  }, [pathname, close]);
  
  // Analytics: track when panel opens with a type
  useEffect(() => {
    if (open && selected) {
      console.debug("[analytics]", "report_start", { type: selected.id, source: "panel_open" });
    }
  }, [open, selected]);
  
  // Prevent background rubber-band scrolling on iOS while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overscrollBehavior;
      document.body.style.overscrollBehavior = "contain";
      return () => { document.body.style.overscrollBehavior = prev; };
    }
  }, [open]);
  
  // Listen for location picked from map pin placement
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ lat: number; lng: number }>).detail;
      if (detail && setRefinedCoords) setRefinedCoords(detail);
    };
    window.addEventListener("nn:location-picked", handler as EventListener);
    return () => window.removeEventListener("nn:location-picked", handler as EventListener);
  }, [setRefinedCoords]);

  // cooldown logic & optimized countdown (less frequent updates)
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const i = setInterval(tick, 1000); // Reduced from 500ms to 1s for better performance
    window.addEventListener("focus", tick);
    return () => { 
      clearInterval(i); 
      window.removeEventListener("focus", tick); 
    };
  }, []);
  
  const msLeft = Math.max(0, (lastSubmitAt ?? 0) + COOLDOWN_MS - now);
  const cooldownActive = msLeft > 0;
  const secondsLeft = Math.ceil(msLeft / 1000);

  const mutation = useMutation({
    mutationFn: async (dto: CreateIncidentDTO) => {
      const { postJSON } = await import("@/lib/http");
      return await postJSON("/api/incidents", {
        type: dto.type,
        note: dto.description,
        latitude: chosenCoords?.lat,
        longitude: chosenCoords?.lng
      });
    },
    onSuccess: (resp: any) => {
      // Reconcile optimistic update with real response
      const tempIncidents = useIncidentStore.getState().incidents.filter(i => i.id.startsWith('temp-'));
      if (tempIncidents.length > 0) {
        reconcileIncident(tempIncidents[0].id, resp);
      }
      
      // Analytics: track successful submission
      console.debug("[analytics]", "report_submit", { type: selected?.id, anon: isAnonymous });
      
      const ts = Date.now();
      setLastSubmitAt(ts);
      localStorage.setItem(COOLDOWN_KEY, String(ts));
      toast({ title: "Incident reported", description: "Redirecting to map to view your report..." });
      setDescription(""); 
      setSelectedFiles([]);
      setAnonymous(false);
      // optional: clear refined pin
      if (setRefinedCoords) setRefinedCoords(null);
      
      // Clear type param on successful submit
      const url = new URL(window.location.href);
      url.searchParams.delete("type");
      window.history.replaceState({}, "", url.toString());
      
      // Navigate to map with incident coordinates and highlight
      if (chosenCoords?.lat && chosenCoords?.lng) {
        const sp = new URLSearchParams({
          lat: String(chosenCoords.lat),
          lng: String(chosenCoords.lng),
          z: "17",
          highlight: "1",
        });
        setLocation(`${RoutePaths.Map}?${sp.toString()}`);
      } else {
        // Fallback: navigate to map without coordinates
        setLocation(RoutePaths.Map);
      }
      
      close();
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Could not submit";
      toast({ variant: "destructive", title: "Submission failed", description: msg });
    },
  });

  const chosenCoords = useMemo(() => refinedCoords ?? coords, [refinedCoords, coords]);
  const hasCoords = !!chosenCoords?.lat && !!chosenCoords?.lng;

  function handleSubmit() {
    if (!selected || cooldownActive || !hasCoords) return;
    const { id, severity } = selected;
    
    // Add optimistic incident
    const tempId = `temp-${crypto.randomUUID()}`;
    addIncident({
      id: tempId,
      type: id,
      status: "pending",
      lat: chosenCoords?.lat,
      lng: chosenCoords?.lng,
      createdAt: new Date().toISOString(),
      title: selected.label,
      description: description.trim() || undefined,
      severity,
      isAnonymous
    });
    
    // For now, we'll pass file names as placeholder (photos not fully implemented yet)
    const photoPlaceholders = selectedFiles.length ? selectedFiles.slice(0, 2).map(f => f.name) : undefined;
    
    mutation.mutate({
      type: id,
      severity, // fixed by type per spec
      description: description.trim() || undefined,
      isAnonymous,
      lat: chosenCoords?.lat,
      lng: chosenCoords?.lng,
      photos: photoPlaceholders,
    });
  }

  function beginRefineOnMap() {
    // decoupled handshake — Map listens and enables pin drop
    beginLocationPick();
  }

  // Clear type param and track cancel on close
  function handleOpenChange(o: boolean) {
    if (!o && selected) {
      console.debug("[analytics]", "report_cancel", { type: selected.id });
      // Clear type param
      const url = new URL(window.location.href);
      url.searchParams.delete("type");
      window.history.replaceState({}, "", url.toString());
    }
    if (!o) close();
  }
  
  // Respect reduced motion
  const prefersReduced = typeof window !== "undefined" ? 
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches : false;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-md rounded-t-2xl glass-surface safe-bottom">
        <SheetHeader className="mb-2">
          <SheetTitle className="flex items-center gap-2">
            {selected ? selected.label : "Report"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Anonymous toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="anon" checked={isAnonymous} onCheckedChange={setAnonymous} />
              <Label htmlFor="anon" className="text-sm">Report anonymously</Label>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm">Short note (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What happened?"
              className="mt-2"
            />
            <div className="mt-1 text-xs opacity-60">
              {chosenCoords
                ? `Location ready (${chosenCoords.lat.toFixed(5)}, ${chosenCoords.lng.toFixed(5)})`
                : "Location not available yet"}
            </div>
            {!hasCoords && (
              <div className="mt-1 text-xs text-amber-400">
                Tip: tap "Drop a pin" to set an exact spot.
              </div>
            )}
            {!isPermissionGranted && (
              <div className="text-xs text-slate-300/80">
                Location is off. You can still <button className="underline" onClick={beginRefineOnMap}>drop a pin</button>.
              </div>
            )}
          </div>

          {/* Photos (max 2) */}
          <div>
            <Label className="text-sm">Photos (optional, up to 2)</Label>
            <div className="mt-2">
              <ImageUpload
                onImagesSelected={(files: File[]) => setSelectedFiles((files ?? []).slice(0, 2))}
                maxImages={2}
                maxSize={10}
                accept="image/*"
              />
            </div>
          </div>

          {/* Refine location */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/70 p-3">
            <div className="text-sm opacity-80">Refine location on map</div>
            <Button size="sm" variant="outline" onClick={beginRefineOnMap} className="tap-target focus-enhanced">
              Drop a pin
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={close} className="tap-target focus-enhanced">Cancel</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending || cooldownActive || !hasCoords} className="tap-target focus-enhanced">
              {mutation.isPending
                ? "Submitting…"
                : cooldownActive
                  ? `Wait ${secondsLeft}s`
                  : hasCoords ? "Submit" : "Set location"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}