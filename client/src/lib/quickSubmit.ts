import { nanoid } from "nanoid";
import { enqueueIncident, type PendingIncident } from "./offlineDb";

async function getCoordsWithTimeout(ms = 3000) {
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("No geolocation"));
    const t = setTimeout(() => reject(new Error("GPS timeout")), ms);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        clearTimeout(t);
        reject(new Error(err?.message || "GPS failed"));
      },
      { enableHighAccuracy: true, timeout: ms, maximumAge: 0 }
    );
  });
}

// types
type Severity = "low" | "medium" | "high" | "critical";

export async function submitIncidentQuick({
  title,
  description,
  category,
  severity, // "low" | "medium" | "high" | "critical"
  type, // CRITICAL: incident type ID like "car_accident", "break_in"
}: {
  title: string;
  description?: string;
  category: string;
  severity: Severity;
  type: string;
}) {
  const sev = (severity ?? "low") as Severity;
  // 1) get coords with increased timeout for better GPS capture
  let coords: { lat: number; lng: number };
  let gpsSuccess = false;
  
  try {
    // Increased from 3s to 10s for better GPS lock
    coords = await getCoordsWithTimeout(10000);
    gpsSuccess = true;
    console.log("[QUICKSUBMIT] GPS acquired successfully:", coords);
    
    // Save successful GPS location for future fallback
    try {
      localStorage.setItem("nn:last-gps", JSON.stringify({
        lat: coords.lat,
        lng: coords.lng,
        t: Date.now()
      }));
    } catch {}
    
  } catch (gpsError) {
    console.warn("[QUICKSUBMIT] GPS failed:", gpsError);
    
    // Multiple fallback strategies for GPS failure
    let center = null;
    
    // Strategy 1: Try to get current map center
    center = (window as any).__nnMap?.getCenter?.() || 
             (window as any).mapInstance?.getCenter?.() ||
             null;
    
    console.log("[QUICKSUBMIT] Map center fallback:", center);
    
    // Strategy 2: Use last successful GPS location (within 1 hour)
    if (!center) {
      try {
        const lastGPS = localStorage.getItem("nn:last-gps");
        if (lastGPS) {
          const parsed = JSON.parse(lastGPS);
          if (parsed.lat && parsed.lng && Date.now() - parsed.t < 3600000) {
            center = { lat: parsed.lat, lng: parsed.lng };
            console.log("[QUICKSUBMIT] Using last GPS location:", center);
          }
        }
      } catch {}
    }
    
    // Strategy 3: Use last incident location (within 1 hour)
    if (!center) {
      try {
        const lastIncident = localStorage.getItem("nn:last-incident");
        if (lastIncident) {
          const parsed = JSON.parse(lastIncident);
          if (parsed.lat && parsed.lng && Date.now() - parsed.t < 3600000) {
            center = { lat: parsed.lat, lng: parsed.lng };
            console.log("[QUICKSUBMIT] Using last incident location:", center);
          }
        }
      } catch {}
    }
    
    // If all fallbacks fail, show error instead of using wrong default location
    if (!center) {
      throw new Error("Unable to determine your location. Please enable GPS or set your location on the map first.");
    }
    
    coords = { lat: center.lat, lng: center.lng };
    console.log("[QUICKSUBMIT] Using fallback coordinates:", coords);
  }

  // 2) create a temp id and notify the map immediately with full incident data
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  window.dispatchEvent(new CustomEvent("nn:incident:local", {
    detail: { 
      tempId, 
      lat: coords.lat, 
      lng: coords.lng, 
      severity: sev,
      type, // Include type for correct marker color/shape
      title,
      description: description || "",
      isOptimistic: true, // Flag for styling
    }
  }));

  // 3) POST with an AbortController timeout (12s)
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 12000);
  
  // DEBUG: Log the exact data being sent
  const payload = {
    title,
    description: description || "",
    category,
    type, // CRITICAL FIX: Include incident type ID
    severity: sev,
    latitude: coords.lat,
    longitude: coords.lng,
    // no photos on this quick path
    isAnonymous: true, // or your default
  };
  
  console.log("🔍 [QUICKSUBMIT] Sending to backend:", payload);
  console.log("🔍 [QUICKSUBMIT] Type value:", type, "typeof:", typeof type);
  
  let res: Response;
  try {
    res = await fetch("/api/incidents", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": nanoid(),
        "x-nn-quick": "1", // harmless header; server can ignore
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
  } catch (fetchError: any) {
    clearTimeout(timeout);
    
    // Network error (offline, CORS, DNS, etc.) - queue for offline sync
    const isOffline = !navigator.onLine;
    const isNetworkError = fetchError instanceof TypeError || fetchError.name === 'AbortError';
    
    console.warn("[QUICKSUBMIT] Fetch failed, queueing offline:", { isOffline, isNetworkError, error: fetchError.message });
    
    if (isOffline || isNetworkError) {
      // Enqueue to IndexedDB for later sync
      try {
        const pendingIncident = await enqueueIncident({
          type,
          title,
          description: description || "",
          latitude: coords.lat,
          longitude: coords.lng,
          severity: sev,
          createdAt: Date.now(),
        });
        
        console.log("[QUICKSUBMIT] Incident queued for offline sync:", pendingIncident.id);
        
        // Dispatch event so UI can show the pending incident
        window.dispatchEvent(new CustomEvent("nn:incident:queued", {
          detail: { 
            tempId, 
            pendingId: pendingIncident.id,
            lat: coords.lat, 
            lng: coords.lng, 
            severity: sev,
            syncStatus: 'pending',
          }
        }));
        
        // Return a mock result indicating queued status
        return {
          id: pendingIncident.id,
          tempId,
          queued: true,
          syncStatus: 'pending',
          message: 'Report saved offline. It will sync when you reconnect.',
        };
      } catch (queueError) {
        console.error("[QUICKSUBMIT] Failed to queue offline:", queueError);
        throw new Error("Unable to save report. Please try again when online.");
      }
    }
    
    // Unknown error - rethrow
    throw fetchError;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // leave the temporary dot for 30s so user still sees something
    setTimeout(() => (window as any).__nnRemoveSimpleDot?.(tempId), 30000);
    throw new Error(await res.text());
  }

  // success → invalidate caches to ensure immediate UI update
  const result = await res.json();
  
  // Manually invalidate all incident-related query keys to ensure immediate updates
  if (typeof window !== 'undefined' && (window as any).__queryClient) {
    const qc = (window as any).__queryClient;
    try {
      // Invalidate the main incidents feed cache used by the map
      await qc.invalidateQueries({ queryKey: ["/api/incidents"] });
      // Also invalidate the generic incidents key used by other components
      await qc.invalidateQueries({ queryKey: ["incidents"] });
      console.log("🔄 [QUICKSUBMIT] Cache invalidated successfully");
    } catch (err) {
      console.warn("🔄 [QUICKSUBMIT] Cache invalidation failed:", err);
    }
  }
  
  return result;
}