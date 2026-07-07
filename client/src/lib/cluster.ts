import L from "leaflet";
import "leaflet.markercluster";

// 🔒 NRP Guardrails
const NRP_UNIFY_CLUSTER = true;

let _cluster: L.MarkerClusterGroup | null = null;

export function ensureCluster(map: L.Map) {
  if (NRP_UNIFY_CLUSTER) {
    // Forward to severity-aware cluster from features
    const { createClusterGroup } = require("@/features/map/cluster");
    const cluster = createClusterGroup();
    if (!map.hasLayer(cluster)) {
      map.addLayer(cluster);
    }
    return cluster;
  }

  // Original behavior
  if (!_cluster) {
    _cluster = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 17,
    });
    map.addLayer(_cluster);
    (window as any).__nnCluster = _cluster;
  }
  return _cluster;
}

export function getCluster() {
  return _cluster;
}

// Refresh cluster for a specific marker (stub implementation)
export function refreshClusterFor(marker: L.Marker) {
  if (_cluster && marker) {
    // Simple cluster refresh - remove and re-add marker
    _cluster.refreshClusters?.();
  }
}