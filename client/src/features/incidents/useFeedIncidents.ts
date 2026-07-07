import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Incident, itemsFromAnyPayload } from "@/lib/incidentsShape";
import { useLocationStore } from "@/store/locationStore";
import { pickQueryLocation, quantizeCoord } from "@/lib/useDeviceLocation";
import { socketService } from "@/lib/socketService";

// Match queries that start with /api/incidents/nearby (location-based feed)
const NEARBY_KEY_PREFIX = "/api/incidents/nearby";

// SessionStorage key for persisting optimistic incidents across navigation
const OPTIMISTIC_STORAGE_KEY = "nn:optimistic-incidents";

// Event detail type for optimistic incidents
interface OptimisticIncidentEvent {
  tempId: string;
  lat: number;
  lng: number;
  severity: string;
  type: string;
  title: string;
  description: string;
  isOptimistic: boolean;
}

// Minimal payload for sessionStorage (only what's needed for marker rendering)
interface StoredOptimisticIncident {
  id: string; // tempId
  lat: number;
  lng: number;
  severity: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
}

// Helper: Load optimistic incidents from sessionStorage
function loadOptimisticFromStorage(): StoredOptimisticIncident[] {
  try {
    const stored = sessionStorage.getItem(OPTIMISTIC_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper: Save optimistic incident to sessionStorage
function saveOptimisticToStorage(incident: StoredOptimisticIncident): void {
  try {
    const existing = loadOptimisticFromStorage();
    // Avoid duplicates by tempId
    const filtered = existing.filter(i => i.id !== incident.id);
    sessionStorage.setItem(OPTIMISTIC_STORAGE_KEY, JSON.stringify([...filtered, incident]));
  } catch {
    // Silent fail - sessionStorage might be full or disabled
  }
}

// Helper: Remove optimistic incident from sessionStorage (when real data arrives)
function removeOptimisticFromStorage(tempId: string): void {
  try {
    const existing = loadOptimisticFromStorage();
    const filtered = existing.filter(i => i.id !== tempId);
    if (filtered.length === 0) {
      sessionStorage.removeItem(OPTIMISTIC_STORAGE_KEY);
    } else {
      sessionStorage.setItem(OPTIMISTIC_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Silent fail
  }
}

// Helper: Clear all optimistic incidents from sessionStorage
export function clearAllOptimisticFromStorage(): void {
  try {
    sessionStorage.removeItem(OPTIMISTIC_STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

// Haversine distance in km — used by socket listener to check if an incoming
// incident falls within the user's current radius before adding it to state
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DEFAULT_RADIUS_KM = 5;
const DEFAULT_SINCE_HOURS = 72;

// Allowed values for validation
const ALLOWED_RADIUS_KM = [1, 3, 5, 10] as const;
const ALLOWED_SINCE_HOURS = [24, 72, 168] as const;

interface UseFeedIncidentsOptions {
  radiusKm?: number;
  sinceHours?: number;
  cityFallback?: { lat: number; lng: number } | null;
}

export function useFeedIncidents(options: UseFeedIncidentsOptions = {}) {
  // Validate and use provided values or defaults
  const radiusKm = ALLOWED_RADIUS_KM.includes(options.radiusKm as any) 
    ? options.radiusKm! 
    : DEFAULT_RADIUS_KM;
  const sinceHours = ALLOWED_SINCE_HOURS.includes(options.sinceHours as any) 
    ? options.sinceHours! 
    : DEFAULT_SINCE_HOURS;
  
  const qc = useQueryClient();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const currentLocation = useLocationStore(s => s.currentLocation);
  const lastGoodLocation = useLocationStore(s => s.lastGoodLocation);
  const locationStatus = useLocationStore(s => s.locationStatus);
  
  // FIX #1C: Track last fetched query key to prevent refetch on GPS jitter or unchanged params
  // Key includes lat+lng+radiusKm+sinceHours so any of these changing triggers a fresh fetch
  const lastFetchedKeyRef = useRef<string | null>(null);

  // Subscribe to cache updates for nearby queries
  useEffect(() => {
    const unsub = qc.getQueryCache().subscribe((event) => {
      const q = event?.query;
      if (!q) return;
      
      // Check if query key starts with nearby prefix
      const keyStr = Array.isArray(q.queryKey) ? q.queryKey[0] : q.queryKey;
      if (typeof keyStr === 'string' && keyStr === NEARBY_KEY_PREFIX) {
        // When real data comes in, replace optimistic incidents
        const newIncidents = itemsFromAnyPayload(q.state.data);
        setIncidents(prev => {
          // Find temp/optimistic incidents that are being replaced
          const tempIds = prev.filter(inc => inc.id.startsWith('temp_')).map(inc => inc.id);
          
          // Clear those from sessionStorage (real data has arrived)
          tempIds.forEach(tempId => {
            removeOptimisticFromStorage(tempId);
            console.log("[useFeedIncidents] Cleared optimistic from storage:", tempId);
          });
          
          // Remove any temp/optimistic incidents that are now confirmed
          const filtered = prev.filter(inc => !inc.id.startsWith('temp_'));
          // Merge new incidents (avoids duplicates by id)
          const existingIds = new Set(newIncidents.map((i: Incident) => i.id));
          const keep = filtered.filter(inc => !existingIds.has(inc.id));
          return [...newIncidents, ...keep];
        });
      }
    });
    return () => { unsub?.(); };
  }, [qc]);

  // Listen for optimistic incident events (immediate marker appearance)
  useEffect(() => {
    const handler = (e: CustomEvent<OptimisticIncidentEvent>) => {
      const { tempId, lat, lng, severity, type, title, description } = e.detail;
      const createdAt = new Date().toISOString();
      
      // Add optimistic incident immediately for instant marker rendering
      const optimisticIncident: Incident = {
        id: tempId,
        title,
        description,
        type,
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
        latitude: String(lat),
        longitude: String(lng),
        lat,
        lng,
        createdAt,
        isOptimistic: true,
      };
      
      // PERSIST to sessionStorage so it survives navigation
      saveOptimisticToStorage({
        id: tempId,
        lat,
        lng,
        severity,
        type,
        title,
        description,
        createdAt,
      });
      
      setIncidents(prev => [optimisticIncident, ...prev]);
      console.log("[useFeedIncidents] Added optimistic incident and saved to storage:", tempId);
    };
    
    window.addEventListener("nn:incident:local", handler as EventListener);
    return () => window.removeEventListener("nn:incident:local", handler as EventListener);
  }, []);

  // Read initial data from cache AND hydrate optimistic incidents from sessionStorage
  useEffect(() => {
    // First, hydrate any pending optimistic incidents from sessionStorage
    // This ensures markers survive navigation
    const storedOptimistic = loadOptimisticFromStorage();
    if (storedOptimistic.length > 0) {
      const hydratedIncidents: Incident[] = storedOptimistic.map(stored => ({
        id: stored.id,
        title: stored.title,
        description: stored.description,
        type: stored.type,
        severity: stored.severity as 'low' | 'medium' | 'high' | 'critical',
        latitude: String(stored.lat),
        longitude: String(stored.lng),
        lat: stored.lat,
        lng: stored.lng,
        createdAt: stored.createdAt,
        isOptimistic: true,
      }));
      setIncidents(prev => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(i => i.id));
        const toAdd = hydratedIncidents.filter(i => !existingIds.has(i.id));
        if (toAdd.length > 0) {
          console.log("[useFeedIncidents] Hydrated optimistic incidents from storage:", toAdd.map(i => i.id));
          return [...toAdd, ...prev];
        }
        return prev;
      });
    }
    
    // Then read from cache
    const queries = qc.getQueryCache().findAll({
      predicate: (query) => {
        const keyStr = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
        return typeof keyStr === 'string' && keyStr === NEARBY_KEY_PREFIX;
      }
    });
    
    if (queries.length > 0 && queries[0].state.data) {
      const cachedIncidents = itemsFromAnyPayload(queries[0].state.data);
      setIncidents(prev => {
        // Merge cached data with any optimistic incidents, avoiding duplicates
        const existingIds = new Set(prev.map(i => i.id));
        const toAdd = cachedIncidents.filter((i: Incident) => !existingIds.has(i.id));
        return [...prev, ...toAdd];
      });
    }
  }, [qc]);

  // FIX #1C: Compute quantized GPS location to prevent GPS jitter from triggering refetches
  const quantizedLocation = useMemo(() => {
    const raw = pickQueryLocation({ currentLocation, lastGoodLocation });
    if (!raw) return null;
    return {
      lat: quantizeCoord(raw.lat, 3),
      lng: quantizeCoord(raw.lng, 3)
    };
  }, [currentLocation, lastGoodLocation]);

  // When GPS is unavailable, use the provided city fallback coords
  const cityFallbackQuantized = useMemo(() => {
    if (quantizedLocation || !options.cityFallback) return null;
    return {
      lat: quantizeCoord(options.cityFallback.lat, 3),
      lng: quantizeCoord(options.cityFallback.lng, 3),
    };
  }, [quantizedLocation, options.cityFallback?.lat, options.cityFallback?.lng]);

  // The effective location used for fetching: GPS if available, city fallback otherwise
  const effectiveLocation = quantizedLocation ?? cityFallbackQuantized;
  const isCityFallback = !quantizedLocation && !!cityFallbackQuantized;

  // Fetch incidents when we have a valid location (GPS or city fallback)
  // FIX: Only skip refetch when the composite key (lat+lng+radius+since) is unchanged
  //      to prevent GPS jitter while still allowing filter-driven refetches
  useEffect(() => {
    if (!effectiveLocation) {
      console.log("[useFeedIncidents] No valid location available, skipping fetch");
      return;
    }
    
    // Build composite fetch key — includes all query params so filter changes trigger re-fetch
    const fetchKey = `${effectiveLocation.lat},${effectiveLocation.lng},${radiusKm},${sinceHours}`;
    
    // Skip if we already fetched with this exact set of parameters
    if (lastFetchedKeyRef.current === fetchKey) {
      return;
    }
    
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          lat: String(effectiveLocation.lat),
          lng: String(effectiveLocation.lng),
          radiusKm: String(radiusKm),
          sinceHours: String(sinceHours)
        });
        console.log("[useFeedIncidents] Fetching with location:", effectiveLocation, isCityFallback ? "(city fallback)" : "(GPS)", "radius:", radiusKm, "since:", sinceHours);
        const res = await fetch(`/api/incidents/nearby?${params}`, { credentials: 'include' });
        const payload = await res.json();
        const items = itemsFromAnyPayload(payload);
        if (!cancelled) {
          lastFetchedKeyRef.current = fetchKey;
          if (items.length > 0) {
            setIncidents(prev => {
              // Keep any still-pending optimistic incidents, merge with real server data
              const optimistic = prev.filter(i => i.id.startsWith('temp_') || i.isOptimistic);
              const realIds = new Set(items.map((i: Incident) => i.id));
              const keepOptimistic = optimistic.filter(o => !realIds.has(o.id));
              return [...keepOptimistic, ...items];
            });
            qc.setQueryData([NEARBY_KEY_PREFIX, effectiveLocation.lat, effectiveLocation.lng, radiusKm, sinceHours], payload);
          }
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [qc, effectiveLocation?.lat, effectiveLocation?.lng, radiusKm, sinceHours]);

  // ── Real-time: socket listener for other users' incidents ─────────────────
  // Subscribes to incident:created socket events. Guards:
  //   • valid coordinates on the incoming payload
  //   • haversine distance check against current user location + radiusKm
  //   • dedup by ID (prevents duplicates from race with background poll)
  //   • optimistic reconciliation: replaces a matching temp_ incident if found
  // Re-registers only when radiusKm changes (distance check uses it).
  useEffect(() => {
    const unsubscribe = socketService.on('incident:created', (raw: any) => {
      if (!raw?.id) return;

      const incLat = parseFloat(raw.latitude ?? raw.lat ?? '');
      const incLng = parseFloat(raw.longitude ?? raw.lng ?? '');
      if (!Number.isFinite(incLat) || !Number.isFinite(incLng)) return;

      // Distance check — read store directly (safe in callback, not a hook call)
      const locState = useLocationStore.getState();
      const userLoc = pickQueryLocation({
        currentLocation: locState.currentLocation,
        lastGoodLocation: locState.lastGoodLocation,
      });
      if (!userLoc) return;
      if (haversineKm(userLoc.lat, userLoc.lng, incLat, incLng) > radiusKm) return;

      const incoming: Incident = {
        id: raw.id,
        title: raw.title || '',
        description: raw.description || '',
        type: raw.type || 'safety_alert',
        severity: (raw.severity as Incident['severity']) || 'medium',
        latitude: String(incLat),
        longitude: String(incLng),
        lat: incLat,
        lng: incLng,
        createdAt: raw.createdAt || new Date().toISOString(),
      };

      setIncidents(prev => {
        // Already present — no change
        if (prev.some(i => i.id === incoming.id)) return prev;
        // Replace matching optimistic temp incident if it exists
        const withoutTemp = prev.filter(i =>
          !(i.id.startsWith('temp_') &&
            i.type === incoming.type &&
            Math.abs((i.lat ?? 0) - incLat) < 0.001 &&
            Math.abs((i.lng ?? 0) - incLng) < 0.001)
        );
        return [incoming, ...withoutTemp];
      });

      console.log('[useFeedIncidents] Real-time incident added via socket:', raw.id);
    });

    return () => { unsubscribe?.(); };
  }, [radiusKm]); // radiusKm is the only value used from hook scope (distance check)

  // ── Background poll every 90 s ────────────────────────────────────────────
  // Safety net for: missed socket events, tab left open, app returning from
  // background. Silent — merges server data with any still-pending optimistic
  // incidents, same logic as the main fetch effect.
  // Re-starts the interval whenever location or filters change.
  useEffect(() => {
    if (!effectiveLocation) return;

    const { lat, lng } = effectiveLocation;

    const intervalId = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radiusKm: String(radiusKm),
          sinceHours: String(sinceHours),
        });
        const res = await fetch(`/api/incidents/nearby?${params}`, { credentials: 'include' });
        const payload = await res.json();
        const items = itemsFromAnyPayload(payload);
        if (!items.length) return;

        setIncidents(prev => {
          const optimistic = prev.filter(i => i.id.startsWith('temp_') || i.isOptimistic);
          const realIds = new Set(items.map((i: Incident) => i.id));
          const keepOptimistic = optimistic.filter(o => !realIds.has(o.id));
          return [...keepOptimistic, ...items];
        });

        // Keep React Query cache warm
        qc.setQueryData([NEARBY_KEY_PREFIX, lat, lng, radiusKm, sinceHours], payload);

        console.log('[useFeedIncidents] Background poll refreshed:', items.length, 'incidents');
      } catch {
        /* silent — background poll must never surface errors to the user */
      }
    }, 90_000);

    return () => clearInterval(intervalId);
  }, [effectiveLocation?.lat, effectiveLocation?.lng, radiusKm, sinceHours, qc]);

  const count = incidents.length;
  const hasValidLocation = locationStatus === 'ok' || locationStatus === 'stale' || !!quantizedLocation;
  const hasAnyLocation = !!effectiveLocation;
  
  return useMemo(() => ({ incidents, count, hasValidLocation, hasAnyLocation, isCityFallback, locationStatus }), 
    [incidents, count, hasValidLocation, hasAnyLocation, isCityFallback, locationStatus]);
}
