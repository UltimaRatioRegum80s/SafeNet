import L from "leaflet";
import { renderPopupHTML, PopupData } from "./popup";
import { createClusterGroup } from "./cluster";

// Registry for tracking markers
const markerRegistry = new Map<string, L.Marker>();

type CreateMarkerOpts = {
  id: string;
  type: string;
  lat: number;
  lng: number;
  description?: string;
  severity?: string;
  optimistic?: boolean;
  offline?: boolean;
  target?: L.LayerGroup | L.Map;
};

export function createIncidentMarker(opts: CreateMarkerOpts): L.Marker | null {
  const { id, type, lat, lng, description, severity, optimistic, offline, target } = opts;
  
  // Filter out probe incidents so they never render on map
  if (type === "__probe__" || opts.type === "__probe__" || (opts as any)?.metadata?.probe) {
    return null;
  }
  
  // remove any optimistic dot for this id when real incident arrives
  (window as any).__nnRemoveSimpleDot?.(id);
  
  // Map incident types to icons - aligned with backend incidentTypes.ts
  const iconMap: Record<string, string> = {
    // Match exact incident type IDs from incidentTypes.ts
    car_accident: "/attached_assets/1_1755387124843.png",
    accident: "/attached_assets/1_1755387124843.png", // Fix: map accident to car_accident icon
    emergency_alarm: "/attached_assets/2_1755387124844.png", 
    break_in_burglary: "/attached_assets/3_1755387124844.png",
    break_in: "/attached_assets/3_1755387124844.png", // Fix: map break_in to break_in_burglary icon
    construction: "/attached_assets/4_1755387124845.png",
    fire: "/attached_assets/5_1755387124845.png",
    help: "/attached_assets/6_1755387124846.png", // Fixed: was "sos_need_help"
    lost_pet: "/attached_assets/7_1755387124846.png",
    suspicious_person: "/attached_assets/8_1755387124846.png",
    suspicious_persons: "/attached_assets/8_1755387124846.png", // Fix: map suspicious_persons to suspicious_person icon
    hit_and_run: "/attached_assets/9_1755387124847.png",
    traffic_issue: "/attached_assets/10_1755387124847.png",
    lost_and_found: "/attached_assets/11_1755387124848.png",
    violence: "/attached_assets/12_1755387124849.png", // Fixed: was "violence_fight"
    // Add missing critical incident types
    gun_shots: "/attached_assets/2_1755387124844.png", // Use emergency alarm icon
    medical: "/attached_assets/6_1755387124846.png", // Use SOS icon for medical
    theft: "/attached_assets/3_1755387124844.png", // Use break-in icon for theft
  };

  const iconUrl = iconMap[type] || "/attached_assets/1_1755387124843.png"; // fallback
  const classes = ["nn-marker"];
  if (optimistic) classes.push("nn-marker--optimistic");
  if (offline) classes.push("nn-marker--offline");
  
  // Add severity-based styling class
  if (severity) {
    classes.push(`nn-marker--${severity}`);
  }

  const badgeText = offline ? "⏳" : optimistic ? "⚡" : "";

  const html = `
    <div class="${classes.join(" ")}" data-id="${id}">
      <img class="nn-marker__img" src="${iconUrl}" alt="${type}" />
      ${badgeText ? `<span class="nn-marker__badge">${badgeText}</span>` : ""}
    </div>
  `;

  const divIcon = L.divIcon({
    html,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -28],
  });

  const marker = L.marker([lat, lng], { icon: divIcon });
  (marker as any).nnFlags = { optimistic: !!optimistic, offline: !!offline };
  (marker as any).nnData = { id, type, severity, description, lat, lng } as PopupData;

  // bind popup with smart content
  marker.bindPopup(() => renderPopupHTML((marker as any).nnData));

  // Directly add to target layer or cluster
  const defaultCluster = createClusterGroup();
  const layer = target ?? defaultCluster ?? undefined;
  
  if (layer) {
    console.log(`Adding marker to layer: ${id} at ${lat}, ${lng}`);
    (layer as L.LayerGroup).addLayer(marker);
  } else {
    console.warn(`No layer available for marker: ${id}`);
  }

  markerRegistry.set(id, marker);
  return marker;
}

export function updateMarkerFlags(
  id: string,
  flags: { optimistic?: boolean; offline?: boolean }
) {
  const marker = markerRegistry.get(id);
  if (!marker) return;
  (marker as any).nnFlags = { ...(marker as any).nnFlags, ...flags };

  // update DOM classes if icon is present
  const el = (marker as any)._icon as HTMLElement | null;
  if (el) {
    el.classList.toggle("nn-marker--optimistic", !!(marker as any).nnFlags.optimistic);
    el.classList.toggle("nn-marker--offline", !!(marker as any).nnFlags.offline);
    const wantBadge = (marker as any).nnFlags.optimistic || (marker as any).nnFlags.offline;
    let badge = el.querySelector(".nn-marker__badge") as HTMLSpanElement | null;
    if (wantBadge && !badge) {
      badge = document.createElement("span");
      badge.className = "nn-marker__badge";
      el.appendChild(badge);
    }
    if (!wantBadge && badge) badge.remove();
    else if (badge) badge.textContent = (marker as any).nnFlags.offline ? "⏳" : "⚡";
  }
  // Refresh cluster if needed
  const cluster = createClusterGroup();
  if (cluster && typeof cluster.refreshClusters === 'function') {
    cluster.refreshClusters();
  }
}

export function updateMarkerData(id: string, data: Partial<PopupData>) {
  const marker = markerRegistry.get(id);
  if (!marker) return;
  (marker as any).nnData = { ...(marker as any).nnData, ...data };
  if (marker.isPopupOpen()) marker.setPopupContent(renderPopupHTML((marker as any).nnData));
}

export function replaceMarkerId(tempId: string, newId: string) {
  const marker = markerRegistry.get(tempId);
  if (!marker) return;
  markerRegistry.delete(tempId);
  markerRegistry.set(newId, marker);

  (marker as any).nnData.id = newId;
  const el = (marker as any)._icon as HTMLElement | null;
  if (el) el.setAttribute("data-id", newId);
  // Refresh cluster if needed
  const cluster = createClusterGroup();
  if (cluster && typeof cluster.refreshClusters === 'function') {
    cluster.refreshClusters();
  }
}

export function getMarkerById(id: string) {
  return markerRegistry.get(id) ?? null;
}

export { markerRegistry };