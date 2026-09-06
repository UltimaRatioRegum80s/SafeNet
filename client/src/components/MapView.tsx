import { useEffect, useRef, useState, useCallback } from 'react';

// 🔒 NRP Guardrails  
const NRP_UNIFY_CLUSTER = true;
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { ensureCluster } from "@/lib/cluster";
import { createClusterGroup } from "@/features/map/cluster";
import { showDebug } from "@/lib/debug";
import { getIncidentIcon, createAccuracyCircle } from '../lib/incidentIcons';
import { Flags } from '@/lib/flags';
import { isMobileLike } from '@/lib/platform';
import { MAP_STYLES } from '@/lib/mapTiles';

// ==================== DIAGNOSTIC BUILD ====================
// Toggle via URL query params: ?disableClustering=true&disableAutoFit=true&showDebugOverlay=true
const urlParams = new URLSearchParams(window.location.search);
const DIAG_DISABLE_CLUSTERING = urlParams.get('disableClustering') === 'true';
const DIAG_DISABLE_AUTOFIT = urlParams.get('disableAutoFit') === 'true';
const DIAG_HARD_KILL_SWITCH = true; // Always on for diagnosis
const DIAG_SHOW_OVERLAY = urlParams.get('showDebugOverlay') === 'true' || true; // Always show for Kenya field test

// Governor Diagnostic Mode: detected at runtime via URL params (not module load)
// This is set inside the component to support SPA navigation

// Monotonic event counter for logging
let diagEventCounter = 0;
const diagStartTime = Date.now();

// ==================== GOVERNOR DIAGNOSTIC STATE ====================
// Tracks snap-back detection for non-technical verification
interface GovernorDiagState {
  appVersion: string;
  lastZoomstartTime: number | null;
  lastZoomendTime: number | null;
  lastZoomendZoom: number | null;
  lastZoomendCenter: string | null;
  lastMoveendTime: number | null;
  forcedViewDetected: boolean;
  forcedViewMethod: string | null;
  forcedViewDelay: number | null;
  forcedViewArgs: string | null;
  logLines: string[];
}

const governorDiag: GovernorDiagState = {
  appVersion: 'v2.1.1',
  lastZoomstartTime: null,
  lastZoomendTime: null,
  lastZoomendZoom: null,
  lastZoomendCenter: null,
  lastMoveendTime: null,
  forcedViewDetected: false,
  forcedViewMethod: null,
  forcedViewDelay: null,
  forcedViewArgs: null,
  logLines: []
};

// Callback for React re-render
let governorDiagUpdateCallback: (() => void) | null = null;

function governorLog(line: string) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = `[${timestamp}] ${line}`;
  governorDiag.logLines.push(entry);
  // Keep only last 20 lines
  if (governorDiag.logLines.length > 20) {
    governorDiag.logLines.shift();
  }
  governorDiagUpdateCallback?.();
}

function governorRecordZoomstart() {
  governorDiag.lastZoomstartTime = Date.now();
  governorLog('ZOOMSTART detected');
  governorDiagUpdateCallback?.();
}

function governorRecordZoomend(zoom: number, center: L.LatLng) {
  governorDiag.lastZoomendTime = Date.now();
  governorDiag.lastZoomendZoom = zoom;
  governorDiag.lastZoomendCenter = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
  governorLog(`ZOOMEND → zoom=${zoom}, center=${governorDiag.lastZoomendCenter}`);
  governorDiagUpdateCallback?.();
}

function governorRecordMoveend(zoom: number, center: L.LatLng) {
  governorDiag.lastMoveendTime = Date.now();
  governorLog(`MOVEEND → zoom=${zoom}, center=${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`);
  governorDiagUpdateCallback?.();
}

function governorRecordForcedView(method: string, args: string) {
  const now = Date.now();
  // Check if this is within 1000ms AFTER a zoomend (snap-back signature)
  if (governorDiag.lastZoomendTime && (now - governorDiag.lastZoomendTime) <= 1000) {
    const delay = now - governorDiag.lastZoomendTime;
    governorDiag.forcedViewDetected = true;
    governorDiag.forcedViewMethod = method;
    governorDiag.forcedViewDelay = delay;
    governorDiag.forcedViewArgs = args;
    governorLog(`⚠️ SNAP-BACK: ${method} called ${delay}ms after zoomend`);
  } else {
    governorLog(`${method} called (no snap-back)`);
  }
  governorDiagUpdateCallback?.();
}

function governorReset() {
  governorDiag.lastZoomstartTime = null;
  governorDiag.lastZoomendTime = null;
  governorDiag.lastZoomendZoom = null;
  governorDiag.lastZoomendCenter = null;
  governorDiag.lastMoveendTime = null;
  governorDiag.forcedViewDetected = false;
  governorDiag.forcedViewMethod = null;
  governorDiag.forcedViewDelay = null;
  governorDiag.forcedViewArgs = null;
  governorDiag.logLines = [];
  governorLog('--- Log Reset ---');
  governorDiagUpdateCallback?.();
}

function governorGenerateReport(): string {
  const lines = [
    `=== NaborNet Map Diagnostic Report ===`,
    `App Version: ${governorDiag.appVersion}`,
    `Timestamp: ${new Date().toISOString()}`,
    ``,
    `--- Last Gesture State ---`,
    `Zoomend zoom: ${governorDiag.lastZoomendZoom ?? 'none'}`,
    `Zoomend center: ${governorDiag.lastZoomendCenter ?? 'none'}`,
    ``,
    `--- Snap-Back Detection ---`,
    `Forced view detected: ${governorDiag.forcedViewDetected ? 'YES ⚠️' : 'NO ✅'}`,
  ];
  
  if (governorDiag.forcedViewDetected) {
    lines.push(`Method: ${governorDiag.forcedViewMethod}`);
    lines.push(`Delay after zoomend: ${governorDiag.forcedViewDelay}ms`);
    lines.push(`Args: ${governorDiag.forcedViewArgs}`);
  }
  
  lines.push(``);
  lines.push(`--- Last 10 Log Lines ---`);
  const last10 = governorDiag.logLines.slice(-10);
  last10.forEach(l => lines.push(l));
  
  lines.push(``);
  lines.push(`=== End Report ===`);
  
  return lines.join('\n');
}

// ==================== DEBUG OVERLAY STATE (Global for field testing) ====================
interface DebugOverlayState {
  lastMovementSource: string;
  lastMovementTimestamp: number;
  hasUserInteracted: boolean;
  clusteringEnabled: boolean;
  autoFitEnabled: boolean;
  center: [number, number];
  zoom: number;
  blockedCount: number;
}

const debugOverlayState: DebugOverlayState = {
  lastMovementSource: 'INIT',
  lastMovementTimestamp: Date.now(),
  hasUserInteracted: false,
  clusteringEnabled: !DIAG_DISABLE_CLUSTERING,
  autoFitEnabled: !DIAG_DISABLE_AUTOFIT,
  center: [0, 0],
  zoom: 0,
  blockedCount: 0
};

// Callback for React component to subscribe to state updates
let debugOverlayUpdateCallback: (() => void) | null = null;

function updateDebugOverlay(source: string, data?: Partial<DebugOverlayState>) {
  debugOverlayState.lastMovementSource = source;
  debugOverlayState.lastMovementTimestamp = Date.now();
  if (data) {
    Object.assign(debugOverlayState, data);
  }
  // Trigger React re-render if subscribed
  debugOverlayUpdateCallback?.();
}

// Diagnostic logging helper
function diagLog(prefix: string, label: string, data: Record<string, any>) {
  diagEventCounter++;
  const elapsed = Date.now() - diagStartTime;
  console.log(`[${prefix}] #${diagEventCounter} @${elapsed}ms | ${label} |`, JSON.stringify(data));
  
  // Update overlay state for field testing visibility
  if (prefix === 'MAP_MOVE' || prefix === 'KILL_SWITCH' || prefix === 'CLUSTER_EVENT') {
    const source = prefix === 'KILL_SWITCH' ? `BLOCKED_${label}` : label;
    updateDebugOverlay(source, {
      hasUserInteracted: data.hasUserInteracted ?? debugOverlayState.hasUserInteracted,
      blockedCount: prefix === 'KILL_SWITCH' ? debugOverlayState.blockedCount + 1 : debugOverlayState.blockedCount
    });
  }
}

// Console banner on load
console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔍 DIAGNOSTIC BUILD ACTIVE                                 ║
║  disableClustering: ${DIAG_DISABLE_CLUSTERING}                                ║
║  disableAutoFit: ${DIAG_DISABLE_AUTOFIT}                                   ║
║  hardKillSwitch: ${DIAG_HARD_KILL_SWITCH}                                   ║
║                                                             ║
║  Log prefixes to search for:                                ║
║  [MAP_MOVE] - Our viewport-changing callsites               ║
║  [MAP_EVENT] - Leaflet/plugin viewport events               ║
║  [CLUSTER_EVENT] - MarkerCluster-specific events            ║
║  [SNAPSHOT] - Viewport snapshots after user interaction     ║
║  [KILL_SWITCH] - Blocked viewport changes                   ║
╚════════════════════════════════════════════════════════════╝
`);
// ==================== END DIAGNOSTIC BUILD HEADER ====================

// Ensure mobile cluster renders & the map centers on data (flag only)
function postAddMobileRefresh(map: L.Map, cluster: L.MarkerClusterGroup) {
  if (!Flags.fixMobileMarkers || !isMobileLike) return;

  // 1) Ensure Leaflet knows container size (mobile layout often changes)
  map.invalidateSize();

  // 2) Ask MarkerCluster to (re)draw icons now
  (cluster as any).refreshClusters?.();

  // 3) If the current view doesn't intersect data, fit to data bounds
  const b = cluster.getBounds();
  if (b && b.isValid()) {
    const intersects = map.getBounds().intersects(b);
    if (!intersects) {
      map.fitBounds(b.pad(0.2), { animate: false });
    }
  }
}

// Flag-gated, idempotent CSS injector to make clusters/markers visible on mobile.
function injectMobileMarkerHotfix() {
  if (!Flags.fixMobileMarkers) return;
  if (document.getElementById("nn-mobile-marker-hotfix")) return;

  const css = `
  .leaflet-marker-pane{ z-index:650 !important; display:block !important; opacity:1 !important; }
  /* Visible cluster bubbles even if MarkerCluster.css didn't load in the PWA chunk */
  .marker-cluster{ width:42px !important; height:42px !important; border-radius:9999px !important;
    background:#2563eb !important; color:#fff !important; box-shadow:0 2px 6px rgba(0,0,0,.30) !important;
    text-align:center !important; line-height:42px !important; font-weight:700 !important; }
  .marker-cluster div{ background:transparent !important; }
  .marker-cluster span{ color:#fff !important; line-height:42px !important; }
  /* Make our divIcon dots obvious */
  .nn-divicon-wrapper > div{ outline:2px solid rgba(255,255,255,.75) !important; }
  `;

  const st = document.createElement("style");
  st.id = "nn-mobile-marker-hotfix";
  st.textContent = css;
  document.head.appendChild(st);

  // Nudge re-render if map/cluster are available (debug only; harmless)
  const m = (window as any)._map;
  const cl = (window as any)._cluster;
  m?.invalidateSize();
  cl?.refreshClusters?.();

  console.log("[NN] mobile marker hotfix injected");
}
import { isLikelyMobile } from '@/lib/platform';
import { Button } from './ui/button';
import { Plus, Minus, Maximize2, Minimize2, Sun, Moon } from 'lucide-react';
import { useIncidentStore } from '@/state/useIncidentStore';
import { useSearchParamsWouter } from '@/router/useSearchParamsWouter';

// --- Default Leaflet icon safety (prevents invisible markers if custom icons fail) ---
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
});

// --- Coordinate normalizer: handles lat/lng OR latitude/longitude and swaps if needed ---
type MaybeIncidentCoords = {
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
};

function toLatLng(obj: MaybeIncidentCoords): L.LatLng | null {
  const latRaw = (obj.lat ?? obj.latitude) as any;
  const lngRaw = (obj.lng ?? obj.longitude) as any;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Detect swapped coords (very common): latitude cannot exceed |90|
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    console.warn("[NN] coords look swapped; swapping", { lat, lng });
    return L.latLng(lng, lat);
  }
  return L.latLng(lat, lng);
}

interface IncidentData {
  id: string;
  lat: number;
  lng: number;
  type: 'crime' | 'suspicious' | 'safety_alert' | 'emergency';
  title: string;
  description: string;
  timestamp: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  photos?: string[]; // Photo URLs for incident images
}

interface MapViewProps {
  incidents: IncidentData[];
  center?: [number, number];
  defaultCenter?: [number, number]; // 🔒 NRP: Support for uncontrolled center
  zoom?: number;
  defaultZoom?: number; // 🔒 NRP: Support for uncontrolled zoom
  className?: string;
  onIncidentClick?: (marker: any) => void;
  mapRef?: React.MutableRefObject<L.Map | null>;
  onMapReady?: () => void;
}

export default function MapView({ 
  incidents, 
  center = [17.0658, -22.5597], // Default to Windhoek, Namibia
  defaultCenter, // 🔒 NRP: uncontrolled center prop
  zoom = 12,
  defaultZoom, // 🔒 NRP: uncontrolled zoom prop
  className = "w-full h-96",
  onIncidentClick,
  mapRef,
  onMapReady
}: MapViewProps) {
  // 🔒 NRP: Use defaults if provided, otherwise controlled props
  const initialCenter = defaultCenter ?? center;
  const initialZoom = defaultZoom ?? zoom;
  const mapContainer = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const map = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerByIdRef = useRef(new Map<string, L.Marker>());
  const prevKeyRef = useRef<string>("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    // Check if document has dark class (sync with main app theme)
    return document.documentElement.classList.contains('dark');
  });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ==================== DEBUG OVERLAY STATE ====================
  const [debugOverlayTick, setDebugOverlayTick] = useState(0);
  
  // Subscribe to debug overlay updates
  useEffect(() => {
    if (!DIAG_SHOW_OVERLAY) return;
    debugOverlayUpdateCallback = () => setDebugOverlayTick(t => t + 1);
    return () => { debugOverlayUpdateCallback = null; };
  }, []);
  
  // 🔒 NRP: Auto-center guard (runs once on first load)
  const hasAutoCentered = useRef(false);
  const hasAutoCenteredFromProp = useRef(false);
  
  // FIX #2B: Track user interaction to prevent auto-zoom from overriding user pans/zooms
  const hasUserInteracted = useRef(false);
  const didInitialAutoFit = useRef(false);
  const hasAppliedLocalStorageFallback = useRef(false);
  // FIX #2B: Track programmatic zoom/pan to distinguish from user gestures
  const isProgrammaticMove = useRef(false);
  // FIX: Track last focused ID to make focus centering one-shot per ID
  const lastFocusedCoordsRef = useRef<string | null>(null);

  // Focus params from URL
  const sp = useSearchParamsWouter();
  const focusLat = Number(sp.get("lat"));
  const focusLng = Number(sp.get("lng"));
  const focusZoom = Number(sp.get("z") ?? 17);
  const shouldHighlight = sp.get("highlight") === "1";
  
  // ==================== GOVERNOR DIAGNOSTIC STATE ====================
  // ALWAYS ENABLED - no URL param needed for debugging
  const isGovernorDiagMode = true; // Always show diagnostic button
  const [governorDiagTick, setGovernorDiagTick] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [diagSheetOpen, setDiagSheetOpen] = useState(false);
  
  // Subscribe to governor diagnostic updates - always active
  useEffect(() => {
    governorDiagUpdateCallback = () => setGovernorDiagTick(t => t + 1);
    return () => { governorDiagUpdateCallback = null; };
  }, []);
  
  // Copy report to clipboard handler
  const handleCopyReport = useCallback(async () => {
    const report = governorGenerateReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  }, []);
  
  // Reset log handler
  const handleResetLog = useCallback(() => {
    governorReset();
  }, []);
  
  // 🔒 NRP: Fix snap-back - only focus if we have valid non-zero coordinates
  const hasFocus = NRP_UNIFY_CLUSTER 
    ? (Number.isFinite(focusLat) && Number.isFinite(focusLng) && 
       focusLat !== 0 && focusLng !== 0 &&
       Math.abs(focusLat) <= 90 && Math.abs(focusLng) <= 180)
    : (Number.isFinite(focusLat) && Number.isFinite(focusLng));

  // 1) GPT Mobile Diagnostic: Confirm incidents are arriving  
  console.log("[Mobile] incidents count:", incidents?.length ?? -1);

  // Set body attribute for flag-gated CSS when mobile markers are enabled
  useEffect(() => {
    if (Flags.fixMobileMarkers) {
      document.body.setAttribute('data-mobile-markers', '1');
      console.log('[Debug] Set data-mobile-markers=1 for CSS override');
    } else {
      document.body.removeAttribute('data-mobile-markers');
    }
    
    return () => {
      document.body.removeAttribute('data-mobile-markers');
    };
  }, []);

  // Helper: Build fallback divIcon for mobile (cluster-compatible)
  const buildFallbackDivIcon = useCallback(({ size = 14, color = '#2563eb' } = {}) => {
    const r = size / 2;
    return L.divIcon({
      className: 'nn-divicon-wrapper',
      html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:rgba(37,99,235,0.15);border:2px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,.25)"></div>`,
      iconSize: [size, size],
      iconAnchor: [r, r],
      popupAnchor: [0, -r],
    });
  }, []);

  // Centralized marker addition with gated fallback
  const addIncidentToCluster = useCallback((inc: any) => {
    if (!clusterRef.current) return;
    
    // ignore probes (if you added probes earlier)
    if (
      inc?.type === "__probe__" ||
      inc?.category === "__probe__" ||
      (inc as any)?.metadata?.probe
    ) return;

    // remove any optimistic dot for this id
    (window as any).__nnRemoveSimpleDot?.(inc.id);

    const ll = toLatLng(inc);
    if (!ll) {
      console.warn("[NN] dropped incident with bad coords", inc);
      return;
    }
    const icon = typeof getIncidentIcon === "function" ? getIncidentIcon(inc.type) : null;

    let layer: L.Layer;

    // Desktop path unchanged (uses image icons)
    if (!Flags.fixMobileMarkers || !isMobileLike) {
      layer = L.marker(ll, { icon: icon || undefined, title: inc.title ?? inc.type });
    } else {
      // FLAGGED MOBILE PATH: guaranteed Marker with divIcon (cluster-compatible)
      const divIcon = L.divIcon({
        className: 'nn-divicon-wrapper',
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:rgba(37,99,235,.18);border:2px solid #2563eb;box-shadow:0 1px 2px rgba(0,0,0,.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7], 
        popupAnchor: [0, -7]
      });
      layer = L.marker(ll, { icon: divIcon, title: inc.title ?? inc.type });
    }

    (layer as any).incidentId = inc.id;
    layer.addTo(clusterRef.current);
    
    // Simple canary kill-switch protection
    if (Flags.fixMobileMarkers) {
      if (!(window as any).__nnDiag) (window as any).__nnDiag = { created: 0 };
      (window as any).__nnDiag.created++;
      if ((window as any).__nnDiag.created === 10) {
        const childCount = clusterRef.current.getLayers().length;
        if (childCount === 0) {
          console.warn('[NN] Canary: zero layers after 10 adds. Disabling fallback for this session.');
          localStorage.setItem('NN_FIX_MOBILE_MARKERS', '0'); // kill-switch
        }
      }
    }
    
    // Update debug counter
    const el = document.getElementById("nn-debug-count");
    if (el) el.textContent = `markers: ${clusterRef.current.getLayers().length}`;
    
    return layer;
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newIsDark = document.documentElement.classList.contains('dark');
      if (newIsDark !== isDarkTheme) {
        setIsDarkTheme(newIsDark);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [isDarkTheme]);

  // Expose method to zoom to incident (explicit user action - allowed even after interaction)
  // This is called when user taps an incident in the list to view it on the map
  const zoomToIncident = useCallback((incidentId: string) => {
    if (!map.current) return;
    
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;
    
    const lat = incident.lat ?? (incident as any).latitude;
    const lng = incident.lng ?? (incident as any).longitude;
    
    if (lat === undefined || lng === undefined) return;
    
    const latNum = parseFloat(lat.toString());
    const lngNum = parseFloat(lng.toString());
    
    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && 
        latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
      // Mark as programmatic to prevent this from triggering hasUserInteracted
      isProgrammaticMove.current = true;
      console.log("[Map] PROGRAMMATIC: zoomToIncident", incidentId, [latNum, lngNum]);
      updateDebugOverlay('ZOOM_TO_INCIDENT');
      map.current.setView([latNum, lngNum], 19, { animate: true });
      // isProgrammaticMove reset handled by moveend/zoomend events
    }
  }, [incidents]);

  // Expose zoomToIncident method to parent component
  useEffect(() => {
    // Always store reference for parent to call
    (window as any).mapZoomToIncident = zoomToIncident;
  }, [zoomToIncident]);

  // Map ref and onMapReady now handled in whenReady callback above

  // Get marker color based on incident type
  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'crime': return '#ef4444'; // red
      case 'suspicious': return '#8b5cf6'; // purple
      case 'safety_alert': return '#f97316'; // orange
      case 'emergency': return '#dc2626'; // dark red
      default: return '#6b7280'; // gray
    }
  };

  // Create incident marker with proper icon
  const createIncidentMarker = (incident: IncidentData) => {
    return getIncidentIcon(incident.type);
  };

  // Create popup content
  const createPopupContent = (incident: IncidentData) => {
    const severityColor = {
      low: '#10b981',
      medium: '#f59e0b', 
      high: '#ef4444',
      critical: '#dc2626'
    }[incident.severity];

    // Generate photos section with proper lazy loading and fallbacks
    let photosHTML = '';
    if (incident.photos && incident.photos.length > 0) {
      const photoElements = incident.photos.slice(0, 3).map((photoUrl, idx) => `
        <button
          type="button"
          class="w-16 h-16 rounded bg-gray-800/60 border border-gray-700/60 focus:ring-2 focus:ring-blue-500 tap-target"
          aria-label="Open photo ${idx + 1}"
          onclick="window.open('${photoUrl}', '_blank')"
        >
          <img
            src="${photoUrl}"
            alt="Incident photo ${idx + 1}"
            class="w-full h-full rounded object-cover"
            loading="lazy"
            decoding="async"
            onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\"w-full h-full rounded glass-card flex items-center justify-center text-gray-400\">📷</div>';"
          />
        </button>
      `).join('');
      
      const extraCount = incident.photos.length > 3 ? 
        `<div class="w-16 h-16 rounded glass-card flex items-center justify-center text-xs text-gray-400">+${incident.photos.length - 3}</div>` : '';
      
      photosHTML = `
        <div class="mb-2">
          <div class="flex gap-1 overflow-x-auto">
            ${photoElements}
            ${extraCount}
          </div>
          <p class="text-xs text-gray-400 mt-1">📸 ${incident.photos.length} photo${incident.photos.length !== 1 ? 's' : ''}</p>
        </div>
      `;
    }

    const titleColor = isDarkTheme ? 'text-white' : 'text-gray-900';
    const descColor = isDarkTheme ? 'text-gray-300' : 'text-gray-700';
    const metaColor = isDarkTheme ? 'text-gray-400' : 'text-gray-600';
    const categoryColor = isDarkTheme ? 'text-gray-300' : 'text-gray-600';

    return `
      <div class="glass-card rounded-xl p-3 max-w-xs">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-sm ${titleColor}">${incident.title}</h3>
          <span class="px-2 py-1 text-xs rounded-full" style="background-color: ${severityColor}; color: white;">
            ${incident.severity}
          </span>
        </div>
        <div class="mb-2">
          <span class="inline-block px-2 py-1 text-xs rounded-full glass-toolbar ${categoryColor}">
            ${incident.category}
          </span>
        </div>
        <p class="text-sm ${descColor} mb-2">${incident.description}</p>
        ${photosHTML}
        <p class="text-xs ${metaColor}">${incident.timestamp}</p>
      </div>
    `;
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Initialize Leaflet map
      map.current = L.map(mapContainer.current, {
        center: [initialCenter[1], initialCenter[0]], // 🔒 NRP: Use calculated initial center
        zoom: initialZoom, // 🔒 NRP: Use calculated initial zoom
        maxZoom: 19, // Fix: specify maxZoom to prevent map crashes
        zoomControl: false, // Disable default zoom controls
        attributionControl: true,
        // Flag-gated: disable zoom animations on mobile to prevent crashes
        zoomAnimation: !(Flags.fixMobileMarkers && isMobileLike),
        markerZoomAnimation: !(Flags.fixMobileMarkers && isMobileLike),
        fadeAnimation: !(Flags.fixMobileMarkers && isMobileLike)
      });

      // Defensive guard: prevent Leaflet marker zoom crash (flag-gated mobile only)
      if (Flags.fixMobileMarkers && isMobileLike && (L as any).Marker && !(L as any).Marker.__nnPatched) {
        const P = (L as any).Marker.prototype as any;
        const original = P._animateZoom;
        P._animateZoom = function(e: any) {
          if (!this._map) return; // prevents "_latLngToNewLayerPoint" on null
          return original.call(this, e);
        };
        (L as any).Marker.__nnPatched = true;
        console.log('[Debug] Applied Leaflet marker zoom crash fix');
      }

      // Set ref and mark ready in single callback - GPT's surgical timing fix
      if (mapRef) {
        mapRef.current = map.current;  // set ref first
      }

      // ==================== DIAGNOSTIC: Viewport Method Wrappers ====================
      // Wrap ALL viewport-changing methods with comprehensive logging + HARD KILL SWITCH
      const m = map.current;
      const getViewportState = () => {
        const c = m.getCenter();
        return { center: [c.lat.toFixed(5), c.lng.toFixed(5)], zoom: m.getZoom() };
      };
      
      // Store original methods
      const origSetView = m.setView.bind(m);
      const origFitBounds = m.fitBounds.bind(m);
      const origFlyTo = m.flyTo.bind(m);
      const origFlyToBounds = m.flyToBounds.bind(m);
      const origPanTo = m.panTo.bind(m);
      const origSetZoom = m.setZoom.bind(m);
      const origInvalidateSize = m.invalidateSize.bind(m);
      
      // Wrapped setView with kill switch + FULL STACK TRACE
      (m as any).setView = function(center: L.LatLngExpression, zoom?: number, options?: L.ZoomPanOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] setView called", { center, zoom, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('setView', `center=${String(center)}, zoom=${zoom}`);
        }
        
        // HARD KILL SWITCH: Block if user has interacted
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_setView', { before, center: String(center), zoom, label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'setView', { 
          before, center: String(center), zoom, label,
          hasUserInteracted: hasUserInteracted.current,
          isProgrammaticMove: isProgrammaticMove.current
        });
        return origSetView(center, zoom, options);
      };
      
      // Wrapped fitBounds with kill switch + FULL STACK TRACE
      (m as any).fitBounds = function(bounds: L.LatLngBoundsExpression, options?: L.FitBoundsOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] fitBounds called", { bounds, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('fitBounds', `bounds=${String(bounds)}`);
        }
        
        // HARD KILL SWITCH: Block if user has interacted
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_fitBounds', { before, bounds: String(bounds), label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'fitBounds', { 
          before, bounds: String(bounds), label,
          hasUserInteracted: hasUserInteracted.current,
          isProgrammaticMove: isProgrammaticMove.current
        });
        return origFitBounds(bounds, options);
      };
      
      // Wrapped flyTo with kill switch + FULL STACK TRACE
      (m as any).flyTo = function(latlng: L.LatLngExpression, zoom?: number, options?: L.ZoomPanOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] flyTo called", { latlng, zoom, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('flyTo', `latlng=${String(latlng)}, zoom=${zoom}`);
        }
        
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_flyTo', { before, latlng: String(latlng), zoom, label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'flyTo', { before, latlng: String(latlng), zoom, label, hasUserInteracted: hasUserInteracted.current });
        return origFlyTo(latlng, zoom, options);
      };
      
      // Wrapped flyToBounds with kill switch + FULL STACK TRACE
      (m as any).flyToBounds = function(bounds: L.LatLngBoundsExpression, options?: L.FitBoundsOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] flyToBounds called", { bounds, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('flyToBounds', `bounds=${String(bounds)}`);
        }
        
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_flyToBounds', { before, bounds: String(bounds), label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'flyToBounds', { before, bounds: String(bounds), label, hasUserInteracted: hasUserInteracted.current });
        return origFlyToBounds(bounds, options);
      };
      
      // Wrapped panTo with kill switch + FULL STACK TRACE
      (m as any).panTo = function(latlng: L.LatLngExpression, options?: L.PanOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] panTo called", { latlng, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('panTo', `latlng=${String(latlng)}`);
        }
        
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_panTo', { before, latlng: String(latlng), label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'panTo', { before, latlng: String(latlng), label, hasUserInteracted: hasUserInteracted.current });
        return origPanTo(latlng, options);
      };
      
      // Wrapped setZoom with kill switch + FULL STACK TRACE
      (m as any).setZoom = function(zoom: number, options?: L.ZoomPanOptions) {
        const before = getViewportState();
        const stack = new Error().stack;
        const label = (stack?.split('\n')[2]?.trim()) || 'unknown';
        
        // FULL STACK TRACE for mobile debugging
        console.warn("[MAP] setZoom called", { zoom, options }, stack);
        
        // Governor diagnostic: track forced view
        if (isGovernorDiagMode) {
          governorRecordForcedView('setZoom', `zoom=${zoom}`);
        }
        
        if (DIAG_HARD_KILL_SWITCH && hasUserInteracted.current && !isProgrammaticMove.current) {
          diagLog('KILL_SWITCH', 'BLOCKED_setZoom', { before, zoom, label, hasUserInteracted: true });
          return m;
        }
        
        diagLog('MAP_MOVE', 'setZoom', { before, zoom, label, hasUserInteracted: hasUserInteracted.current });
        return origSetZoom(zoom, options);
      };
      
      // Wrapped invalidateSize (logs only, no kill - but logs for chain detection)
      (m as any).invalidateSize = function(...args: any[]) {
        const before = getViewportState();
        diagLog('MAP_MOVE', 'invalidateSize', { before, hasUserInteracted: hasUserInteracted.current });
        const result = origInvalidateSize(...args);
        // Check if viewport changed after invalidateSize
        setTimeout(() => {
          const after = getViewportState();
          if (before.center[0] !== after.center[0] || before.center[1] !== after.center[1] || before.zoom !== after.zoom) {
            diagLog('MAP_MOVE', 'invalidateSize_CAUSED_CHANGE', { before, after });
          }
        }, 100);
        return result;
      };
      
      // ==================== DIAGNOSTIC: Leaflet Event Logging ====================
      // User-requested explicit gesture event logging + Governor tracking
      m.on("zoomstart", () => {
        console.log("[MAP] zoomstart");
        if (isGovernorDiagMode) governorRecordZoomstart();
      });
      m.on("zoomend", () => {
        console.log("[MAP] zoomend", m.getZoom(), m.getCenter());
        if (isGovernorDiagMode) governorRecordZoomend(m.getZoom(), m.getCenter());
      });
      m.on("movestart", () => console.log("[MAP] movestart"));
      m.on("moveend", () => {
        console.log("[MAP] moveend", m.getZoom(), m.getCenter());
        if (isGovernorDiagMode) governorRecordMoveend(m.getZoom(), m.getCenter());
      });
      
      // Additional diagnostic event logging
      const leafletEvents = ['zoom', 'move', 'dragstart', 'dragend', 'resize'];
      leafletEvents.forEach(eventName => {
        m.on(eventName, () => {
          diagLog('MAP_EVENT', eventName, {
            ...getViewportState(),
            hasUserInteracted: hasUserInteracted.current,
            isProgrammaticMove: isProgrammaticMove.current
          });
        });
      });
      
      // ==================== DIAGNOSTIC: Viewport Snapshot Logger ====================
      // After any user interaction, log viewport at 0ms, 300ms, 1s, 2s to catch snap-back timing
      let snapshotTimers: number[] = [];
      const takeSnapshots = (trigger: string) => {
        // Clear any pending timers
        snapshotTimers.forEach(t => clearTimeout(t));
        snapshotTimers = [];
        
        const initialState = getViewportState();
        diagLog('SNAPSHOT', `${trigger}_0ms`, { ...initialState, trigger });
        
        [300, 1000, 2000].forEach(delay => {
          const timer = window.setTimeout(() => {
            const currentState = getViewportState();
            const changed = initialState.center[0] !== currentState.center[0] || 
                           initialState.center[1] !== currentState.center[1] || 
                           initialState.zoom !== currentState.zoom;
            diagLog('SNAPSHOT', `${trigger}_${delay}ms`, { 
              ...currentState, 
              changed,
              delta: changed ? { 
                lat: (parseFloat(currentState.center[0]) - parseFloat(initialState.center[0])).toFixed(5),
                lng: (parseFloat(currentState.center[1]) - parseFloat(initialState.center[1])).toFixed(5),
                zoom: currentState.zoom - initialState.zoom
              } : null
            });
          }, delay);
          snapshotTimers.push(timer);
        });
      };
      
      // Trigger snapshots on user interaction events
      m.on('dragend', () => takeSnapshots('dragend'));
      m.on('zoomend', () => {
        if (!isProgrammaticMove.current) takeSnapshots('zoomend_user');
      });
      
      // Use Leaflet's whenReady for proper timing
      map.current.whenReady(() => {
        // Safety after first render to avoid _leaflet_pos errors  
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize();
            console.log("[Map] Leaflet whenReady fired");
          }
        }, 0);
        
        // Mark as loaded for internal state
        setMapLoaded(true);
      });
      
      // Call parent's onMapReady in next tick to avoid re-render loops
      setTimeout(() => {
        if (onMapReady) {
          onMapReady();
        }
      }, 0);

      // Add zoom control to top-left and attribution to bottom-right
      L.control.zoom({ position: "topleft" }).addTo(map.current);
      map.current.attributionControl.setPosition("bottomright");

      // Listen for zoom changes
      map.current.on('zoomend', () => {
        if (map.current) {
          setCurrentZoom(map.current.getZoom());
        }
      });
      
      // FIX #2B: Track user interactions to prevent auto-zoom from overriding user pans/zooms
      // PERMANENT FLAG: Once user interacts, no more programmatic viewport changes allowed
      // Expanded detection: dragstart, zoomstart, movestart, touchstart (mobile pinch triggers move)
      const markUserInteraction = (eventName: string) => {
        // Skip if already marked or if this is a programmatic move in progress
        if (hasUserInteracted.current) return;
        if (isProgrammaticMove.current) {
          console.log(`[Map] ${eventName} ignored (isProgrammaticMove=true)`);
          return;
        }
        hasUserInteracted.current = true;
        console.log(`[Map] USER_INTERACTION: ${eventName} | hasUserInteracted=true (LOCKED)`);
        // Update debug overlay
        updateDebugOverlay('USER', { hasUserInteracted: true });
      };
      
      map.current.on('dragstart', () => markUserInteraction('dragstart'));
      map.current.on('zoomstart', () => markUserInteraction('zoomstart'));
      map.current.on('movestart', () => markUserInteraction('movestart'));
      
      // Mobile pinch zoom: touchstart on map container (with cleanup ref)
      const touchContainer = mapContainer.current;
      const touchStartHandler = () => {
        if (hasUserInteracted.current) return;
        if (isProgrammaticMove.current) return;
        hasUserInteracted.current = true;
        console.log("[Map] USER_INTERACTION: touchstart | hasUserInteracted=true (LOCKED)");
        // Update debug overlay
        updateDebugOverlay('USER_TOUCH', { hasUserInteracted: true });
      };
      touchContainer?.addEventListener('touchstart', touchStartHandler, { passive: true });
      // Store for cleanup
      (map.current as any)._nnTouchHandler = touchStartHandler;
      (map.current as any)._nnTouchContainer = touchContainer;
      
      // FIX: Reset isProgrammaticMove on moveend/zoomend instead of timers
      map.current.on('moveend', () => {
        if (isProgrammaticMove.current) {
          isProgrammaticMove.current = false;
          console.log("[Map] moveend: isProgrammaticMove reset to false");
        }
      });
      map.current.on('zoomend', () => {
        if (isProgrammaticMove.current) {
          isProgrammaticMove.current = false;
          console.log("[Map] zoomend: isProgrammaticMove reset to false");
        }
      });

      // Add initial tile layer based on theme preference. Tile URLs,
      // attribution and provider-key handling come from lib/mapTiles so this
      // component cannot drift from the one the /community/map route renders.
      const initialTiles = MAP_STYLES[isDarkTheme ? 'dark' : 'light'];
      if (initialTiles.available) {
        tileLayerRef.current = L.tileLayer(initialTiles.url, {
          attribution: initialTiles.attribution,
          subdomains: initialTiles.subdomains,
          maxZoom: initialTiles.maxZoom
        }).addTo(map.current);
      }

      // Create and add cluster layer using singleton
      // 2) GPT Mobile Diagnostic: Confirm we create & attach cluster group  
      console.log("[Mobile] creating cluster group");
      
      // GPT's defensive create+attach (2-3 lines)
      try {
        const existing = clusterRef.current;
        const cluster =
          existing ??
          (clusterRef.current = createClusterGroup?.() ?? ensureCluster?.(map.current));

        console.log("[Mobile] cluster created:", !!cluster);

        if (cluster && map.current && !map.current.hasLayer(cluster)) {
          map.current.addLayer(cluster);
          console.log("[Mobile] cluster added to map:", map.current.hasLayer(cluster));
        }

        // Flag-gated: ensure cluster attachment and debug exports
        if (Flags.fixMobileMarkers && isMobileLike && map.current && cluster) {
          if (!map.current.hasLayer(cluster)) {
            map.current.addLayer(cluster);
          }
          // NEW: render/center once attached (one-shot, guarded by hasUserInteracted)
          // FIX: Guard postAddMobileRefresh - never run after user interaction
          if (!hasUserInteracted.current) {
            isProgrammaticMove.current = true;
            console.log("[Map] PROGRAMMATIC: postAddMobileRefresh");
            updateDebugOverlay('MOBILE_REFRESH');
            postAddMobileRefresh(map.current, cluster);
            // isProgrammaticMove reset handled by moveend/zoomend events
          }
        }
        
        // Debug exports (flag-gated only, helps verification)
        if (Flags.fixMobileMarkers) {
          (window as any)._map = map.current;
          (window as any)._cluster = cluster;
          console.log('[Debug] Debug exports set for testing');
        }
        
        // Apply mobile marker hotfix after map and cluster are ready
        if (Flags.fixMobileMarkers) {
          injectMobileMarkerHotfix();
        }
        
        // ==================== DIAGNOSTIC: MarkerCluster Event Logging ====================
        if (cluster) {
          const clusterEvents = ['spiderfied', 'unspiderfied', 'animationend', 'clusterclick'];
          clusterEvents.forEach(eventName => {
            cluster.on(eventName, () => {
              const c = m.getCenter();
              diagLog('CLUSTER_EVENT', eventName, {
                center: [c.lat.toFixed(5), c.lng.toFixed(5)],
                zoom: m.getZoom(),
                hasUserInteracted: hasUserInteracted.current
              });
            });
          });
          console.log('[DIAGNOSTIC] MarkerCluster event logging attached');
        }
      } catch (e) {
        console.error("[Mobile] cluster creation error:", e);
      }

      // === Simple severity dots (always on, sits above everything) ===
      const nnPane = map.current.createPane("nnTop");
      nnPane.style.zIndex = "650";          // above markerPane(600)
      nnPane.style.pointerEvents = "none";

      (function ensureSimpleDots() {
        const w = window as any;
        if (!w.__nnSimpleDots) {
          const group = L.layerGroup();
          const byId = new Map<string, L.CircleMarker>();

          const severityColor: Record<string, string> = {
            low: "#facc15",      // yellow
            medium: "#f59e0b",   // amber
            high: "#ef4444",     // red
            critical: "#b91c1c", // darker red
          };

          const add = (id: string, lat: number, lng: number, severity: string = "low") => {
            if (byId.has(id)) return;
            const color = severityColor[severity] || "#f59e0b";
            const m = L.circleMarker([lat, lng], {
              pane: "nnTop",
              radius: 9,
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.95,
            }).addTo(group);
            byId.set(id, m);
          };

          const remove = (id: string) => {
            const m = byId.get(id);
            if (!m) return;
            group.removeLayer(m);
            byId.delete(id);
          };

          w.__nnSimpleDots = { group, add, remove };
        }
        const dots = (window as any).__nnSimpleDots;
        if (!map.current!.hasLayer(dots.group)) dots.group.addTo(map.current!);
      })();

      // Keep legacy functions for backward compatibility
      (window as any).__nnSimpleDot = function addSimpleDot(
        id: string,
        lat: number,
        lng: number,
        severity: string = "low"
      ) {
        (window as any).__nnSimpleDots?.add(id, lat, lng, severity);
      };

      (window as any).__nnRemoveSimpleDot = function removeSimpleDot(id: string) {
        (window as any).__nnSimpleDots?.remove(id);
      };

      // provide a safe stub to kill the runtime error you're seeing
      (window as any).refreshClusterFor = (/* _bbox? */) => {};

      // Store map reference globally for coordinate fallback
      (window as any).__nnMap = map.current;

      // Feature-flagged debug elements (only show with ?debug=1)
      if (showDebug) {
        const DebugCounter = L.Control.extend({
          onAdd: function() {
            const div = L.DomUtil.create("div", "nn-debug-counter");
            div.id = "nn-debug-count";
            div.textContent = "markers: 0";
            div.style.cssText = "background: rgba(255,255,255,0.8); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #333;";
            return div;
          }
        });
        new DebugCounter({ position: "topleft" }).addTo(map.current);

        const updateCount = () => {
          const el = document.getElementById("nn-debug-count");
          if (el && clusterRef.current) el.textContent = `markers: ${clusterRef.current.getLayers().length}`;
        };

        // keep the counter in sync with cluster changes
        if (clusterRef.current) {
          clusterRef.current.on("layeradd", updateCount);
          clusterRef.current.on("layerremove", updateCount);
        }

        // Sanity markers for debugging
        if (clusterRef.current) {
          const sanity = L.latLng(-33.9249, 18.4241);
          L.marker(sanity, { title: "sanity" }).addTo(clusterRef.current);
          L.circleMarker(sanity, { radius: 8, color: "#2563eb", weight: 2, fillOpacity: 0.9 })
            .addTo(clusterRef.current)
            .bindTooltip("sanity-circle");
          updateCount();
        }
      }

      // Debug helpers for console testing (flag-gated)
      if (Flags.fixMobileMarkers) {
        // expose map and cluster with expected names for diagnostics
        (window as any)._map = map.current;
        (window as any).map = map.current;
        (window as any)._cluster = clusterRef.current;
        (window as any).clusterRef = { current: clusterRef.current };
        
        // ensure cluster is attached to map
        if (map.current && clusterRef.current && !map.current.hasLayer(clusterRef.current)) {
          map.current.addLayer(clusterRef.current);
          console.log('[Debug] Cluster attached to map via flag-gated debug export');
        }
      }
      
      // Original debug helpers (always available)
      (window as any).__nnMap = map.current;
      (window as any).__nnCluster = clusterRef.current;
      (window as any).__nnAddDebug = (lat: number, lng: number) => {
        if (!clusterRef.current) return null;
        const m = L.marker([lat, lng]).addTo(clusterRef.current);
        const updateCount = () => {
          const el = document.getElementById("nn-debug-count");
          if (el && clusterRef.current) el.textContent = `markers: ${clusterRef.current.getLayers().length}`;
        };
        updateCount();
        return m;
      };
      
      // Orphan scanner for debugging cluster mismatches
      (window as any).__nnScan = () => {
        const orphans: any[] = [];
        map.current!.eachLayer((l: any) => {
          if (l instanceof L.Marker && clusterRef.current && !clusterRef.current.hasLayer(l)) orphans.push(l);
        });
        console.log("[NN] cluster count:", clusterRef.current?.getLayers().length || 0, "orphans:", orphans.length, orphans);
      };
      
      // Quick fly-to helper for @RDM (debug only, but mark as programmatic for safety)
      (window as any).__nnFly = (lat: number, lng: number, z = 14) => {
        isProgrammaticMove.current = true;
        console.log("[Map] PROGRAMMATIC: __nnFly debug helper", [lat, lng], z);
        updateDebugOverlay('DEBUG_FLY');
        map.current?.setView([lat, lng], z);
        // isProgrammaticMove reset handled by moveend/zoomend events
      };

      // De-duplicated marker management system with probe filtering
      const addIncidentToCluster = (inc: { id: string; type: string; latitude?: number; longitude?: number; lat?: number; lng?: number; title?: string; category?: string; metadata?: any; severity?: string; }) => {
        if (!clusterRef.current) return;
        
        // Filter out probe incidents so they never render on map
        if (inc.type === "__probe__" || inc.category === "__probe__" || inc.metadata?.probe) {
          return;
        }
        
        if (inc.id && seenIds.current.has(inc.id)) return; // de-dup
        if (inc.id) seenIds.current.add(inc.id);

        const lat = Number(inc.lat ?? inc.latitude);
        const lng = Number(inc.lng ?? inc.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // BEFORE cluster add: add severity dot
        (window as any).__nnSimpleDots?.add(
          inc.id,
          lat,
          lng,
          inc.severity || "low"
        );

        const ll = Math.abs(lat) > 90 && Math.abs(lng) <= 90 ? L.latLng(lng, lat) : L.latLng(lat, lng);
        const icon = getIncidentIcon?.(inc.type);
        
        // Enhanced fallback circle marker with severity colors
        const severityColor: Record<string, string> = {
          low: "#facc15",
          medium: "#f59e0b",
          high: "#ef4444",
          critical: "#b91c1c",
        };

        const layer = icon
          ? L.marker(ll, { icon, title: inc.title ?? inc.type })
          : (L.circleMarker(ll, {
              pane: "nnTop",                  // ensure visibility
              radius: 9,
              color: severityColor[inc.severity || "low"] || "#f59e0b",
              weight: 2,
              fillColor: severityColor[inc.severity || "low"] || "#f59e0b",
              fillOpacity: 0.95,
            }) as unknown as L.Marker);

        (layer as any).incidentId = inc.id;
        clusterRef.current.addLayer(layer);

        // Remove the severity dot when real marker is added
        (window as any).__nnSimpleDots?.remove(inc.id);

        if (showDebug) {
          const el = document.getElementById("nn-debug-count");
          if (el && clusterRef.current) el.textContent = `markers: ${clusterRef.current.getLayers().length}`;
        }
      };

      // Store helper globally for use
      (window as any).__nnAddIncident = addIncidentToCluster;

      // Mobile layout & orientation resiliency
      const invalidate = () => {
        updateDebugOverlay('RESIZE');
        setTimeout(() => map.current?.invalidateSize(), 0);
      };
      window.addEventListener("resize", invalidate);
      window.addEventListener("orientationchange", invalidate);
      const container = mapContainer.current;
      const ro = new ResizeObserver(invalidate);
      if (container) ro.observe(container);
      
      // Store cleanup references for use in return function
      (map.current as any)._nnInvalidate = invalidate;
      (map.current as any)._nnResizeObserver = ro;

      setMapLoaded(true);

    } catch (error) {
      // Map initialization failed
      setMapLoaded(true); // Still allow the component to work
    }

    // Cleanup on unmount
    return () => {
      if (map.current) {
        const invalidateFn = (map.current as any)._nnInvalidate;
        const resizeObs = (map.current as any)._nnResizeObserver;
        const touchHandler = (map.current as any)._nnTouchHandler;
        const touchContainer = (map.current as any)._nnTouchContainer;
        
        if (invalidateFn) {
          window.removeEventListener("resize", invalidateFn);
          window.removeEventListener("orientationchange", invalidateFn);
        }
        if (resizeObs) {
          resizeObs.disconnect();
        }
        // FIX: Clean up touchstart listener
        if (touchHandler && touchContainer) {
          touchContainer.removeEventListener('touchstart', touchHandler);
        }
        
        try {
          map.current.remove();
        } catch (error) {
          // Cleanup error ignored
        }
        map.current = null;
        clusterRef.current = null;
      }
      setMapLoaded(false);
    };
  }, []); // Only initialize once - center/zoom changes handled in separate useEffects

  // 🔒 NRP: Only honor explicit center prop (Guard A)
  useEffect(() => {
    console.log("[CenterEffect] firing | center=", center, "hasUserInteracted=", hasUserInteracted.current, "hasAutoCenteredFromProp=", hasAutoCenteredFromProp.current);
    
    // A) Early return unless a real center prop is provided
    if (!center) {
      console.log("[CenterEffect] SKIPPED - no center prop provided");
      return;
    }
    
    // FIX: Never override user's pan/zoom
    if (hasUserInteracted.current) {
      console.log("[CenterEffect] SKIPPED - user has interacted with map");
      return;
    }
    
    // A) One-time guard for explicit center props
    if (hasAutoCenteredFromProp.current) {
      console.log("[CenterEffect] SKIPPED - already auto-centered from prop");
      return;
    }
    
    if (map.current && mapLoaded) {
      try {
        // D) Ensure consistent coordinate order [lat, lng] for Leaflet
        const lat = center[1];
        const lng = center[0];
        if (Number.isFinite(lat) && Number.isFinite(lng) && 
            lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          console.log("[CenterEffect] PROGRAMMATIC setView:", [lat, lng], zoom);
          isProgrammaticMove.current = true;
          updateDebugOverlay('CENTER_PROP');
          map.current.setView([lat, lng], zoom);
          // isProgrammaticMove reset handled by moveend/zoomend events
          hasAutoCenteredFromProp.current = true; // A) Mark as centered
        }
      } catch (error) {
        // Map center update failed
      }
    }
  }, [center, defaultCenter, mapLoaded, zoom]);

  // 🔧 Track incidents length transitions for diagnostics
  useEffect(() => {
    console.log("[Map] incidents length ->", incidents.length);
  }, [incidents.length]);

  // Update markers when incidents change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    try {
      // Guard against excessive marker rebuilds
      const keyOf = (i: any) => `${i.id}-${i.lat ?? i.latitude}-${i.lng ?? i.longitude}-${i.type}`;
      const currentKey = incidents.map(keyOf).join("|");
      if (prevKeyRef.current === currentKey) {
        return;
      }
      prevKeyRef.current = currentKey;

      // Clear existing markers
      markersRef.current.forEach(marker => {
        try {
          map.current?.removeLayer(marker);
        } catch (error) {
          // Ignore removal errors
        }
      });
      markersRef.current = [];
      markerByIdRef.current.clear();

      // Clear accuracy circles
      circlesRef.current.forEach(circle => {
        try {
          map.current?.removeLayer(circle);
        } catch (error) {
          // Circle removal error ignored
        }
      });
      circlesRef.current = [];

      console.log("[MOBILE SIMPLE] Creating direct markers for:", incidents.length, "incidents");
      console.log("[DIAGNOSTIC] disableClustering:", DIAG_DISABLE_CLUSTERING, "disableAutoFit:", DIAG_DISABLE_AUTOFIT);
      
      // DIAGNOSTIC: When disableClustering=true, skip clustering entirely
      // MOBILE DIRECT APPROACH: Skip clustering entirely, add simple visible markers
      if (DIAG_DISABLE_CLUSTERING || (Flags.fixMobileMarkers && isMobileLike)) {
        console.log("[DIAGNOSTIC] Rendering WITHOUT clustering (plain markers)");
        
        incidents.forEach(incident => {
          try {
            const lat = Number(incident.lat ?? (incident as any).latitude);
            const lng = Number(incident.lng ?? (incident as any).longitude);
            
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            
            // Create bright, visible circle marker
            const marker = L.circleMarker([lat, lng], {
              radius: 12,
              color: '#ff0000',
              weight: 3,
              fillColor: '#ffff00', 
              fillOpacity: 0.8
            });

            marker.addTo(map.current!);
            markersRef.current.push(marker as any);
            
            // Add popup
            marker.bindPopup(`<strong>${incident.title || 'Incident'}</strong><br>${incident.description || 'No description'}`);
            
            console.log("[MOBILE SIMPLE] Added marker at:", lat, lng);
          } catch (error) {
            console.warn("[MOBILE SIMPLE] Error creating marker:", error);
          }
        });
      } else {
        // Desktop clustering approach
        if (!clusterRef.current) return;
        
        const cluster = clusterRef.current;
        cluster.clearLayers();
        
        incidents.forEach(incident => {
          try {
            const marker = addIncidentToCluster(incident);
            if (!marker) return;

            marker.bindPopup(createPopupContent(incident), {
              maxWidth: 300,
              closeButton: true
            });

            if (onIncidentClick) {
              marker.on('click', () => {
                onIncidentClick(incident);
              });
            }

            if (marker instanceof L.Marker) {
              markerByIdRef.current.set(incident.id, marker);
            }
          } catch (error) {
            console.warn("[NN] marker creation error", error);
          }
        });
      }

      // FIX #2A: Fit map to show all markers ONLY on initial load (one-shot)
      // FIX #2B: Do NOT auto-fit if user has interacted with map (pan/zoom)
      // FIX #2C: Use didInitialAutoFit instead of incidents array in dependency
      // DIAGNOSTIC: disableAutoFit toggle skips all auto-fit logic
      console.log("[Map] Auto-fit check | hasFocus=", hasFocus, "didInitialAutoFit=", didInitialAutoFit.current, "hasUserInteracted=", hasUserInteracted.current, "incidents=", incidents.length, "disableAutoFit=", DIAG_DISABLE_AUTOFIT);
      
      if (DIAG_DISABLE_AUTOFIT) {
        console.log("[DIAGNOSTIC] Auto-fit DISABLED via toggle - skipping ALL auto-fit logic");
        didInitialAutoFit.current = true; // Mark as done to prevent future attempts
      } else if (!hasFocus && !didInitialAutoFit.current && !hasUserInteracted.current && incidents.length > 0) {
        if (map.current) {
          try {
            const group = L.featureGroup(
              incidents.map((i) => {
                const lat = i.lat ?? (i as any).latitude;
                const lng = i.lng ?? (i as any).longitude;
                return L.marker([parseFloat(lat.toString()), parseFloat(lng.toString())]);
              })
            );
            isProgrammaticMove.current = true;
            console.log("[Map] PROGRAMMATIC: Initial auto-fit fitBounds");
            updateDebugOverlay('AUTO_FIT');
            map.current.fitBounds(group.getBounds(), { maxZoom: 15, padding: [30, 30] });
            // isProgrammaticMove reset handled by moveend/zoomend events
            didInitialAutoFit.current = true;
            hasAutoCentered.current = true;
            console.log("[Map] Initial auto-fit complete, will not re-fit on incident updates");
          } catch (error) {
            // Bounds fitting error ignored
          }
        }
      } else {
        console.log("[Map] Auto-fit SKIPPED");
      }

      console.log("[MOBILE SIMPLE] Total markers on map:", markersRef.current.length);
      
    } catch (error) {
      console.error("[MOBILE SIMPLE] Marker update error:", error);
    }
  }, [incidents, mapLoaded, center, hasFocus]);

  // Focus on redirected coordinates & pulse highlight (one-shot per unique focus)
  // FIX: Guard with hasUserInteracted to prevent snap-back after user interaction
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!hasFocus) return;
    
    // FIX: CRITICAL - Never recenter after user has interacted
    if (hasUserInteracted.current) {
      console.log("[Map] Focus SKIPPED - user has interacted with map (LOCKED)");
      return;
    }

    // FIX: One-shot per unique focus coordinates to prevent repeated centering
    const focusKey = `${focusLat.toFixed(5)},${focusLng.toFixed(5)}`;
    if (lastFocusedCoordsRef.current === focusKey) {
      console.log("[Map] Focus SKIPPED - already focused on these coords:", focusKey);
      return;
    }
    lastFocusedCoordsRef.current = focusKey;

    const leafletMap = map.current;
    isProgrammaticMove.current = true;
    console.log("[Map] PROGRAMMATIC: Focus setView to", [focusLat, focusLng], focusZoom);
    updateDebugOverlay('FOCUS');
    leafletMap.setView([focusLat, focusLng], focusZoom, { animate: true });
    // isProgrammaticMove reset handled by moveend/zoomend events

    if (shouldHighlight) {
      const pulseColor = getComputedStyle(document.documentElement).getPropertyValue("--primary") || "hsl(195, 100%, 50%)";
      const pulse = L.circleMarker([focusLat, focusLng], {
        radius: 16,
        color: pulseColor,
        fillColor: pulseColor,
        fillOpacity: 0.25,
        weight: 2,
        className: "nn-pulse",
      }).addTo(leafletMap);
      
      setTimeout(() => {
        try { leafletMap.removeLayer(pulse); } catch {}
      }, 4000);
    }
  }, [hasFocus, focusLat, focusLng, focusZoom, shouldHighlight, mapLoaded]);

  // FIX #2D: Fallback: center on last incident if no URL params (first load ONLY)
  // Strengthened guards: must run before user interaction AND before auto-fit
  useEffect(() => {
    if (!map.current || !mapLoaded || hasFocus) return;
    // FIX #2D: Only run once, never after user interaction or auto-fit
    if (hasAppliedLocalStorageFallback.current) return;
    if (hasUserInteracted.current) return;
    if (didInitialAutoFit.current) return;
    
    const raw = localStorage.getItem("nn:last-incident");
    if (!raw) return;
    try {
      const { lat, lng, t } = JSON.parse(raw);
      if (Date.now() - t < 5 * 60 * 1000 && Number.isFinite(lat) && Number.isFinite(lng)) {
        isProgrammaticMove.current = true;
        console.log("[Map] PROGRAMMATIC: localStorage fallback setView to", [lat, lng]);
        updateDebugOverlay('FALLBACK');
        map.current!.setView([lat, lng], 17, { animate: true });
        // isProgrammaticMove reset handled by moveend/zoomend events
        localStorage.removeItem("nn:last-incident");
        hasAppliedLocalStorageFallback.current = true;
        console.log("[Map] Applied localStorage fallback center (one-shot)");
      }
    } catch {}
  }, [hasFocus, mapLoaded]);

  // Subscribe to selected incident for pulse animation
  useEffect(() => {
    let previousSelectedId: string | null = null;
    
    const unsubscribe = useIncidentStore.subscribe(
      (state) => {
        const selectedId = state.selectedId;
        
        // Remove pulse from previous marker
        if (previousSelectedId) {
          const prevMarker = markerByIdRef.current.get(previousSelectedId);
          const prevElement = prevMarker?.getElement?.();
          if (prevElement) {
            prevElement.classList.remove("nn-marker-pulse");
          }
        }
        
        // Add pulse to current marker
        if (selectedId) {
          const currentMarker = markerByIdRef.current.get(selectedId);
          const currentElement = currentMarker?.getElement?.();
          if (currentElement) {
            currentElement.classList.add("nn-marker-pulse");
          }
        }
        
        previousSelectedId = selectedId;
      }
    );
    
    return unsubscribe;
  }, []);

  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut();
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const toggleMapTheme = () => {
    if (!map.current || !tileLayerRef.current) return;
    
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    
    // Save preference to localStorage
    localStorage.setItem('mapTheme', newTheme ? 'dark' : 'light');
    
    // Remove current tile layer
    map.current.removeLayer(tileLayerRef.current);
    
    // Add new tile layer based on theme
    const themeTiles = MAP_STYLES[newTheme ? 'dark' : 'light'];
    if (themeTiles.available) {
      tileLayerRef.current = L.tileLayer(themeTiles.url, {
        attribution: themeTiles.attribution,
        subdomains: themeTiles.subdomains,
        maxZoom: themeTiles.maxZoom
      }).addTo(map.current);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative w-full h-full">
        <div id="nn-map" ref={mapContainer} className="w-full h-full rounded-lg bg-gray-100" />
        
        {/* Custom Zoom, Theme, and Fullscreen Controls */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 ml-[270px] mr-[270px] mt-[300px] mb-[300px]">
          {/* Zoom In Button */}
          <Button
            size="sm"
            variant="secondary"
            className="w-10 h-10 p-0 shadow-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={handleZoomIn}
            data-testid="zoom-in-button"
          >
            <Plus className="w-4 h-4" />
          </Button>
          
          {/* Zoom Out Button */}
          <Button
            size="sm"
            variant="secondary"
            className="w-10 h-10 p-0 shadow-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={handleZoomOut}
            data-testid="zoom-out-button"
          >
            <Minus className="w-4 h-4" />
          </Button>
          
          {/* Map Theme Toggle Button */}
          <Button
            size="sm"
            variant="secondary"
            className="w-10 h-10 p-0 shadow-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={toggleMapTheme}
            data-testid="map-theme-toggle-button"
            title={isDarkTheme ? "Switch to light map" : "Switch to dark map"}
          >
            {isDarkTheme ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
          
          {/* Fullscreen Toggle Button */}
          <Button
            size="sm"
            variant="secondary"
            className="w-10 h-10 p-0 shadow-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={toggleFullscreen}
            data-testid="fullscreen-toggle-button"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Zoom Level Indicator */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-md shadow-lg text-sm font-medium">
            Zoom: {currentZoom}
          </div>
        </div>
        
        {/* ==================== DEBUG OVERLAY PANEL (Kenya Field Test) ==================== */}
        {DIAG_SHOW_OVERLAY && (
          <div 
            className="absolute bottom-20 left-2 bg-black/90 text-white text-xs font-mono p-2 rounded-md shadow-lg max-w-[220px] border border-yellow-500/50"
            style={{ fontSize: '11px', lineHeight: '1.5', zIndex: 9999 }}
            data-testid="debug-overlay"
            data-tick={debugOverlayTick}
          >
            <div className="font-bold text-yellow-400 mb-1">🔍 DEBUG</div>
            <div className="space-y-0.5">
              <div>
                <span className="text-gray-400">Source:</span>{' '}
                <span className={debugOverlayState.lastMovementSource.startsWith('BLOCKED') ? 'text-red-400' : debugOverlayState.lastMovementSource === 'USER' ? 'text-green-400' : 'text-yellow-300'}>
                  {debugOverlayState.lastMovementSource}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Time:</span>{' '}
                <span className="text-white">
                  {new Date(debugOverlayState.lastMovementTimestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Interacted:</span>{' '}
                <span className={debugOverlayState.hasUserInteracted ? 'text-green-400' : 'text-gray-500'}>
                  {debugOverlayState.hasUserInteracted ? '✅ YES' : '❌ NO'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Clustering:</span>{' '}
                <span className={debugOverlayState.clusteringEnabled ? 'text-blue-400' : 'text-gray-500'}>
                  {debugOverlayState.clusteringEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">AutoFit:</span>{' '}
                <span className={debugOverlayState.autoFitEnabled ? 'text-blue-400' : 'text-gray-500'}>
                  {debugOverlayState.autoFitEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Center:</span>{' '}
                <span className="text-white">
                  {map.current ? `${map.current.getCenter().lat.toFixed(4)}, ${map.current.getCenter().lng.toFixed(4)}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Zoom:</span>{' '}
                <span className="text-white">{map.current?.getZoom() ?? '-'}</span>
              </div>
              <div>
                <span className="text-gray-400">Blocked:</span>{' '}
                <span className={debugOverlayState.blockedCount > 0 ? 'text-red-400' : 'text-gray-500'}>
                  {debugOverlayState.blockedCount}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* ==================== GOVERNOR DIAGNOSTIC: CENTERED PILL BUTTON + PANEL (?diag=1) ==================== */}
        {isGovernorDiagMode && (
          <>
            {/* Floating Pill Button - CENTER of screen (horizontal equator) */}
            <button
              onClick={() => setDiagSheetOpen(!diagSheetOpen)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-full shadow-2xl border-4 border-white"
              style={{ 
                position: 'fixed', 
                left: '50%', 
                top: '50%', 
                transform: diagSheetOpen ? 'translate(-50%, -200%)' : 'translate(-50%, -50%)',
                zIndex: 999999,
                fontSize: '18px'
              }}
              data-testid="diag-pill-button"
            >
              🔬 Diagnostics {governorDiag.forcedViewDetected ? '⚠️' : ''}
            </button>
            
            {/* Centered Panel Overlay */}
            {diagSheetOpen && (
              <div 
                className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl shadow-2xl border-4 border-blue-500"
                style={{ 
                  position: 'fixed', 
                  left: '50%', 
                  top: '50%', 
                  transform: 'translate(-50%, -50%)',
                  zIndex: 999998, 
                  width: '90vw',
                  maxWidth: '400px',
                  maxHeight: '70vh', 
                  overflowY: 'auto' 
                }}
                data-testid="diag-bottom-sheet"
                data-tick={governorDiagTick}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-2 pb-1">
                  <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                </div>
                
                {/* Header with Close */}
                <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="font-bold text-blue-600 dark:text-blue-400 text-lg flex items-center gap-2">
                    🔬 Map Diagnostics
                    <span className="text-xs font-normal text-gray-500">{governorDiag.appVersion}</span>
                  </div>
                  <button 
                    onClick={() => setDiagSheetOpen(false)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold px-2"
                    data-testid="diag-close-button"
                  >
                    ×
                  </button>
                </div>
                
                <div className="p-4 space-y-3">
                  {/* Current Map State */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Current Map State</div>
                    <div className="text-sm"><span className="text-gray-500">Zoom:</span> <strong className="text-lg">{map.current?.getZoom() ?? '-'}</strong></div>
                    <div className="text-sm"><span className="text-gray-500">Center:</span> <strong>{map.current ? `${map.current.getCenter().lat.toFixed(5)}, ${map.current.getCenter().lng.toFixed(5)}` : '-'}</strong></div>
                  </div>
                  
                  {/* Last Gesture Events */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Last Gesture Events</div>
                    <div className="text-sm space-y-1">
                      <div><span className="text-gray-500">Zoomstart:</span> {governorDiag.lastZoomstartTime ? new Date(governorDiag.lastZoomstartTime).toLocaleTimeString() : 'none'}</div>
                      <div><span className="text-gray-500">Zoomend:</span> {governorDiag.lastZoomendTime ? new Date(governorDiag.lastZoomendTime).toLocaleTimeString() : 'none'}</div>
                      {governorDiag.lastZoomendZoom !== null && (
                        <div className="ml-4 text-gray-600 dark:text-gray-400">
                          → zoom={governorDiag.lastZoomendZoom}, center={governorDiag.lastZoomendCenter}
                        </div>
                      )}
                      <div><span className="text-gray-500">Moveend:</span> {governorDiag.lastMoveendTime ? new Date(governorDiag.lastMoveendTime).toLocaleTimeString() : 'none'}</div>
                    </div>
                  </div>
                  
                  {/* Snap-Back Detection (Critical) */}
                  <div className={`p-3 rounded-lg ${governorDiag.forcedViewDetected ? 'bg-red-100 dark:bg-red-900 border-2 border-red-500' : 'bg-green-100 dark:bg-green-900 border-2 border-green-500'}`}>
                    <div className="font-bold text-base mb-2">
                      Forced View After Pinch Zoom: {governorDiag.forcedViewDetected ? '⚠️ YES' : '✅ NO'}
                    </div>
                    {governorDiag.forcedViewDetected && (
                      <div className="space-y-1 text-sm">
                        <div><span className="text-gray-600 dark:text-gray-400">Method:</span> <strong className="text-red-700 dark:text-red-300 text-base">{governorDiag.forcedViewMethod}</strong></div>
                        <div><span className="text-gray-600 dark:text-gray-400">Delay after zoomend:</span> <strong className="text-red-700 dark:text-red-300 text-base">{governorDiag.forcedViewDelay}ms</strong></div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">Args: {governorDiag.forcedViewArgs}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Recent Log Lines */}
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-h-40 overflow-y-auto">
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Recent Events ({governorDiag.logLines.length})</div>
                    {governorDiag.logLines.length === 0 ? (
                      <div className="text-gray-400 italic text-sm">No events yet. Pinch-zoom to test.</div>
                    ) : (
                      governorDiag.logLines.slice(-8).map((line, i) => (
                        <div key={i} className="text-gray-600 dark:text-gray-400 text-xs font-mono break-all py-0.5">{line}</div>
                      ))
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCopyReport}
                      className={`flex-1 px-4 py-3 rounded-lg font-bold text-base transition-colors ${copySuccess ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                      data-testid="copy-report-button"
                    >
                      {copySuccess ? '✓ Copied!' : '📋 Copy Report'}
                    </button>
                    <button
                      onClick={handleResetLog}
                      className="px-4 py-3 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-bold text-base"
                      data-testid="reset-log-button"
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading interactive map...</p>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .incident-marker-icon {
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-container {
          border-radius: 8px;
        }
        .custom-marker {
          background: none;
          border: none;
        }
      `}</style>
    </div>
  );
}