import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// 🔒 NRP Guardrails
const NRP_FIX_ZOOM = true;
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import MapView from '../../components/MapView';
import FallbackMap from '../../components/FallbackMap';
import IncidentSheet from '../../components/IncidentSheet';
import { Severity } from '../../lib/severity';
import useLeafletBounds from '../../hooks/useLeafletBounds';
import { socketService } from '../../lib/socketService';
import { geolocationService, type LocationData, type GeolocationError } from '../../lib/geolocationService';
import { getCityCoordinates } from '../../lib/locationCoordinates';
import { useAuthStore } from '../../store/auth';
import { useToast } from '../../hooks/use-toast';
import { useIncidentStore } from '../../state/useIncidentStore';
import { INCIDENT_TYPES } from '@/features/report/incidentTypes';
import type { IncidentMarker as IncidentListMarker } from '../../components/IncidentList';
import IncidentList from '../../components/IncidentList';
import BottomCenterDock from '../../components/BottomCenterDock';
import { useReportPanel } from "@/features/report/useReportPanel";
import ReportPanel from "@/features/report/ReportPanel";
import { useLocationStore } from '@/store/locationStore';
import { LocationRequiredBanner } from '@/components/LocationRequiredBanner';
import { beginLocationPick, emitLocationPicked } from '@/lib/events';
import { useMapPicking } from '@/features/map-picking/useMapPicking';
import { useLocation } from 'wouter';
import { MarkerLegend } from '@/features/map/MarkerLegend';
import { createClusterGroup, getClusterGroup } from '@/features/map/cluster';
import { createIncidentMarker, getMarkerById, markerRegistry } from '@/features/map/createIncidentMarker';
import { getQueryParam } from '@/lib/url';
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { useQuickReportStore } from "@/state/useQuickReportStore";
import { DebugHud } from '@/components/DebugHud';
import { useFeedIncidents } from '@/features/incidents/useFeedIncidents';
import { MAX_STALE_MS } from '@/lib/useDeviceLocation';
import RecentIncidentsPanel from '@/features/map/RecentIncidentsPanel';
import L from 'leaflet';
import "leaflet.markercluster";

const MIN_SELECT_ZOOM = 15;

// Debounced panning to prevent spam when user taps multiple rows quickly
let panTimeout: any;
function debouncedCenterTo(map: L.Map | null, lat: number, lng: number, minZoom = 15) {
  if (!map) return;
  clearTimeout(panTimeout);
  panTimeout = setTimeout(() => {
    try {
      map.setView([lat, lng], Math.max(minZoom, map.getZoom()), { animate: true });
    } catch (error) {
      // Ignore panning errors
    }
  }, 60);
}
import { 
  MapPin, 
  AlertTriangle, 
  Eye, 
  Calendar,
  Navigation,
  Clock,
  Loader2,
  Target,
} from 'lucide-react';
import { ReportFab } from '../../components/shared/ReportFab';

interface IncidentMarker {
  id: string;
  type: 'crime' | 'safety_alert' | 'suspicious' | 'emergency';
  position: { lat: number; lng: number };
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeAgo: string;
  verified: boolean;
  reports: number;
  accuracy_m?: number;
  created_at?: number;
}

// Helper functions
const mapIncidentTypeToMarkerType = (type: string): 'crime' | 'safety_alert' | 'suspicious' | 'emergency' => {
  switch (type) {
    case 'car_accident':
    case 'hit_and_run':
    case 'violence_fight':
      return 'crime';
    case 'emergency_alarm':
    case 'fire_emergency':
    case 'sos_need_help':
      return 'emergency';
    case 'break_in_burglary':
    case 'suspicious_person':
      return 'suspicious';
    default:
      return 'safety_alert';
  }
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Transform marker data for MapView component
const transformMarkersForMap = (markers: IncidentMarker[]) => {
  return markers.map(marker => ({
    id: marker.id,
    lat: marker.position.lat,
    lng: marker.position.lng,
    type: marker.type,
    title: marker.title,
    description: marker.description,
    timestamp: marker.timeAgo,
    category: marker.category,
    severity: marker.severity
  }));
};

// Helper function to wire bbox updates to store
const wireBBox = (map: L.Map) => {
  let timeout: any;
  
  const updateBBox = () => {
    try {
      // Check if map is ready and loaded
      if (!(map as any)._loaded) return;
      
      const bounds = map.getBounds();
      if (!bounds) return;
      
      useIncidentStore.getState().setBBox({ 
        north: bounds.getNorth(), 
        south: bounds.getSouth(), 
        east: bounds.getEast(), 
        west: bounds.getWest() 
      });
    } catch (error) {
      // Swallow transient errors during init
    }
  };
  
  const debouncedUpdate = () => { 
    clearTimeout(timeout); 
    timeout = setTimeout(updateBBox, 180); 
  };

  map.whenReady(updateBBox);
  map.on("load", debouncedUpdate);
  map.on("moveend", debouncedUpdate);
  map.on("zoomend", debouncedUpdate);
  
  return () => {
    clearTimeout(timeout);
    map.off("load", debouncedUpdate);
    map.off("moveend", debouncedUpdate);
    map.off("zoomend", debouncedUpdate);
  };
};

export default function CommunityMap() {
  const [location] = useLocation();
  const [markers, setMarkers] = useState<IncidentMarker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<IncidentMarker | null>(null);
  const [mapError, setMapError] = useState(false);
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false);
  const [isIncidentsOpen] = useState(true);
  const [isIncidentSheetOpen, setIsIncidentSheetOpen] = useState(false);
  
  // ✅ Use shared hook for consistent data with Feed
  const [mapReady, setMapReady] = useState(false);
  const { incidents, count } = useFeedIncidents();
  const lastEventAtRef = useRef(Date.now()); // Fixed: moved from setupRealtimeAndWatchdog to avoid hook rules violation
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Log for debugging
  useEffect(() => {
    console.log('[Map] Feed incidents synced:', incidents.length);
    console.log("[Map] sample incident", incidents?.[0]);
    console.log("[Map] keys", incidents?.[0] && Object.keys(incidents[0]));
  }, [incidents.length]);
  
  // Report panel integration
  const { openWith } = useReportPanel();
  const { setRefinedCoords } = useLocationStore();
  
  // Desktop tap-to-report functionality
  const isDesktop = useIsDesktop();
  const {
    isOpen: sheetOpen,
    reportMode,
    pendingReportMode,
    confirmTempPin,
    cancelReportMode,
    consumePendingReportMode,
    open: openQuickReport,
    startReportMode,
  } = useQuickReportStore();
  
  // Map picking functionality
  const { Overlay, GhostMarker, Footer } = useMapPicking({ mapRef, containerRef: mapContainerRef });

  // Use store for filters and selection
  const { 
    selectedId, 
    setSelectedId, 
    severity, 
    setSeverity, 
    timeRange, 
    setTimeRange,
    inViewOnly,
    toggleInViewOnly,
    bbox 
  } = useIncidentStore();
  
  
  // Function to handle incident click and zoom to location
  const handleIncidentZoom = (marker: IncidentMarker) => {
    // Set selected marker first for immediate display
    setSelectedMarker(marker);
    
    // IncidentMarker always has position.lat/lng
    const lat = marker.position?.lat;
    const lng = marker.position?.lng;
    
    if (lat !== undefined && lng !== undefined) {
      // Use debounced panning for smooth experience
      debouncedCenterTo(mapRef.current, lat, lng, MIN_SELECT_ZOOM);
    }
  };

  const { user } = useAuthStore();
  const { toast } = useToast();
  
  // Wire bbox updates to store when map is ready with stronger guards
  useEffect(() => {
    const map = mapRef.current;
    if (map && (map._loaded || map.getBounds)) {
      try {
        const cleanup = wireBBox(map);
        return cleanup;
      } catch (error) {
        // Ignore bbox wiring errors on slow devices
      }
    }
  }, [mapRef.current, mapRef.current?._loaded]);

  // 🔒 NRP: Memoize map center using the robust location service
  // PATCH B: Use location store instead of hardcoded Windhoek default
  const currentLocation = useLocationStore(state => state.currentLocation);
  const lastGoodLocation = useLocationStore(state => state.lastGoodLocation);
  const locationStatus = useLocationStore(state => state.locationStatus);
  
  // FAIL-LOUD: Check for explicit URL focus params (focus=incidentId or lat/lng params)
  const urlFocusCenter = useMemo((): [number, number] | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const focusLat = Number(urlParams.get('lat'));
    const focusLng = Number(urlParams.get('lng'));
    const focusId = urlParams.get('focus') || urlParams.get('incident');
    
    // If explicit lat/lng in URL, use those
    if (Number.isFinite(focusLat) && Number.isFinite(focusLng) && 
        focusLat !== 0 && focusLng !== 0 &&
        Math.abs(focusLat) <= 90 && Math.abs(focusLng) <= 180) {
      return [focusLng, focusLat]; // MapView expects [lng, lat]
    }
    
    // If focus ID present, we'll let the incident focus handler deal with it
    // but signal that we have an explicit navigation intent
    if (focusId) {
      return null; // Will be handled by focus effect, but we know nav is explicit
    }
    
    return null;
  }, []);
  
  const hasFocusParam = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!(urlParams.get('focus') || urlParams.get('incident') || 
              (urlParams.get('lat') && urlParams.get('lng')));
  }, []);
  
  const mapCenter = useMemo((): [number, number] | null => {
    // First priority: Explicit URL params (for post-incident navigation)
    if (urlFocusCenter) {
      return urlFocusCenter;
    }
    
    // Second priority: Current GPS location
    if (currentLocation?.latitude && currentLocation?.longitude) {
      return [currentLocation.longitude, currentLocation.latitude];
    }
    
    // Third priority: Last good location (within 7-day stale window)
    if (lastGoodLocation) {
      const now = Date.now();
      if (now - lastGoodLocation.timestamp <= MAX_STALE_MS) {
        return [lastGoodLocation.lng, lastGoodLocation.lat];
      }
    }
    
    // Fourth priority: User's city setting
    if (user && user.city) {
      const coordinates = getCityCoordinates(user.city);
      if (coordinates) {
        return [coordinates[1], coordinates[0]]; // MapView expects [lng, lat]
      }
    }
    
    // Final fallback: Windhoek default
    return [17.0658, -22.5597];
  }, [user?.city, currentLocation, lastGoodLocation, urlFocusCenter]);
  
  // FAIL-LOUD: Determine if we can render the map
  // Either we have valid location data OR we have explicit focus params (incident ID will center later)
  const hasValidMapCenter = mapCenter !== null || hasFocusParam;

  // Add error boundary for map
  useEffect(() => {
    const handleError = () => setMapError(true);
    window.addEventListener('unhandledrejection', handleError);
    return () => window.removeEventListener('unhandledrejection', handleError);
  }, []);
  
  // Location refinement event handler
  useEffect(() => {
    const handler = () => {
      // Enable map's pin placement mode
      const handleMapClick = (e: any) => {
        if (e.latlng) {
          const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
          setRefinedCoords(coords);
          
          // Dispatch return event so ReportPanel updates
          emitLocationPicked(coords.lat, coords.lng);
          
          // Remove the click handler after first use
          if (mapRef.current) {
            mapRef.current.off('click', handleMapClick);
            // Reset cursor
            if (mapRef.current.getContainer) {
              mapRef.current.getContainer().style.cursor = '';
            }
          }
          
          // Show toast confirmation
          toast({
            title: "Location set",
            description: `Pin placed at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          });
        }
      };
      
      if (mapRef.current) {
        mapRef.current.on('click', handleMapClick);
        // Change cursor to crosshair
        if (mapRef.current.getContainer) {
          mapRef.current.getContainer().style.cursor = 'crosshair';
        }
      }
    };
    
    window.addEventListener("nn:begin-location-pick", handler);
    return () => window.removeEventListener("nn:begin-location-pick", handler);
  }, [setRefinedCoords, toast]);

  // Delegated click handler for "Show on map" buttons inside Leaflet popups.
  // Closes the popup and smoothly pans the in-app Leaflet map to the incident.
  // Bound to document to work regardless of which mapContainerRef node is active.
  useEffect(() => {
    const handleNavigateClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("[data-navigate-lat]") as HTMLElement | null;
      if (!btn) return;
      const lat = parseFloat(btn.dataset.navigateLat ?? "");
      const lng = parseFloat(btn.dataset.navigateLng ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        e.stopPropagation();
        const map: L.Map | undefined = (window as any).__nnMap;
        if (map) {
          map.closePopup();
          map.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
        }
      }
    };

    document.addEventListener("click", handleNavigateClick, true);
    return () => document.removeEventListener("click", handleNavigateClick, true);
  }, []);

  // Listen for incident deletion events dispatched by IncidentCard.
  // Removes the marker from the cluster and registry immediately.
  useEffect(() => {
    const handleDeleted = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      const marker = markerRegistry.get(id);
      if (marker) {
        const cluster = getClusterGroup();
        if (cluster) cluster.removeLayer(marker);
        markerRegistry.delete(id);
      }
      setMarkers((prev) => prev.filter((m) => m.id !== id));
    };
    window.addEventListener('nn:incident:deleted', handleDeleted);
    return () => window.removeEventListener('nn:incident:deleted', handleDeleted);
  }, []);

  const dblStateRef = useRef<boolean | null>(null);
  
  // Listen for local incident events and auto-pan to new points
  useEffect(() => {
    function onLocalIncident(e: CustomEvent<{
      tempId: string; lat: number; lng: number; severity: string;
    }>) {
      const { tempId, lat, lng, severity } = e.detail;
      const map = mapRef.current;
      if (!map) return;
      
      // draw the dot immediately
      (window as any).__nnSimpleDot?.(tempId, lat, lng, severity);
      // pan the map so it's in view (ensures bbox includes it)
      map.panTo([lat, lng], { animate: true });
    }
    
    const localHandler = (e: any) => onLocalIncident(e as any);
    window.addEventListener("nn:incident:local", localHandler as any);
    return () => window.removeEventListener("nn:incident:local", localHandler as any);
  }, []);

  // ⬇️ NEW: map click → set pin when in report mode (desktop flow)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // preserve prior dbl-click zoom state
    if (dblStateRef.current === null) {
      dblStateRef.current = map.doubleClickZoom.enabled();
    }
    if (reportMode) map.doubleClickZoom.disable();
    else if (dblStateRef.current) map.doubleClickZoom.enable();
    
    function onClick(e: L.LeafletMouseEvent) {
      if (!reportMode) return;
      confirmTempPin({ lat: e.latlng.lat, lng: e.latlng.lng });
      window.dispatchEvent(new CustomEvent("nn.analytics", { detail: { event: "report_pin_set" }}));
    }
    
    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [reportMode, confirmTempPin]);

  // auto-cancel if viewport becomes non-desktop mid-flow
  useEffect(() => {
    if (!isDesktop && reportMode) cancelReportMode();
  }, [isDesktop, reportMode, cancelReportMode]);

  // when user queued "Drop a pin", wait until the sheet is closed, then enter report mode
  useEffect(() => {
    if (!sheetOpen && pendingReportMode) {
      startReportMode();
      consumePendingReportMode();
    }
  }, [sheetOpen, pendingReportMode, startReportMode, consumePendingReportMode]);

  // ⬇️ NEW: ESC to cancel report mode on desktop
  useEffect(() => {
    if (!isDesktop || !reportMode) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelReportMode();
    };
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop, reportMode, cancelReportMode]);


  // 2) When map becomes ready or incidents change, sync markers to map
  useEffect(() => {
    console.log(`[Map] useEffect trigger - mapReady: ${mapReady}, mapRef: ${!!mapRef.current}, incidents: ${incidents.length}`);
    if (!mapReady) return;
    
    // Give mapRef a moment to be set after onMapReady
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) {
        console.log("[Map] mapRef still null after timeout, skipping marker addition");
        return;
      }
      const map = mapRef.current;
      console.log("Map ready, adding", incidents.length, "incidents to map");
      addIncidentsToMap(map, incidents);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [mapReady, incidents]);

  // 2b) When active filters change, re-sync the cluster layer with filtered markers only
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!markers.length) return;
    const map = mapRef.current;
    const cluster = createClusterGroup();
    
    // Clear and re-add only the filtered set so filter changes are reflected immediately
    cluster.clearLayers();
    
    filteredMarkers.forEach((marker) => {
      const lat = Number(marker.position?.lat);
      const lng = Number(marker.position?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      
      createIncidentMarker({
        id: marker.id,
        type: marker.type,
        lat,
        lng,
        description: marker.description,
        severity: marker.severity,
        target: cluster,
      });
    });
    
    if (!map.hasLayer(cluster)) {
      map.addLayer(cluster);
    }
    
    console.log(`[Map] Filter sync: rendered ${filteredMarkers.length} markers (severity: ${severity}, timeRange: ${timeRange})`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, severity, timeRange, inViewOnly, markers]);

  // 3) Setup real-time updates and bbox watchdog once map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    setupRealtimeAndWatchdog(map);
  }, [mapReady, toast]);

  const addIncidentsToMap = (map: L.Map, incidentList: any[]) => {
    if (!incidentList?.length) return;
    
    // 1) ensure cluster layer exists and is added
    const cluster = createClusterGroup();
    if (!map.hasLayer(cluster)) {
      map.addLayer(cluster);
    }

    // 2) Add incidents to cluster with proper coordinate validation
    let withCoords = 0;
    let missingOrInvalid = 0;
    
    incidentList.forEach((inc: any) => {
      const lat = Number(inc.latitude);
      const lng = Number(inc.longitude);
      
      // Sanity bounds check: -90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180
      if (Number.isFinite(lat) && Number.isFinite(lng) && 
          Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        withCoords++;
        
        // Add severity dot if system is available
        if ((window as any).__nnSimpleDots?.add) {
          (window as any).__nnSimpleDots.add(
            inc.id,
            lat,
            lng,
            inc.severity || "low"
          );
        }

        createIncidentMarker({
          id: inc.id,
          type: inc.type, // Use actual incident type, not generic mapping
          lat,
          lng,
          description: inc.description,
          severity: inc.severity,
          target: cluster,
        });
      } else {
        missingOrInvalid++;
      }
    });
    
    // Log counters once
    console.log(`[Map] markers -> with: ${withCoords}, skipped: ${missingOrInvalid}`);

    // Transform markers for state using same coordinate validation
    const transformedMarkers = incidentList.map((incident: any) => {
      const lat = Number(incident.latitude);
      const lng = Number(incident.longitude);
      
      return {
        id: incident.id,
        type: incident.type as 'crime' | 'safety_alert' | 'suspicious' | 'emergency', // Keep original type
        position: { lat, lng },
        title: incident.title || incident.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: incident.description || 'No description provided',
        category: incident.category || incident.type.replace(/_/g, ' '),
        severity: incident.severity || 'medium' as const,
        timeAgo: formatTimeAgo(incident.createdAt || incident.created_at || Date.now()),
        verified: incident.verified || false,
        reports: incident.reports || 1,
        accuracy_m: incident.accuracy_m,
        created_at: incident.createdAt || incident.created_at || Date.now(),
        photos: incident.photos || []
      };
    }).filter((marker: IncidentMarker) => {
      const hasValidCoords = Number.isFinite(marker.position.lat) && Number.isFinite(marker.position.lng) &&
                             Math.abs(marker.position.lat) <= 90 && Math.abs(marker.position.lng) <= 180;
      return hasValidCoords;
    });
    
    setMarkers(transformedMarkers);
  };

  const setupRealtimeAndWatchdog = (map: L.Map) => {
    // ✅ Register window bridge for socket service real-time updates
    (window as any).__nnAddIncident = (inc: any) => {
      if (!mapRef.current) return;
      const cluster = createClusterGroup();
      if (!mapRef.current.hasLayer(cluster)) {
        mapRef.current.addLayer(cluster);
      }
      const lat = parseFloat(inc.latitude ?? inc.lat);
      const lng = parseFloat(inc.longitude ?? inc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      
      console.log(`[Real-time] Adding incident ${inc.id} of type ${inc.type} at ${lat}, ${lng}`);
      createIncidentMarker({
        id: inc.id,
        type: inc.type, // Use actual incident type
        lat,
        lng,
        description: inc.description,
        severity: inc.severity,
        target: cluster,
      });
    };
    
    // Setup real-time incident updates with optimistic reconciliation
    const handleNewIncident = (incident: any) => {
      // First, handle optimistic reconciliation - Fixed: use getState() instead of hook
      const incidentState = useIncidentStore.getState();
      const tempIncident = incidentState.incidents.find(i =>
        i.id.startsWith("temp-") &&
        i.type === incident.type &&
        Math.hypot((i.lat ?? 0) - (parseFloat(incident.latitude || incident.lat || 0)), (i.lng ?? 0) - (parseFloat(incident.longitude || incident.lng || 0))) < 0.0007
      );
      
      if (tempIncident) {
        // Reconcile optimistic update
        incidentState.reconcileIncident(tempIncident.id, {
          id: incident.id,
          type: incident.type,
          status: incident.status || "pending",
          lat: parseFloat(incident.latitude || incident.lat || 0),
          lng: parseFloat(incident.longitude || incident.lng || 0),
          createdAt: incident.createdAt || new Date().toISOString(),
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          isAnonymous: incident.isAnonymous
        });
      } else {
        // Add fresh incident from other users
        incidentState.addIncident({
          id: incident.id,
          type: incident.type,
          status: incident.status || "pending",
          lat: parseFloat(incident.latitude || incident.lat || 0),
          lng: parseFloat(incident.longitude || incident.lng || 0),
          createdAt: incident.createdAt || new Date().toISOString(),
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          isAnonymous: incident.isAnonymous
        });
      }
      
      // Also update the map markers for display
      const newMarker: IncidentMarker = {
        id: incident.id,
        type: incident.type as 'crime' | 'safety_alert' | 'suspicious' | 'emergency', // Keep original type
        position: { 
          lat: parseFloat(incident.latitude || incident.lat || 0),
          lng: parseFloat(incident.longitude || incident.lng || 0)
        },
        title: incident.title || incident.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: incident.description || 'No description provided',
        category: incident.category || incident.type.replace(/_/g, ' '),
        severity: incident.severity || 'medium' as const,
        timeAgo: 'Just now',
        verified: incident.verified || false,
        reports: incident.reports || 1,
        accuracy_m: incident.accuracy_m,
        created_at: incident.createdAt || incident.created_at || Date.now()
      };

      setMarkers(prev => {
        // Avoid duplicates if already exists
        const exists = prev.find(m => m.id === incident.id);
        return exists ? prev : [newMarker, ...prev];
      });
      
      // Only toast for incidents from other users (not our own optimistic ones)
      if (!tempIncident) {
        toast({
          title: "New Incident Reported",
          description: `${newMarker.title} - ${newMarker.description.substring(0, 50)}${newMarker.description.length > 50 ? '...' : ''}`,
        });
      }
    };

    const unsubscribe = socketService.on('incident:created', (incident: any) => {
      console.debug("[socket] incident:new", incident.id, incident.type);
      lastEventAtRef.current = Date.now(); // Update watchdog
      handleNewIncident(incident);
      
      // Real-time marker handled by window.__nnAddIncident bridge (registered above)
    });

    // Watchdog: backup fetch if sockets are quiet for 15s
    const watchdogInterval = setInterval(async () => {
      if (Date.now() - lastEventAtRef.current <= 15000) return;
      
      const map = mapRef.current;
      if (!map || !map.getBounds) return;
      
      try {
        const b = map.getBounds();
        const url = `/api/incidents?bbox=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&sinceHours=168&limit=300`;
        
        // Use normalized fetcher to handle response shape
        const { fetchIncidentsAny, dedupeById } = await import('@/lib/incidentsApi');
        const newIncidents = await fetchIncidentsAny(url);
        
        if (newIncidents.length) {
          console.log('[Map] Watchdog fetched:', newIncidents.length);
          // Incidents managed via useFeedIncidents hook
        }
        
        lastEventAtRef.current = Date.now();
      } catch (error) {
        console.warn("[watchdog] backfill failed:", error);
      }
    }, 5000);

    return () => {
      unsubscribe?.();
      clearInterval(watchdogInterval);
    };
  };

  // Handle focus and incident parameters for navigation from Feed
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const focusId = urlParams.get('focus');
    const incidentId = urlParams.get('incident');
    const targetId = focusId || incidentId;
    
    console.log("[navigation] Effect running - targetId:", targetId, "markers count:", markers?.length, "mapRef:", !!mapRef.current);
    
    if (!targetId) {
      console.log("[navigation] No target ID found in URL");
      return;
    }
    
    // Wait for both markers AND map to be ready
    if (!markers?.length || !mapRef.current) {
      console.log("[navigation] Waiting... markers:", markers?.length, "map:", !!mapRef.current);
      return;
    }

    // Find the incident & center
    const target = markers.find(i => i.id === targetId);
    console.log("[navigation] Looking for incident:", targetId, "found:", !!target);
    
    if (!target) {
      console.warn("[navigation] Incident not found in markers:", targetId);
      console.log("[navigation] Available marker IDs:", markers.map(m => m.id).slice(0, 10));
      
      // Only cleanup after giving markers time to load (wait at least 2s after map init)
      // This prevents premature cleanup if incident is still being fetched
      return;
    }

    console.log("[navigation] Found target incident:", target);

    // Center and flash the incident
    if (mapRef.current) {
      const lat = target.position?.lat ?? (target as any).lat;
      const lng = target.position?.lng ?? (target as any).lng;
      
      console.log("[navigation] Target coordinates:", { lat, lng });
      
      if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
        // Use maximum zoom level for closest view
        const maxZoom = mapRef.current.getMaxZoom() || 18;
        mapRef.current.setView([lat, lng], maxZoom, { animate: true });
        console.log("[navigation] ✅ Centered on incident:", targetId, "zoom:", maxZoom, "coords:", [lat, lng]);
        
        // If from Feed (incident param), also select and show the incident
        if (incidentId) {
          setSelectedMarker(target);
          setSelectedId(target.id);
          setIsIncidentSheetOpen(true);
          console.log("[navigation] ✅ Opened incident sheet for:", target.title);
        }
        
        // Cleanup querystring ONLY after successful navigation
        setTimeout(() => {
          const u = new URL(window.location.href);
          u.searchParams.delete('focus');
          u.searchParams.delete('incident');
          window.history.replaceState({}, '', u.toString());
          console.log("[navigation] ✅ URL params cleaned up");
        }, 1000);
      } else {
        console.error("[navigation] Invalid coordinates:", { lat, lng });
      }
    }
  }, [markers, mapRef]);

  const getMarkerColor = (type: string, severity: string) => {
    if (type === 'crime') {
      switch (severity) {
        case 'critical': return '#DC2626';
        case 'high': return '#EA580C';
        case 'medium': return '#D97706';
        default: return '#CA8A04';
      }
    }
    if (type === 'safety_alert') return '#2563EB';
    if (type === 'suspicious') return '#7C3AED';
    return '#6B7280';
  };

  const getSeverityBadge = (severity: string) => {
    // Use centralized color system for consistency with Feed and Report pages
    const colors = {
      critical: 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100',
      high: 'bg-red-100 text-red-900 dark:bg-red-800 dark:text-red-100',
      medium: 'bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
      low: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100'
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  const filteredMarkers = markers.filter(marker => {
    // Filter by severity
    if (severity !== 'all' && marker.severity !== severity) {
      return false;
    }
    
    // Filter by map view (bbox) - only if inViewOnly is enabled
    if (inViewOnly && bbox) {
      const { north, south, east, west } = bbox;
      const { lat, lng } = marker.position;
      if (lat > north || lat < south || lng > east || lng < west) {
        return false;
      }
    }
    
    // Filter by time
    if (timeRange !== 'all') {
      const now = Date.now();
      let timeThreshold = now;
      
      if (timeRange === '1hour') {
        timeThreshold = now - (1 * 60 * 60 * 1000);
      } else if (timeRange === '6hours') {
        timeThreshold = now - (6 * 60 * 60 * 1000);
      } else if (timeRange === '12hours') {
        timeThreshold = now - (12 * 60 * 60 * 1000);
      }
      
      // Show incidents within time range, or if no timestamp available
      if (!marker.created_at || marker.created_at === 0) {
        return true; // Show incidents without timestamps
      }
      
      const incidentTime = new Date(marker.created_at).getTime();
      return incidentTime >= timeThreshold;
    }
    
    return true;
  });

  // Map ↔ List sync handler (center + select)
  const handleSelectFromList = useCallback((id: string) => {
    setSelectedId(id);
    const incident = filteredMarkers.find((x) => x.id === id);
    const map = mapRef.current;
    if (!incident || !map || !map.getBounds) return;
    
    try {
      map.setView([incident.position.lat, incident.position.lng], Math.max(MIN_SELECT_ZOOM, map.getZoom()), { animate: true });
      // Also set the selected marker for consistency
      setSelectedMarker(incident);
    } catch (error) {
      // Ignore map positioning errors
    }
  }, [filteredMarkers, setSelectedId, mapRef]);

  // Debug logging
  console.log('Total markers:', markers.length);
  console.log('Filtered markers:', filteredMarkers.length);
  console.log('Active filter:', severity);
  console.log('Time filter:', timeRange);

  const mapMarkers = filteredMarkers.map(marker => ({
    id: marker.id,
    type: marker.type as 'crime' | 'safety_alert' | 'suspicious' | 'emergency',
    position: marker.position,
    title: marker.title,
    data: marker
  }));


  return (
    <>
      {/* =========== MOBILE & TABLET (map as background) =========== */}
      <div 
        ref={mapContainerRef} 
        className="map-shell relative h-[100dvh] w-full overflow-hidden bg-black xl:hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
        }}
      >
        {/* MAP = background - FAIL-LOUD: Only render when we have valid location or focus params */}
        {hasValidMapCenter ? (
          <div className="absolute inset-0 z-0">
            {(() => {
              // When navigating via focus param but no GPS, use Windhoek as temporary center
              // The focus effect will immediately re-center on the target incident
              const safeDefaultCenter = mapCenter || [17.0658, -22.5597] as [number, number];
              
              const mobileMapProps = {
                incidents: transformMarkersForMap(filteredMarkers),
                ...(NRP_FIX_ZOOM 
                  ? { defaultCenter: safeDefaultCenter }
                  : { }  // C) Remove center prop completely when using NRP_FIX_ZOOM
                ),
                ...(NRP_FIX_ZOOM 
                  ? { defaultZoom: user && user.city ? 13 : 11 }
                  : { zoom: user && user.city ? 13 : 11 }
                ),
                className: "w-full h-full",
                mapRef: mapRef,
                onMapReady: () => setMapReady(true),
                onIncidentClick: (marker: any) => {
                  handleIncidentZoom(marker);
                  setIsIncidentSheetOpen(true);
                }
              };
              
              // C) Destructure key to avoid spreading warning
              const mobileKey = "map-mobile-background"; // C) Stabilize key
              
              console.log("[Mobile] Render MapView props", {
                hasCenter: "center" in mobileMapProps, 
                center: (mobileMapProps as any).center, 
                defaultCenter: (mobileMapProps as any).defaultCenter,
                hasZoom: "zoom" in mobileMapProps,
                defaultZoom: (mobileMapProps as any).defaultZoom,
                key: mobileKey,
                incidentsCount: mobileMapProps.incidents.length
              });
              console.log("[Mobile] incidents count:", mobileMapProps.incidents.length);
              
              return <MapView key={mobileKey} {...mobileMapProps} />;
            })()}
            {/* Marker Legend - Mobile */}
            <MarkerLegend />
          </div>
        ) : (
          /* FAIL-LOUD: No valid location and no focus params - show location required UI */
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-zinc-900">
            <div className="p-6 max-w-md text-center">
              <LocationRequiredBanner />
              <p className="mt-4 text-sm text-zinc-400">
                Enable location access to view incidents near you, or navigate here from a specific incident.
              </p>
            </div>
          </div>
        )}

        {/* PICKING UI LAYER - only show when map is available */}
        {hasValidMapCenter && (
          <>
            <GhostMarker />
            <Overlay />
            <Footer />
          </>
        )}
        
        {/* UI LAYER (floats above map) */}
        <div className="absolute inset-0 z-20 pointer-events-none">

          {/* Desktop: Report button (top-right) */}
          {isDesktop && (
            <div className="absolute top-3 right-3 z-[100] pointer-events-none">
              <div className="pointer-events-auto">
                <Button
                  size="lg"
                  data-testid="button-report-desktop"
                  className="bg-blue-500 text-white shadow-xl hover:bg-blue-400 active:scale-95 transition-all duration-150"
                  onClick={() => {
                    const desktopTapEnabled = import.meta.env.VITE_DESKTOP_TAP_TO_REPORT !== 'false';
                    startReportMode();
                    window.dispatchEvent(new CustomEvent("nn.analytics", { detail: { event: "report_open", mode: "desktop" }}));
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Report
                </Button>
              </div>
            </div>
          )}

          {/* Mobile: Report FAB (bottom-right) */}
          {!isDesktop && (
            <ReportFab onClick={() => {
              const defaultType = INCIDENT_TYPES.find(t => t.id === "help") || INCIDENT_TYPES[0];
              openWith(defaultType);
              window.dispatchEvent(new CustomEvent("nn.analytics", { detail: { event: "report_open", mode: "mobile" }}));
              console.debug("[analytics]", "report_start", { type: defaultType.id, source: "map_fab" });
            }} />
          )}
          
          {/* Bottom-center utility dock */}
          <BottomCenterDock
            onLocate={() => {
              if (mapCenter) {
                debouncedCenterTo(mapRef.current, mapCenter[1], mapCenter[0], 13);
              }
            }}
            onToggleList={() => setIsIncidentSheetOpen(true)}
            hidden={isIncidentSheetOpen}
          />
        </div>

        {/* Bottom sheet overlay */}
        <IncidentSheet
          open={isIncidentSheetOpen}
          onOpenChange={setIsIncidentSheetOpen}
          items={incidents.map(incident => ({
            id: incident.id,
            type: incident.type as "crime" | "safety_alert" | "suspicious" | "emergency",
            title: incident.title,
            description: incident.description,
            severity: incident.severity as "low" | "medium" | "high" | "emergency",
            created_at: new Date(incident.createdAt).getTime(),
            position: { 
              lat: incident.lat ?? Number(incident.latitude) ?? 0, 
              lng: incident.lng ?? Number(incident.longitude) ?? 0 
            }
          }))}
          onSelect={(id) => {
            handleSelectFromList(id);
          }}
        />
      </div>

      {/* =========== DESKTOP (keep existing) =========== */}
      <div className="hidden xl:block min-h-screen bg-background dark:bg-background">
        <div className="max-w-7xl mx-auto p-4">
        {/* Controls - Desktop only, mobile uses sheet filters */}
        <div className="hidden md:flex flex-wrap items-center gap-2 mb-6">
          <Button 
            variant={severity === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSeverity('all')}
            data-testid="filter-all"
          >
            All incidents
          </Button>
          <Button 
            variant={severity === 'high' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSeverity('high')}
            data-testid="filter-high"
          >
            High
          </Button>
          <Button 
            variant={severity === 'medium' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSeverity('medium')}
            data-testid="filter-medium"
          >
            Medium
          </Button>
          <Button 
            variant={severity === 'low' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setSeverity('low')}
            data-testid="filter-low"
          >
            Low
          </Button>
          
          <div className="flex gap-2 ml-auto">
            <Button 
              variant={inViewOnly ? 'default' : 'outline'} 
              size="sm" 
              className="flex items-center gap-2"
              onClick={toggleInViewOnly}
              data-testid="view-filter-button"
            >
              <Target className="w-4 h-4" />
              {inViewOnly ? 'In View' : 'All'}
            </Button>
            <Button 
              variant={timeRange === 'all' ? 'outline' : 'default'} 
              size="sm" 
              className="flex items-center gap-2"
              onClick={() => {
                const options: Array<typeof timeRange> = ['all', '1hour', '6hours', '12hours'];
                const currentIndex = options.indexOf(timeRange);
                const nextIndex = (currentIndex + 1) % options.length;
                setTimeRange(options[nextIndex]);
              }}
              data-testid="time-filter-button"
            >
              <Calendar className="w-4 h-4" />
              {timeRange === 'all' ? 'All Time' : 
               timeRange === '1hour' ? 'Last Hour' : 
               timeRange === '6hours' ? 'Last 6 Hours' : 
               timeRange === '12hours' ? 'Last 12 Hours' :
               timeRange === '24h' ? 'Last 24 Hours' :
               timeRange === '7d' ? 'Last 7 Days' :
               timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            </Button>
          </div>
        </div>


        {/* Map Container - Desktop Layout */}

        <div className="mb-6 xl:flex xl:gap-4">
          {/* Main Map - Always leaves space for permanent sidebar */}
          <div className="xl:w-[calc(100%-22rem)] w-full">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <div ref={mapContainerRef} className={`relative w-full h-full ${reportMode ? "cursor-crosshair" : ""}`}>
                  {/* FAIL-LOUD: Desktop - Only render when we have valid location or focus params */}
                  {hasValidMapCenter ? (
                    <>
                      {(() => {
                        // When navigating via focus param but no GPS, use Windhoek as temporary center
                        const safeDesktopCenter = mapCenter || [17.0658, -22.5597] as [number, number];
                        
                        const desktopMapProps = {
                          incidents: transformMarkersForMap(filteredMarkers),
                          ...(NRP_FIX_ZOOM 
                            ? { defaultCenter: safeDesktopCenter }
                            : { }  // C) Remove center prop completely when using NRP_FIX_ZOOM
                          ),
                          onMapReady: useCallback(() => {
                            console.log("[Map] Desktop MapView ready callback fired");
                            setMapReady(true);
                          }, []),
                          ...(NRP_FIX_ZOOM 
                            ? { defaultZoom: user && user.city ? 13 : 11 }
                            : { zoom: user && user.city ? 13 : 11 }
                          ),
                          className: "w-full h-full",
                          mapRef: mapRef,
                          onIncidentClick: (marker: any) => {
                            setSelectedId(marker.id);
                            setSelectedMarker(marker);
                            if (window.innerWidth < 1280) {
                              setIsIncidentSheetOpen(true);
                            }
                          }
                        };
                        
                        // C) Destructure key to avoid spreading warning  
                        const desktopKey = "map-with-sidebar"; // C) Stabilize key
                        
                        console.log("[Desktop] Render MapView props", {
                          hasCenter: "center" in desktopMapProps, 
                          center: (desktopMapProps as any).center, 
                          defaultCenter: (desktopMapProps as any).defaultCenter,
                          hasZoom: "zoom" in desktopMapProps,
                          defaultZoom: (desktopMapProps as any).defaultZoom,
                          key: desktopKey,
                          incidentsCount: desktopMapProps.incidents.length
                        });
                        
                        return <MapView key={desktopKey} {...desktopMapProps} />;
                      })()}
                      
                      {/* Desktop Picking UI */}
                      <GhostMarker />
                      <Overlay />
                      <Footer />
                      {/* Marker Legend */}
                      <MarkerLegend />
                      
                      {/* overlay helper when awaiting a click */}
                      {reportMode && (
                        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
                          <div
                            role="status"
                            aria-live="polite"
                            className="pointer-events-auto rounded-xl border bg-background/85 px-3 py-2 text-sm shadow"
                          >
                            Click the map to set the incident location · <kbd>Esc</kbd> to cancel
                          </div>
                        </div>
                      )}
                      
                      {/* Fallback overlay in case of map errors */}
                      <div className="absolute inset-0 pointer-events-none">
                        <FallbackMap
                          incidents={transformMarkersForMap(filteredMarkers)}
                          className="w-full h-full opacity-0 hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </>
                  ) : (
                    /* FAIL-LOUD: Desktop - No valid location and no focus params */
                    <div className="flex items-center justify-center h-full bg-zinc-100 dark:bg-zinc-900">
                      <div className="p-6 max-w-md text-center">
                        <LocationRequiredBanner />
                        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                          Enable location access to view incidents near you, or navigate here from a specific incident.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Floating Action Buttons for Mobile */}
            <div className="xl:hidden">
              {/* Filters & Incidents entry point */}
              {!isIncidentSheetOpen && (
                <button
                  onClick={() => setIsIncidentSheetOpen(true)}
                  className="md:hidden absolute left-3 bottom-[calc(96px+1rem)] z-20 h-12 px-4 rounded-2xl bg-white/90 text-slate-900 shadow-lg font-medium"
                  aria-label="Open filters & incidents"
                >
                  Filters & Incidents
                </button>
              )}
              
            </div>
          </div>

          {/* Desktop Sidebar - Permanent feature */}
          <div className="hidden xl:block w-80 flex flex-col min-h-0">
            <div className="h-[600px] shadow-xl border-2 flex flex-col overflow-hidden">
              <RecentIncidentsPanel />
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Recent Incidents Section - Permanent feature */}
        <div className="xl:hidden max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Recent Incidents
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <IncidentList 
                items={incidents.slice(0, 5).map(incident => ({
                  id: incident.id,
                  type: incident.type as "crime" | "safety_alert" | "suspicious" | "emergency",
                  title: incident.title,
                  description: incident.description,
                  severity: incident.severity as "low" | "medium" | "high" | "emergency",
                  created_at: new Date(incident.createdAt).getTime(),
                  position: { 
                    lat: incident.lat ?? Number(incident.latitude) ?? 0, 
                    lng: incident.lng ?? Number(incident.longitude) ?? 0 
                  }
                }))} 
                onSelect={handleSelectFromList}
              />
            </CardContent>
          </Card>
        </div>

        </div>
        
        {/* Desktop Incident Sheet */}
        <IncidentSheet
          open={isIncidentSheetOpen}
          onOpenChange={setIsIncidentSheetOpen}
          items={incidents.map(incident => ({
            id: incident.id,
            type: incident.type as "crime" | "safety_alert" | "suspicious" | "emergency",
            title: incident.title,
            description: incident.description,
            severity: incident.severity as "low" | "medium" | "high" | "emergency",
            created_at: new Date(incident.createdAt).getTime(),
            position: { 
              lat: incident.lat ?? Number(incident.latitude) ?? 0, 
              lng: incident.lng ?? Number(incident.longitude) ?? 0 
            }
          }))}
          onSelect={(id) => {
            handleSelectFromList(id);
          }}
        />
      </div>

      {/* Shared ReportPanel available on both mobile and desktop */}
      <ReportPanel />
      
      {/* Debug overlay for mobile testing */}
      <DebugHud />
    </>
  );
}