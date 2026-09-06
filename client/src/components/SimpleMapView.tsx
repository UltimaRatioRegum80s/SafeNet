import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation } from 'wouter';
import { Plus, Minus, Crosshair, Sun, Moon, Globe, X, Navigation, MapPinOff } from 'lucide-react';
import { fetchOSRMRoute, formatDistance, formatDuration } from '@/lib/routing';
import { CollapsibleCategoryFilter, type GroupFilter } from './CollapsibleCategoryFilter';
import { LongPressFAB } from './LongPressFAB';
import { isExpressReportEnabled, EXPRESS_REPORT_CONFIG } from '@/lib/featureFlags';
import { submitIncidentQuick } from '@/lib/quickSubmit';
import { useToast } from '@/hooks/use-toast';
import { deriveSeverityFromGroup } from '@/features/report/taxonomyV2';

// ==================== DIAGNOSTIC TYPES & STATE ====================
interface DiagEvent {
  id: number;
  type: 'user' | 'programmatic';
  event: string;
  zoom: number;
  lat: number;
  lng: number;
  timestamp: number;
  msSinceLastZoomend: number | null;
}

let globalMapInstanceId = 0; // Increments each time a map is mounted
import { getCurrentUser } from '@/lib/auth';
import { getCityCoordinates } from '@/lib/locationCoordinates';
import { useLocationStore } from '@/store/locationStore';
import { pickQueryLocation } from '@/lib/useDeviceLocation';
import { resolveToV2Type, TAXONOMY_GROUPS, type TaxonomyGroupId, getMarkerShape, type MarkerShape } from '@/features/report/taxonomyV2';
import {
  MAP_STYLES,
  availableMapStyles,
  resolveInitialStyle,
  createTileHealthWatcher,
  type MapStyle,
  type TileHealthWatcher,
} from '@/lib/mapTiles';
import { useAuthStore } from '@/store/auth';

// Fix default markers
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
});

interface Incident {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface FocusCoords {
  lat: number;
  lng: number;
  zoom?: number;
  highlight?: boolean;
  severity?: string;
}

interface SimpleMapViewProps {
  incidents: Incident[];
  className?: string;
  focusCoords?: FocusCoords | null;
  categoryFilter?: GroupFilter;
  onCategoryFilterChange?: (value: GroupFilter) => void;
  mapStyle?: MapStyle;
  onMapStyleChange?: (style: MapStyle) => void;
}

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

// Tile URLs, attribution and per-style availability now live in one place, so
// the initial layer and the style switcher can never disagree about them.
// See client/src/lib/mapTiles.ts.
export type { MapStyle };

/** Used only when the signed-in account has no city we can resolve. */
const MAP_FALLBACK_CENTER: [number, number] = [-22.5597, 17.0658]; // Windhoek

// Check if incident is critical (should pulse)
const isIncidentCritical = (incident: Incident): boolean => {
  // Check v2 taxonomy first - emergency and critical groups pulse
  const v2Type = resolveToV2Type(incident.type);
  if (v2Type) {
    return v2Type.groupId === 'emergency' || v2Type.groupId === 'critical';
  }
  
  // Critical if explicit severity is 'critical' or 'high'
  if (incident.severity === 'critical' || incident.severity === 'high') {
    return true;
  }
  
  // Critical based on high-severity incident types - expanded list
  const criticalTypes = ['fire', 'violence', 'fight', 'emergency', 'assault', 'help', 'medical', 'gun_shots', 'theft'];
  return criticalTypes.includes(incident.type?.toLowerCase() || '');
};

// Color mapping based on v2 taxonomy or severity
const getIncidentColor = (incident: Incident) => {
  // First try v2 taxonomy
  const v2Type = resolveToV2Type(incident.type);
  if (v2Type) {
    return v2Type.color;
  }
  
  // Map severity levels to colors as requested: yellow, amber, red
  const colorMap = {
    'low': '#facc15',      // Yellow for low severity (matches v2 services)
    'medium': '#f97316',   // Amber/Orange for medium severity  
    'high': '#ef4444',     // Red for high severity
    'critical': '#dc2626'  // Dark red for critical severity
  };
  
  // If incident has severity field, use it
  if (incident.severity) {
    return colorMap[incident.severity] || '#ef4444';
  }
  
  // Fallback: map common incident types to severity colors
  const typeColorMap: Record<string, string> = {
    // High severity - Red
    'fire': '#ef4444',
    'violence': '#ef4444', 
    'fight': '#ef4444',
    'emergency': '#ef4444',
    'assault': '#ef4444',
    
    // Medium severity - Amber/Orange  
    'break_in': '#f97316',
    'accident': '#f97316',
    'car_accident': '#f97316',
    'suspicious_persons': '#f97316',
    'suspicious_person': '#f97316',
    'suspicious_vehicle': '#f97316',
    'police_activity': '#f97316',
    'speed_camera': '#f97316',
    'theft': '#f97316',
    'burglary': '#f97316',
    
    // Low severity - Yellow
    'heavy_traffic': '#facc15',
    'blocked_road': '#facc15',
    'construction': '#facc15',
    'lost_pet': '#facc15',
    'lost_found': '#facc15',
    'noise_complaint': '#facc15',
    'police_traffic_stop': '#facc15'
  };
  
  const incidentType = incident.type?.toLowerCase() || '';
  return typeColorMap[incidentType] || '#ef4444'; // Default to red
};

// Get color for highlight marker based on severity or v2 group
const getHighlightColor = (severity?: string, incidentType?: string) => {
  // Try v2 taxonomy first
  if (incidentType) {
    const v2Type = resolveToV2Type(incidentType);
    if (v2Type) {
      return v2Type.color;
    }
  }
  
  const colorMap = {
    'low': '#facc15',      // Yellow for low severity
    'medium': '#f97316',   // Amber/Orange for medium severity  
    'high': '#ef4444',     // Red for high severity
    'critical': '#dc2626'  // Dark red for critical severity
  };
  
  return colorMap[severity as keyof typeof colorMap] || '#ef4444'; // Default to red
};

// Safely escape HTML to prevent XSS attacks
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ==================== MARKER SHAPE FACTORY ====================
// Creates Leaflet markers with different shapes based on taxonomy v2

interface ShapedMarkerOptions {
  lat: number;
  lng: number;
  color: string;
  shape: MarkerShape;
  size: number; // Diameter in pixels
  isPulsing?: boolean;
  isNew?: boolean; // True for newly added markers (triggers fade-in)
  isOptimistic?: boolean; // True for optimistic/pending markers
}

function createShapedMarker({ lat, lng, color, shape, size, isPulsing, isNew, isOptimistic }: ShapedMarkerOptions): L.Marker | L.CircleMarker {
  const halfSize = size / 2;
  
  // Build wrapper class for fade-in and optimistic styling
  const wrapperClasses = [];
  if (isNew) wrapperClasses.push('nn-marker-fadein');
  if (isOptimistic) wrapperClasses.push('nn-marker-optimistic');
  const wrapperClass = wrapperClasses.length > 0 ? wrapperClasses.join(' ') : '';
  
  switch (shape) {
    case 'square': {
      const html = `
        <div class="${wrapperClass}" style="position:relative;">
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border: 2px solid rgba(255,255,255,0.8);
            border-radius: 3px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        </div>
      `;
      return L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: '',
          iconSize: [size, size],
          iconAnchor: [halfSize, halfSize],
        }),
      });
    }
    
    case 'cross': {
      const armWidth = Math.max(4, size * 0.25);
      const html = `
        <div class="${wrapperClass} emergency-cross-marker" style="position: relative; width: ${size}px; height: ${size}px;">
          <div style="
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            width: 100%;
            height: ${armWidth}px;
            background-color: ${color};
            border-radius: 2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></div>
          <div style="
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: ${armWidth}px;
            height: 100%;
            background-color: ${color};
            border-radius: 2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></div>
        </div>
      `;
      return L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: '',
          iconSize: [size, size],
          iconAnchor: [halfSize, halfSize],
        }),
      });
    }
    
    case 'pulse': {
      // Pulsing red circle for critical incidents
      const html = `
        <div class="${wrapperClass} critical-incident-marker critical-incident-pulse" style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid ${color};
          border-radius: 50%;
          position: relative;
        "></div>
      `;
      return L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: '',
          iconSize: [size, size],
          iconAnchor: [halfSize, halfSize],
        }),
      });
    }
    
    case 'circle':
    default: {
      // Standard circle marker - CircleMarker doesn't support CSS classes easily
      // so we use a divIcon wrapper for consistency
      const html = `
        <div class="${wrapperClass}" style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid ${color};
          border-radius: 50%;
          opacity: 0.7;
        "></div>
      `;
      return L.marker([lat, lng], {
        icon: L.divIcon({
          html,
          className: '',
          iconSize: [size, size],
          iconAnchor: [halfSize, halfSize],
        }),
      });
    }
  }
}

export default function SimpleMapView({ 
  incidents, 
  className = "w-full h-96", 
  focusCoords,
  categoryFilter = 'all',
  onCategoryFilterChange,
  mapStyle: externalMapStyle,
  onMapStyleChange
}: SimpleMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const baseRef = useRef<Record<MapStyle, L.TileLayer | null> & { current?: MapStyle }>({
    light: null,
    dark: null,
    satellite: null,
    current: undefined,
  });
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [internalMapStyle, setInternalMapStyle] = useState<MapStyle>("light");
  const mapStyle = externalMapStyle ?? internalMapStyle;
  const setMapStyle = onMapStyleChange ?? setInternalMapStyle;
  const [currentZoom, setCurrentZoom] = useState<number>(12); // Track current zoom level
  const [, setLocation] = useLocation();
  const [userCity, setUserCity] = useState<string | null>(null);

  // The map opens on the signed-in user's city when we already know it. The
  // city used to arrive from a second getCurrentUser() call after mount, so the
  // first paint was always the Windhoek default and then jumped — which is what
  // made mobile briefly show Windhoek while Home showed Swakopmund.
  const authUser = useAuthStore((s) => s.user);
  const seededCenter = useRef<[number, number] | null>(
    (authUser?.city && getCityCoordinates(authUser.city)) || null,
  );
  const [initialCenter, setInitialCenter] = useState<[number, number]>(
    seededCenter.current ?? MAP_FALLBACK_CENTER,
  );

  // Basemap health. `unconfigured` means the selected style has no tile
  // provider in this build (see lib/mapTiles.ts); `network` means its tiles
  // are failing to load. Either way the user gets a stated reason and a way
  // out rather than a permanently grey map.
  // Health is per style, not per map: each style has its own layer and its own
  // provider, so switching to a working style must not inherit the failed
  // style's state. Only the style on screen is consulted.
  const [tileHealth, setTileHealth] = useState<Record<MapStyle, boolean>>({
    light: false,
    dark: false,
    satellite: false,
  });
  const tilesFailing = tileHealth[mapStyle];
  // Each layer's watcher, so Retry can clear the batch counters of the layer
  // the user is actually looking at. Populated when the layers are built.
  const tileHealthRef = useRef<Partial<Record<MapStyle, TileHealthWatcher>>>({});
  const styleUnavailable = !MAP_STYLES[mapStyle].available;
  // The street map could not be offered at all, so the map opened on imagery
  // instead. Say so — a provider change the user did not ask for should not be
  // silent, even when the replacement works.
  const streetMapUnconfigured = !MAP_STYLES.light.available && !MAP_STYLES.dark.available;
  const [fallbackNoticeDismissed, setFallbackNoticeDismissed] = useState(false);
  const basemapProblem: 'unconfigured' | 'network' | null = styleUnavailable
    ? 'unconfigured'
    : tilesFailing
      ? 'network'
      : null;
  const workingStyles = availableMapStyles().filter((s) => s !== mapStyle);
  const [isLocating, setIsLocating] = useState(false);
  
  // GPS availability — gate Report FAB on active GPS (not city fallback)
  const currentLocation = useLocationStore(state => state.currentLocation);
  const lastGoodLocation = useLocationStore(state => state.lastGoodLocation);
  const hasGps = !!pickQueryLocation({ currentLocation, lastGoodLocation });

  // Express report state (Phase 3C)
  const { toast } = useToast();
  const [expressReportCooldown, setExpressReportCooldown] = useState(false);
  const [isExpressSubmitting, setIsExpressSubmitting] = useState(false);
  const expressReportEnabled = isExpressReportEnabled();
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  // ==================== DIAGNOSTIC MODE GATE ====================
  // Only show diagnostic panel when ?diag=1 is in URL
  const diagMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('diag') === '1';

  // ==================== USER INTERACTION GUARD ====================
  // Once user touches the map, block all passive auto-fit/auto-setView
  const userHasInteractedRef = useRef<boolean>(false);
  // Ensure initial fit runs only once
  const didInitialFitRef = useRef<boolean>(false);
  // Track if we've set the city center (one-time)
  const didSetCityCenterRef = useRef<boolean>(false);
  // Track processed focus coordinates to prevent re-trigger on data refresh
  // Stores "lat,lng" string of last focused coordinates
  const lastFocusedCoordsRef = useRef<string | null>(null);
  
  // ==================== PHASE E: MARKER FADE-IN TRACKING ====================
  // Track rendered incident IDs to only animate new ones (not on pan/zoom/filter)
  const renderedIncidentIdsRef = useRef<Set<string>>(new Set());

  // ==================== ROUTING STATE ====================
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distanceMetres: number; durationSeconds: number } | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const clearRoute = useCallback(() => {
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    setRouteInfo(null);
  }, []);

  // ==================== DIAGNOSTIC STATE (only used when diagMode) ====================
  const [diagPanelOpen, setDiagPanelOpen] = useState(false);
  const [diagEvents, setDiagEvents] = useState<DiagEvent[]>([]);
  const [mapInstanceId, setMapInstanceId] = useState<number>(0);
  const [lastMapEvent, setLastMapEvent] = useState<{ event: string; timestamp: number } | null>(null);
  const lastZoomendTimeRef = useRef<number | null>(null);
  const diagEventIdRef = useRef<number>(0);
  const originalMethodsRef = useRef<{
    setView?: L.Map['setView'];
    setZoom?: L.Map['setZoom'];
    flyTo?: L.Map['flyTo'];
    fitBounds?: L.Map['fitBounds'];
    panTo?: L.Map['panTo'];
  }>({});

  // Add diagnostic event to log
  const addDiagEvent = useCallback((type: 'user' | 'programmatic', event: string, mapInstance: L.Map | null) => {
    if (!mapInstance) return;
    const now = Date.now();
    const center = mapInstance.getCenter();
    const newEvent: DiagEvent = {
      id: ++diagEventIdRef.current,
      type,
      event,
      zoom: mapInstance.getZoom(),
      lat: center.lat,
      lng: center.lng,
      timestamp: now,
      msSinceLastZoomend: lastZoomendTimeRef.current ? now - lastZoomendTimeRef.current : null,
    };
    setDiagEvents(prev => [...prev.slice(-9), newEvent]); // Keep last 10
    setLastMapEvent({ event, timestamp: now });
    
    // Update lastZoomendTime for zoomend events
    if (event === 'zoomend') {
      lastZoomendTimeRef.current = now;
    }
  }, []);

  // Handle user location centering (acts as RECENTER - explicit user intent)
  const handleMyLocation = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!map.current) {
        reject(new Error("Map not initialized"));
        return;
      }

      if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        reject(new Error("Geolocation not supported"));
        return;
      }

      // EXPLICIT USER INTENT: Reset interaction flag to allow this setView
      userHasInteractedRef.current = false;
      console.log("[SIMPLE MAP] Recenter: userHasInteracted reset to false");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log("[SIMPLE MAP] User location:", latitude, longitude);
          
          // Center map on user location with good zoom level
          map.current?.setView([latitude, longitude], 16);
          resolve();
        },
        (error) => {
          console.error("[SIMPLE MAP] Geolocation error:", error);
          
          let message = "Unable to get your location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Location access denied. Please enable location permissions in your browser.";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              message = "Location request timed out.";
              break;
          }
          
          alert(message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  // Handle location click with loading state
  const handleLocationClick = async () => {
    if (isLocating) return;
    
    setIsLocating(true);
    try {
      await handleMyLocation();
    } finally {
      setIsLocating(false);
    }
  };

  // Express report submission handler (Phase 3C)
  const handleExpressReport = useCallback(async () => {
    if (isExpressSubmitting || expressReportCooldown) return;
    
    setIsExpressSubmitting(true);
    
    try {
      const typeId = EXPRESS_REPORT_CONFIG.INCIDENT_TYPE;
      const severity = deriveSeverityFromGroup('nabor_note');
      
      await submitIncidentQuick({
        title: 'Express Report',
        description: 'Quick observation report',
        category: 'Nabor Note',
        type: typeId,
        severity,
      });
      
      toast({
        title: "Report submitted",
        description: "Thank you for keeping the community informed.",
      });
      
      // Start cooldown with cleanup ref
      setExpressReportCooldown(true);
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = setTimeout(() => {
        setExpressReportCooldown(false);
        cooldownTimerRef.current = null;
      }, EXPRESS_REPORT_CONFIG.COOLDOWN_DURATION_MS);
      
    } catch (error: any) {
      console.error('[EXPRESS_REPORT] Failed:', error);
      toast({
        title: "Could not submit report",
        description: error?.message || "Please try again or use the full report form.",
        variant: "destructive",
      });
    } finally {
      setIsExpressSubmitting(false);
    }
  }, [isExpressSubmitting, expressReportCooldown, toast]);

  // Calculate dynamic radius based on zoom level
  const calculateRadius = (baseRadius: number, zoom: number): number => {
    const referenceZoom = 14; // Reference zoom level where base radius applies
    const scaleFactor = Math.pow(1.4, (zoom - referenceZoom)); // Scale factor per zoom level
    const calculatedRadius = baseRadius * scaleFactor;
    
    // Apply limits to maintain usability across all device types
    const minRadius = 4;  // Minimum size for touch targets on mobile
    const maxRadius = 24; // Maximum size to prevent overwhelming on desktop
    
    return Math.max(minRadius, Math.min(maxRadius, calculatedRadius));
  };

  // Update all marker sizes based on current zoom level
  const updateMarkerSizes = (zoom: number) => {
    if (!markersRef.current) return;
    
    markersRef.current.eachLayer((layer: any) => {
      const metadata = (layer as any).customData;
      if (!metadata) return;
      
      if (layer instanceof L.CircleMarker) {
        // Handle regular circle markers
        const newRadius = calculateRadius(metadata.baseRadius, zoom);
        layer.setRadius(newRadius);
      } else if (layer instanceof L.Marker && metadata.shape) {
        // Handle divIcon markers (square, cross, pulse)
        const newRadius = calculateRadius(metadata.baseRadius, zoom);
        const newSize = newRadius * 2;
        const halfSize = newSize / 2;
        
        // Use stored color from metadata - NEVER look up incidents (stale closure bug)
        // If metadata.markerColor is missing, skip this marker (shouldn't happen)
        if (!metadata.markerColor) {
          console.warn("[SIMPLE MAP] Missing markerColor in metadata, skipping marker resize");
          return;
        }
        const markerColor = metadata.markerColor;
        
        let html = '';
        
        switch (metadata.shape as MarkerShape) {
          case 'square':
            html = `
              <div style="
                width: ${newSize}px;
                height: ${newSize}px;
                background-color: ${markerColor};
                border: 2px solid rgba(255,255,255,0.8);
                border-radius: 3px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>
            `;
            break;
            
          case 'cross': {
            const armWidth = Math.max(4, newSize * 0.25);
            html = `
              <div class="emergency-cross-marker" style="
                position: relative;
                width: ${newSize}px;
                height: ${newSize}px;
              ">
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 0;
                  transform: translateY(-50%);
                  width: 100%;
                  height: ${armWidth}px;
                  background-color: ${markerColor};
                  border-radius: 2px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                "></div>
                <div style="
                  position: absolute;
                  left: 50%;
                  top: 0;
                  transform: translateX(-50%);
                  width: ${armWidth}px;
                  height: 100%;
                  background-color: ${markerColor};
                  border-radius: 2px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                "></div>
              </div>
            `;
            break;
          }
            
          case 'pulse': {
            // Only apply pulse class if shouldPulse is true (genuine SOS/critical marker)
            const pulseClass = metadata.shouldPulse ? 'critical-incident-marker critical-incident-pulse' : '';
            html = `
              <div class="${pulseClass}" style="
                width: ${newSize}px;
                height: ${newSize}px;
                background-color: ${markerColor};
                border: 2px solid ${markerColor};
                border-radius: 50%;
                position: relative;
              "></div>
            `;
            break;
          }
            
          case 'circle':
          default:
            // Circle markers - never pulse
            html = `
              <div style="
                width: ${newSize}px;
                height: ${newSize}px;
                background-color: ${markerColor};
                border: 2px solid rgba(255,255,255,0.8);
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>
            `;
            break;
        }
        
        const newIcon = L.divIcon({
          html,
          className: '',
          iconSize: [newSize, newSize],
          iconAnchor: [halfSize, halfSize]
        });
        
        layer.setIcon(newIcon);
      }
    });
  };

  // Get user's city and set initial map center
  useEffect(() => {
    const fetchUserCity = async () => {
      try {
        const user = await getCurrentUser();
        if (user && user.city) {
          console.log("[SIMPLE MAP] User city:", user.city);
          setUserCity(user.city);
          
          // Get coordinates for user's city
          const coordinates = getCityCoordinates(user.city);
          if (coordinates) {
            console.log("[SIMPLE MAP] City coordinates:", coordinates);
            setInitialCenter(coordinates);
          } else {
            console.log("[SIMPLE MAP] No coordinates found for city, using default Windhoek");
          }
        } else {
          console.log("[SIMPLE MAP] No user or city found, using default Windhoek");
        }
      } catch (error) {
        console.error("[SIMPLE MAP] Error fetching user city:", error);
        // Keep default Windhoek coordinates
      }
    };

    fetchUserCity();
  }, []);

  // Initialize map (only once)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Increment global map instance ID
    globalMapInstanceId++;
    setMapInstanceId(globalMapInstanceId);

    // Start on the user's city when the auth store already knows it, so the
    // first painted frame matches Home and Feed instead of flashing Windhoek.
    map.current = L.map(mapContainer.current, {
      center: seededCenter.current ?? MAP_FALLBACK_CENTER,
      zoom: 12,
      zoomControl: !isMobile(), // hide default zoom control on mobile
    });

    const mapInstance = map.current;

    // ==================== DIAGNOSTIC: Instrument viewport methods ====================
    originalMethodsRef.current.setView = mapInstance.setView.bind(mapInstance);
    originalMethodsRef.current.setZoom = mapInstance.setZoom.bind(mapInstance);
    originalMethodsRef.current.flyTo = mapInstance.flyTo.bind(mapInstance);
    originalMethodsRef.current.fitBounds = mapInstance.fitBounds.bind(mapInstance);
    originalMethodsRef.current.panTo = mapInstance.panTo.bind(mapInstance);

    mapInstance.setView = function(...args: Parameters<L.Map['setView']>) {
      addDiagEvent('programmatic', 'setView', mapInstance);
      return originalMethodsRef.current.setView!(...args);
    };
    mapInstance.setZoom = function(...args: Parameters<L.Map['setZoom']>) {
      addDiagEvent('programmatic', 'setZoom', mapInstance);
      return originalMethodsRef.current.setZoom!(...args);
    };
    mapInstance.flyTo = function(...args: Parameters<L.Map['flyTo']>) {
      addDiagEvent('programmatic', 'flyTo', mapInstance);
      return originalMethodsRef.current.flyTo!(...args);
    };
    mapInstance.fitBounds = function(...args: Parameters<L.Map['fitBounds']>) {
      addDiagEvent('programmatic', 'fitBounds', mapInstance);
      return originalMethodsRef.current.fitBounds!(...args);
    };
    mapInstance.panTo = function(...args: Parameters<L.Map['panTo']>) {
      addDiagEvent('programmatic', 'panTo', mapInstance);
      return originalMethodsRef.current.panTo!(...args);
    };

    // ==================== DIAGNOSTIC: Add user gesture event listeners ====================
    // IMPORTANT: Only set userHasInteracted on GENUINE user gestures (with originalEvent)
    // Programmatic setView/fitBounds also fire zoomstart/movestart but without originalEvent
    mapInstance.on('zoomstart', (e: L.LeafletEvent) => {
      // Only set flag if this is a genuine user gesture (has originalEvent)
      if ((e as any).originalEvent) {
        userHasInteractedRef.current = true;
        console.log("[SIMPLE MAP] User gesture detected: zoomstart");
      }
      addDiagEvent((e as any).originalEvent ? 'user' : 'programmatic', 'zoomstart', mapInstance);
    });
    mapInstance.on('zoomend', () => {
      addDiagEvent('user', 'zoomend', mapInstance);
      // Also update marker sizes
      const zoom = mapInstance.getZoom() || 12;
      setCurrentZoom(zoom);
      updateMarkerSizes(zoom);
    });
    mapInstance.on('movestart', (e: L.LeafletEvent) => {
      // Only set flag if this is a genuine user gesture (has originalEvent)
      if ((e as any).originalEvent) {
        userHasInteractedRef.current = true;
        console.log("[SIMPLE MAP] User gesture detected: movestart");
      }
      addDiagEvent((e as any).originalEvent ? 'user' : 'programmatic', 'movestart', mapInstance);
    });
    mapInstance.on('moveend', () => addDiagEvent('user', 'moveend', mapInstance));
    // dragstart always has originalEvent (user is dragging)
    mapInstance.on('dragstart', () => {
      userHasInteractedRef.current = true;
      console.log("[SIMPLE MAP] User gesture detected: dragstart");
      addDiagEvent('user', 'dragstart', mapInstance);
    });
    mapInstance.on('dragend', () => addDiagEvent('user', 'dragend', mapInstance));

    // Set initial zoom level
    setCurrentZoom(mapInstance.getZoom());

    // Build a Leaflet layer only for styles this build can actually serve. A
    // style with no provider key is left null so it can never be added to the
    // map — an unauthenticated CARTO tile returns HTTP 200 carrying an
    // "API KEY REQUIRED" watermark, so there is nothing to detect afterwards.
    const tileLayers: Record<MapStyle, L.TileLayer | null> = {
      light: null,
      dark: null,
      satellite: null,
    };
    for (const style of availableMapStyles()) {
      const config = MAP_STYLES[style];
      const layer = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
        subdomains: config.subdomains,
      });

      // Health is watched per layer, and the listeners go on before the layer
      // is ever added to the map below: the first batch of tiles starts loading
      // on `addTo`, so a watcher attached from a later render can miss the
      // failure that matters most — the one on first paint.
      const watcher = createTileHealthWatcher((failing) =>
        setTileHealth((prev) =>
          prev[style] === failing ? prev : { ...prev, [style]: failing },
        ),
      );
      tileHealthRef.current[style] = watcher;
      layer.on('tileerror', watcher.tileerror);
      layer.on('tileload', watcher.tileload);
      layer.on('load', watcher.load);

      tileLayers[style] = layer;
    }

    // Open on the requested style, or the first one that works.
    const startStyle = resolveInitialStyle(mapStyle);
    if (startStyle && tileLayers[startStyle]) {
      tileLayers[startStyle]!.addTo(map.current);
      if (startStyle !== mapStyle) setMapStyle(startStyle);
    }

    // Store all layers in ref
    baseRef.current = {
      ...tileLayers,
      current: startStyle ?? undefined,
    };

    // Markers layer group (keeps incidents above base when we switch tiles)
    const markers = L.layerGroup().addTo(map.current);
    markersRef.current = markers;

    // Add fullscreen control for desktop - positioned in bottom-right corner
    if (!isMobile()) {
      // Use L.Control to create a custom fullscreen button
      const FullscreenControl = L.Control.extend({
        onAdd: function(map: L.Map) {
          const container = L.DomUtil.create('div', 'leaflet-control-fullscreen');
          container.innerHTML = '<button class="fullscreen-btn" title="Toggle Fullscreen" aria-label="Toggle Fullscreen">⛶</button>';
          
          // Prevent click events from propagating to the map
          L.DomEvent.disableClickPropagation(container);
          
          L.DomEvent.on(container, 'click', function() {
            if (!document.fullscreenElement) {
              mapContainer.current?.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          });
          
          return container;
        }
      });
      
      map.current.addControl(new FullscreenControl({ position: 'bottomright' }));
    }

    // Mobile attribution positioning
    if (isMobile()) {
      map.current.attributionControl.setPosition("bottomleft");
    }

    // Delegated click handler for "Navigate here" popup buttons
    // Must be attached to the map container so it catches clicks inside Leaflet popups
    const container = mapContainer.current;
    const handleNavigateClick = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-navigate-lat]');
      if (!target) return;
      const incLat = parseFloat(target.getAttribute('data-navigate-lat') || '');
      const incLng = parseFloat(target.getAttribute('data-navigate-lng') || '');
      if (!Number.isFinite(incLat) || !Number.isFinite(incLng)) return;
      e.stopPropagation();

      // Claim the viewport so auto-fit/auto-center guards don't snap back
      userHasInteractedRef.current = true;

      // Close popup and clear any existing route
      if (map.current) map.current.closePopup();
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      setRouteInfo(null);

      // Get the best available user location from the store
      const locState = useLocationStore.getState();
      const userLoc = pickQueryLocation({
        currentLocation: locState.currentLocation,
        lastGoodLocation: locState.lastGoodLocation,
      });

      if (!userLoc) {
        // No GPS at all — just pan to the incident and inform user
        map.current?.setView([incLat, incLng], 17);
        toast({
          title: "GPS unavailable",
          description: "Enable location access to see your route. Map centred on incident.",
        });
        return;
      }

      // Show routing spinner
      setIsRouting(true);

      try {
        const result = await fetchOSRMRoute(userLoc.lat, userLoc.lng, incLat, incLng);

        if (!result || !map.current) {
          // OSRM failed — draw a straight dashed fallback line
          const fallback = L.polyline(
            [[userLoc.lat, userLoc.lng], [incLat, incLng]],
            { color: '#3b82f6', weight: 3, dashArray: '8 6', opacity: 0.8 }
          );
          routeLayerRef.current = fallback;
          fallback.addTo(map.current!);
          map.current!.fitBounds(fallback.getBounds(), { padding: [50, 50] });
          toast({
            title: "Road route unavailable",
            description: "Showing straight-line direction instead.",
          });
          return;
        }

        // Draw the road-following polyline
        const line = L.polyline(result.coordinates, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round',
        });
        routeLayerRef.current = line;
        line.addTo(map.current);

        // Fit map to show the full route
        map.current.fitBounds(line.getBounds(), { padding: [55, 55] });

        // Show the route info card
        setRouteInfo({ distanceMetres: result.distanceMetres, durationSeconds: result.durationSeconds });
      } catch (err) {
        console.warn('[ROUTING] OSRM fetch failed:', err);
        toast({
          title: "Could not fetch route",
          description: "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsRouting(false);
      }
    };
    container?.addEventListener('click', handleNavigateClick);

    // Clear route when any new popup opens (user switched to a different marker)
    mapInstance.on('popupopen', () => {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
        setRouteInfo(null);
      }
    });

    // Mark as loaded
    setMapLoaded(true);
    console.log("[SIMPLE MAP] Map initialized with mobile chrome support");

    return () => {
      container?.removeEventListener('click', handleNavigateClick);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDiagEvent]); // addDiagEvent is stable (useCallback with no deps)

  // Update map center when user's city coordinates are available (ONE-TIME, guarded)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // GUARD: Only run once, and only if user hasn't interacted yet
    if (didSetCityCenterRef.current) {
      console.log("[SIMPLE MAP] City center already set, skipping");
      return;
    }
    if (userHasInteractedRef.current) {
      console.log("[SIMPLE MAP] User has interacted, skipping city center");
      return;
    }
    
    // Nothing to do when the map already opened on these coordinates.
    const [seedLat, seedLng] = seededCenter.current ?? MAP_FALLBACK_CENTER;
    if (initialCenter[0] === seedLat && initialCenter[1] === seedLng) {
      didSetCityCenterRef.current = true;
      return;
    }

    console.log("[SIMPLE MAP] Updating map center to user's city:", initialCenter);
    didSetCityCenterRef.current = true;
    map.current.setView(initialCenter, 12);
  }, [initialCenter, mapLoaded]);

  // Add markers when incidents change
  useEffect(() => {
    if (!markersRef.current || !mapLoaded) return;

    console.log("[SIMPLE MAP] Adding markers for", incidents.length, "incidents");

    // Clear existing markers from layer group
    markersRef.current.clearLayers();
    
    // Track current incident IDs for this render
    const currentIds = new Set<string>();

    // Add new markers to layer group
    incidents.forEach(incident => {
      if (!Number.isFinite(incident.lat) || !Number.isFinite(incident.lng)) {
        console.warn("[SIMPLE MAP] Invalid coordinates for incident:", incident.id);
        return;
      }

      // Get marker color and shape from taxonomy v2
      const markerColor = getIncidentColor(incident);
      const markerShape = getMarkerShape(incident.type);
      const isCritical = markerShape === 'pulse';
      
      // Calculate zoom-aware size
      const baseSize = isCritical ? 24 : 20; // Base diameter for critical/normal incidents
      const currentSize = calculateRadius(baseSize / 2, currentZoom) * 2;
      
      // PHASE E: Determine if this is a new marker (fade-in only on first appearance)
      const isNewMarker = !renderedIncidentIdsRef.current.has(incident.id);
      const isOptimistic = (incident as any).isOptimistic === true;
      currentIds.add(incident.id);
      
      // Debug logging for shape rendering
      console.log("[SIMPLE MAP] Creating marker:", {
        id: incident.id,
        type: incident.type,
        shape: markerShape,
        color: markerColor,
        size: currentSize,
        isNew: isNewMarker,
        isOptimistic
      });
      
      // Create shaped marker using taxonomy v2 shape factory
      const marker = createShapedMarker({
        lat: incident.lat,
        lng: incident.lng,
        color: markerColor,
        shape: markerShape,
        size: currentSize,
        isPulsing: isCritical,
        isNew: isNewMarker,
        isOptimistic,
      });

      // Store metadata for zoom scaling using custom data property
      // IMPORTANT: Store color and pulse flag here to avoid stale closure in zoomend handler
      (marker as any).customData = {
        baseRadius: baseSize / 2,
        baseSize,
        isCritical,
        incidentId: incident.id,
        shape: markerShape,
        markerColor: markerColor, // Stored at creation time - used by updateMarkerSizes
        shouldPulse: isCritical,  // Only SOS/critical markers should pulse
      };

      // Build popup: title, type label, and a Navigate button (no image)
      const safeTitle = escapeHtml(incident.title || 'Incident');
      const safeTypeLabel = escapeHtml(
        (incident.type || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      );
      const safeLat = String(incident.lat);
      const safeLng = String(incident.lng);
      marker.bindPopup(`
        <div style="min-width:160px;font-family:sans-serif;padding:2px 0;">
          <div style="font-weight:700;font-size:14px;margin-bottom:3px;">${safeTitle}</div>
          <div style="font-size:11px;color:#888;margin-bottom:10px;">${safeTypeLabel}</div>
          <button
            data-navigate-lat="${safeLat}"
            data-navigate-lng="${safeLng}"
            style="width:100%;padding:7px 12px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;"
          >Navigate here</button>
        </div>
      `);

      // Add to markers layer group
      marker.addTo(markersRef.current!);

      console.log("[SIMPLE MAP] Added marker at", incident.lat, incident.lng);
    });

    const markerCount = Object.keys(markersRef.current.getLayers()).length;
    console.log("[SIMPLE MAP] Total markers added:", markerCount);

    // Fit map to show all markers - GUARDED: only on initial load, not on every refresh
    // GUARD 1: Only run once (initial fit)
    // GUARD 2: Only if user hasn't interacted yet
    // GUARD 3: Only if no focus coordinates are present
    if (markerCount > 0 && map.current && !focusCoords) {
      if (didInitialFitRef.current) {
        console.log("[SIMPLE MAP] Initial fit already done, skipping fitBounds");
      } else if (userHasInteractedRef.current) {
        console.log("[SIMPLE MAP] User has interacted, skipping fitBounds");
      } else {
        try {
          console.log("[SIMPLE MAP] Running ONE-TIME initial fitBounds");
          didInitialFitRef.current = true;
          const group = L.featureGroup(Object.values(markersRef.current.getLayers()));
          map.current.fitBounds(group.getBounds(), { padding: [20, 20] });
        } catch (error) {
          console.warn("[SIMPLE MAP] Could not fit bounds:", error);
        }
      }
    }
    
    // PHASE E: Accumulate rendered IDs (union, not replace)
    // This ensures fade-in only happens on FIRST-EVER appearance, not on filter toggle
    currentIds.forEach(id => renderedIncidentIdsRef.current.add(id));

  }, [incidents, mapLoaded]);

  // Handle focus coordinates from URL parameters (EXPLICIT USER INTENT - always allowed)
  // This is triggered by "View on Map" button clicks, so it bypasses userHasInteracted guard
  // IMPORTANT: After focusing, we CLAIM the viewport by setting userHasInteractedRef=true
  // This prevents auto-fit, city-center, or other effects from snapping back
  useEffect(() => {
    if (!map.current || !mapLoaded || !focusCoords) return;

    // Create a key for this focus request to detect duplicates
    const focusKey = `${focusCoords.lat.toFixed(5)},${focusCoords.lng.toFixed(5)}`;
    
    // GUARD: Skip if we already processed this exact focus request
    // This prevents re-focusing on every data refresh/polling cycle
    if (lastFocusedCoordsRef.current === focusKey) {
      console.log("[SIMPLE MAP] Already focused on these coordinates, skipping:", focusKey);
      return;
    }

    console.log("[SIMPLE MAP] Focusing on coordinates (explicit intent):", focusCoords);
    
    // Mark this focus request as processed
    lastFocusedCoordsRef.current = focusKey;

    // Center map on the focus coordinates with the specified or max zoom
    const zoom = focusCoords.zoom || 18; // Default to max zoom for incident focusing
    map.current.setView([focusCoords.lat, focusCoords.lng], zoom);
    
    // CLAIM THE VIEWPORT: Mark as user-interacted to prevent snap-back from other effects
    // This is explicit user intent ("View on Map"), so we treat it like a user gesture
    userHasInteractedRef.current = true;
    console.log("[SIMPLE MAP] Viewport claimed after focus - userHasInteracted set to true");

    // Add highlight marker if requested
    if (focusCoords.highlight) {
      // Get the appropriate color based on severity
      const highlightColor = getHighlightColor(focusCoords.severity);
      
      // Create a pulsing highlight marker
      const highlightMarker = L.circleMarker([focusCoords.lat, focusCoords.lng], {
        radius: 15,
        color: highlightColor,
        weight: 3,
        fillColor: highlightColor,
        fillOpacity: 0.3,
        className: 'highlight-marker'
      });

      // Add pulsing animation
      highlightMarker.on('add', () => {
        const element = highlightMarker.getElement() as HTMLElement;
        if (element) {
          element.style.animation = 'highlightPulse 2s infinite';
          element.style.transformOrigin = 'center center';
        }
      });

      // Add to map temporarily (remove after 10 seconds)
      highlightMarker.addTo(map.current);
      setTimeout(() => {
        try {
          map.current?.removeLayer(highlightMarker);
        } catch (err) {
          console.warn("[SIMPLE MAP] Could not remove highlight marker:", err);
        }
      }, 10000);
    }
  }, [focusCoords, mapLoaded]);

  // Recover from a basemap problem: fall back to a style this build can serve
  // when the current one has no provider, and otherwise ask Leaflet to fetch
  // the tiles again.
  const retryBasemap = useCallback(() => {
    // Clear through this style's watcher so the retry starts from an empty
    // batch; a bare setState would leave the failed batch's count in place and
    // the first dropped tile of the retry would re-trip the threshold.
    tileHealthRef.current[mapStyle]?.reset();
    if (!MAP_STYLES[mapStyle].available) {
      const alternative = availableMapStyles()[0];
      if (alternative) setMapStyle(alternative);
      return;
    }
    baseRef.current[mapStyle]?.redraw();
  }, [mapStyle, setMapStyle]);

  // Tile-failure watching is set up where the layers are built, above, so the
  // listeners are in place before the first batch starts loading. Leaflet fires
  // `tileerror` on a network or HTTP failure; it cannot see a watermarked tile,
  // which is why the missing-key case is handled by configuration instead.
  //
  // `load` means the batch settled, not that it succeeded — Leaflet fires it
  // even when every tile in the batch errored — so recovery is decided from
  // `tileload`. See createTileHealthWatcher in lib/mapTiles.ts.

  // Map style toggle. A style with no configured provider has no layer, so the
  // current one is removed and the basemap-unavailable state takes over rather
  // than leaving the previous style on screen under the wrong label.
  useEffect(() => {
    const mapInstance = map.current;
    const base = baseRef.current;
    if (!mapInstance || !mapLoaded) return;
    if (mapStyle === base.current) return;

    if (base.current && base[base.current]) {
      mapInstance.removeLayer(base[base.current]!);
    }

    if (base[mapStyle]) {
      base[mapStyle]!.addTo(mapInstance);
      base.current = mapStyle;
    } else {
      base.current = undefined;
    }
  }, [mapStyle, mapLoaded]);

  return (
    <div className="relative">
      {/* Single map container with responsive styling */}
      <div 
        className={`
          md:w-full md:h-[85vh] md:rounded-lg md:border md:shadow-lg md:relative
          max-md:fixed max-md:inset-0 max-md:z-0
        `}
      >
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Loading state */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm md:rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {/* Street map not configured, imagery shown instead. Stated once, and
            dismissible — it is a setup fact, not an error the user caused. */}
        {mapLoaded && streetMapUnconfigured && !basemapProblem && !fallbackNoticeDismissed && (
          <div
            className="absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+82px)] z-[550] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur md:top-4"
            role="status"
            data-testid="map-street-fallback-notice"
          >
            <span className="flex-1">
              Street map unavailable — showing satellite imagery instead.
            </span>
            <button
              type="button"
              onClick={() => setFallbackNoticeDismissed(true)}
              aria-label="Dismiss"
              className="-my-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-white/70 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Basemap unavailable — the selected style has no configured tile
            provider. Says so plainly instead of leaving an endless grey map,
            and keeps the incident data one tap away. */}
        {mapLoaded && basemapProblem && (
          <div
            className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-6 md:rounded-lg"
            data-testid="map-unavailable"
            role="status"
          >
            <div className="max-w-sm text-center">
              <MapPinOff
                className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Map background unavailable
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {basemapProblem === 'unconfigured'
                  ? MAP_STYLES[mapStyle].unavailableReason
                  : "The map tiles could not be loaded. Check your connection."}{" "}
                {incidents.length === 1
                  ? "1 nearby report is still available."
                  : `${incidents.length} nearby reports are still available.`}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={retryBasemap}
                  className="min-h-[44px] rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
                  data-testid="map-unavailable-retry"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setLocation('/community/feed')}
                  className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                  data-testid="map-unavailable-activity"
                >
                  View activity
                </button>
                {workingStyles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setMapStyle(style)}
                    className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                    data-testid={`map-unavailable-switch-${style}`}
                  >
                    Use {MAP_STYLES[style].label.toLowerCase()} map
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Route info card — floats above map after "Navigate here" is tapped */}
        {(isRouting || routeInfo) && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3 bg-gray-900/95 text-white px-4 py-3 rounded-xl shadow-xl border border-gray-700 pointer-events-auto"
            style={{ minWidth: '220px', maxWidth: '300px' }}
          >
            {isRouting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">Finding route…</span>
              </>
            ) : routeInfo ? (
              <>
                <Navigation size={20} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base leading-tight">
                    {formatDistance(routeInfo.distanceMetres)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ~{formatDuration(routeInfo.durationSeconds)} driving
                  </div>
                </div>
                <button
                  onClick={clearRoute}
                  className="p-1 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                  aria-label="Clear route"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ==================== DIAGNOSTIC PANEL (gated behind ?diag=1) ==================== */}
      {diagMode && (
        <>
        {/* Toggle Button - Subdued styling (Phase E) */}
        <button
          onClick={() => setDiagPanelOpen(!diagPanelOpen)}
          className="bg-gray-600/70 text-white/80 text-xs px-2 py-1 rounded shadow border border-gray-500/50 hover:bg-gray-500/80 transition-colors"
          style={{ 
            position: 'fixed', 
            left: '8px', 
            bottom: '50px',
            zIndex: 999999
          }}
          data-testid="diag-toggle-button"
        >
          {diagPanelOpen ? 'Hide' : '🔬'}
        </button>

        {/* Diagnostic Panel */}
        {diagPanelOpen && (
        <div
          className="bg-gray-900/95 text-white rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
          style={{
            position: 'fixed',
            left: '12px',
            right: '12px',
            bottom: '110px',
            maxHeight: '60vh',
            zIndex: 999998,
            fontSize: '11px',
          }}
          data-testid="diag-panel"
        >
          {/* Header - Subdued styling (Phase E) */}
          <div className="bg-gray-700 px-3 py-2 flex justify-between items-center">
            <span className="font-medium text-gray-300">🔬 Diagnostic</span>
            <button onClick={() => setDiagPanelOpen(false)} className="p-1">
              <X size={16} />
            </button>
          </div>

          {/* Map Proof Section */}
          <div className="px-3 py-2 border-b border-gray-700 bg-gray-800">
            <div className="font-bold text-yellow-400 mb-1">Active Map Proof</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>Instance ID:</div>
              <div className="font-mono text-green-400">#{mapInstanceId}</div>
              <div>Last Event:</div>
              <div className="font-mono text-green-400">
                {lastMapEvent ? `${lastMapEvent.event} (${((Date.now() - lastMapEvent.timestamp) / 1000).toFixed(1)}s ago)` : 'none'}
              </div>
              <div>Live Zoom:</div>
              <div className="font-mono text-green-400">{map.current?.getZoom()?.toFixed(2) ?? 'N/A'}</div>
              <div>Live Center:</div>
              <div className="font-mono text-green-400">
                {map.current?.getCenter() 
                  ? `${map.current.getCenter().lat.toFixed(5)}, ${map.current.getCenter().lng.toFixed(5)}`
                  : 'N/A'}
              </div>
              <div>Incidents:</div>
              <div className="font-mono text-green-400">{incidents.length}</div>
            </div>
          </div>

          {/* Event Log */}
          <div className="px-3 py-2">
            <div className="font-bold text-yellow-400 mb-1">Event Log (last 10)</div>
            <div className="overflow-y-auto max-h-[30vh] space-y-1">
              {diagEvents.length === 0 ? (
                <div className="text-gray-400 italic">No events yet. Interact with the map...</div>
              ) : (
                diagEvents.slice().reverse().map(evt => (
                  <div 
                    key={evt.id} 
                    className={`font-mono py-1 px-2 rounded ${
                      evt.type === 'programmatic' 
                        ? 'bg-red-900/50 border-l-2 border-red-500' 
                        : 'bg-green-900/30 border-l-2 border-green-500'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className={evt.type === 'programmatic' ? 'text-red-400 font-bold' : 'text-green-400'}>
                        {evt.type === 'programmatic' ? '⚡' : '👆'} {evt.event}
                      </span>
                      <span className="text-gray-400">
                        {evt.msSinceLastZoomend !== null ? `+${evt.msSinceLastZoomend}ms` : '—'}
                      </span>
                    </div>
                    <div className="text-gray-400 text-[10px]">
                      z={evt.zoom.toFixed(2)} @ {evt.lat.toFixed(5)}, {evt.lng.toFixed(5)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-3 py-2 border-t border-gray-700 flex gap-2">
            <button 
              onClick={() => {
                const logText = diagEvents.map(evt => 
                  `${evt.type === 'programmatic' ? '⚡' : '👆'} ${evt.event} | z=${evt.zoom.toFixed(2)} @ ${evt.lat.toFixed(5)},${evt.lng.toFixed(5)} | +${evt.msSinceLastZoomend ?? '—'}ms`
                ).join('\n');
                const fullText = `MAP DIAG #${mapInstanceId}\nLive: z=${map.current?.getZoom()?.toFixed(2)} @ ${map.current?.getCenter()?.lat.toFixed(5)},${map.current?.getCenter()?.lng.toFixed(5)}\n---\n${logText || '(no events)'}`;
                navigator.clipboard.writeText(fullText).then(() => alert('Log copied!')).catch(() => alert('Copy failed'));
              }}
              className="flex-1 bg-blue-700 hover:bg-blue-600 py-1 rounded text-xs"
            >
              📋 Copy Log
            </button>
            <button 
              onClick={() => setDiagEvents([])}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded text-xs"
            >
              Clear
            </button>
          </div>
        </div>
        )}
        </>
      )}

      {/* Map Controls - Mobile only - OUTSIDE map container for proper z-index */}
      <div className="md:hidden pointer-events-none">
        <div className="fixed right-4 bottom-[20vh] z-[60] flex flex-col gap-3 pointer-events-auto">
          {/* Category Filter - Collapsible button */}
          {onCategoryFilterChange && (
            <CollapsibleCategoryFilter
              value={categoryFilter}
              onChange={onCategoryFilterChange}
            />
          )}
          
          <button
            data-testid="button-zoom-in"
            aria-label="Zoom in"
            className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={22} />
          </button>
          <button
            data-testid="button-zoom-out"
            aria-label="Zoom out"
            className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={22} />
          </button>
          <div className="h-2" /> {/* Spacer for better visual separation */}
          <button
            data-testid="button-my-location"
            aria-label="My location"
            className="h-14 w-14 grid place-items-center rounded-2xl bg-gray-800/95 dark:bg-background/95 border border-gray-700 dark:border-border shadow-lg active:scale-95 transition-all duration-200 hover:bg-gray-700/95 dark:hover:bg-background text-white dark:text-foreground disabled:opacity-50"
            onClick={handleLocationClick}
            disabled={isLocating}
          >
            <Crosshair 
              size={22} 
              className={isLocating ? "animate-spin" : ""} 
            />
          </button>
          
          
          {/* Report FAB - Phase 3C: LongPressFAB with express report via 3s long-press (gated on GPS) */}
          <LongPressFAB
            onShortTap={() => {
              if (!hasGps) {
                toast({
                  title: "GPS required to report",
                  description: "Enable location access before reporting an incident.",
                });
                return;
              }
              setLocation('/community/report');
            }}
            onLongPressComplete={handleExpressReport}
            onCooldownAttempt={() => {
              toast({
                title: "Express report cooling down",
                description: "Please wait a moment before submitting another quick report.",
              });
            }}
            disabled={isExpressSubmitting || !hasGps}
            cooldownActive={expressReportCooldown}
            enableLongPress={expressReportEnabled && hasGps}
          />
        </div>
      </div>
    </div>
  );
}