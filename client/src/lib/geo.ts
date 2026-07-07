export type LngLat = { lng: number; lat: number };

/** Southern Africa rough bounds (adjust as needed) */
export const SA_BOUNDS = {
  minLat: -35, maxLat: -10,
  minLng:  10, maxLng:  40,
};

export function inSouthernAfrica({ lat, lng }: { lat: number; lng: number }) {
  return (
    lat >= SA_BOUNDS.minLat && lat <= SA_BOUNDS.maxLat &&
    lng >= SA_BOUNDS.minLng && lng <= SA_BOUNDS.maxLng
  );
}

export function fmtCoord(n: number) {
  return n.toFixed(5);
}

/**
 * Pixel-grid snap:
 *  - Snap click to an N-pixel grid in screen space, then convert back to lat/lng.
 *  - This gives a pleasant "snap near feature" feel without querying rendered features.
 *  - Works with Leaflet at any zoom; gridPx ~ 8–16 feels good.
 */
export function pixelGridSnap(map: any, lng: number, lat: number, gridPx = 12) {
  if (!map?.containerPointToLatLng || !map?.latLngToContainerPoint) return { lng, lat };
  const p = map.latLngToContainerPoint({ lat, lng });
  const snapped = {
    x: Math.round(p.x / gridPx) * gridPx,
    y: Math.round(p.y / gridPx) * gridPx,
  };
  const ll = map.containerPointToLatLng(snapped);
  return { lng: ll.lng, lat: ll.lat };
}