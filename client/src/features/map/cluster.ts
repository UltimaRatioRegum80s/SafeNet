import L from "leaflet";
import "leaflet.markercluster";
import { Flags } from "@/lib/flags";

// Keep one instance across the map page lifecycle
let _cluster: L.MarkerClusterGroup | null = null;

export function createClusterGroup(): L.MarkerClusterGroup {
  if (_cluster) return _cluster;

  _cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 17,
    maxClusterRadius: 48,
    removeOutsideVisibleBounds: !Flags.fixMobileMarkers, // safer on mobile init; OK with ~50 markers
    // style cluster icon based on children states
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      const markers = cluster.getAllChildMarkers() as L.Marker[];
      let hasOptimistic = false;
      let hasOffline = false;

      for (const m of markers) {
        const flags = (m as any).nnFlags as { optimistic?: boolean; offline?: boolean } | undefined;
        if (flags?.optimistic) hasOptimistic = true;
        if (flags?.offline) hasOffline = true;
        if (hasOptimistic && hasOffline) break;
      }

      const classes = ["nn-cluster"];
      if (hasOptimistic) classes.push("nn-cluster--optimistic");
      if (hasOffline) classes.push("nn-cluster--offline");

      return L.divIcon({
        html: `<div class="nn-cluster__inner"><span>${count}</span></div>`,
        className: classes.join(" "),
        iconSize: [40, 40],
      });
    },
  });

  return _cluster!;
}

export function getClusterGroup(): L.MarkerClusterGroup | null {
  return _cluster;
}

export function refreshClusterFor(marker?: L.Marker) {
  const c = getClusterGroup();
  if (!c) return;
  // refreshClusters exists on markercluster; refresh what changed (faster than full redraw)
  (c as any).refreshClusters?.(marker ? [marker] : undefined);
}